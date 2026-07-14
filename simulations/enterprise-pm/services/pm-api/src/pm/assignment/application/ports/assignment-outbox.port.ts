// @def.boundary sim-pm-api
// @def.doc domain-slice-architecture

import type { OutboxPort, OutboxRecord } from '@qa-sdk/sim-domain-slice-kit';

/**
 * Assignment 슬라이스의 OutboxPort.
 *
 * sim-domain-slice-kit 의 OutboxPort 를 그대로 사용. payload 형식만 슬라이스가
 * 결정한다.
 */
export type AssignmentOutboxPort = OutboxPort;
export type AssignmentOutboxRecord = OutboxRecord;

/** 도메인 이벤트 payload — assignment.created v1. */
export interface AssignmentCreatedEventPayload {
  readonly id: string;
  readonly projectId: string;
  readonly managerId: string;
  readonly occurredAt: string;
}
