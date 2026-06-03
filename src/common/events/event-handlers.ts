import { eventBus } from './event-bus';
import { DomainEventType } from './domain-events';
import { prisma } from '../../config/database/prisma.client';
import { logger } from '../utils/logger';

eventBus.subscribe(DomainEventType.ORDER_CREATED, async (event) => {
  const { userId, orderId } = event.payload as { userId: string; orderId: string };
  await prisma.notification.create({
    data: {
      userId,
      type: 'ORDER_CREATED',
      title: 'Order Placed',
      message: `Your order ${orderId} has been created.`,
      metadata: { orderId },
    },
  });
});

eventBus.subscribe(DomainEventType.ORDER_PAID, async (event) => {
  const { orderId } = event.payload as { orderId: string };
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return;
  await prisma.notification.create({
    data: {
      userId: order.userId,
      type: 'ORDER_PAID',
      title: 'Payment Received',
      message: `Payment confirmed for order ${order.orderNumber}.`,
    },
  });
});

eventBus.subscribe(DomainEventType.SELLER_APPROVED, async (event) => {
  const { userId } = event.payload as { userId: string };
  await prisma.notification.create({
    data: {
      userId,
      type: 'SELLER_APPROVED',
      title: 'Seller Approved',
      message: 'Your seller account has been approved. You can now list products.',
    },
  });
});

logger.info('Event handlers registered');
