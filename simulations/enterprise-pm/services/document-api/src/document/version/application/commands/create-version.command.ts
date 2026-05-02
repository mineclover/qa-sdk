// @def.boundary sim-document-api
// @def.doc domain-slice-architecture

/** 새 document version 을 생성하라는 명령. */
export interface CreateVersionCommand {
  readonly documentId: string;
  readonly contentRef: string;
  readonly authorId: string;
  readonly traceId?: string;
  readonly correlationId?: string;
}
