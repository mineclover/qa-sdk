// @def.boundary sim-pm-api
// @def.doc domain-slice-architecture

import type { OutboxPort, OutboxRecord } from '@qa-sdk/sim-domain-slice-kit';

export type MemberOutboxPort = OutboxPort;
export type MemberOutboxRecord = OutboxRecord;

export interface MemberAddedEventPayload {
  readonly projectId: string;
  readonly userId: string;
  readonly role: string;
  readonly occurredAt: string;
}

export interface MemberRemovedEventPayload {
  readonly projectId: string;
  readonly userId: string;
  readonly occurredAt: string;
}
