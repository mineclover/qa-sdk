// @def.boundary sim-pm-api
// @def.doc domain-slice-architecture

import type { OutboxPort, OutboxRecord } from '@qa-sdk/sim-domain-slice-kit';

export type TaskOutboxPort = OutboxPort;
export type TaskOutboxRecord = OutboxRecord;

/** 도메인 이벤트 payload — task.created v1. */
export interface TaskCreatedEventPayload {
  readonly id: string;
  readonly projectId: string;
  readonly title: string;
  readonly status: string;
  readonly parentTaskId: string | null;
  readonly occurredAt: string;
}

/** 도메인 이벤트 payload — task.updated v1. */
export interface TaskUpdatedEventPayload {
  readonly id: string;
  readonly projectId: string;
  readonly status: string;
  readonly occurredAt: string;
}

/** 도메인 이벤트 payload — task.deleted v1. */
export interface TaskDeletedEventPayload {
  readonly id: string;
  readonly occurredAt: string;
}
