// @def.boundary sim-approval-api
// @def.doc domain-slice-architecture

import type { OutboxPort, OutboxRecord } from '@qa-sdk/sim-domain-slice-kit';

export type BudgetOutboxPort = OutboxPort;
export type BudgetOutboxRecord = OutboxRecord;

/** 도메인 이벤트 payload — budget.created v1. */
export interface BudgetCreatedEventPayload {
  readonly id: string;
  readonly projectId: string;
  readonly projectDepartmentId: string;
  readonly amount: number;
  readonly requesterId: string;
  readonly totalStages: number;
  readonly occurredAt: string;
}

/** 도메인 이벤트 payload — budget.decided v1. */
export interface BudgetDecidedEventPayload {
  readonly id: string;
  readonly approverId: string;
  readonly decision: 'approved' | 'rejected';
  readonly stage: number;
  readonly nextStatus: string;
  readonly occurredAt: string;
}
