// @def.boundary sim-document-api
// @def.doc domain-slice-architecture

import type { OutboxPort, OutboxRecord } from "@qa-sdk/sim-domain-slice-kit";

export type VersionOutboxPort = OutboxPort;
export type VersionOutboxRecord = OutboxRecord;

export interface VersionCreatedEventPayload {
  readonly documentId: string;
  readonly versionNumber: number;
  readonly contentRef: string;
  readonly authorId: string;
  readonly occurredAt: string;
}
