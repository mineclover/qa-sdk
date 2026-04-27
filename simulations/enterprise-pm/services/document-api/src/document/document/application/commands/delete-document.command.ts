// @def.boundary sim-document-api
// @def.doc domain-slice-architecture

/** Document 삭제 명령. */
export interface DeleteDocumentCommand {
  readonly id: string;
  readonly traceId?: string;
  readonly correlationId?: string;
}
