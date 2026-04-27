// @def.boundary sim-pm-api
// @def.doc domain-slice-architecture

import type { OutboxPort, OutboxRecord } from "@qa-sdk/sim-domain-slice-kit";

export type ProjectOutboxPort = OutboxPort;
export type ProjectOutboxRecord = OutboxRecord;

export interface ProjectCreatedEventPayload {
  readonly id: string;
  readonly name: string;
  readonly ownerId: string;
  readonly departmentId: string;
  readonly status: string;
  readonly occurredAt: string;
}

export interface ProjectUpdatedEventPayload {
  readonly id: string;
  readonly status: string;
  readonly occurredAt: string;
}

export interface ProjectDeletedEventPayload {
  readonly id: string;
  readonly occurredAt: string;
}

export interface ProjectDelegatedEventPayload {
  readonly id: string;
  readonly graphRootId: string;
  readonly delegateUserId: string;
  readonly occurredAt: string;
}
