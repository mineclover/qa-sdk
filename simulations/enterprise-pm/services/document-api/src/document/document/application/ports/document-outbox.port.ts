// @def.boundary sim-document-api
// @def.doc domain-slice-architecture

import type { OutboxPort, OutboxRecord } from '@qa-sdk/sim-domain-slice-kit';

/**
 * Document 슬라이스의 OutboxPort.
 *
 * sim-domain-slice-kit 의 OutboxPort 를 그대로 사용. payload 형식만 슬라이스가
 * 결정한다.
 */
export type DocumentOutboxPort = OutboxPort;
export type DocumentOutboxRecord = OutboxRecord;

/** 도메인 이벤트 payload — document.created v1. */
export interface DocumentCreatedEventPayload {
  readonly id: string;
  readonly projectId: string;
  readonly title: string;
  readonly ownerId: string;
  readonly occurredAt: string;
}

/** 도메인 이벤트 payload — document.updated v1. */
export interface DocumentUpdatedEventPayload {
  readonly id: string;
  readonly projectId: string;
  readonly title: string;
  readonly ownerId: string;
  readonly occurredAt: string;
}

/** 도메인 이벤트 payload — document.deleted v1. */
export interface DocumentDeletedEventPayload {
  readonly id: string;
  readonly occurredAt: string;
}
