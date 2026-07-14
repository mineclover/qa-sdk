// @def.boundary sim-notification-api
// @def.doc domain-slice-architecture

import type { SubscriptionEntity } from '../../domain/index.js';
import type { SubscriptionTransactionScope } from './subscription-transaction.port.js';

/** Subscription Aggregate 의 영속 추상. */
export abstract class SubscriptionRepositoryPort {
  abstract save(entity: SubscriptionEntity, scope: SubscriptionTransactionScope): Promise<void>;
  abstract findById(userId: string, eventType: string): Promise<SubscriptionEntity | null>;
  abstract listForUser(userId: string): Promise<SubscriptionEntity[]>;
  abstract listSubscribersByEventType(eventType: string): Promise<SubscriptionEntity[]>;
  abstract deleteById(
    userId: string,
    eventType: string,
    scope: SubscriptionTransactionScope,
  ): Promise<void>;
}
