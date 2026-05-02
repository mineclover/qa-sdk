// @def.boundary sim-notification-api
// @def.doc domain-slice-architecture

import { InvalidNotificationIdException } from "./notification.exceptions.js";

/** PascalCase + branded 식별자. cross-aggregate 참조는 항상 ID by value. */
export type NotificationId = string & { readonly __brand: "NotificationId" };

/** Notification 의 수신자 (다른 도메인 — auth.user — aggregate 참조). */
export type RecipientUserId = string & { readonly __brand: "RecipientUserId" };

export function toNotificationId(value: string): NotificationId {
  if (value.trim().length === 0) {
    throw new InvalidNotificationIdException();
  }
  return value as NotificationId;
}

export function toRecipientUserId(value: string): RecipientUserId {
  return value as RecipientUserId;
}
