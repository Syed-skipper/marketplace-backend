import type { OrderStatus, Prisma } from '@prisma/client';
import { prisma } from '../../../config/database/prisma.client';
import { NotFoundError } from '../../../common/exceptions/errors';
import { parsePagination } from '../../../common/types/pagination.types';
import { OrderService } from '../../orders/service/order.service';

export type SellerOrderListFilter =
  | 'all'
  | 'pending'
  | 'packed'
  | 'shipped'
  | 'delivered'
  | 'cancelled';

export type SellerOrdersListQuery = {
  page?: number;
  limit?: number;
  search?: string;
  status?: SellerOrderListFilter;
};

const FILTER_STATUSES: Record<Exclude<SellerOrderListFilter, 'all'>, OrderStatus[]> = {
  pending: ['PENDING', 'PAYMENT_PENDING', 'PAID'],
  packed: ['PROCESSING'],
  shipped: ['SHIPPED'],
  delivered: ['DELIVERED'],
  cancelled: ['CANCELLED', 'REFUNDED'],
};

function orderInclude(sellerId: string) {
  return {
    user: { select: { id: true, email: true, firstName: true, lastName: true } },
    items: {
      where: { sellerId },
      include: {
        product: { include: { images: { orderBy: { sortOrder: 'asc' as const }, take: 1 } } },
        variant: { select: { sku: true } },
      },
    },
    shipments: { select: { trackingNumber: true, carrier: true, status: true } },
    payments: { select: { status: true, amount: true } },
  };
}

function sellerItemsWhere(sellerId: string): Prisma.OrderWhereInput {
  return { items: { some: { sellerId } } };
}

function buildWhere(sellerId: string, query: SellerOrdersListQuery): Prisma.OrderWhereInput {
  const and: Prisma.OrderWhereInput[] = [sellerItemsWhere(sellerId)];

  const filter = query.status ?? 'all';
  if (filter !== 'all') {
    and.push({ status: { in: FILTER_STATUSES[filter] } });
  }

  if (query.search?.trim()) {
    const term = query.search.trim();
    and.push({
      OR: [
        { orderNumber: { contains: term, mode: 'insensitive' } },
        { user: { email: { contains: term, mode: 'insensitive' } } },
        { user: { firstName: { contains: term, mode: 'insensitive' } } },
        { user: { lastName: { contains: term, mode: 'insensitive' } } },
      ],
    });
  }

  return { AND: and };
}

function sellerLineTotal(
  items: Array<{ sellerId: string; price: Prisma.Decimal; quantity: number }>,
  sellerId: string,
): number {
  return items
    .filter((i) => i.sellerId === sellerId)
    .reduce((sum, i) => sum + Number(i.price) * i.quantity, 0);
}

export class SellerOrdersService {
  private readonly orderService = new OrderService();

  async getStats(sellerId: string) {
    const base = sellerItemsWhere(sellerId);
    const [pending, toPack, shipped, completed] = await Promise.all([
      prisma.order.count({
        where: { ...base, status: { in: FILTER_STATUSES.pending } },
      }),
      prisma.order.count({
        where: { ...base, status: { in: FILTER_STATUSES.packed } },
      }),
      prisma.order.count({
        where: { ...base, status: { in: FILTER_STATUSES.shipped } },
      }),
      prisma.order.count({
        where: { ...base, status: { in: FILTER_STATUSES.delivered } },
      }),
    ]);
    return { pending, toPack, shipped, completed };
  }

  async list(sellerId: string, query: SellerOrdersListQuery) {
    const { page, limit, skip } = parsePagination(query);
    const where = buildWhere(sellerId, query);

    const [orders, total, stats] = await Promise.all([
      prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: orderInclude(sellerId),
      }),
      prisma.order.count({ where }),
      this.getStats(sellerId),
    ]);

    const items = orders.map((order) => ({
      ...order,
      sellerSubtotal: sellerLineTotal(order.items, sellerId),
    }));

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
        stats,
      },
    };
  }

  async getById(sellerId: string, orderId: string) {
    const order = await prisma.order.findFirst({
      where: { id: orderId, ...sellerItemsWhere(sellerId) },
      include: orderInclude(sellerId),
    });
    if (!order) throw new NotFoundError('Order not found');

    return {
      ...order,
      sellerSubtotal: sellerLineTotal(order.items, sellerId),
    };
  }

  async updateStatus(sellerId: string, orderId: string, nextStatus: OrderStatus) {
    const order = await prisma.order.findFirst({
      where: { id: orderId, ...sellerItemsWhere(sellerId) },
    });
    if (!order) throw new NotFoundError('Order not found');
    return this.orderService.transitionStatus(orderId, nextStatus);
  }

  async exportCsv(sellerId: string, query: Omit<SellerOrdersListQuery, 'page' | 'limit'>) {
    const where = buildWhere(sellerId, query);
    const orders = await prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 10_000,
      include: orderInclude(sellerId),
    });

    const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const header = [
      'Order Number',
      'Customer Name',
      'Customer Email',
      'Status',
      'Seller Subtotal',
      'Order Total',
      'Created At',
      'Items',
    ].join(',');

    const rows = orders.map((order) => {
      const subtotal = sellerLineTotal(order.items, sellerId);
      const customerName = `${order.user.firstName} ${order.user.lastName}`.trim();
      const itemSummary = order.items.map((i) => `${i.product.name} x${i.quantity}`).join('; ');

      return [
        escape(order.orderNumber),
        escape(customerName),
        escape(order.user.email),
        escape(order.status),
        subtotal.toFixed(2),
        Number(order.totalAmount).toFixed(2),
        escape(order.createdAt.toISOString()),
        escape(itemSummary),
      ].join(',');
    });

    return [header, ...rows].join('\n');
  }
}
