// @def.boundary sim-notification-api
// @def.doc domain-slice-architecture

import type { NotificationId, RecipientUserId } from './notification.ids.js';

/** 상태 머신 — notification 라이프사이클의 유한 상태. */
export type NotificationStatus = 'pending' | 'sent' | 'read' | 'failed';

/** 도메인 entity 의 내부 props (불변, branded ids). */
export interface NotificationProps {
  readonly id: NotificationId;
  readonly recipientUserId: RecipientUserId;
  readonly type: string;
  readonly title: string;
  readonly body: string;
  readonly status: NotificationStatus;
  readonly createdAt: Date;
  readonly sentAt: Date | null;
  readonly readAt: Date | null;
}

/** 영속/와이어 직렬화 형 — branding 제거, ISO 문자열. */
export interface NotificationSnapshot {
  readonly id: string;
  readonly recipientUserId: string;
  readonly type: string;
  readonly title: string;
  readonly body: string;
  readonly status: NotificationStatus;
  readonly createdAt: string;
  readonly sentAt: string | null;
  readonly readAt: string | null;
}
