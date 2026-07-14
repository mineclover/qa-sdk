// @def.boundary sim-notification-api
// @def.doc domain-slice-architecture

import type { OutboxPort, OutboxRecord } from '@qa-sdk/sim-domain-slice-kit';

/**
 * Notification 슬라이스의 OutboxPort.
 *
 * sim-domain-slice-kit 의 OutboxPort 를 그대로 사용. payload 형식만 슬라이스가
 * 결정한다.
 */
export type NotificationOutboxPort = OutboxPort;
export type NotificationOutboxRecord = OutboxRecord;

/** 도메인 이벤트 — notification.sent v1. */
export interface NotificationSentEventPayload {
  readonly id: string;
  readonly recipientUserId: string;
  readonly type: string;
  readonly occurredAt: string;
}

/** 도메인 이벤트 — notification.delivered v1. (markRead 시점) */
export interface NotificationDeliveredEventPayload {
  readonly id: string;
  readonly recipientUserId: string;
  readonly type: string;
  readonly occurredAt: string;
}

/** 도메인 이벤트 — notification.failed v1. */
export interface NotificationFailedEventPayload {
  readonly id: string;
  readonly recipientUserId: string;
  readonly type: string;
  readonly occurredAt: string;
}
