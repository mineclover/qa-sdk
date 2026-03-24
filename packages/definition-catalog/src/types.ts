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

/** 세부 측면 — 어떤 측면을 정의하는가 (17종, flat) */
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
  | "traces_to";   // 추적

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
 * 좌표(address)는 등록 시 scope × aspect × depth × lifecycle에서 자동 계산된다.
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
