// @def.boundary sim-document-api
// @def.doc domain-slice-architecture

import type { OutboxPort, OutboxRecord } from "@qa-sdk/sim-domain-slice-kit";

export type CommentOutboxPort = OutboxPort;
export type CommentOutboxRecord = OutboxRecord;

export interface CommentCreatedEventPayload {
  readonly id: string;
  readonly documentId: string;
  readonly authorId: string;
  readonly body: string;
  readonly parentCommentId: string | null;
  readonly occurredAt: string;
}

export interface CommentDeletedEventPayload {
  readonly id: string;
  readonly occurredAt: string;
}
