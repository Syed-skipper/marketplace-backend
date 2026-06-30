import { prisma } from '../../../config/database/prisma.client';
import { NotFoundError } from '../../../common/exceptions/errors';
import { eventBus } from '../../../common/events/event-bus';
import { DomainEventType } from '../../../common/events/domain-events';
import { buildTrackingTimeline, formatShipmentStatus } from './tracking-timeline';

export class ShippingService {
  async createShipment(orderId: string, carrier: string) {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundError('Order not found');

    const trackingNumber = `TRK-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

    const shipment = await prisma.shipment.create({
      data: { orderId, carrier, trackingNumber, status: 'LABEL_CREATED' },
    });

    await prisma.order.update({
      where: { id: orderId },
      data: { status: 'SHIPPED' },
    });

    await eventBus.publish({
      type: DomainEventType.ORDER_SHIPPED,
      payload: { orderId, trackingNumber },
      occurredAt: new Date(),
    });

    return shipment;
  }

  async updateStatus(shipmentId: string, status: 'IN_TRANSIT' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'FAILED') {
    const shipment = await prisma.shipment.update({
      where: { id: shipmentId },
      data: { status },
    });

    if (status === 'DELIVERED') {
      await prisma.order.update({
        where: { id: shipment.orderId },
        data: { status: 'DELIVERED' },
      });
    }

    return shipment;
  }

  async track(trackingNumber: string) {
    const shipment = await prisma.shipment.findFirst({
      where: { trackingNumber },
      include: { order: { select: { id: true, orderNumber: true, status: true, createdAt: true } } },
    });
    if (!shipment) throw new NotFoundError('Shipment not found');

    const { events, estimatedDelivery } = buildTrackingTimeline(shipment);

    return {
      id: shipment.id,
      orderId: shipment.orderId,
      trackingNumber: shipment.trackingNumber,
      carrier: shipment.carrier,
      status: shipment.status,
      statusLabel: formatShipmentStatus(shipment.status),
      createdAt: shipment.createdAt,
      updatedAt: shipment.updatedAt,
      estimatedDelivery,
      events,
      order: shipment.order,
    };
  }
}
