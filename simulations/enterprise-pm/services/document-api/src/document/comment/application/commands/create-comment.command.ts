// @def.boundary sim-document-api
// @def.doc domain-slice-architecture

/** 새 comment 를 생성하라는 명령. */
export interface CreateCommentCommand {
  readonly id: string;
  readonly documentId: string;
  readonly authorId: string;
  readonly body: string;
  readonly parentCommentId?: string;
  readonly traceId?: string;
  readonly correlationId?: string;
}
