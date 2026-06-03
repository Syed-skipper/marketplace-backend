import { prisma } from '../../../config/database/prisma.client';
import { NotFoundError, DomainError } from '../../../common/exceptions/errors';
import { OrderStateMachine } from '../entity/order-state.machine';
import { InventoryService } from '../../inventory/service/inventory.service';
import { eventBus } from '../../../common/events/event-bus';
import { DomainEventType } from '../../../common/events/domain-events';
import { OrderStatus, Prisma } from '@prisma/client';
import { parsePagination } from '../../../common/types/pagination.types';

export class OrderService {
  constructor(private readonly inventory = new InventoryService()) {}

  private generateOrderNumber(): string {
    return `ORD-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  }

  async createFromCart(userId: string, shippingAddress: Record<string, unknown>) {
    const cart = await prisma.cart.findUnique({
      where: { userId },
      include: {
        items: {
          include: {
            variant: { include: { product: true } },
          },
        },
      },
    });

    if (!cart?.items.length) throw new DomainError('Cart is empty');

    let subtotal = 0;
    const orderItems = cart.items.map((item) => {
      const price = Number(item.variant.discountPrice ?? item.variant.price);
      subtotal += price * item.quantity;
      return {
        productId: item.variant.productId,
        sellerId: item.variant.product.sellerId,
        variantId: item.variantId,
        price,
        quantity: item.quantity,
      };
    });

    const tax = subtotal * 0.18;
    const shippingFee = 50;
    const totalAmount = subtotal + tax + shippingFee;

    const order = await prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          orderNumber: this.generateOrderNumber(),
          userId,
          status: 'PAYMENT_PENDING',
          subtotal,
          tax,
          shippingFee,
          totalAmount,
          shippingAddress: shippingAddress as Prisma.InputJsonValue,
          items: { create: orderItems },
        },
        include: { items: true },
      });

      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
      return created;
    });

    await eventBus.publish({
      type: DomainEventType.ORDER_CREATED,
      payload: { orderId: order.id, userId },
      occurredAt: new Date(),
    });

    return order;
  }

  async transitionStatus(orderId: string, nextStatus: OrderStatus) {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundError('Order not found');

    const sm = new OrderStateMachine(order.status);
    const newStatus = sm.transitionTo(nextStatus);

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: { status: newStatus, version: { increment: 1 } },
      include: { items: true, payments: true, shipments: true },
    });

    if (newStatus === 'PAID') {
      for (const item of updated.items) {
        await this.inventory.deductStock(item.variantId, item.quantity, orderId);
      }
      await eventBus.publish({
        type: DomainEventType.ORDER_PAID,
        payload: { orderId },
        occurredAt: new Date(),
      });
    }

    if (newStatus === 'CANCELLED') {
      for (const item of updated.items) {
        await this.inventory.releaseStock(item.variantId, item.quantity, orderId);
      }
      await eventBus.publish({
        type: DomainEventType.ORDER_CANCELLED,
        payload: { orderId },
        occurredAt: new Date(),
      });
    }

    return updated;
  }

  async getById(orderId: string, userId?: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: { include: { product: true, variant: true } }, payments: true, shipments: true },
    });
    if (!order) throw new NotFoundError('Order not found');
    if (userId && order.userId !== userId) throw new NotFoundError('Order not found');
    return order;
  }

  async listForUser(userId: string, query: Record<string, unknown>) {
    const { page, limit, skip } = parsePagination(query as { page?: number; limit?: number });
    const [items, total] = await Promise.all([
      prisma.order.findMany({
        where: { userId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { items: true },
      }),
      prisma.order.count({ where: { userId } }),
    ]);
    return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async listForSeller(sellerId: string, query: Record<string, unknown>) {
    const { page, limit, skip } = parsePagination(query as { page?: number; limit?: number });
    const [items, total] = await Promise.all([
      prisma.order.findMany({
        where: { items: { some: { sellerId } } },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { items: { where: { sellerId } } },
      }),
      prisma.order.count({ where: { items: { some: { sellerId } } } }),
    ]);
    return { items, meta: { page, limit, total } };
  }
}
