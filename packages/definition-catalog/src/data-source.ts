/**
 * DefDataSource — definition 데이터 접근 추상화
 *
 * CLI, 서비스, 에이전트 모두 이 인터페이스로 문서 데이터에 접근.
 * 구현체: LocalDataSource (SQLite 직접), ServerDataSource (HTTP)
 */

/** 문서 메타데이터 (DB 기준) */
export interface DefDoc {
  docId: string;
  level?: string;
  scope: string;
  aspect: string;
  depth: string;
  lifecycle: string;
  layer?: string;
  tags: string[];
  links: { target: string; type: string }[];
  svc?: string;
  address?: string;
  version: number;
  purpose?: string;
  intent?: string;
  context?: string;
  caveat?: string;
  sourcePath?: string;
}

/** 링크 (역방향) */
export interface DefIncomingLink {
  source: string;
  type: string;
}

/** 목록 필터 */
export interface DefListFilter {
  scope?: string;
  aspect?: string;
  depth?: string;
  lifecycle?: string;
  layer?: string;
  level?: string;
  svc?: string;
  tag?: string;
  address?: string;
  q?: string;
  limit?: number;
  offset?: number;
}

/** 검증 이슈 */
export interface DefValidationIssue {
  severity: "error" | "warning";
  type: string;
  docId: string;
  message: string;
}

/** 검증 결과 */
export interface DefValidationResult {
  issues: DefValidationIssue[];
  errors: number;
  warnings: number;
  passed: boolean;
}

/**
 * 데이터 소스 인터페이스 — 서버/로컬 양쪽 구현
 */
export interface DefDataSource {
  readonly mode: "local" | "server";

  /** 단건 조회 */
  get(docId: string): Promise<DefDoc | null>;

  /** 목록 (필터 + pagination + 전문검색) */
  list(filter?: DefListFilter): Promise<DefDoc[]>;

  /** contains 자식 */
  getChildren(docId: string): Promise<DefDoc[]>;

  /** contains 부모 */
  getParent(docId: string): Promise<DefDoc | null>;

  /** 역링크 */
  getIncomingLinks(docId: string): Promise<DefIncomingLink[]>;

  /** 순방향 링크 */
  getOutgoingLinks(docId: string): Promise<{ target: string; type: string }[]>;

  /** 그래프 검증 */
  validate(): Promise<DefValidationResult>;
}
