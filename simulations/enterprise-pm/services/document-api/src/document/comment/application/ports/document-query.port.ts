// @def.boundary sim-document-api
// @def.doc domain-slice-architecture

/**
 * Cross-domain Query Port — comment 슬라이스가 document 슬라이스의 read 측에
 * 의존하기 위한 추상.
 *
 * - comment 슬라이스는 document 슬라이스의 entity/repository 를 직접 import 하지 않는다.
 * - infrastructure 계층에서 document 슬라이스의 ReadModelQuery 어댑터로 충족.
 */
export interface DocumentRefSummary {
  readonly id: string;
  readonly title: string;
  readonly projectId: string;
}

export abstract class DocumentQueryPort {
  /** documentId 가 존재하는지 확인하고 요약 정보를 반환. 없으면 null. */
  abstract findSummary(documentId: string): Promise<DocumentRefSummary | null>;
}
