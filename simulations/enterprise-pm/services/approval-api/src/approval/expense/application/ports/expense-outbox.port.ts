// @def.boundary sim-approval-api
// @def.doc domain-slice-architecture

import type { OutboxPort, OutboxRecord } from "@qa-sdk/sim-domain-slice-kit";

export type ExpenseOutboxPort = OutboxPort;
export type ExpenseOutboxRecord = OutboxRecord;

export interface ExpenseCreatedEventPayload {
  readonly id: string;
  readonly requesterId: string;
  readonly amount: number;
  readonly category: string;
  readonly occurredAt: string;
}

export interface ExpenseStatusChangedEventPayload {
  readonly id: string;
  readonly status: string;
  readonly occurredAt: string;
}
