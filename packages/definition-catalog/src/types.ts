// @def.doc definition-catalog-spec

/**
 * 소프트웨어 정의 카탈로그 — 핵심 타입
 *
 * 소프트웨어를 구성하는 정의(화면, 기능, 흐름, 상태, 제약, 데이터)를
 * 좌표계로 분류하고 관리하기 위한 타입 정의.
 */

import type { QualityGateSpec } from "work-domain";

// ─── 축 값 타입 (Dimension Value Types) ─────────────────

/**
 * 분해 레벨 — 문서의 역할을 3단계로 분류.
 *
 * 원칙: 모든 문서는 하나의 개념과 그 개념의 구성을 참조하는 완결된 정의여야 한다.
 *
 * | level  | 질문                         | 정의하는 것                    |
 * |--------|-----------------------------|-----------------------------|
 * | group  | "왜 이것들이 함께 있는가"      | 묶임의 이유 (조직적 경계)       |
 * | module | "이 개념은 무엇인가"          | 단일 개념 + 구성 요소 참조       |
 * | leaf   | "이 구성 요소는 어떻게 동작하는가" | 최종 명세 (더 이상 분해 안 함)   |
 *
 * contains 계층:
 *   group  → group | module  (그룹은 재귀 가능)
 *   module → module | leaf   (개념은 하위 개념 또는 구성 요소를 포함)
 *   leaf   → (없음)          (최종 명세는 자식 없음)
 */
export type DefLevel =
  | "group"      // 묶임의 이유를 설명 (재귀 가능)
  | "module"     // 단일 개념을 정의 (구성 요소를 포함)
  | "leaf";      // 구성 요소의 최종 명세 (자식 없음, 기본값)

/**
 * STC (Semantic Topological Coordinate) 구조 축 — 문서의 물리적/구조적 역할 (4 tier)
 * 기존 `level`을 대체하며, System 독립성과 Layout 분리를 달성한다.
 */
export type DefTier =
  | "component"  // 데이터 진입점 (shape, enum, 등)
  | "entry"      // 구체화 인스턴스 (canonical singleton)
  | "system"     // 기능 집합 (operations + 상태 관리 위임)
  | "layout"     // 시스템의 조직적 배치 (refs)
  | "exempt";    // 운영 메타-문서 면제 처리용

/**
 * 문서 유형 — spec(무엇) vs knowledge(왜)
 *
 * spec: 현재 시스템이 무엇으로 구성되어 있는가 (코드에서 파생 가능)
 * knowledge: 왜 이렇게 설계했는가 (사람만이 기록할 수 있는 정보)
 */
export type DefDocType = "design" | "spec" | "knowledge";

/**
 * 지식 문서 종류
 *
 * philosophy: 시스템 철학/본질 ("왜 좌표계인가")
 * adr: 아키텍처 결정 기록 ("ADR-001: 불변 주소")
 * guide: 사용법/판단 기준 ("scope 선택 가이드")
 * narrative: 진화 과정/맥락 ("시스템이 어떻게 여기까지 왔는가")
 * convention: 합의된 규칙 ("에러 코드 컨벤션")
 * pattern: 반복되는 설계 패턴 ("이벤트 수집 패턴")
 * concept: 개념 자체의 정의 ("좌표란 무엇인가", "taxonomy란 무엇인가")
 * proposal: 아직 확정되지 않은 제안/RFC
 * template: 문서 생성을 위한 뼈대 및 표준 양식
 */
export type KnowledgeKind =
  | "philosophy"
  | "adr"
  | "guide"
  | "narrative"
  | "convention"
  | "pattern"
  | "concept"
  | "proposal"
  | "template";

/** 대분류 — 무엇에 대한 정의인가 */
export type DefScope =
  | "ui"
  | "feature"
  | "flow"
  | "state"
  | "constraint"
  | "data"
  | "interface"
  | "meta";

/** 세부 측면 — 어떤 측면을 정의하는가 (40종, flat) */
export type DefAspect =
  // ui
  | "layout"
  | "component"
  | "interaction"
  // feature
  | "func_def"
  | "scenario"
  // feature — func_def 하위 세분화 (Phase 5b)
  | "codegen_func"
  | "harness_func"
  | "gate_func"
  | "analyzer_func"
  | "encoding_func"
  | "domain_service_func"
  | "nesting_func"
  // feature — encoding 계열 하위 세분화 (Mini-5b)
  | "codec_func"
  | "binder_func"
  | "format_func"
  // flow
  | "user_scenario"
  | "process_flow"
  | "relation"
  // flow — process_flow 하위 세분화 (Phase 5b)
  | "lifecycle_flow"
  | "ingest_flow"
  | "pipeline_flow"
  | "gate_flow"
  | "definition_mgmt_flow"
  // flow — definition-management 하위 세분화 (Mini-5b)
  | "mgmt_flow"
  | "quality_flow"
  | "harness_flow"
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
  | "prefix_schema"
  | "axis_catalog"
  // data — domain_data 하위 세분화 (Phase 5b)
  | "taxonomy_data"
  | "coordinate_model_data"
  // interface
  | "api_contract"
  | "cli_contract"
  | "event_contract"
  // interface — api_contract 하위 세분화 (Phase 5b)
  | "decode_contract"
  | "gate_contract"
  | "query_contract"
  | "browser_contract"
  | "pipeline_contract"
  // meta
  | "proposal_design";

/** 정의의 깊이 — 얼마나 상세한가 */
export type DefDepth =
  | "overview"        // 개요
  | "specification"   // 명세
  | "implementation"  // 구현
  | "validation";     // 검증

/**
 * 존재론적 계층 — "이것이 왜 존재하는가"
 *
 * scope × aspect × depth는 구조(무엇에 대한 정의인가)를 표현하고,
 * layer는 존재 이유(왜 이것이 존재하는가)를 표현한다. 직교.
 *
 * 구분 기준 — "이 코드/문서/DB를 삭제해도 비즈니스 진실이 바뀌는가?"
 *   예 → domain, 아니오+성능↓ → operation, 아니오+불편↑ → mediation, 아니오+유도↓ → experience
 *
 * 영향 전파:
 *   domain     → domain + operation + mediation (experience 직접 영향 없음)
 *   operation  → operation 내부만 (domain/mediation/experience 영향 없음)
 *   mediation  → mediation + experience (domain 역전파 없음)
 *   experience → experience 내부만 (상향 전파 없음)
 */
export type DefLayer =
  | "domain"       // 비즈니스 본질 — "이것이 참이다" (엔티티, 상태, 정책, 계약, 결정)
  | "operation"    // 시스템 운영 — "시스템이 돌아가게 한다" (DB 스키마, 캐시, 큐, 모니터링)
  | "mediation"    // 중재/번역 — "진실을 소비 가능하게 변환" (API 포맷, 에러 매핑, 검색 인덱스, 편의 캐시)
  | "experience";  // 경험 설계 — "사용자 행동을 유도한다" (UI 흐름, 위자드, 힌트, CTA)

/** 문서 생명주기 */
export type DefLifecycle =
  | "draft"       // 초안
  | "review"      // 검토중
  | "approved"    // 승인
  | "deprecated"  // 폐기예정
  | "archived";   // 보관

/** 투영 평면 — 지식의 출처와 주권 */
export type ProjectionPlane =
  | "intent"      // 설계자의 규범적 의도
  | "execution";  // 코드의 실증적 사실

/** 의도 위계 — 시스템 내 역할 비중 */
export type IntentHierarchy =
  | "core"        // 도메인 본질 로직
  | "auxiliary";  // 인프라/지원 로직 (Sidecar)

/** 계보 패싯 — 혈통 상의 상태 전이 */
export type LineageFacet =
  | "ingress"     // 유입
  | "checkpoint"  // 검문 (Manage)
  | "transform"   // 변환 (Produce)
  | "egress";      // 안착/유출 (Store)

/** 계보 상세 유형 */
export type LineageKind =
  // Ingress
  | "interaction" | "call" | "subscription" | "load"
  // Traversal
  | "validation" | "mapping" | "enrichment" | "branching"
  // Egress
  | "settlement" | "emission" | "response" | "suspension";

/** 정의 간 관계 유형 */
export type LinkType =
  | "depends_on"   // 의존
  | "implements"   // 구현
  | "refines"      // 구체화
  | "constrains"   // 제약
  | "traces_to"    // 추적
  | "contains"     // 포함 — 그룹이 멤버를 포함
  | "evolves_from" // 개정/버전 진화
  | "supersedes"   // 이전 개정 대체
  | "refs";        // 조직적 배치 — Layout이 System을 카탈로그로 참조할 때 사용 (STC D-4)

// ─── Meta-Taxonomy — taxonomy 분류군 ────────────────────

/**
 * taxonomy 분류군 — taxonomy 자체를 분류하는 상위 체계.
 *
 * | 분류군       | 자체 좌표계 | 타 좌표계 연결 | 역할                              |
 * |-------------|:---------:|:------------:|----------------------------------|
 * | topological | O         | —            | 대상의 위치를 정의한다               |
 * | functional  | —         | —            | 대상에 역할·기능을 부여한다           |
 * | bridge      | O         | O            | 자체 좌표계로 타 좌표계의 의도를 보존  |
 */
export type TaxonomyFamily =
  | "topological"   // 위상 좌표계 — 대상의 위치 정의
  | "functional"    // 기능 부여 — 대상에 역할·기능 부여
  | "bridge";       // 브릿지 — 자체 좌표 + 타 좌표계 의도 보존

/**
 * taxonomy 등록 메타데이터.
 *
 * 각 taxonomy를 meta-taxonomy에 등록할 때 사용하는 구조.
 * topological/bridge는 coordinateAxes 필수, bridge는 bridgeTarget 필수.
 */
export interface TaxonomyMeta {
  /** taxonomy 고유 식별자 */
  readonly id: string;
  /** 사람이 읽는 이름 */
  readonly name: string;
  /** 분류군 */
  readonly family: TaxonomyFamily;
  /** 이 taxonomy가 답하는 1차 질문 */
  readonly primaryQuestion: string;
  /** 소유 개념 목록 */
  readonly ownedConcepts: readonly string[];
  /** 자체 좌표계 축 (topological, bridge만 해당) */
  readonly coordinateAxes?: readonly string[];
  /** 연결 대상 taxonomy id (bridge만 해당) */
  readonly bridgeTarget?: string;
  /** 연결의 역할 설명 (bridge만 해당) */
  readonly bridgeRole?: string;
}

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

/** 상태 관리 위임 참조 (D-17) */
export interface LifecycleRef {
  /** 상태 목록을 정의한 Component 문서 ID */
  readonly stateComponent: string;
  /** meta-semantic pipe 문서 참조 (transitionId 포함) */
  readonly pipeRefs?: readonly string[];
  /** 읽기 전용 여부 (write-mode가 없으면 true) */
  readonly readOnlyProjection?: boolean;
  /** 추가 설명 */
  readonly notes?: string;
}

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
  /** 사람 기준 버전 ID (예: "v1", "2026.03") */
  readonly version?: string;
  /** 문서 개정 번호 (기본: 1) */
  readonly revision?: number;

  // 문서 유형 (기본: spec)
  readonly type?: DefDocType;
  /** knowledge 문서의 세부 종류 (type=knowledge일 때만 유의미) */
  readonly knowledgeKind?: KnowledgeKind;

  // 좌표 차원 (인코딩 입력 — scope × aspect × depth)
  readonly scope?: DefScope;
  // 분해 레벨 (메타데이터 — 좌표에 인코딩하지 않음. 변할 수 있으므로)
  readonly level?: DefLevel;
  // STC 구조 축 (D-17, 메타데이터)
  readonly tier?: DefTier;
  readonly aspect?: DefAspect;
  readonly depth?: DefDepth;
  readonly lifecycle: DefLifecycle;
  /** 존재론적 계층 — business / interaction / binding (선택, 기본: business) */
  readonly layer?: DefLayer;

  // ─── 추적 및 소유권 (D-19/20) ───
  /** 최상위 소유 시스템 ID */
  readonly owner_system?: string;
  /** 투영 평면 */
  readonly projection_plane?: ProjectionPlane;
  /** 의도 위계 */
  readonly intent_hierarchy?: IntentHierarchy;
  /** 계보 패싯 */
  readonly lineage_facet?: LineageFacet;
  /** 계보 상세 유형 */
  readonly lineage_kind?: LineageKind;

  // 상태 관리 위임 (선택)
  readonly lifecycleRef?: LifecycleRef;

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

  // 품질 게이트 연결 (선택)
  /** validation 문서가 실행 가능한 품질 게이트를 함께 정의할 때 사용 */
  readonly gate?: QualityGateSpec;
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
  readonly type?: DefDocType;
  readonly knowledgeKind?: KnowledgeKind;
  readonly scope?: DefScope;
  readonly aspect?: DefAspect;
  readonly depth?: DefDepth;
  readonly lifecycle?: DefLifecycle;
  readonly layer?: DefLayer;
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

/**
 * 등록 입력.
 *
 * 기본은 address/serialized 자동 계산이지만,
 * frontmatter에 explicit address(v1/v2)가 이미 있으면 이를 병행 입력으로 허용한다.
 */
export type DefinitionEntryInput =
  Omit<DefinitionEntry, "address" | "serialized">
  & Partial<Pick<DefinitionEntry, "address" | "serialized">>;

/** 수정 가능한 필드 */
export type DefinitionEntryPatch = Partial<Pick<
  DefinitionEntry,
  "title" | "description" | "version" | "revision" | "depth" | "lifecycle" | "ref" | "tags" | "decisionRef" | "tier" | "lifecycleRef"
>>;
