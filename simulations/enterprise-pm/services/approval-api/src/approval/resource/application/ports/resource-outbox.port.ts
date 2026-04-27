// @def.boundary sim-approval-api
// @def.doc domain-slice-architecture

import type { OutboxPort, OutboxRecord } from "@qa-sdk/sim-domain-slice-kit";

export type ResourceOutboxPort = OutboxPort;
export type ResourceOutboxRecord = OutboxRecord;

export interface ResourceCreatedEventPayload {
  readonly id: string;
  readonly projectId: string;
  readonly requesterId: string;
  readonly resourceType: string;
  readonly occurredAt: string;
}

export interface ResourceStatusChangedEventPayload {
  readonly id: string;
  readonly status: string;
  readonly occurredAt: string;
}
