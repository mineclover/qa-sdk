// @def.boundary sim-document-api
// @def.doc domain-slice-architecture

export interface DeleteCommentCommand {
  readonly id: string;
  readonly traceId?: string;
  readonly correlationId?: string;
}
