// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

// ── Constraint — 정형화된 검증 규칙 정의 ────────────────

/**
 * Constraint = "무엇에 대해, 어떤 조건이, 어떤 상황에서 참이어야 한다"
 *
 * 스펙이 정의한 것의 증명 단위.
 * 테스트 케이스는 이 constraint를 증명한다.
 * 실패 시 subject + predicate + context로 오류를 추적한다.
 */
export interface ConstraintDef {
  /** 제약 ID (스펙 내 유일) */
  constraintId: string;

  /** 소속 스펙 */
  specId: string;

  /** subject — 검증 대상 (무엇에 대해) */
  subject: ConstraintSubject;

  /** predicate — 조건 (어떤 조건이) */
  predicate: ConstraintPredicate;

  /** context — 상황 (어떤 상황에서) */
  context: ConstraintContext;

  /** evidence — 증명 방법 (어떻게 검증) */
  evidence: ConstraintEvidence;

  /** 심각도: 실패 시 영향 */
  severity: "critical" | "error" | "warning";

  /** 사람 읽기용 설명 */
  description: string;
}

// ── Subject — 검증 대상 ──────────────────────────────

export interface ConstraintSubject {
  /** 대상 유형 */
  kind: SubjectKind;

  /** 식별자 (스키마ID, 파이프ID, 필드 참조 등) */
  ref: string;

  /** 세부 필드 (필드 레벨 제약 시) */
  field?: string;
}

export type SubjectKind =
  | "schema"        // DataSchema
  | "field"         // DataSchema의 특정 컬럼
  | "relation"      // DataRelation
  | "pipe"          // PipeSpec
  | "pipe-step"     // PipeSpec 내 특정 step
  | "pipe-graph"    // PipeGraph
  | "connection"    // PipeConnection
  | "lineage"       // FieldLineage
  | "event"         // 이벤트
  | "contract";     // DataContract

// ── Predicate — 조건 ─────────────────────────────────

export interface ConstraintPredicate {
  /** 조건 유형 */
  op: PredicateOp;

  /** 기대값 */
  expected?: unknown;

  /** 복합 조건 (and/or) */
  children?: ConstraintPredicate[];
}

export type PredicateOp =
  // 값 비교
  | "eq"            // === expected
  | "neq"           // !== expected
  | "gt"            // > expected
  | "gte"           // >= expected
  | "lt"            // < expected
  | "lte"           // <= expected
  // 존재/포함
  | "exists"        // 존재해야 함
  | "not-exists"    // 존재하면 안 됨
  | "contains"      // expected를 포함
  | "not-contains"  // expected를 포함하면 안 됨
  | "subset-of"     // expected의 부분집합
  | "superset-of"   // expected의 상위집합
  // 타입/스키마
  | "type-is"       // 타입이 expected
  | "compatible"    // 스키마 호환
  | "breaking"      // breaking 변경 여부
  // 관계
  | "connected-to"  // 연결되어 있음
  | "reachable"     // 도달 가능
  | "traceable"     // 계보 추적 가능
  // 논리
  | "and"           // 모든 children 충족
  | "or"            // children 중 하나 이상 충족
  | "not";          // children[0] 불충족

// ── Context — 상황 ───────────────────────────────────

export interface ConstraintContext {
  /** 상황 유형 */
  when: ContextWhen;

  /** 상황 조건 (입력값, 상태, 이벤트 등) */
  conditions?: Record<string, unknown>;

  /** 매니페스트 버전 (어떤 버전 기준으로) */
  manifestVersion?: string;
}

export type ContextWhen =
  | "always"              // 항상
  | "on-schema-change"    // 스키마 변경 시
  | "on-event"            // 특정 이벤트 발생 시
  | "on-pipe-execution"   // 파이프 실행 시
  | "on-deploy"           // 배포 시
  | "on-version-upgrade"  // 버전 업그레이드 시
  | "given";              // 특정 조건 하에서 (conditions 참조)

// ── Evidence — 증명 방법 ─────────────────────────────

export interface ConstraintEvidence {
  /** 증명 방법 유형 */
  method: EvidenceMethod;

  /** 검증 함수 참조 (코드 경로) */
  verifier?: string;

  /** 연결된 테스트 주소 */
  testAddresses?: string[];

  /** 검증 결과의 가역성 */
  reversible: boolean;
}

export type EvidenceMethod =
  | "unit-test"           // 단위 테스트
  | "integration-test"    // 통합 테스트
  | "contract-test"       // 계약 테스트
  | "schema-validation"   // 스키마 검증
  | "type-check"          // 타입 체크 (컴파일 타임)
  | "simulation"          // dry-run 시뮬레이션
  | "lineage-trace"       // 계보 추적
  | "compatibility-check" // 호환성 검증
  | "invariant-check"     // 불변 조건 체크
  | "snapshot-compare"    // 스냅샷 비교
  | "dry-run"             // 출력 비교
  | "manual-review";      // 수동 리뷰 (코드 리뷰)

// ── ConstraintResult — 검증 결과 ─────────────────────

export interface ConstraintResult {
  /** 제약 참조 */
  constraintId: string;
  specId: string;

  /** 판정 */
  verdict: "pass" | "fail" | "skip" | "error";

  /** subject 실제 값 (실패 시 디버깅) */
  actualValue?: unknown;

  /** predicate 기대 값 */
  expectedValue?: unknown;

  /** 실패 시 오류 추적 정보 */
  failureTrace?: FailureTrace;

  /** 실행 시각 */
  executedAt: string;

  /** 실행 duration (ms) */
  duration: number;
}

/** 오류 추적 — 실패 시 어디서 왜 깨졌는가 */
export interface FailureTrace {
  /** 깨진 subject */
  subject: ConstraintSubject;

  /** 깨진 predicate */
  predicate: ConstraintPredicate;

  /** 깨진 context */
  context: ConstraintContext;

  /** 영향 범위: 이 실패로 인해 깨질 수 있는 다른 constraint */
  impactedConstraints?: string[];

  /** 수정 힌트 */
  hint?: string;

  /** 스택 트레이스 (코드 오류 시) */
  stackTrace?: string;
}
