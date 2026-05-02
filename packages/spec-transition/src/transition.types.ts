// @def.boundary spec-engine-system
// @def.doc spec-engine-system

/**
 * Transition Spec DSL — 타입 정의.
 *
 * raw coordinate system 위에 state semantics를 덧씌우는 해석 계층.
 * 좌표 패턴 → 전이 이름 → input/output 바인딩 → effect.
 *
 * 상태는 별도 vocabulary가 아니라 DEMO_CATALOG의 축(axis)으로 표현한다.
 * input/output은 축 이름 + entry 값을 참조한다.
 */

// ═══════════════════════════════════════════════════════════════
//  Effect Kind — 정규 vocabulary (자유 문자열 금지)
// ═══════════════════════════════════════════════════════════════

export type EffectKind =
  | "create"
  | "update"
  | "move"
  | "consume"
  | "open"
  | "close";

export const EFFECT_KINDS: readonly EffectKind[] = [
  "create",
  "update",
  "move",
  "consume",
  "open",
  "close",
] as const;

// ═══════════════════════════════════════════════════════════════
//  Match — 좌표 패턴 매칭
// ═══════════════════════════════════════════════════════════════

export type MatchMode = "single" | "ordered" | "unordered" | "windowed";

/** 좌표 패턴. DEMO_CATALOG의 축 이름 → 값 매핑 */
export interface CoordinatePattern {
  readonly [dimension: string]: string;
}

export interface MatchPattern {
  /** 매칭 모드 (1차: single | ordered만 구현) */
  readonly mode: MatchMode;
  /** 좌표 패턴 배열 */
  readonly coordinates: readonly CoordinatePattern[];
  /** windowed 모드 시 시간 범위 (ms) */
  readonly window_ms?: number;
}

// ═══════════════════════════════════════════════════════════════
//  Bind — raw event에서 identity 추출
// ═══════════════════════════════════════════════════════════════

/**
 * 바인드 정의. 경로 형식: `$.events[N].field_name`
 *
 * 최소 필수: context_id, resource_id.
 * 추가 바인딩은 자유 키로 선언.
 */
export interface BindDef {
  readonly context_id: string;
  readonly resource_id: string;
  readonly [key: string]: string;
}

// ═══════════════════════════════════════════════════════════════
//  State Condition / Mutation — 축(axis) 기반
//
//  상태는 DEMO_CATALOG 축의 entry로 표현된다.
//  - axis: DEMO_CATALOG 축 이름 (예: "flow_step", "lifecycle_state")
//  - value: 해당 축의 entry 문자열 (예: "processing", "active")
//  - exists 연산자: 해당 축에 값이 설정되어 있는지 (lifecycle_state 유무 = 존재 여부)
// ═══════════════════════════════════════════════════════════════

/** input 조건. 축의 현재 entry 값을 기준으로 평가 */
export interface StateCondition {
  /** DEMO_CATALOG 축 이름 */
  readonly axis: string;
  /** entry 값 일치 */
  readonly eq?: string;
  /** entry 값 불일치 */
  readonly neq?: string;
  /** entry 값 목록 포함 */
  readonly in?: readonly string[];
  /** 해당 축에 값이 설정되어 있는지 */
  readonly exists?: boolean;
}

export interface InputCondition {
  readonly all: readonly StateCondition[];
}

/** output 변경. 축의 entry 값을 설정 */
export interface StateAssignment {
  /** DEMO_CATALOG 축 이름 */
  readonly axis: string;
  /** 설정할 entry 값 (null = 값 제거) */
  readonly value: string | null;
}

export interface OutputMutation {
  readonly set: readonly StateAssignment[];
}

// ═══════════════════════════════════════════════════════════════
//  Effect — 전이의 성격
// ═══════════════════════════════════════════════════════════════

export interface EffectDef {
  readonly kind: EffectKind;
}

// ═══════════════════════════════════════════════════════════════
//  Transition Spec — 최상위 정의
// ═══════════════════════════════════════════════════════════════

/**
 * Transition Spec.
 *
 * 좌표 패턴 → 전이 해석 규칙.
 * naming: `<domain>.<entity>.<operation>` (예: article.create)
 */
export interface TransitionSpec {
  /** 고유 이름. 형식: <domain>.<entity>.<operation> */
  readonly transition: string;
  /** spec 버전 */
  readonly version: string;
  /** 좌표 패턴 매칭 규칙 */
  readonly match: MatchPattern;
  /** raw event에서 identity 추출 */
  readonly bind: BindDef;
  /** 전이 전 상태 조건 (축 기반) */
  readonly input: InputCondition;
  /** 전이 후 상태 변경 (축 기반) */
  readonly output: OutputMutation;
  /** 전이의 성격 */
  readonly effect: EffectDef;
}

// ═══════════════════════════════════════════════════════════════
//  Transition Instance — 런타임 결과
// ═══════════════════════════════════════════════════════════════

/**
 * spec이 raw event에 적용된 결과.
 * deterministic replay의 단위.
 *
 * snapshot은 축 이름 → entry 값 매핑.
 */
export interface TransitionInstance {
  readonly transition_name: string;
  readonly spec_version: string;
  readonly context_id: string;
  readonly resource_id: string;
  readonly matched_event_ids: readonly string[];
  /** 전이 전 축별 상태 */
  readonly input_snapshot: Readonly<Record<string, string | null>>;
  /** 전이 후 축별 상태 */
  readonly output_snapshot: Readonly<Record<string, string | null>>;
  readonly effect_kind: EffectKind;
  readonly matched_at: string;
}

// ═══════════════════════════════════════════════════════════════
//  Validation
// ═══════════════════════════════════════════════════════════════

export interface ValidationIssue {
  readonly path: string;
  readonly message: string;
}

export interface ValidationResult {
  readonly valid: boolean;
  readonly issues: readonly ValidationIssue[];
}
