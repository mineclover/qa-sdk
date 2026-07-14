// @def.boundary sim-approval-api
// @def.doc domain-slice-architecture

import type { OutboxPort, OutboxRecord } from '@qa-sdk/sim-domain-slice-kit';

export type TimeOffOutboxPort = OutboxPort;
export type TimeOffOutboxRecord = OutboxRecord;

export interface TimeOffCreatedEventPayload {
  readonly id: string;
  readonly requesterId: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly occurredAt: string;
}

export interface TimeOffStatusChangedEventPayload {
  readonly id: string;
  readonly status: string;
  readonly occurredAt: string;
}
