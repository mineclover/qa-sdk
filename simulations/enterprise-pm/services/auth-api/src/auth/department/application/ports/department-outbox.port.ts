// @def.boundary sim-auth-api
// @def.doc domain-slice-architecture

import type { OutboxPort, OutboxRecord } from '@qa-sdk/sim-domain-slice-kit';

export type DepartmentOutboxPort = OutboxPort;
export type DepartmentOutboxRecord = OutboxRecord;

export interface DepartmentCreatedEventPayload {
  readonly id: string;
  readonly name: string;
  readonly parentId: string | null;
  readonly managerId: string | null;
  readonly occurredAt: string;
}

export interface DepartmentUpdatedEventPayload {
  readonly id: string;
  readonly name: string;
  readonly parentId: string | null;
  readonly managerId: string | null;
  readonly occurredAt: string;
}

export interface DepartmentDeletedEventPayload {
  readonly id: string;
  readonly occurredAt: string;
}
