import { OrderStatus } from '@prisma/client';
import { DomainError } from '../../../common/exceptions/errors';

const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ['PAYMENT_PENDING', 'CANCELLED'],
  PAYMENT_PENDING: ['PAID', 'CANCELLED'],
  PAID: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
  REFUNDED: [],
};

export class OrderStateMachine {
  constructor(private readonly currentStatus: OrderStatus) {}

  canTransitionTo(next: OrderStatus): boolean {
    return VALID_TRANSITIONS[this.currentStatus]?.includes(next) ?? false;
  }

  transitionTo(next: OrderStatus): OrderStatus {
    if (!this.canTransitionTo(next)) {
      throw new DomainError(
        `Invalid order transition from ${this.currentStatus} to ${next}`,
      );
    }
    return next;
  }

  static getAllowedTransitions(status: OrderStatus): OrderStatus[] {
    return VALID_TRANSITIONS[status] ?? [];
  }
}
