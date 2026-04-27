// @def.boundary sim-auth-api
// @def.doc domain-slice-architecture

import type { OutboxPort, OutboxRecord } from "@qa-sdk/sim-domain-slice-kit";

export type RoleOutboxPort = OutboxPort;
export type RoleOutboxRecord = OutboxRecord;

export interface RoleCreatedEventPayload {
  readonly id: string;
  readonly name: string;
  readonly scopeType: string;
  readonly defaultMaskHex: string;
  readonly occurredAt: string;
}

export interface RoleDeletedEventPayload {
  readonly id: string;
  readonly occurredAt: string;
}
