// @def.boundary sim-document-api
// @def.doc domain-slice-architecture

/** 새 document 를 생성하라는 명령 (use-case 입력). */
export interface CreateDocumentCommand {
  readonly id: string;
  readonly projectId: string;
  readonly title: string;
  readonly ownerId: string;
  readonly traceId?: string;
  readonly correlationId?: string;
}
