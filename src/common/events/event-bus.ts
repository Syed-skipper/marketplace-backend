import { DomainEvent, DomainEventType } from './domain-events';
import { logger } from '../utils/logger';

type EventHandler<T = Record<string, unknown>> = (event: DomainEvent<T>) => void | Promise<void>;

class EventBus {
  private handlers = new Map<DomainEventType, EventHandler[]>();

  subscribe<T>(type: DomainEventType, handler: EventHandler<T>): void {
    const existing = this.handlers.get(type) ?? [];
    existing.push(handler as EventHandler);
    this.handlers.set(type, existing);
  }

  async publish<T extends Record<string, unknown>>(event: DomainEvent<T>): Promise<void> {
    logger.info('Domain event published', {
      type: event.type,
      correlationId: event.correlationId,
    });

    const handlers = this.handlers.get(event.type) ?? [];
    await Promise.allSettled(
      handlers.map(async (handler) => {
        try {
          await handler(event);
        } catch (err) {
          logger.error('Event handler failed', { type: event.type, error: err });
        }
      }),
    );
  }
}

export const eventBus = new EventBus();
