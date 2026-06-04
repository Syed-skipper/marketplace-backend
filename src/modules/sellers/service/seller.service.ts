import type { OrderStatus, Prisma } from '@prisma/client';
import { prisma } from '../../../config/database/prisma.client';
import { ConflictError, NotFoundError } from '../../../common/exceptions/errors';
import { eventBus } from '../../../common/events/event-bus';
import { DomainEventType } from '../../../common/events/domain-events';
import { InventoryService } from '../../inventory/service/inventory.service';

const REVENUE_ORDER_STATUSES: OrderStatus[] = ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED'];
const LOW_STOCK_THRESHOLD = 5;
const DEFAULT_RESTOCK_QUANTITY = 50;

export type SellerDashboardPeriod = '7d' | '30d' | '90d';

function periodRange(period: SellerDashboardPeriod) {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date(end);
  const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
  start.setDate(start.getDate() - (days - 1));
  start.setHours(0, 0, 0, 0);

  const priorEnd = new Date(start);
  priorEnd.setMilliseconds(-1);
  const priorStart = new Date(priorEnd);
  priorStart.setDate(priorStart.getDate() - (days - 1));
  priorStart.setHours(0, 0, 0, 0);

  return { start, end, priorStart, priorEnd, days };
}

function sellerItemRevenue(items: { price: Prisma.Decimal; quantity: number }[]) {
  return items.reduce((sum, i) => sum + Number(i.price) * i.quantity, 0);
}

function sellerItemVolume(items: { quantity: number }[]) {
  return items.reduce((sum, i) => sum + i.quantity, 0);
}

function pctChange(current: number, previous: number) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

function formatPct(n: number) {
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(1)}%`;
}

export class SellerService {
  async register(userId: string, data: {
    businessName: string;
    businessEmail: string;
    gstNumber?: string;
    documents?: object;
  }) {
    const existing = await prisma.seller.findUnique({ where: { userId } });
    if (existing) throw new ConflictError('Seller profile already exists');

    const seller = await prisma.seller.create({
      data: {
        userId,
        businessName: data.businessName,
        businessEmail: data.businessEmail,
        gstNumber: data.gstNumber,
        documents: data.documents,
        status: 'PENDING',
      },
    });

    await prisma.userRole.upsert({
      where: { userId_roleId: { userId, roleId: (await prisma.role.findUnique({ where: { name: 'seller' } }))!.id } },
      update: {},
      create: {
        userId,
        roleId: (await prisma.role.findUnique({ where: { name: 'seller' } }))!.id,
      },
    });

    await eventBus.publish({
      type: DomainEventType.SELLER_CREATED,
      payload: { sellerId: seller.id, userId },
      occurredAt: new Date(),
    });

    return seller;
  }

  async approve(sellerId: string, adminId: string) {
    const seller = await prisma.seller.update({
      where: { id: sellerId },
      data: { status: 'APPROVED', approvedBy: adminId, approvedAt: new Date() },
    });

    await eventBus.publish({
      type: DomainEventType.SELLER_APPROVED,
      payload: { sellerId, userId: seller.userId },
      occurredAt: new Date(),
    });

    return seller;
  }

  async reject(sellerId: string, note: string) {
    return prisma.seller.update({
      where: { id: sellerId },
      data: { status: 'REJECTED', rejectionNote: note },
    });
  }

  async getByUserId(userId: string) {
    const seller = await prisma.seller.findUnique({ where: { userId } });
    if (!seller) throw new NotFoundError('Seller not found');
    return seller;
  }

  async listPending(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      prisma.seller.findMany({
        where: { status: 'PENDING' },
        skip,
        take: limit,
        include: { user: { select: { email: true, firstName: true, lastName: true } } },
      }),
      prisma.seller.count({ where: { status: 'PENDING' } }),
    ]);
    return { items, total };
  }

  private async ordersInRange(
    sellerId: string,
    start: Date,
    end: Date,
  ) {
    return prisma.order.findMany({
      where: {
        createdAt: { gte: start, lte: end },
        status: { in: REVENUE_ORDER_STATUSES },
        items: { some: { sellerId } },
      },
      orderBy: { createdAt: 'asc' },
      include: { items: { where: { sellerId } } },
    });
  }

  private buildChart(
    period: SellerDashboardPeriod,
    orders: Awaited<ReturnType<SellerService['ordersInRange']>>,
  ) {
    const { start, days } = periodRange(period);
    const buckets: { label: string; revenue: number; volume: number }[] = [];

    if (period === '7d') {
      for (let i = 0; i < 7; i++) {
        const d = new Date(start);
        d.setDate(d.getDate() + i);
        buckets.push({
          label: d.toLocaleDateString('en-US', { weekday: 'short' }),
          revenue: 0,
          volume: 0,
        });
      }
      for (const order of orders) {
        const idx = Math.floor(
          (new Date(order.createdAt).setHours(0, 0, 0, 0) - start.getTime()) / 86_400_000,
        );
        if (idx >= 0 && idx < 7) {
          buckets[idx].revenue += sellerItemRevenue(order.items);
          buckets[idx].volume += sellerItemVolume(order.items);
        }
      }
      return buckets;
    }

    if (period === '30d') {
      const chunk = 5;
      const count = Math.ceil(days / chunk);
      for (let i = 0; i < count; i++) {
        const from = new Date(start);
        from.setDate(from.getDate() + i * chunk);
        const to = new Date(from);
        to.setDate(to.getDate() + chunk - 1);
        buckets.push({
          label: `${from.getDate()}-${to.getDate()}`,
          revenue: 0,
          volume: 0,
        });
      }
      for (const order of orders) {
        const idx = Math.floor(
          (new Date(order.createdAt).setHours(0, 0, 0, 0) - start.getTime()) / 86_400_000 / chunk,
        );
        if (idx >= 0 && idx < buckets.length) {
          buckets[idx].revenue += sellerItemRevenue(order.items);
          buckets[idx].volume += sellerItemVolume(order.items);
        }
      }
      return buckets;
    }

    const weeks = 12;
    for (let i = 0; i < weeks; i++) {
      const from = new Date(start);
      from.setDate(from.getDate() + i * 7);
      buckets.push({
        label: from.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        revenue: 0,
        volume: 0,
      });
    }
    for (const order of orders) {
      const idx = Math.floor(
        (new Date(order.createdAt).setHours(0, 0, 0, 0) - start.getTime()) / (7 * 86_400_000),
      );
      if (idx >= 0 && idx < weeks) {
        buckets[idx].revenue += sellerItemRevenue(order.items);
        buckets[idx].volume += sellerItemVolume(order.items);
      }
    }
    return buckets;
  }

  async getDashboard(sellerId: string, period: SellerDashboardPeriod = '30d') {
    const { start, end, priorStart, priorEnd } = periodRange(period);

    const [currentOrders, priorOrders, recentOrders, productCount, lowStockVariants] =
      await Promise.all([
        this.ordersInRange(sellerId, start, end),
        this.ordersInRange(sellerId, priorStart, priorEnd),
        prisma.order.findMany({
          where: { items: { some: { sellerId } } },
          take: 8,
          orderBy: { createdAt: 'desc' },
          include: { items: { where: { sellerId }, include: { product: { select: { name: true } } } } },
        }),
        prisma.product.count({ where: { sellerId } }),
        prisma.productVariant.findMany({
          where: {
            product: { sellerId, status: 'ACTIVE' },
            inventory: {
              availableStock: { gt: 0, lt: LOW_STOCK_THRESHOLD },
            },
          },
          take: 5,
          orderBy: { inventory: { availableStock: 'asc' } },
          include: {
            product: { select: { name: true } },
            inventory: { select: { availableStock: true } },
          },
        }),
      ]);

    const revenue = currentOrders.reduce((s, o) => s + sellerItemRevenue(o.items), 0);
    const priorRevenue = priorOrders.reduce((s, o) => s + sellerItemRevenue(o.items), 0);
    const orderCount = currentOrders.length;
    const priorOrderCount = priorOrders.length;

    const lowStockCount = await prisma.productVariant.count({
      where: {
        product: { sellerId, status: 'ACTIVE' },
        inventory: { availableStock: { gt: 0, lt: LOW_STOCK_THRESHOLD } },
      },
    });

    const chart = this.buildChart(period, currentOrders);

    const inventoryAlerts: Array<{
      id: string;
      variantId: string;
      variant: 'error' | 'info' | 'success';
      icon: string;
      title: string;
      description: string;
      action?: string;
    }> = lowStockVariants.map((v) => ({
      id: v.id,
      variantId: v.id,
      variant: 'error' as const,
      icon: 'warning',
      title: `Low Stock: ${v.product.name}`,
      description: `${v.inventory?.availableStock ?? 0} units remaining`,
      action: 'Restock',
    }));

    if (inventoryAlerts.length === 0) {
      inventoryAlerts.push({
        id: 'optimized',
        variantId: '',
        variant: 'success',
        icon: 'check_circle',
        title: 'Inventory Optimized',
        description: 'No critical actions needed.',
      });
    }

    const revenueChange = pctChange(revenue, priorRevenue);
    const orderChange = pctChange(orderCount, priorOrderCount);

    return {
      period,
      kpis: {
        revenue,
        revenueChangePct: revenueChange,
        orderCount,
        orderChangePct: orderChange,
        productCount,
        lowStockCount,
      },
      chart,
      inventoryAlerts,
      recentOrders: recentOrders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        createdAt: o.createdAt,
        sellerTotal: sellerItemRevenue(o.items),
        itemCount: o.items.reduce((s, i) => s + i.quantity, 0),
      })),
      periodLabels: {
        '7d': 'Last 7 Days',
        '30d': 'Last 30 Days',
        '90d': 'Last 90 Days',
      },
      badges: {
        revenue: formatPct(revenueChange),
        orders: formatPct(orderChange),
      },
    };
  }

  async exportDashboardCsv(sellerId: string, period: SellerDashboardPeriod = '30d') {
    const { start, end } = periodRange(period);
    const orders = await prisma.order.findMany({
      where: {
        createdAt: { gte: start, lte: end },
        items: { some: { sellerId } },
      },
      orderBy: { createdAt: 'desc' },
      take: 10_000,
      include: { items: { where: { sellerId } } },
    });

    const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const header = ['Order Number', 'Date', 'Status', 'Seller Revenue', 'Units Sold'].join(',');
    const rows = orders.map((o) => {
      const rev = sellerItemRevenue(o.items);
      const units = sellerItemVolume(o.items);
      return [
        escape(o.orderNumber),
        escape(o.createdAt.toISOString()),
        escape(o.status),
        escape(rev.toFixed(2)),
        escape(String(units)),
      ].join(',');
    });

    const paidRevenue = orders
      .filter((o) => REVENUE_ORDER_STATUSES.includes(o.status))
      .reduce((s, o) => s + sellerItemRevenue(o.items), 0);

    const summaryRows = [
      '',
      ['Summary', 'Value'].join(','),
      ['Period', period].map(escape).join(','),
      ['Total Orders', String(orders.length)].map(escape).join(','),
      ['Recognized Revenue', paidRevenue.toFixed(2)].map(escape).join(','),
    ];

    return [header, ...rows, ...summaryRows].join('\n');
  }

  async restockVariant(sellerId: string, variantId: string, quantity = DEFAULT_RESTOCK_QUANTITY) {
    const variant = await prisma.productVariant.findUnique({
      where: { id: variantId },
      include: { product: true, inventory: true },
    });
    if (!variant || variant.product.sellerId !== sellerId) {
      throw new NotFoundError('Variant not found');
    }

    const current = variant.inventory?.availableStock ?? 0;
    const inventoryService = new InventoryService();
    const updated = await inventoryService.updateStock(variantId, current + quantity);
    return {
      variantId,
      previousStock: current,
      availableStock: updated.availableStock,
      added: quantity,
    };
  }
}
