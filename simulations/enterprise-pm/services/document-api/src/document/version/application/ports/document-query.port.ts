// @def.boundary sim-document-api
// @def.doc domain-slice-architecture

/**
 * Cross-domain Query Port — version 슬라이스가 document 슬라이스의 read 측에
 * 의존하기 위한 추상.
 */
export interface DocumentRefSummary {
  readonly id: string;
  readonly title: string;
  readonly projectId: string;
  readonly currentVersion: number;
}

export abstract class DocumentQueryPort {
  abstract findSummary(documentId: string): Promise<DocumentRefSummary | null>;
}
