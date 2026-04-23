// @def.boundary nest-service-port-contract
// @def.doc nest-service-port-contract

import type { EventEnvelope } from "./event-envelope.js";

export abstract class EventPublisherPort {
  abstract publish<TPayload extends Record<string, unknown>>(
    envelope: EventEnvelope<TPayload>,
  ): Promise<void>;
}

export abstract class MessageBusPort {
  abstract publish<TPayload extends Record<string, unknown>>(
    topic: string,
    envelope: EventEnvelope<TPayload>,
  ): Promise<void>;
}

export abstract class OutboxStorePort {
  abstract append<TPayload extends Record<string, unknown>>(
    envelope: EventEnvelope<TPayload>,
  ): Promise<void>;
}

export abstract class UnitOfWorkPort {
  abstract runInTransaction<T>(work: () => Promise<T>): Promise<T>;
}

export class NoopEventPublisher extends EventPublisherPort {
  readonly published: EventEnvelope[] = [];

  async publish<TPayload extends Record<string, unknown>>(
    envelope: EventEnvelope<TPayload>,
  ): Promise<void> {
    this.published.push(envelope);
  }
}

export class OutboxEventPublisher extends EventPublisherPort {
  constructor(private readonly outboxStore: OutboxStorePort) {
    super();
  }

  async publish<TPayload extends Record<string, unknown>>(
    envelope: EventEnvelope<TPayload>,
  ): Promise<void> {
    await this.outboxStore.append(envelope);
  }
}
