/**
 * Ensures demo tracking data exists for a specific order (dev/demo use).
 * Run: npm run db:seed:tracking
 */
import { PrismaClient, ShipmentStatus } from '@prisma/client';

const prisma = new PrismaClient();

const DEMO_ORDER_ID = 'a7b8d666-7612-46d8-8c2b-dcddf7c3b326';
const DEMO_TRACKING_NUMBER = 'TRK-A7B8D666-DEMO';

function daysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function daysFromNow(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

async function main() {
  const order = await prisma.order.findUnique({ where: { id: DEMO_ORDER_ID } });

  if (!order) {
    console.error(`Order not found: ${DEMO_ORDER_ID}`);
    console.error('Create the order via checkout first, then re-run this script.');
    process.exit(1);
  }

  const events = [
    {
      status: 'LABEL_CREATED',
      title: 'Order packed',
      description: 'Your items were packed and the shipping label was created.',
      location: 'Bengaluru fulfillment center',
      timestamp: daysAgo(2),
      completed: true,
    },
    {
      status: 'IN_TRANSIT',
      title: 'In transit',
      description: 'Package handed to BlueDart and moving through the delivery network.',
      location: 'Chennai regional hub',
      timestamp: daysAgo(1),
      completed: true,
      current: true,
    },
    {
      status: 'OUT_FOR_DELIVERY',
      title: 'Out for delivery',
      description: 'Package is with the local courier.',
      location: 'Local delivery facility',
      timestamp: daysFromNow(0),
      completed: false,
    },
    {
      status: 'DELIVERED',
      title: 'Delivered',
      description: 'Package will be delivered to your shipping address.',
      location: 'Your address',
      timestamp: daysFromNow(1),
      completed: false,
    },
  ];

  const metadata = {
    estimatedDelivery: daysFromNow(2),
    events,
  };

  const existing = await prisma.shipment.findFirst({ where: { orderId: DEMO_ORDER_ID } });

  const shipment = existing
    ? await prisma.shipment.update({
        where: { id: existing.id },
        data: {
          trackingNumber: DEMO_TRACKING_NUMBER,
          carrier: 'BlueDart',
          status: ShipmentStatus.IN_TRANSIT,
          metadata,
        },
      })
    : await prisma.shipment.create({
        data: {
          orderId: DEMO_ORDER_ID,
          trackingNumber: DEMO_TRACKING_NUMBER,
          carrier: 'BlueDart',
          status: ShipmentStatus.IN_TRANSIT,
          metadata,
        },
      });

  if (!['SHIPPED', 'DELIVERED'].includes(order.status)) {
    await prisma.order.update({
      where: { id: DEMO_ORDER_ID },
      data: { status: 'SHIPPED' },
    });
  }

  console.log('Tracking seed complete');
  console.log(`  Order:     ${order.orderNumber} (${DEMO_ORDER_ID})`);
  console.log(`  Tracking:  ${shipment.trackingNumber}`);
  console.log(`  Carrier:   ${shipment.carrier}`);
  console.log(`  Status:    ${shipment.status}`);
  console.log(`  URL:       /orders/${DEMO_ORDER_ID}/tracking`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
