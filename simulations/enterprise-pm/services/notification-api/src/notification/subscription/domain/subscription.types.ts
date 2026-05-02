// @def.boundary sim-notification-api
// @def.doc domain-slice-architecture

import type { SubscriberUserId, EventTypeKey } from "./subscription.ids.js";

export type SubscriptionChannel = "in_app" | "email";

/** 도메인 entity 의 내부 props (불변, branded ids). */
export interface SubscriptionProps {
  readonly userId: SubscriberUserId;
  readonly eventType: EventTypeKey;
  readonly channel: SubscriptionChannel;
  readonly isActive: boolean;
  readonly createdAt: Date;
}

/** 영속/와이어 직렬화 형 — branding 제거, ISO 문자열. */
export interface SubscriptionSnapshot {
  readonly userId: string;
  readonly eventType: string;
  readonly channel: SubscriptionChannel;
  readonly isActive: boolean;
  readonly createdAt: string;
}
