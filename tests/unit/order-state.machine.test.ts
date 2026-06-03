import { OrderStateMachine } from '../../src/modules/orders/entity/order-state.machine';
import { DomainError } from '../../src/common/exceptions/errors';

describe('OrderStateMachine', () => {
  it('allows PENDING -> PAYMENT_PENDING', () => {
    const sm = new OrderStateMachine('PENDING');
    expect(sm.canTransitionTo('PAYMENT_PENDING')).toBe(true);
    expect(sm.transitionTo('PAYMENT_PENDING')).toBe('PAYMENT_PENDING');
  });

  it('allows PAYMENT_PENDING -> PAID', () => {
    const sm = new OrderStateMachine('PAYMENT_PENDING');
    expect(sm.transitionTo('PAID')).toBe('PAID');
  });

  it('rejects invalid PENDING -> SHIPPED', () => {
    const sm = new OrderStateMachine('PENDING');
    expect(() => sm.transitionTo('SHIPPED')).toThrow(DomainError);
  });

  it('rejects DELIVERED -> any', () => {
    const sm = new OrderStateMachine('DELIVERED');
    expect(sm.canTransitionTo('CANCELLED')).toBe(false);
  });
});
