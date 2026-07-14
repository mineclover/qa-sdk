// @def.boundary sim-auth-api
// @def.doc domain-slice-architecture

import type { OutboxPort, OutboxRecord } from '@qa-sdk/sim-domain-slice-kit';

export type RoleAssignmentOutboxPort = OutboxPort;
export type RoleAssignmentOutboxRecord = OutboxRecord;

export interface RoleAssignedEventPayload {
  readonly userId: string;
  readonly roleId: string;
  readonly scopeType: string;
  readonly scopeId: string | null;
  readonly occurredAt: string;
}

export interface RoleRevokedEventPayload {
  readonly userId: string;
  readonly roleId: string;
  readonly scopeType: string;
  readonly scopeId: string | null;
  readonly occurredAt: string;
}
