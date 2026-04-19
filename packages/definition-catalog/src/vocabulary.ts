// @def.doc definition-catalog-spec

/**
 * 소프트웨어 정의 도메인 축 정의 (Vocabulary)
 *
 * 소프트웨어를 정의하는 문서의 메타데이터를 좌표로 관리하기 위한 축.
 * decision-flow가 "왜(why)"를 축으로 표현한다면,
 * definition-catalog는 "무엇(what)"을 축으로 표현한다.
 *
 * 각 축은 5Q 자격 검증을 통과한다:
 *   Q1 유한? Q2 정의 분류와 관련? Q3 여러 prefix에서 공유? Q4 안정? Q5 capacity 관리?
 *
 * entries는 snake_case. capacity는 nextPowerOf2(entries.length * 2) 이상.
 */

// ─── VersionedAxis (의존 없이 자체 정의) ────────────────

/** @qa-sdk/core 호환 VersionedAxis 인터페이스 */
export interface VersionedAxis {
  readonly id: string;
  readonly name: string;
  readonly versions: Record<string, {
    readonly entries: readonly string[];
    readonly capacity?: number;
    readonly ko?: Record<string, string>;
  }>;
}

// ─── 축 설명력 메타데이터 ─────────────────────────────────

/** 축의 설명력 역할 */
export type ExplanatoryRole = "primary" | "secondary" | "contextual" | "relation";

/** 축의 설명력 메타데이터 */
export interface AxisExplanatoryMeta {
  readonly role: ExplanatoryRole;
  readonly explains: string;
  readonly designRationale: string;
  readonly orthogonalTo: readonly string[];
}

// ─── 헬퍼 ────────────────────────────────────────────────

function toVersionedAxis(
  id: string,
  name: string,
  def: { readonly entries: readonly string[]; readonly capacity: number; readonly ko: Record<string, string> },
): VersionedAxis {
  return {
    id,
    name,
    versions: { v1: { entries: def.entries, capacity: def.capacity, ko: def.ko } },
  };
}

// ─── 축 정의 ─────────────────────────────────────────────

/**
 * def_level — 분해 레벨 (5 entries, capacity 8)
 *
 * 5Q: ✓유한(5) ✓분류 관련(분해 단위 결정) ✓공유(전 prefix) ✓안정(시스템 구조 안정) ✓capacity
 * 설명력: 문서가 전체-부분 분해 구조에서 어느 레벨인지. scope보다 상위 개념.
 * L0~L1에서는 scope가 의미 약화, L2 이하에서 scope가 본래 역할 수행.
 */
export const DEF_LEVEL = {
  entries: ["system", "area", "unit", "module", "leaf"] as const,
  capacity: 16,  // nextPowerOf2(5 * 2 = 10) = 16
  ko: {
    system: "시스템",
    area: "영역",
    unit: "단위",
    module: "모듈",
    leaf: "리프",
  } as Record<string, string>,
} as const;

/**
 * def_scope — 정의 대분류 (7 entries, capacity 16)
 *
 * 5Q: ✓유한(7) ✓분류 관련(문서 종류 결정) ✓공유(전 prefix) ✓안정(SW 정의 기본 분류) ✓capacity
 * 설명력: 소프트웨어 정의의 최상위 분류. 이 축이 다르면 문서의 성격이 근본적으로 달라진다.
 */
export const DEF_SCOPE = {
  entries: ["ui", "feature", "flow", "state", "constraint", "data", "interface"] as const,
  capacity: 16,  // nextPowerOf2(7 * 2 = 14) = 16
  ko: {
    ui: "화면/UI",
    feature: "기능",
    flow: "흐름",
    state: "상태",
    constraint: "제약조건",
    data: "데이터",
    interface: "인터페이스",
  } as Record<string, string>,
} as const;

/**
 * def_aspect — 세부 측면 (22 entries, capacity 64)
 *
 * 5Q: ✓유한(22) ✓분류 관련(세부 유형 결정) ✓공유(전 prefix) ✓안정(느린 변화) ✓capacity
 * 설명력: 대분류 내 세부 유형. scope와 함께 문서의 정확한 주제를 결정한다.
 * 주의: scope-aspect 간 유효 조합 제약 있음 (taxonomy.ts VALID_SCOPE_ASPECTS 참조).
 */
export const DEF_ASPECT = {
  entries: [
    // ui (3)
    "layout", "component", "interaction",
    // feature (2)
    "func_def", "scenario",
    // flow (3)
    "user_scenario", "process_flow", "relation",
    // state (3)
    "app_state", "domain_state", "system_state",
    // constraint (3)
    "tech_constraint", "biz_constraint", "infra_constraint",
    // data (5)
    "domain_data", "system_data", "external_data", "prefix_schema", "axis_catalog",
    // interface (3)
    "api_contract", "cli_contract", "event_contract",
  ] as const,
  capacity: 64,  // nextPowerOf2(22 * 2 = 44) = 64
  ko: {
    layout: "레이아웃",
    component: "컴포넌트",
    interaction: "인터랙션",
    func_def: "기능정의",
    scenario: "시나리오",
    user_scenario: "사용자시나리오",
    process_flow: "프로세스흐름",
    relation: "연관관계",
    app_state: "앱상태",
    domain_state: "도메인상태",
    system_state: "시스템상태",
    tech_constraint: "기술적제약",
    biz_constraint: "비즈니스제약",
    infra_constraint: "인프라제약",
    domain_data: "도메인데이터",
    system_data: "시스템데이터",
    external_data: "외부데이터",
    prefix_schema: "Prefix스키마",
    axis_catalog: "Axis카탈로그",
    api_contract: "API계약",
    cli_contract: "CLI계약",
    event_contract: "이벤트계약",
  } as Record<string, string>,
} as const;

/**
 * def_depth — 정의의 깊이 (4 entries, capacity 8)
 *
 * 5Q: ✓유한(4) ✓분류 관련(상세도 결정) ✓공유(전 prefix) ✓안정 ✓capacity
 * 설명력: 같은 주제라도 개요와 구현 명세는 다른 문서다. scope×aspect 내에서 깊이를 구분한다.
 */
export const DEF_DEPTH = {
  entries: ["overview", "specification", "implementation", "validation"] as const,
  capacity: 8,  // nextPowerOf2(4 * 2 = 8) = 8
  ko: {
    overview: "개요",
    specification: "명세",
    implementation: "구현",
    validation: "검증",
  } as Record<string, string>,
} as const;

/**
 * def_lifecycle — 문서 생명주기 (5 entries, capacity 16)
 *
 * 5Q: ✓유한(5) ✓분류 관련(문서 성숙도) ✓공유(전 prefix) ✓안정 ✓capacity
 * 설명력: 초안과 승인된 문서는 신뢰도가 다르다. 문서의 현재 상태를 좌표에 반영한다.
 */
export const DEF_LIFECYCLE = {
  entries: ["draft", "review", "approved", "deprecated", "archived"] as const,
  capacity: 16,  // nextPowerOf2(5 * 2 = 10) = 16
  ko: {
    draft: "초안",
    review: "검토중",
    approved: "승인",
    deprecated: "폐기예정",
    archived: "보관",
  } as Record<string, string>,
} as const;

/**
 * link_type — 정의 간 관계 유형 (8 entries, capacity 16)
 *
 * 5Q: ✓유한(8) ✓분류 관련(관계 종류) ✓공유(def_link) ✓안정 ✓capacity
 * 설명력: 정의 간 관계의 성격을 구분한다. 의존과 구체화는 방향과 의미가 다르다.
 * contains는 그룹→멤버 포함 관계로, 계층 구조와 concern 전파의 경로가 된다.
 */
export const LINK_TYPE = {
  entries: ["depends_on", "implements", "refines", "constrains", "traces_to", "contains", "evolves_from", "supersedes"] as const,
  capacity: 16,  // nextPowerOf2(8 * 2 = 16) = 16
  ko: {
    depends_on: "의존",
    implements: "구현",
    refines: "구체화",
    constrains: "제약",
    traces_to: "추적",
    contains: "포함",
    evolves_from: "진화원본",
    supersedes: "대체",
  } as Record<string, string>,
} as const;

/**
 * doc_seq — 문서 순번 (유형 내 유일 식별)
 *
 * 같은 scope×aspect×depth 내에서 개별 문서를 구분하는 순번.
 * capacity 128 → 같은 유형에 최대 128건.
 * 주소 = scope × aspect × depth × doc_seq → 유일 식별자.
 */
export const DOC_SEQ = {
  capacity: 128,
} as const;

// ─── Meta-Taxonomy — taxonomy 분류군 ────────────────────

/**
 * taxonomy_family — taxonomy 분류군 (3 entries, capacity 8)
 *
 * 5Q: ✓유한(3) ✓분류 관련(taxonomy 종류 결정) ✓공유(전 taxonomy) ✓안정(메타 구조) ✓capacity
 * 설명력: taxonomy 자체가 어떤 종류의 분류 기능을 제공하는지 결정한다.
 */
export const TAXONOMY_FAMILY = {
  entries: ["topological", "functional", "bridge"] as const,
  capacity: 8,  // nextPowerOf2(3 * 2 = 6) = 8
  ko: {
    topological: "위상좌표계",
    functional: "기능부여",
    bridge: "브릿지",
  } as Record<string, string>,
} as const;

/**
 * taxonomy 레지스트리 — 각 taxonomy의 meta-taxonomy 등록 정보.
 *
 * 새 taxonomy 추가 시 여기에 등록한다.
 * 이 레지스트리가 meta-taxonomy의 SSOT다.
 */
export const TAXONOMY_REGISTRY: Record<string, {
  readonly name: string;
  readonly family: (typeof TAXONOMY_FAMILY.entries)[number];
  readonly primaryQuestion: string;
  readonly ownedConcepts: readonly string[];
  readonly coordinateAxes?: readonly string[];
  readonly bridgeTarget?: string;
  readonly bridgeRole?: string;
}> = {
  "definition-taxonomy": {
    name: "정의 분류",
    family: "topological",
    primaryQuestion: "어떤 인지 관점으로 읽고 기록할 것인가",
    ownedConcepts: ["scope", "aspect", "depth", "level", "layer", "lifecycle"],
    coordinateAxes: ["def_scope", "def_aspect", "def_depth", "doc_seq"],
  },
  "structural-taxonomy": {
    name: "구조 분류",
    family: "topological",
    primaryQuestion: "실제로 어떤 단위가 존재하고 어떻게 배열되는가",
    ownedConcepts: ["facet", "boundary", "runtime_scope", "contract"],
    coordinateAxes: ["facet", "boundary", "runtime_scope"],
  },
  "observability-taxonomy": {
    name: "관측 분류",
    family: "functional",
    primaryQuestion: "무엇을 어떤 층위에서 관측하는가",
    ownedConcepts: ["semantic_address", "telemetry", "infra_observe"],
  },
  "pm-taxonomy": {
    name: "전달 분류",
    family: "functional",
    primaryQuestion: "무엇을 누가 언제 끝내는가",
    ownedConcepts: ["initiative", "epic", "deliverable", "task", "checkpoint"],
  },
  "df-taxonomy": {
    name: "의사결정 분류",
    family: "bridge",
    primaryQuestion: "왜 이런 판단을 했는가",
    ownedConcepts: ["DecisionUnit", "Evidence", "DecisionLayer", "verdict"],
    coordinateAxes: ["decision_path", "decision_layer"],
    bridgeTarget: "definition-taxonomy",
    bridgeRole: "스펙관리의 의사결정 의도를 자체 좌표 공간에 기억한다",
  },
} as const;

// ─── VersionedAxis 변환 ──────────────────────────────────

/** 카탈로그 호환 VersionedAxis 목록 */
export const DEFINITION_AXES: Record<string, VersionedAxis> = {
  def_level: toVersionedAxis("def_level", "분해 레벨", DEF_LEVEL),
  def_scope: toVersionedAxis("def_scope", "정의 대분류", DEF_SCOPE),
  def_aspect: toVersionedAxis("def_aspect", "세부 측면", DEF_ASPECT),
  def_depth: toVersionedAxis("def_depth", "정의 깊이", DEF_DEPTH),
  def_lifecycle: toVersionedAxis("def_lifecycle", "생명주기", DEF_LIFECYCLE),
  link_type: toVersionedAxis("link_type", "관계 유형", LINK_TYPE),
};

// ─── 축 설명력 메타 레지스트리 ────────────────────────────

/** 축별 설명력 메타데이터 */
export const AXIS_META: Record<string, AxisExplanatoryMeta> = {
  def_scope: {
    role: "primary",
    explains: "문서가 소프트웨어의 어떤 측면을 정의하는가 (UI, 기능, 흐름, 상태, 제약, 데이터, 인터페이스)",
    designRationale: "소프트웨어 정의의 7대 분류는 아키텍처 관점에서 직교하는 관심사다. " +
      "UI를 정의하는 문서와 데이터를 정의하는 문서는 독자, 형식, 검증 방법이 모두 다르다. " +
      "인터페이스(API/CLI/이벤트)는 기능이 아니라 접근 계약이므로 별도 scope.",
    orthogonalTo: ["def_depth", "def_lifecycle"],
  },
  def_aspect: {
    role: "primary",
    explains: "대분류 내에서 구체적으로 어떤 세부 유형을 정의하는가",
    designRationale: "레이아웃 정의와 컴포넌트 정의는 같은 UI지만 다른 문서다. " +
      "scope만으로는 문서의 정확한 주제를 특정할 수 없다. " +
      "scope-aspect 쌍이 함께 문서의 정체성을 결정한다. " +
      "data scope에 prefix_schema/axis_catalog를 두어 좌표 정의 문서도 관리한다.",
    orthogonalTo: ["def_depth", "def_lifecycle"],
  },
  def_depth: {
    role: "secondary",
    explains: "같은 주제를 얼마나 깊이 다루는가 (개요 vs 명세 vs 구현 vs 검증)",
    designRationale: "컴포넌트 개요와 컴포넌트 구현 명세는 독자와 목적이 다르다. " +
      "depth가 없으면 같은 scope×aspect 내 문서들을 구분할 수 없다.",
    orthogonalTo: ["def_scope", "def_aspect", "def_lifecycle"],
  },
  def_lifecycle: {
    role: "contextual",
    explains: "문서가 현재 어떤 상태인가 (초안, 검토, 승인, 폐기, 보관)",
    designRationale: "초안 문서와 승인된 문서는 신뢰도가 다르다. " +
      "생명주기는 문서의 내용이 아니라 상태를 측정하는 메타 축이다.",
    orthogonalTo: ["def_scope", "def_aspect", "def_depth"],
  },
  link_type: {
    role: "relation",
    explains: "두 정의 사이의 관계가 어떤 성격인가 (의존, 구현, 구체화, 제약, 추적)",
    designRationale: "관계의 종류에 따라 전이 규칙이 다르다. " +
      "의존은 전이적이지만 구현은 아닐 수 있다.",
    orthogonalTo: ["def_scope", "def_aspect"],
  },
};
