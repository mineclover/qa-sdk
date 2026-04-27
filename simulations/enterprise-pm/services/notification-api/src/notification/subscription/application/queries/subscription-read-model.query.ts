// @def.boundary sim-notification-api
// @def.doc domain-slice-architecture

/** Read-side detail DTO. */
export interface SubscriptionDetailReadModel {
  readonly userId: string;
  readonly eventType: string;
  readonly channel: string;
  readonly isActive: boolean;
  readonly createdAt: string;
}

/** Read 전용 추상 (CQRS). */
export abstract class SubscriptionReadModelQuery {
  abstract findDetail(userId: string, eventType: string): Promise<SubscriptionDetailReadModel | null>;
  abstract listForUser(userId: string): Promise<SubscriptionDetailReadModel[]>;
  abstract listSubscribersByEventType(eventType: string): Promise<SubscriptionDetailReadModel[]>;
}
