import { ShipmentStatus } from '@prisma/client';

export type TrackingTimelineEvent = {
  status: string;
  title: string;
  description: string;
  location?: string;
  timestamp: string;
  completed: boolean;
  current?: boolean;
};

type ShipmentMetadata = {
  events?: TrackingTimelineEvent[];
  estimatedDelivery?: string;
};

const TIMELINE_TEMPLATE: Array<{
  status: ShipmentStatus;
  title: string;
  description: string;
  location: string;
  dayOffset: number;
}> = [
  {
    status: 'LABEL_CREATED',
    title: 'Order packed',
    description: 'Your items were packed and the shipping label was created.',
    location: 'Seller fulfillment center',
    dayOffset: 0,
  },
  {
    status: 'IN_TRANSIT',
    title: 'In transit',
    description: 'Package handed to carrier and moving through the delivery network.',
    location: 'Regional distribution hub',
    dayOffset: 1,
  },
  {
    status: 'OUT_FOR_DELIVERY',
    title: 'Out for delivery',
    description: 'Package is with the local courier and will arrive today.',
    location: 'Local delivery facility',
    dayOffset: 3,
  },
  {
    status: 'DELIVERED',
    title: 'Delivered',
    description: 'Package delivered successfully.',
    location: 'Your address',
    dayOffset: 4,
  },
];

const STATUS_RANK: Record<string, number> = {
  PENDING: 0,
  LABEL_CREATED: 1,
  IN_TRANSIT: 2,
  OUT_FOR_DELIVERY: 3,
  DELIVERED: 4,
  FAILED: -1,
  RETURNED: -1,
};

export function buildTrackingTimeline(
  shipment: {
    status: ShipmentStatus;
    createdAt: Date;
    metadata: unknown;
  },
): { events: TrackingTimelineEvent[]; estimatedDelivery: string | null } {
  const metadata = (shipment.metadata ?? null) as ShipmentMetadata | null;

  if (metadata?.events?.length) {
    return {
      events: metadata.events,
      estimatedDelivery: metadata.estimatedDelivery ?? null,
    };
  }

  const currentRank = STATUS_RANK[shipment.status] ?? 0;
  const baseDate = shipment.createdAt;

  const events = TIMELINE_TEMPLATE.map((step) => {
    const eventDate = new Date(baseDate);
    eventDate.setDate(eventDate.getDate() + step.dayOffset);
    const rank = STATUS_RANK[step.status] ?? 0;
    const completed = currentRank >= rank && currentRank >= 0;
    const current = shipment.status === step.status;

    return {
      status: step.status,
      title: step.title,
      description: step.description,
      location: step.location,
      timestamp: eventDate.toISOString(),
      completed,
      current,
    };
  });

  const estimated = new Date(baseDate);
  estimated.setDate(estimated.getDate() + 5);

  return {
    events,
    estimatedDelivery: metadata?.estimatedDelivery ?? estimated.toISOString(),
  };
}

export function formatShipmentStatus(status: string) {
  return status.replace(/_/g, ' ');
}
