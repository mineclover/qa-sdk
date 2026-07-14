// @def.doc definition-catalog-spec

/**
 * DefDataSource — definition 데이터 접근 추상화
 *
 * CLI, 서비스, 에이전트 모두 이 인터페이스로 문서 데이터에 접근.
 * 구현체: LocalDataSource (SQLite 직접), ServerDataSource (HTTP), ScanDataSource (frontmatter scan)
 */

import type { QualityGateSpec } from 'test-types';

/** 문서 메타데이터 (DB 기준) */
export interface DefDoc {
  docId: string;
  title?: string;
  type?: string;
  knowledgeKind?: string;
  level?: string;
  tier?: string;
  scope?: string;
  aspect?: string;
  depth?: string;
  lifecycle: string;
  layer?: string;
  targetPrefix?: string;
  ownerSystem?: string;
  projectionPlane?: string;
  intentHierarchy?: string;
  lineageFacet?: string;
  lineageKind?: string;
  tags: string[];
  links: { target: string; type: string }[];
  svc?: string;
  docVersion?: string;
  revision?: number;
  address?: string;
  version: number;
  purpose?: string;
  intent?: string;
  context?: string;
  caveat?: string;
  gate?: QualityGateSpec;
  sourcePath?: string;
}

export interface DefDocBody {
  docId: string;
  body: string;
  bodyHash?: string;
  docVersion?: string;
  revision?: number;
  sourcePath?: string;
}

export interface DefCodeReference {
  codePath: string;
  docId: string;
  relationType: 'boundary' | 'doc';
  sourceKind: 'code_comment' | 'doc_frontmatter';
  symbol?: string;
  line?: number;
}

export interface DefBoundaryResolutionCandidate {
  anchor: DefDoc;
  supportingDocs: DefDoc[];
  references: DefCodeReference[];
}

export type DefFileBoundaryResolution =
  | {
      kind: 'none';
      codePath: string;
      references: DefCodeReference[];
    }
  | {
      kind: 'unique';
      codePath: string;
      anchor: DefDoc;
      supportingDocs: DefDoc[];
      references: DefCodeReference[];
    }
  | {
      kind: 'ambiguous';
      codePath: string;
      candidates: DefBoundaryResolutionCandidate[];
      references: DefCodeReference[];
    };

/** 링크 (역방향) */
export interface DefIncomingLink {
  source: string;
  type: string;
  sourceAddress?: string;
  targetAddress?: string;
}

/** 링크 (순방향) */
export interface DefOutgoingLink {
  target: string;
  type: string;
  sourceAddress?: string;
  targetAddress?: string;
}

/** synthetic 역링크 (review-ledger 등 외부 인덱스에서 파생) */
export interface DefSyntheticIncomingLink extends DefIncomingLink {
  synthetic: true;
  kind: 'feedback_request';
  title?: string;
  createdAt?: string;
  targetModel?: string | null;
}

/** definition 문서와 연결된 feedback request 요약 */
export interface DefFeedbackRequestSummary {
  id: string;
  createdAt: string;
  purpose: string;
  targetModel: string | null;
  status: string;
  serviceScope: string | null;
}

export interface DefBoundaryDoc {
  docId: string;
  title: string;
  scope?: string;
  aspect?: string;
  depth?: string;
  lifecycle: string;
  layer?: string;
  svc?: string;
  purpose?: string;
  overview?: string;
}

export interface DefBoundaryMember {
  docId: string;
  title: string;
  scope?: string;
  aspect?: string;
  depth?: string;
  summary: string;
}

export interface DefBoundaryCouplingOutgoing {
  type: string;
  target: string;
  summary: string;
}

export interface DefBoundaryCouplingIncoming {
  type: string;
  source: string;
  summary: string;
}

export interface DefBoundaryResult {
  boundary: DefBoundaryDoc;
  members: DefBoundaryMember[];
  couplings: {
    outgoing: DefBoundaryCouplingOutgoing[];
    incoming: DefBoundaryCouplingIncoming[];
  };
}

export interface DefBoundaryConcernItem {
  tag: string;
  source: string;
  via: string;
}

export interface DefBoundaryConcernsResult {
  docId: string;
  direct: string[];
  inherited: DefBoundaryConcernItem[];
  all: string[];
}

export interface DefBoundaryImpactDoc {
  docId: string;
  address?: string;
  via: string;
  path: string;
  direction: 'upstream' | 'downstream';
  distance: number;
  layer?: string;
  crossLayer: boolean;
}

export interface DefBoundaryImpactResult {
  sourceId: string;
  sourceAddress?: string;
  impacted: DefBoundaryImpactDoc[];
  affectedGroups: string[];
  blastRadius: number;
  byLayer: {
    domain: number;
    operation: number;
    mediation: number;
    experience: number;
    unspecified: number;
  };
}

export interface DefBoundaryContextResult {
  mode: 'direct' | 'transitive';
  level: 'purpose' | 'overview';
  boundary: DefBoundaryResult;
  concerns: DefBoundaryConcernsResult;
  impact: DefBoundaryImpactResult;
  feedbackTrace: DefFeedbackRequestSummary[];
}

/** 목록 필터 */
export interface DefListFilter {
  type?: string;
  knowledgeKind?: string;
  scope?: string;
  aspect?: string;
  depth?: string;
  lifecycle?: string;
  layer?: string;
  level?: string;
  svc?: string;
  tag?: string;
  address?: string;
  /**
   * 소스 파일 확장자 필터 — `.rule.md`, `.cases.md`, `.test.md` 등 문서 유형을 파일명 기준으로 구분한다.
   * 예: `ext: "rule"` → source_path 가 `*.rule.md` 로 끝나는 문서만 반환.
   */
  ext?: string;
  q?: string;
  limit?: number;
  offset?: number;
}

/** 검증 이슈 */
export interface DefValidationIssue {
  severity: 'error' | 'warning' | 'info';
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
  readonly mode: 'local' | 'server' | 'scan';

  /** 단건 조회 */
  get(docId: string): Promise<DefDoc | null>;

  /** 주소 기준 단건 조회 */
  getByAddress(address: string): Promise<DefDoc | null>;

  /** 최신 문서 본문 조회 */
  getBody(docId: string): Promise<DefDocBody | null>;

  /** 코드 파일 기준 authoritative boundary 해석 */
  resolveByFile(filePath: string): Promise<DefFileBoundaryResolution>;

  /** 목록 (필터 + pagination + 전문검색) */
  list(filter?: DefListFilter): Promise<DefDoc[]>;

  /** contains 자식 */
  getChildren(docId: string): Promise<DefDoc[]>;

  /** contains 부모 */
  getParent(docId: string): Promise<DefDoc | null>;

  /** 역링크 */
  getIncomingLinks(docId: string): Promise<DefIncomingLink[]>;

  /** 외부 인덱스에서 파생된 synthetic 역링크 */
  getSyntheticIncomingLinks(docId: string): Promise<DefSyntheticIncomingLink[]>;

  /** 순방향 링크 */
  getOutgoingLinks(docId: string): Promise<DefOutgoingLink[]>;

  /** 문서와 연결된 feedback request 요약 */
  getFeedbackRequestsByDocId(docId: string, limit?: number): Promise<DefFeedbackRequestSummary[]>;

  /** 바운더리 단위 구조 + direct coupling 조회 */
  getBoundary(docId: string, level?: 'purpose' | 'overview'): Promise<DefBoundaryResult | null>;

  /** 바운더리 구조 + concerns + impact + feedback trace 조회 */
  getBoundaryContext(
    docId: string,
    level?: 'purpose' | 'overview',
    mode?: 'direct' | 'transitive',
  ): Promise<DefBoundaryContextResult | null>;

  /** 그래프 검증 */
  validate(options?: DefValidateOptions): Promise<DefValidationResult>;
}

/**
 * `validate()` 호출 옵션
 */
export interface DefValidateOptions {
  /**
   * true면 packages/ Drizzle 스키마 정적 스캔으로 coordinate-storage.rule
   * 위반을 함께 검출. local/scan 모드에서만 의미 있음 (server는 무시).
   */
  readonly includeCoordStorageCheck?: boolean;
  /**
   * 코드 스캔 루트 (기본: process.cwd()). 모노레포 외부에서 호출할 때 사용.
   */
  readonly repoRoot?: string;
}
