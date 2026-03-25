/**
 * 소프트웨어 정의 카탈로그 — 핵심 타입
 *
 * 소프트웨어를 구성하는 정의(화면, 기능, 흐름, 상태, 제약, 데이터)를
 * 좌표계로 분류하고 관리하기 위한 타입 정의.
 */

// ─── 축 값 타입 (Dimension Value Types) ─────────────────

/** 대분류 — 무엇에 대한 정의인가 */
export type DefScope =
  | "ui"
  | "feature"
  | "flow"
  | "state"
  | "constraint"
  | "data"
  | "interface";

/** 세부 측면 — 어떤 측면을 정의하는가 (20종, flat) */
export type DefAspect =
  // ui
  | "layout"
  | "component"
  | "interaction"
  // feature
  | "func_def"
  | "scenario"
  // flow
  | "user_scenario"
  | "process_flow"
  | "relation"
  // state
  | "app_state"
  | "domain_state"
  | "system_state"
  // constraint
  | "tech_constraint"
  | "biz_constraint"
  | "infra_constraint"
  // data
  | "domain_data"
  | "system_data"
  | "external_data"
  // interface
  | "api_contract"
  | "cli_contract"
  | "event_contract";

/** 정의의 깊이 — 얼마나 상세한가 */
export type DefDepth =
  | "overview"        // 개요
  | "specification"   // 명세
  | "implementation"  // 구현
  | "validation";     // 검증

/** 문서 생명주기 */
export type DefLifecycle =
  | "draft"       // 초안
  | "review"      // 검토중
  | "approved"    // 승인
  | "deprecated"  // 폐기예정
  | "archived";   // 보관

/** 정의 간 관계 유형 */
export type LinkType =
  | "depends_on"   // 의존
  | "implements"   // 구현
  | "refines"      // 구체화
  | "constrains"   // 제약
  | "traces_to"    // 추적
  | "contains";    // 포함 — 그룹이 멤버를 포함

// ─── 태그 체계 ───────────────────────────────────────────

/**
 * 횡단 관심사 태그 (Cross-Cutting Concern Tags).
 *
 * scope는 "무엇에 대한 정의인가"를 분류한다.
 * tag는 scope를 횡단하는 **관심사**를 표현한다.
 *
 * 예: "보안"은 interface(인증 API) + constraint(권한 규칙) + state(세션)에 걸친다.
 *    scope를 만들면 분류가 깨지지만, tag로 묶으면 각 문서의 정체성은 유지된다.
 */
export type ConcernTag =
  | "security"       // 보안 — 인증, 인가, 암호화, 감사
  | "performance"    // 성능 — 지연, 처리량, 최적화
  | "accessibility"  // 접근성 — a11y, WCAG, 스크린리더
  | "observability"  // 관측성 — 로깅, 메트릭, 트레이싱
  | "testing"        // 테스트 — 검증 전략, 커버리지
  | "migration"      // 마이그레이션 — 스키마 변경, 데이터 이전
  | "deprecation";   // 폐기 — 대체 계획, 이전 가이드

/**
 * 구조 태그 (Structural Tags).
 *
 * 문서의 구조적 특성을 표시한다.
 */
export type StructuralTag =
  | "cross-scope"    // 여러 scope에 걸치는 통합 문서
  | "entry-point"    // 진입점 — 이 주제의 시작 문서
  | "decision"       // 의사결정 기록이 포함됨
  | "generated";     // codegen 등으로 자동 생성된 문서

/** 알려진 태그 전체 (자유 문자열도 허용하되, 이 목록을 우선 사용) */
export type KnownTag = ConcernTag | StructuralTag;

// ─── Concern 전파 (Structural Constraint Propagation) ────

/** 전파 방향 */
export type PropagationDirection = "downstream" | "upstream";

/**
 * Concern 전파 규칙.
 *
 * "이 concern은 이 관계 유형을 타고 이 방향으로 전파된다."
 * 예: security는 refines를 타고 downstream(부모→자식)으로 전파.
 */
export interface ConcernPropagation {
  readonly linkType: LinkType;
  readonly direction: PropagationDirection;
}

/**
 * Concern 정의.
 *
 * 단순 태그가 아니라 **전파 규칙을 가진 구조적 제약**.
 * link 그래프를 타고 관련 문서에 자동으로 상속된다.
 */
export interface ConcernDef {
  readonly id: ConcernTag;
  readonly name: string;
  readonly description: string;
  readonly propagation: readonly ConcernPropagation[];
}

/** 상속된 concern 1건 */
export interface InheritedConcern {
  /** concern 식별자 */
  readonly concern: ConcernTag;
  /** 출처 문서 ID (이 문서에 직접 부여된 concern) */
  readonly from: string;
  /** 어떤 관계를 통해 전파되었는가 */
  readonly via: LinkType;
  /** 전파 경로 (출처 → ... → 현재 문서) */
  readonly path: readonly string[];
}

/** 문서의 effective concerns = 직접 ∪ 상속 */
export interface EffectiveConcerns {
  /** 이 문서에 직접 부여된 concern */
  readonly direct: readonly ConcernTag[];
  /** link 그래프를 타고 상속된 concern */
  readonly inherited: readonly InheritedConcern[];
  /** 전체 (direct ∪ inherited의 unique concern ID) */
  readonly all: readonly ConcernTag[];
}

// ─── 문서 메타데이터 ─────────────────────────────────────

/** decision-flow 연결 참조 */
export interface DecisionRef {
  /** FlowInstance.id */
  readonly flowInstanceId: string;
  /** decision_path 좌표 */
  readonly coordinateAddress: number;
}

/**
 * 정의 문서 메타데이터.
 *
 * 실제 문서 내용이 아니라 **메타데이터**만 관리한다.
 * 좌표(address)는 등록 시 scope × aspect × depth에서 자동 계산된다 (불변 정체성).
 * lifecycle은 좌표에 포함하지 않는다 — 변하는 상태이므로 메타데이터 필드로만 관리.
 */
export interface DefinitionEntry {
  readonly id: string;
  readonly title: string;
  readonly description?: string;

  // 좌표 차원 (인코딩 입력)
  readonly scope: DefScope;
  readonly aspect: DefAspect;
  readonly depth: DefDepth;
  readonly lifecycle: DefLifecycle;

  // 좌표 (인코딩 결과 — register 시 자동 계산)
  readonly address?: number;
  readonly serialized?: string;  // "def_document:v1:<address>"

  // 메타
  readonly ref?: string;              // 외부 참조 (파일 경로, URL)
  readonly tags?: readonly string[];
  readonly createdAt: string;         // ISO-8601
  readonly updatedAt: string;         // ISO-8601

  // decision-flow 연결 (선택)
  readonly decisionRef?: DecisionRef;

  // 서비스 레지스트리 연결 (선택)
  /** 이 문서가 관련된 서비스 ID (registry-service의 serviceId) */
  readonly serviceId?: string;
}

/** 정의 간 관계 */
export interface DefinitionLink {
  readonly sourceId: string;
  readonly targetId: string;
  readonly linkType: LinkType;
  /** def_link prefix 좌표 (source의 scope × aspect × linkType) */
  readonly address?: number;
  readonly metadata?: Record<string, unknown>;
}

// ─── 레지스트리 ──────────────────────────────────────────

/** 필터 조건 */
export interface DefinitionFilter {
  readonly scope?: DefScope;
  readonly aspect?: DefAspect;
  readonly depth?: DefDepth;
  readonly lifecycle?: DefLifecycle;
  readonly tags?: readonly string[];
  readonly serviceId?: string;
}

/** 통계 */
export interface DefinitionStats {
  readonly totalEntries: number;
  readonly totalLinks: number;
  readonly byScope: Record<DefScope, number>;
  readonly byLifecycle: Record<DefLifecycle, number>;
  readonly byDepth: Record<DefDepth, number>;
}

/** 등록 입력 (address/serialized 제외 — 자동 계산) */
export type DefinitionEntryInput = Omit<DefinitionEntry, "address" | "serialized">;

/** 수정 가능한 필드 */
export type DefinitionEntryPatch = Partial<Pick<
  DefinitionEntry,
  "title" | "description" | "depth" | "lifecycle" | "ref" | "tags" | "decisionRef"
>>;
