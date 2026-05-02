// @def.boundary sim-notification-api
// @def.doc domain-slice-architecture

import type { OutboxPort, OutboxRecord } from "@qa-sdk/sim-domain-slice-kit";

export type SubscriptionOutboxPort = OutboxPort;
export type SubscriptionOutboxRecord = OutboxRecord;

/** subscription.created v1. */
export interface SubscriptionCreatedEventPayload {
  readonly userId: string;
  readonly eventType: string;
  readonly channel: string;
  readonly isActive: boolean;
  readonly occurredAt: string;
}

/** subscription.activeChanged v1. */
export interface SubscriptionActiveChangedEventPayload {
  readonly userId: string;
  readonly eventType: string;
  readonly isActive: boolean;
  readonly occurredAt: string;
}

/** subscription.deleted v1. */
export interface SubscriptionDeletedEventPayload {
  readonly userId: string;
  readonly eventType: string;
  readonly occurredAt: string;
}
