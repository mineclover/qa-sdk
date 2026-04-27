// @def.boundary sim-document-api
// @def.doc domain-slice-architecture

/** 기존 document 의 일부 필드를 업데이트하는 명령. */
export interface UpdateDocumentCommand {
  readonly id: string;
  readonly projectId?: string;
  readonly title?: string;
  readonly ownerId?: string;
  readonly traceId?: string;
  readonly correlationId?: string;
}
