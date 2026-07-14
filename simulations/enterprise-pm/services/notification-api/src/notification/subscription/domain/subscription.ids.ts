// @def.boundary sim-notification-api
// @def.doc domain-slice-architecture

import { InvalidSubscriptionIdException } from './subscription.exceptions.js';

/** Subscription 의 user 식별자 (cross-domain — auth.user 참조). */
export type SubscriberUserId = string & { readonly __brand: 'SubscriberUserId' };

/** Subscription 이 가입하는 이벤트 타입 키 (e.g. "budget.*", "task.assigned"). */
export type EventTypeKey = string & { readonly __brand: 'EventTypeKey' };

export function toSubscriberUserId(value: string): SubscriberUserId {
  if (value.trim().length === 0) {
    throw new InvalidSubscriptionIdException('userId must not be empty');
  }
  return value as SubscriberUserId;
}

export function toEventTypeKey(value: string): EventTypeKey {
  if (value.trim().length === 0) {
    throw new InvalidSubscriptionIdException('eventType must not be empty');
  }
  return value as EventTypeKey;
}
