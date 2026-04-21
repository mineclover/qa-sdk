// @def.doc definition-taxonomy

/**
 * 소프트웨어 정의 분류 체계 (Taxonomy)
 *
 * 7대 분류(scope) × 세부 측면(aspect)의 트리 구조를 정의한다.
 * def_scope와 def_aspect는 독립 축이지만 유효 조합이 제한된다.
 * VALID_SCOPE_ASPECTS가 이 제약을 표현한다.
 *
 * 좌표 공간(16×64)에서 실제 유효한 조합은 22개다.
 * 등록 시 validateScopeAspect()로 검증한다.
 */

import type { DefScope, DefAspect, LinkType, ConcernTag, StructuralTag, KnownTag } from "./types.js";

// ─── 분류 체계 트리 ──────────────────────────────────────

/** 세부 측면 정의 */
export interface TaxonomyAspect {
  readonly id: DefAspect;
  readonly name: string;
  readonly description: string;
}

/** 대분류 정의 */
export interface TaxonomyScope {
  readonly id: DefScope;
  readonly name: string;
  readonly description: string;
  readonly aspects: readonly TaxonomyAspect[];
}

/** 전체 분류 체계 */
export interface DefinitionTaxonomy {
  readonly scopes: readonly TaxonomyScope[];
}

// ─── 분류 체계 데이터 ────────────────────────────────────

/** 소프트웨어 정의 분류 체계 */
export const DEFINITION_TAXONOMY: DefinitionTaxonomy = {
  scopes: [
    {
      id: "ui",
      name: "화면/UI",
      description: "사용자가 보고 상호작용하는 시각적 요소의 정의",
      aspects: [
        { id: "layout", name: "레이아웃", description: "화면의 공간 배치와 구조" },
        { id: "component", name: "컴포넌트", description: "재사용 가능한 UI 구성 요소" },
        { id: "interaction", name: "인터랙션", description: "사용자 상호작용 동작과 피드백" },
      ],
    },
    {
      id: "feature",
      name: "기능",
      description: "시스템이 제공하는 기능과 시나리오의 정의",
      aspects: [
        { id: "func_def", name: "기능정의", description: "기능의 명세와 동작 규칙 (fallback, func_def 하위 값이 맞지 않을 때)" },
        { id: "scenario", name: "시나리오", description: "기능의 사용 시나리오와 기대 결과" },
        // Phase 5b func_def 하위 세분화
        { id: "codegen_func", name: "코드생성기능", description: "카탈로그/스키마를 TypeScript/Proto 소스 코드로 생성" },
        { id: "harness_func", name: "하네스기능", description: "테스트 하네스/FSM/문서-코드 1:1 분해 실행 기능" },
        { id: "gate_func", name: "게이트기능", description: "품질 게이트·정합성 검증 엔진 기능" },
        { id: "analyzer_func", name: "분석기능", description: "수집된 이벤트/문서에 대한 분석·drift·tracker 기능" },
        { id: "encoding_func", name: "인코딩기능", description: "좌표/값 인코딩·디코딩·pack-format 기능 (weighted-index/partial-binder/cq) — umbrella fallback" },
        { id: "domain_service_func", name: "도메인서비스기능", description: "도메인 비즈니스 서비스 기능 (e-commerce, 결제, 콘텐츠)" },
        { id: "nesting_func", name: "스코프중첩기능", description: "Provider/scope nesting pattern 의 lifecycle/resolution 기능" },
        // Mini-5b: encoding 하위 세분화 (sibling of encoding_func)
        { id: "codec_func", name: "코덱기능", description: "조합형 encoding/decoding 통합 기능 (coord-query 등 binder + format 결합)" },
        { id: "binder_func", name: "바인더기능", description: "partial-binder 등 인코딩 입력 바인딩 기능" },
        { id: "format_func", name: "포맷기능", description: "pack-format 등 인코딩 결과 포맷 정의 기능" },
      ],
    },
    {
      id: "flow",
      name: "흐름",
      description: "사용자와 시스템 간 흐름의 정의",
      aspects: [
        { id: "user_scenario", name: "사용자시나리오", description: "사용자 관점의 작업 흐름" },
        { id: "process_flow", name: "프로세스흐름", description: "시스템 내부 처리 순서 (fallback, process_flow 하위 값이 맞지 않을 때)" },
        { id: "relation", name: "연관관계", description: "엔티티/기능 간 연결과 의존성" },
        // Phase 5b process_flow 하위 세분화
        { id: "lifecycle_flow", name: "라이프사이클흐름", description: "브라우저/프로세스/세션 lifecycle 상태 전이 흐름" },
        { id: "ingest_flow", name: "수집흐름", description: "이벤트/로그 ingest 파이프라인 흐름" },
        { id: "pipeline_flow", name: "파이프라인흐름", description: "일반 파이프라인 처리 단계 흐름 (realization/enrichment)" },
        { id: "gate_flow", name: "게이트흐름", description: "gate 캐시 무효화·consistency·query quality 흐름" },
        { id: "definition_mgmt_flow", name: "정의관리흐름", description: "definition-catalog 관리(harness/observability/quality) 흐름 — umbrella fallback" },
        // Mini-5b: definition_mgmt_flow 하위 세분화 (sibling of definition_mgmt_flow)
        { id: "mgmt_flow", name: "관리흐름", description: "definition 관리/관측 모델 흐름 (mgmt-observability-model)" },
        { id: "quality_flow", name: "품질흐름", description: "definition 서비스 품질 번들 흐름 (service-quality-bundle)" },
        { id: "harness_flow", name: "하네스흐름", description: "definition 하네스 아키텍처 흐름 (harness-architecture)" },
      ],
    },
    {
      id: "state",
      name: "상태",
      description: "시스템의 다양한 수준에서의 상태 정의",
      aspects: [
        { id: "app_state", name: "앱상태", description: "프론트엔드 애플리케이션 상태" },
        { id: "domain_state", name: "도메인상태", description: "비즈니스 도메인 상태 모델" },
        { id: "system_state", name: "시스템상태", description: "인프라/런타임 수준 상태" },
      ],
    },
    {
      id: "constraint",
      name: "제약조건",
      description: "시스템에 부과되는 제한과 규칙의 정의",
      aspects: [
        { id: "tech_constraint", name: "기술적제약", description: "기술 스택, 성능, 호환성 제약" },
        { id: "biz_constraint", name: "비즈니스제약", description: "비즈니스 규칙, 정책, 규정 제약" },
        { id: "infra_constraint", name: "인프라제약", description: "인프라, 배포, 운영 환경 제약" },
      ],
    },
    {
      id: "data",
      name: "데이터",
      description: "시스템이 다루는 데이터의 구조와 출처 정의",
      aspects: [
        { id: "domain_data", name: "도메인데이터", description: "비즈니스 도메인 엔티티와 스키마 (fallback, domain_data 하위 값이 맞지 않을 때)" },
        { id: "system_data", name: "시스템데이터", description: "설정, 로그, 메트릭 등 시스템 데이터" },
        { id: "external_data", name: "외부데이터", description: "외부 API, 서드파티 데이터 연동" },
        { id: "prefix_schema", name: "Prefix스키마", description: "좌표 prefix의 차원 구성, 버전, capacity 정의" },
        { id: "axis_catalog", name: "Axis카탈로그", description: "좌표 축의 entries, capacity, headroom 정의" },
        // Phase 5b domain_data 하위 세분화
        { id: "taxonomy_data", name: "분류체계데이터", description: "분류 체계(taxonomy) 데이터 — meta-taxonomy 포함" },
        { id: "coordinate_model_data", name: "좌표모델데이터", description: "좌표·주소·차원 데이터 모델" },
      ],
    },
    {
      id: "interface",
      name: "인터페이스",
      description: "시스템에 접근하는 계약(contract)의 정의 — 기능이 아니라 접근 방식",
      aspects: [
        { id: "api_contract", name: "API계약", description: "REST/gRPC 엔드포인트, 요청/응답 스키마, 인증 (fallback, api_contract 하위 값이 맞지 않을 때)" },
        { id: "cli_contract", name: "CLI계약", description: "커맨드, 플래그, 옵션, 출력 형식 정의" },
        { id: "event_contract", name: "이벤트계약", description: "이벤트 스키마, 메시지 포맷, 발행/구독 규약" },
        // Phase 5b api_contract 하위 세분화
        { id: "decode_contract", name: "디코드계약", description: "decode 서비스·API·스펙 계약" },
        { id: "gate_contract", name: "게이트계약", description: "gate 서비스·이벤트 버스 API 계약" },
        { id: "query_contract", name: "쿼리계약", description: "query 서비스 API 계약" },
        { id: "browser_contract", name: "브라우저계약", description: "브라우저 런타임/프로토콜 계약" },
        { id: "pipeline_contract", name: "파이프라인계약", description: "파이프라인 aggregator·cache 계약" },
      ],
    },
    {
      id: "meta",
      name: "메타-설계",
      description: "정규 스펙의 규칙 자체를 재정의 대상으로 삼는 메타 설계 제안(RFC)의 정의",
      aspects: [
        { id: "proposal_design", name: "제안 설계", description: "제안 문서 분류자 — RFC/proposal 단계의 메타 설계 문서" },
      ],
    },
  ],
};

// ─── scope-aspect 유효 조합 제약 ─────────────────────────

/**
 * scope별 유효한 aspect 목록.
 *
 * def_scope × def_aspect 좌표 공간에서 유효한 조합만 허용한다.
 * 16 × 128 = 2,048 가능한 조합 중 40개만 유효.
 *
 * Phase 5b (aspect-vocab-split RFC): 4 상위 aspect (func_def/process_flow/api_contract/domain_data)
 * 에 17 개 자식 aspect 추가. 부모-자식 관계는 vocabulary.ts ASPECT_PARENTS 참조.
 */
export const VALID_SCOPE_ASPECTS: Record<DefScope, readonly DefAspect[]> = {
  ui: ["layout", "component", "interaction"],
  feature: [
    "func_def", "scenario",
    // func_def 하위
    "codegen_func", "harness_func", "gate_func", "analyzer_func",
    "encoding_func", "domain_service_func", "nesting_func",
    // Mini-5b: encoding 하위 세분화 (sibling of encoding_func, child of func_def)
    "codec_func", "binder_func", "format_func",
  ],
  flow: [
    "user_scenario", "process_flow", "relation",
    // process_flow 하위
    "lifecycle_flow", "ingest_flow", "pipeline_flow",
    "gate_flow", "definition_mgmt_flow",
    // Mini-5b: definition_mgmt_flow 하위 세분화 (sibling of definition_mgmt_flow, child of process_flow)
    "mgmt_flow", "quality_flow", "harness_flow",
  ],
  state: ["app_state", "domain_state", "system_state"],
  constraint: ["tech_constraint", "biz_constraint", "infra_constraint"],
  data: [
    "domain_data", "system_data", "external_data", "prefix_schema", "axis_catalog",
    // domain_data 하위
    "taxonomy_data", "coordinate_model_data",
  ],
  interface: [
    "api_contract", "cli_contract", "event_contract",
    // api_contract 하위
    "decode_contract", "gate_contract", "query_contract",
    "browser_contract", "pipeline_contract",
  ],
  meta: ["proposal_design"],
} as const;

/**
 * aspect → scope[] 역참조 맵 (자동 파생).
 *
 * N:M 소비 모델: 하나의 aspect가 여러 scope에서 소비될 수 있다.
 * VALID_SCOPE_ASPECTS에서 자동 파생.
 *
 * @example
 *   ASPECT_TO_SCOPES["scenario"] → ["feature"]         // v1: feature만 소비
 *   ASPECT_TO_SCOPES["scenario"] → ["feature", "flow"] // 미래: flow도 소비
 */
export const ASPECT_TO_SCOPES: Record<DefAspect, readonly DefScope[]> = (() => {
  const map: Record<string, DefScope[]> = {};
  for (const [scope, aspects] of Object.entries(VALID_SCOPE_ASPECTS)) {
    for (const aspect of aspects) {
      if (!map[aspect]) map[aspect] = [];
      map[aspect].push(scope as DefScope);
    }
  }
  return map as Record<DefAspect, readonly DefScope[]>;
})();

// ─── Semantic lint families ─────────────────────────────

export type SemanticLintTraversalLinkType = Extract<
  LinkType,
  "contains" | "depends_on" | "implements" | "refines"
>;

export interface SemanticLintFamilyRule {
  readonly id: string;
  readonly seeds: readonly string[];
  readonly traversal: readonly SemanticLintTraversalLinkType[];
  readonly containsDepthLimit: number;
  readonly allowCrossScopeMultiParent: boolean;
}

export const SEMANTIC_LINT_FAMILIES: readonly SemanticLintFamilyRule[] = [
  {
    id: "meta-semantic-boundary",
    seeds: [
      "meta-semantic-concepts",
      "ms-concept-boundary",
      "ms-concept-data-facets",
      "ms-concept-verification-unit",
      "ms-concept-contract-descent",
    ],
    traversal: ["contains", "depends_on", "implements", "refines"],
    containsDepthLimit: 6,
    allowCrossScopeMultiParent: true,
  },
] as const;

// ─── 검증 ────────────────────────────────────────────────

/**
 * scope-aspect 조합이 유효한지 검증한다.
 * @throws Error 무효 조합 시
 */
export function validateScopeAspect(scope?: DefScope, aspect?: DefAspect): void {
  if (!scope || !aspect) return;
  const valid = VALID_SCOPE_ASPECTS[scope];
  if (!valid) {
    throw new Error(`유효하지 않은 scope: "${scope}"`);
  }
  if (!valid.includes(aspect)) {
    throw new Error(
      `scope "${scope}"에서 aspect "${aspect}"는 유효하지 않습니다. ` +
      `유효한 aspect: [${valid.join(", ")}]`,
    );
  }
}

/**
 * scope-aspect 조합이 유효한지 boolean으로 반환한다.
 */
export function isValidScopeAspect(scope: DefScope, aspect: DefAspect): boolean {
  const valid = VALID_SCOPE_ASPECTS[scope];
  return valid != null && valid.includes(aspect);
}

/**
 * 모든 유효한 scope-aspect 조합을 반환한다.
 */
export function allValidCombinations(): readonly { scope: DefScope; aspect: DefAspect }[] {
  return Object.entries(VALID_SCOPE_ASPECTS).flatMap(
    ([scope, aspects]) => aspects.map(aspect => ({ scope: scope as DefScope, aspect })),
  );
}

// ─── LinkType 사용 규칙 ─────────────────────────────────

/**
 * LinkType별 의미와 사용 규칙.
 *
 * 관계 유형을 선택할 때 이 정의를 기준으로 판단한다.
 * 순환 허용 여부는 validateGraph()에서 사용.
 */
export interface LinkTypeRule {
  readonly id: LinkType;
  readonly name: string;
  /** 관계 읽는 법: "A {verb} B" */
  readonly verb: string;
  readonly description: string;
  /** true면 source에서 target으로만 흐르고, 역방향은 다른 의미 */
  readonly directional: boolean;
  /** 순환 참조 허용 여부 */
  readonly allowCycle: boolean;
  /** 1:N 제약 (target이 이 유형으로 여러 source를 가질 수 있는가) */
  readonly multiParent: boolean;
  /** 사용 기준 — 언제 이 유형을 선택하는가 */
  readonly when: string;
  /** 혼동 주의 — 다른 유형과의 구분 */
  readonly notTo: string;
}

export const LINK_TYPE_RULES: readonly LinkTypeRule[] = [
  {
    id: "contains",
    name: "포함",
    verb: "포함한다",
    description: "그룹이 멤버를 소속시키는 트리 관계. 그룹 overview → 멤버.",
    directional: true,
    allowCycle: false,
    multiParent: false,
    when: "시스템/그룹 문서가 하위 문서를 조직할 때. cross-scope 태그가 있으면 다중 소속 의도적 허용",
    notTo: "depends_on과 혼동 금지. '사용한다'는 depends_on, '소속시킨다'는 contains",
  },
  {
    id: "depends_on",
    name: "의존",
    verb: "의존한다",
    description: "A가 B 없이 동작할 수 없는 기능적 의존. 빌드/런타임 필수.",
    directional: true,
    allowCycle: false,
    multiParent: true,
    when: "A가 B의 API/타입/데이터를 직접 사용할 때",
    notTo: "refines와 혼동 금지. '구체화한다'는 refines, '필요로 한다'는 depends_on",
  },
  {
    id: "implements",
    name: "구현",
    verb: "구현한다",
    description: "A가 B에서 정의한 계약/인터페이스를 구현. specification → implementation.",
    directional: true,
    allowCycle: false,
    multiParent: true,
    when: "interface spec을 코드가 구현할 때, 추상 계약을 구체 모듈이 이행할 때",
    notTo: "refines와 혼동 금지. refines는 같은 추상도에서 상세화, implements는 추상→구체",
  },
  {
    id: "refines",
    name: "구체화",
    verb: "구체화한다",
    description: "A가 B의 범위를 좁혀 더 상세하게 기술. 같은 계층 내 상세화.",
    directional: true,
    allowCycle: false,
    multiParent: true,
    when: "overview → specification, 서비스 모듈이 시스템 문서를 상세화할 때",
    notTo: "implements와 혼동 금지. implements는 계약→코드, refines는 문서→상세문서",
  },
  {
    id: "constrains",
    name: "제약",
    verb: "제약한다",
    description: "A가 B에 규칙/제한을 부과. constraint 문서가 대상을 제약.",
    directional: true,
    allowCycle: false,
    multiParent: true,
    when: "constraint/* 문서가 다른 문서의 동작을 제한할 때",
    notTo: "depends_on과 혼동 금지. 제약은 '규칙 부과', 의존은 '기능 필요'",
  },
  {
    id: "traces_to",
    name: "추적",
    verb: "추적한다",
    description: "A의 이력이 B로 이어진다. 마이그레이션, 버전 이전 추적.",
    directional: true,
    allowCycle: false,
    multiParent: true,
    when: "deprecated 문서가 대체 문서를 가리킬 때, 버전 이전 추적",
    notTo: "depends_on과 혼동 금지. 런타임 의존이 아닌 이력 추적",
  },
] as const;

/** LinkType이 순환을 허용하는지 확인 */
export function isLinkCycleAllowed(lt: LinkType): boolean {
  return LINK_TYPE_RULES.find(r => r.id === lt)?.allowCycle ?? false;
}

/** LinkType이 다중 부모를 허용하는지 확인 */
export function isLinkMultiParentAllowed(lt: LinkType): boolean {
  return LINK_TYPE_RULES.find(r => r.id === lt)?.multiParent ?? true;
}

// ─── 태그 레지스트리 ─────────────────────────────────────

/** 횡단 관심사 태그 목록 */
export const CONCERN_TAGS: readonly ConcernTag[] = [
  "security", "performance", "accessibility",
  "observability", "testing", "migration", "deprecation",
];

/** 구조 태그 목록 */
export const STRUCTURAL_TAGS: readonly StructuralTag[] = [
  "cross-scope", "entry-point", "decision", "generated",
];

/** 알려진 태그 전체 목록 */
export const KNOWN_TAGS: readonly KnownTag[] = [...CONCERN_TAGS, ...STRUCTURAL_TAGS];

/**
 * 태그가 알려진 태그인지 확인한다.
 * 알려지지 않은 태그도 허용하되, 알려진 태그 사용을 권장한다.
 */
export function isKnownTag(tag: string): tag is KnownTag {
  return (KNOWN_TAGS as readonly string[]).includes(tag);
}

/**
 * tags 배열에서 cross-scope 여부를 감지한다.
 * scope 이름이 3개 이상 태그에 포함되면 분리 후보로 경고한다.
 */
export function detectCrossScope(tags: readonly string[]): {
  isCrossScope: boolean;
  scopeRefs: readonly DefScope[];
  shouldSplit: boolean;
} {
  const allScopes: DefScope[] = ["ui", "feature", "flow", "state", "constraint", "data", "interface", "meta"];
  const scopeRefs = allScopes.filter(s => tags.includes(s));
  return {
    isCrossScope: tags.includes("cross-scope") || scopeRefs.length >= 2,
    scopeRefs,
    shouldSplit: scopeRefs.length >= 3,
  };
}

// ─── 운영 컨벤션 ─────────────────────────────────────────

/**
 * 문서 분류 운영 컨벤션.
 *
 * 코드가 아닌 규칙이지만, 코드 옆에 두어 참조를 강제한다.
 */
export const CLASSIFICATION_CONVENTIONS = {
  /**
   * 컨벤션 1: scope 결정 기준 — "주 독자가 누구인가"
   *
   * 같은 주제라도 독자에 따라 scope가 다르다:
   * - API를 호출하는 사람 → interface/api_contract
   * - 흐름을 이해하려는 사람 → flow/process_flow
   * - 상태를 설계하는 사람 → state/domain_state
   */
  scopeByAudience: "주 독자 기준으로 scope를 결정한다",

  /**
   * 컨벤션 2: 여러 scope에 걸치면 — 쪼개고 link로 연결
   *
   * 하나의 문서에 scope 2개 이상이 걸리면:
   * 1. scope별로 독립 문서로 분리
   * 2. refines / depends_on / constrains 로 연결
   * 3. 정말 쪼갤 수 없으면: 주 scope 1개 + tags: ["cross-scope", ...]
   */
  splitAndLink: "여러 scope에 걸치면 분리 후 link. 불가능하면 cross-scope 태그",

  /**
   * 컨벤션 3: 횡단 관심사는 scope가 아니라 tag
   *
   * 보안, 성능, 접근성 등은 여러 scope에 걸치는 관심사다.
   * scope로 만들면 분류가 깨진다. tag로 횡단 추적한다.
   * query({ tags: ["security"] }) → 보안 관련 문서 전체 조회
   */
  concernAsTag: "횡단 관심사(보안, 성능 등)는 scope가 아니라 ConcernTag로 관리",

  /**
   * 컨벤션 4: aspect 추가 시 — 기존 scope의 성격과 비교
   *
   * 새 aspect가 필요할 때:
   * 1. "주 독자/성격"이 기존 scope의 aspect들과 동류인가?
   * 2. 동류면 해당 scope에 추가 (headroom 내)
   * 3. 아니면 다른 scope를 검토하거나 신규 scope 후보
   */
  aspectFitCheck: "새 aspect는 기존 scope의 동류 aspect와 성격 비교 후 배치",

  /**
   * 컨벤션 5: aspect 이동은 파괴적 — 마이그레이션 프로토콜
   *
   * scope 간 aspect 이동이 필요할 때:
   * 1. 기존 aspect는 유지 (주소 안정성)
   * 2. 새 aspect를 대상 scope에 추가
   * 3. 기존 문서를 새 좌표로 마이그레이션 (새 entry + 구 entry deprecated)
   * 4. traces_to 링크로 이전↔이후 추적
   */
  aspectMigration: "aspect 이동 = 새 entry 등록 + 구 entry deprecated + traces_to",

  /**
   * 컨벤션 6: cross-scope 3개 이상이면 분리 후보
   *
   * tags에 scope 이름이 3개 이상 들어가면:
   * → 이 문서는 너무 많은 관심사를 다루고 있다
   * → 분리하면 각각 더 명확한 좌표를 가진다
   * → detectCrossScope()로 자동 감지
   */
  splitThreshold: "tags에 scope 3개 이상 → 분리 후보 (detectCrossScope로 감지)",

  // ── 문서 작성 컨벤션 ──────────────────────────────────

  /**
   * 컨벤션 8: frontmatter 필수, 마커 섹션은 있으면 수집
   *
   * frontmatter의 def 블록은 필수 (좌표 정의).
   * ^purpose, ^overview 등 마커 섹션은 작성하면 수집된다.
   * 모든 문서에 모든 마커가 필요한 것은 아니다.
   */
  frontmatterRequired: "frontmatter 필수. 마커 섹션은 있으면 수집 (전부 작성할 필요 없음)",

  /**
   * 컨벤션 9: `## 목적 ^purpose` — 이 문서가 무엇인가 (섹션 분량)
   *
   * assembleFeature()가 이 섹션을 수집하여 그룹 요약을 조립한다.
   * 작성자가 요약에 포함할 내용을 명시적으로 통제한다.
   */
  purposeSection: "## 목적 ^purpose에 문서의 존재 이유를 섹션 분량으로 작성",

  /**
   * 컨벤션 10: `## 방법 ^method` — 하위 구성요소로 목적 달성 방법 (module/group 권장)
   *
   * 하위 구성요소를 주어로 써서 목적 달성 경로를 서술한다.
   * ^delegates 목록의 각 항목이 무엇을 하는지 흐름으로 연결.
   */
  methodSection: "## 방법 ^method에 하위 구성요소로 목적 달성 경로를 서술 (module/group 권장)",

  /**
   * 컨벤션 11: `## 구성 ^overview` — 핵심 사실 나열 (선택)
   *
   * 무엇이 있는가, 몇 개인가, 주요 항목 목록.
   * purpose보다 구체적이지만 상세는 아닌 수준.
   */
  overviewSection: "## 구성 ^overview에 핵심 사실을 나열 (선택, purpose보다 구체적)",

  /**
   * 컨벤션 12: 마커 없는 섹션은 detail (full에서만 보임)
   */
  unmarkedIsDetail: "마커 없는 섹션은 full 추출에서만 보임",

  /**
   * 컨벤션 13: 그룹 문서는 overview depth + contains 링크
   *
   * 그룹 문서의 목적에 시스템 전체 목적,
   * 구성에 멤버 목록과 구성 요약.
   */
  groupDocument: "그룹 문서 = overview depth + contains 링크 + 목적/구성 섹션",

  /**
   * 컨벤션 14: 자유 마커로 scope별 핵심 내용 수집
   *
   * purpose/overview 외에 scope에 맞는 자유 마커를 사용한다.
   * - constraint 문서: `## 불변 조건 ^constraint` → 제약 규칙 수집
   * - state 문서: `## 상태 정의 ^state-def` → 상태 정의 수집
   * - interface 문서: `## 엔드포인트 ^endpoints` → API 목록 수집
   * - concept/guide/viz 문서: `## 해석 관점 ^interpretation` → 복수 독해 렌즈 기록
   *
   * extractByMarker(body, "constraint") → 해당 섹션만 추출.
   * 마커 이름은 lowercase + 하이픈: ^my-marker
   */
  customMarkers: "자유 마커(^constraint, ^state-def, ^interpretation 등)로 scope별 핵심 내용 수집 가능",

  // ── 코드 참조 컨벤션 ──────────────────────────────────

  /**
   * 컨벤션 15: 인라인 코드 블록 금지 — 코드 위치 참조로 대체
   *
   * 문서에 TypeScript/코드를 직접 작성하면:
   * - 코드 변경 시 문서가 stale 됨 (이중 관리)
   * - 문서가 코드의 복사본이 되어 부정확해짐
   *
   * 대신 두 가지 방법 중 하나를 사용한다:
   * 1. 소스 경로 참조: `참조: packages/permission-engine/src/ternary-mask.ts:38-40`
   * 2. 코드-문서 공유 마커: 코드에 `// @def:marker-name` 주석, 문서에서 같은 마커 참조
   *
   * 예외: 의사 코드(pseudo-code)나 호출 패턴 예시는 허용 (실제 API가 아닌 개념 설명)
   */
  noInlineCode: "인라인 코드 블록 금지. 소스 경로 참조 또는 코드-문서 공유 마커 사용",

  /**
   * 컨벤션 16: 소스 위치 표기 — `## 관련 소스` 섹션 통일
   *
   * 문서 하단에 `## 관련 소스` 섹션을 두고 소스 파일 경로를 나열한다.
   * 형식: `- packages/<pkg>/src/<path>.ts — <한줄 설명>`
   * 이 섹션이 문서와 코드의 연결점 역할을 한다.
   */
  sourceSection: "문서 하단에 `## 관련 소스` 섹션으로 코드 위치를 통일된 형식으로 나열",

  // ── scope별 표준 마커 ──────────────────────────────────

  /**
   * 컨벤션 17: scope별 권장 마커
   *
   * | scope      | 필수 마커          | 권장 마커                          |
   * |------------|-------------------|---------------------------------|
   * | constraint | ^constraint       | ^precondition, ^postcondition   |
   * | state      | ^state-def        | ^failure                        |
   * | interface  | ^api-surface      | ^error-codes, ^inputs, ^outputs |
   * | feature    | —                 | ^behavior, ^evidence            |
   * | data       | —                 | ^schema                         |
   * | flow       | —                 | ^flow-steps, ^decision-point    |
   * | ui         | —                 | ^interaction                    |
   *
   * 모든 scope: ^purpose (필수), ^overview (권장)
   *
   * 계약 마커 (Contract Markers):
   * 문서 기반 계약 추출을 위한 전용 마커. depth와 조합하여 HyEvo 계약 레이어를 표현한다.
   * ^inputs, ^outputs — 입출력 정의 (interface scope, specification depth)
   * ^precondition — 사전 조건 (constraint scope, specification depth)
   * ^postcondition — 사후 조건 (constraint scope, validation depth)
   * ^decision-point — 분기 지점 (flow scope, specification depth)
   * ^failure — 실패 조건 (state scope, specification depth)
   * ^evidence — 증거 요구사항 (feature scope, validation depth)
   * ^flow-steps — 실행 단계 (flow scope, implementation depth)
   *
   * Prefix/Axis 문서 전용 마커:
   * ^intent — 설계 의도 (data/prefix_schema, 모든 depth). 코드에서 파생 불가능한 "왜"를 기록
   *
   * Experience 계층 전용 마커:
   * ^context — 사용 맥락 (언제/어떤 상황에서 이 도구를 쓰는가)
   * ^feedback — 피드백 규칙 (CLI 사용 패턴에 따른 개선 기준)
   * ^caveat — 주의사항 (한계, 오용 패턴, 잘못된 기대)
   *
   * 다중 해석 문서 전용 마커:
   * ^interpretation — 같은 구조를 여러 독해 관점으로 병렬 기록
   */
  scopeMarkers: "scope별 표준 마커: constraint→^constraint, state→^state-def, interface→^api-surface",

  // ── scope별 작성 템플릿 ─────────────────────────────────

  /**
   * 컨벤션 18: scope별 최소 구조
   *
   * feature/func_def:
   *   ^purpose → ^overview → 입출력 테이블 → 동작 규칙 → 관련 소스
   *
   * data/domain_data:
   *   ^purpose → ^overview → 필드 테이블(소스 참조) → 관계 → 관련 소스
   *
   * constraint/*:
   *   ^purpose → ^overview → ^constraint (번호 + 규칙 + 위반 시 동작) → 관련 소스
   *
   * interface/api_contract:
   *   ^purpose → ^overview → ^api-surface (엔드포인트 테이블) → 관련 소스
   *
   * state/*:
   *   ^purpose → ^overview → ^state-def (상태 테이블 + 전이 규칙) → 관련 소스
   *
   * flow/*:
   *   ^purpose → ^overview → 단계 설명 → 관련 소스
   *
   * data/prefix_schema:
   *   ^purpose → ^overview → ^intent (설계 의도) → ^inputs (차원 정의) → ^constraint → 관련 소스
   *
   * data/axis_catalog:
   *   ^purpose → ^overview → ^intent (축 선택 근거) → entries 목록 → 관련 소스
   *
   * experience 계층 (layer:experience) — skill/CLI 문서:
   *   ^purpose → ^context (사용 맥락) → ^intent (설계 의도) → ^feedback (피드백 규칙) → ^caveat → 관련 소스
   *
   * concept/guide/viz 문서에서 다중 해석이 필요한 경우:
   *   ^purpose → ^overview → ^interpretation (관점별 질문/읽기/한계) → 관련 소스
   */
  scopeTemplates: "scope별 최소 구조: purpose → overview → scope 고유 섹션 → 관련 소스",

  /**
   * 컨벤션 19: overview 그룹 문서 — 자동 파생 가능 정보 생략
   *
   * "overview: 총 N개 멤버." 같은 기계적 prefix 금지.
   * contains 링크에서 멤버 수는 자동 파생된다.
   * overview에는 멤버 목록 + 각 역할 요약만 작성한다.
   */
  overviewNoBoilerplate: "그룹 overview에서 '총 N개 멤버' 등 파생 가능 정보 생략",

  // ── 그룹 분류 컨벤션 ──────────────────────────────────

  /**
   * 컨벤션 20: 그룹 scope는 멤버 투표가 아니라 그룹의 주 책임
   *
   * 그룹 문서의 scope/aspect는 멤버의 다수결이 아니라
   * "이 그룹이 존재하는 이유(주 책임)"로 결정한다.
   *
   * - gate-system → feature/func_def (gate는 기능이다)
   * - permission-system → constraint/biz_constraint (권한은 제약이다)
   * - ingest-system → data/domain_data (데이터 수집이 핵심)
   * - registry-system → interface/api_contract (레지스트리는 서비스 계약)
   *
   * 혼합 scope 그룹이 존재하는 것 자체가 의사결정의 결과다.
   * "왜 이 관심사들이 하나의 그룹인가"가 그룹 문서의 핵심 정보.
   */
  groupScopeByResponsibility: "그룹 scope는 멤버 투표가 아니라 그룹의 주 책임으로 결정",

  /**
   * 컨벤션 21: flow/process_flow는 실제 흐름에만 사용
   *
   * 순수 조직 계층(system-root, system-infra 등)과 실제 시간 순서가 있는
   * 프로세스 흐름(pipeline, lifecycle, spec-phases)을 구분한다.
   *
   * - 순수 조직: flow/process_flow + structural 태그
   * - 실제 흐름: flow/process_flow (structural 태그 없음)
   * - 기능 그룹: feature/func_def, data/domain_data 등 주 책임에 맞는 scope
   *
   * flow/process_flow가 전체의 15~20%를 초과하면 분류 점검 신호.
   */
  flowOnlyForFlow: "flow/process_flow는 실제 시간 순서 흐름에만. 조직 그룹은 주 책임 scope 사용",

  /**
   * 컨벤션 22: structural 태그로 조직 계층 식별
   *
   * depth: overview + contains 링크를 가진 그룹 문서에 structural 태그를 부여한다.
   * query({ tags: ["structural"] }) → 조직 그룹만 조회
   * query({ excludeTags: ["structural"] }) → 실질 콘텐츠만 조회
   */
  structuralTag: "그룹 overview 문서에 structural 태그. 조직 계층 필터링용",

  // ── 코드-문서 연결 컨벤션 ─────────────────────────────

  /**
   * 컨벤션 23: svc 필드로 패키지 연결
   *
   * frontmatter의 svc 필드가 문서를 코드 패키지에 연결한다.
   * 한 패키지에 명확히 속하는 문서에만 부여.
   * 여러 패키지에 걸치는 문서는 svc를 생략한다.
   *
   * svc 값 = packages/ 디렉토리 이름 또는 ServiceBootConfig serviceId.
   * query({ serviceId: "gate-service" }) → gate 관련 문서 전체 조회.
   */
  svcMapping: "svc 필드로 문서-패키지 연결. 단일 패키지 소속일 때만 부여",

  /**
   * 컨벤션 24: 정확성 > 분량
   *
   * 짧은 문서는 문제가 아니다. 부정확한 문서가 문제다.
   * - purpose 1줄이라도 코드와 일치하면 유효
   * - 100줄이라도 코드와 다르면 유해
   * - 코드 변경 시 문서 드리프트를 감지하는 것이 중요
   *   → svc 필드 + 소스 참조로 변경 영향 추적 가능
   */
  accuracyOverVolume: "정확성 > 분량. 짧아도 정확하면 유효, 길어도 부정확하면 유해",

  /**
   * 컨벤션 25: scope 내 aspect 분포를 모니터링
   *
   * 하나의 scope에서 특정 aspect가 80% 이상 집중되면 점검한다.
   * - 도메인 특성(좌표 시스템 = feature가 많음)이면 허용
   * - 분류 오류(store 계약이 domain_data로 분류)면 재분류
   * - 무리한 재분류(의미 왜곡)는 집중보다 나쁨
   */
  aspectDistribution: "scope 내 aspect 집중도 80% 이상이면 점검. 도메인 특성이면 허용, 오류면 재분류",

  // ── 계약 조립 컨벤션 ──────────────────────────────────

  /**
   * 컨벤션 26: 계약 문서는 그룹 + 멤버 구조
   *
   * 계약(Contract)은 단일 문서가 아니라, 기존 좌표 공간의 문서 constellation이다.
   * 그룹 문서(overview depth)가 contains 링크로 멤버를 포함한다.
   * 각 멤버는 자신의 scope × aspect × depth 좌표를 가진다.
   *
   * 계약 멤버의 scope → 역할 매핑:
   * - interface → inputs/outputs (입출력 정의)
   * - constraint → preconditions/postconditions (사전/사후 조건)
   * - flow → steps/decision-points (실행 단계/분기)
   * - state → failure conditions (실패 조건)
   * - feature → evidence requirements (증거 요구)
   * - data → schema definitions (데이터 스키마)
   *
   * depth → 계약 추출 레벨 매핑:
   * - overview → 계약 존재 선언
   * - specification → 계약 상세 (inputs, preconditions, boundaries)
   * - implementation → 계약 실행 (step decomposition, workflow)
   * - validation → 계약 검증 (evidence, postconditions, assertions)
   */
  contractAsConstellation: "계약 = 그룹 문서 + 좌표별 멤버. 각 멤버가 독립 좌표로 concern 전파/impact 역추적 가능",

  // ── 존재론적 계층 (Layer) ──────────────────────────────

  /**
   * 컨벤션 27: layer는 존재 이유, scope는 구조 — 직교
   *
   * scope(무엇에 대한 정의인가)와 layer(왜 존재하는가)는 직교한다.
   *
   * 4계층 — "이것을 삭제해도 비즈니스 진실이 바뀌는가?"
   *
   * | layer       | 존재 이유                          | 삭제 시 영향        |
   * |-------------|----------------------------------|-------------------|
   * | domain      | "이것이 참이다" — 비즈니스 본질        | 진실 자체가 사라짐    |
   * | operation   | "시스템이 돌아가게 한다" — 운영 인프라   | 성능/안정성 저하     |
   * | mediation   | "진실을 소비 가능하게 변환" — 중재      | 유저가 불편해짐      |
   * | experience  | "사용자 행동을 유도한다" — 경험 설계    | 유도가 없어질 뿐     |
   *
   * 자동 분류:
   *   domain:     constraint/*, data/*, state/domain_state, state/system_state
   *   experience: ui/*
   *   operation, mediation: 수동 판단 필요
   *
   * 미지정(layer 없음)은 제한 없음으로 동작한다 (기존 호환).
   */
  layerOrthogonal: "layer는 존재 이유(domain/operation/mediation/experience), scope는 구조. 직교",

  /**
   * 컨벤션 28: layer 영향 전파 규칙
   *
   * domain 변경     → domain + operation + mediation (experience 직접 영향 없음)
   * operation 변경  → operation 내부만 (인프라 변경이 다른 계층에 영향 주면 안 됨)
   * mediation 변경  → mediation + experience (domain 역전파 없음)
   * experience 변경 → experience 내부만 (상향 전파 없음)
   *
   * 핵심 원리: 데이터의 본질(0/1로 표현 가능한 것)과
   * 유저 편의를 위한 제약/유도(구조 복잡성의 원인)를 분리한다.
   *
   * LLM step도 동일 원칙:
   * - experience LLM: 입력 해석, 요약, 의도 분류, 추천 → 허용
   * - mediation LLM: 비정형 입력을 구조화 스키마로 정규화 → 허용
   * - domain decision LLM: 승인 여부, 계약 충족 최종 판정 → 금지
   */
  layerPropagation: "domain→operation(독립)→mediation→experience 방향으로만 영향 전파",
} as const;

// ─── 계약 마커 레지스트리 ──────────────────────────────────

/**
 * 계약 추출을 위한 마커 분류.
 *
 * HyEvo Contract Layer와 기존 scope 체계의 교차점.
 * 기존 자유 마커(extractByMarker)를 분류하여 계약 구조로 조립할 때 사용한다.
 */
export type ContractMarkerKind =
  | "inputs"          // 입력 정의
  | "outputs"         // 출력 정의
  | "precondition"    // 사전 조건
  | "postcondition"   // 사후 조건
  | "decision-point"  // 분기 지점
  | "failure"         // 실패 조건
  | "evidence"        // 증거 요구사항
  | "flow-steps";     // 실행 단계

/** 계약 마커 정의 */
export interface ContractMarkerDef {
  /** 마커 이름 (^marker 형식에서 ^ 제외) */
  readonly marker: ContractMarkerKind;
  /** 이 마커가 자연스러운 scope */
  readonly naturalScope: DefScope;
  /** 이 마커가 자연스러운 depth */
  readonly naturalDepth: "specification" | "implementation" | "validation";
  /** 설명 */
  readonly description: string;
  /** HyEvo 계약 역할 */
  readonly contractRole: string;
  /** 실행 모드 힌트 — code: 결정론적, llm: 의미 해석 필요 */
  readonly modeHint: "code" | "llm";
}

/**
 * 계약 마커 레지스트리.
 *
 * extractByMarker()와 함께 사용하여 문서에서 계약 요소를 추출한다.
 * modeHint는 HyEvo의 LLM/Code node 분리 결정에 사용된다.
 */
export const CONTRACT_MARKERS: readonly ContractMarkerDef[] = [
  {
    marker: "inputs",
    naturalScope: "interface",
    naturalDepth: "specification",
    description: "입력 필드, 요청 스키마, 파라미터 정의",
    contractRole: "boundary.inputs",
    modeHint: "code",
  },
  {
    marker: "outputs",
    naturalScope: "interface",
    naturalDepth: "specification",
    description: "출력 필드, 응답 스키마, 반환값 정의",
    contractRole: "boundary.outputs",
    modeHint: "code",
  },
  {
    marker: "precondition",
    naturalScope: "constraint",
    naturalDepth: "specification",
    description: "실행 전 충족해야 할 조건",
    contractRole: "guard.pre",
    modeHint: "code",
  },
  {
    marker: "postcondition",
    naturalScope: "constraint",
    naturalDepth: "validation",
    description: "실행 후 보장해야 할 조건",
    contractRole: "guard.post",
    modeHint: "code",
  },
  {
    marker: "decision-point",
    naturalScope: "flow",
    naturalDepth: "specification",
    description: "분기 지점 — 조건에 따라 경로가 달라지는 곳",
    contractRole: "topology.branch",
    modeHint: "llm",
  },
  {
    marker: "failure",
    naturalScope: "state",
    naturalDepth: "specification",
    description: "허용되지 않는 실패 조건과 에러 상태",
    contractRole: "guard.failure",
    modeHint: "code",
  },
  {
    marker: "evidence",
    naturalScope: "feature",
    naturalDepth: "validation",
    description: "검증에 필요한 증거, 트레이스, 로그 요구사항",
    contractRole: "trace.evidence",
    modeHint: "code",
  },
  {
    marker: "flow-steps",
    naturalScope: "flow",
    naturalDepth: "implementation",
    description: "실행 순서가 있는 처리 단계",
    contractRole: "topology.steps",
    modeHint: "code",
  },
] as const;

/** 계약 마커 이름 목록 */
export const CONTRACT_MARKER_NAMES: readonly string[] =
  CONTRACT_MARKERS.map(m => m.marker);

/**
 * 마커 이름이 계약 마커인지 확인한다.
 */
export function isContractMarker(marker: string): marker is ContractMarkerKind {
  return (CONTRACT_MARKER_NAMES as readonly string[]).includes(marker);
}

/**
 * 마커 이름으로 계약 마커 정의를 찾는다.
 */
export function getContractMarkerDef(marker: string): ContractMarkerDef | undefined {
  return CONTRACT_MARKERS.find(m => m.marker === marker);
}

// ─── 시나리오 마커 ─────────────────────────────────────────

/**
 * 시나리오 마커 — 유저 시나리오 문서의 구조화된 섹션.
 *
 * 계약 마커(CONTRACT_MARKERS)가 "무엇이 보장되어야 하는가"를 정의한다면,
 * 시나리오 마커(SCENARIO_MARKERS)는 "사용자가 어떻게 사용하는가"를 정의한다.
 *
 * e2e-test skill에서 시나리오 문서를 읽어 테스트를 자동 생성할 때 소비된다.
 */
export type ScenarioMarkerKind =
  | "actor"          // 행위자 정의
  | "preconditions"  // 사전 상태
  | "steps"          // 실행 스텝 시퀀스
  | "assertions"     // 기대 결과 검증
  | "variants"       // 변형 시나리오 (에러, 엣지 케이스)
  | "update-trigger"; // 재검토 트리거

export interface ScenarioMarkerDef {
  readonly marker: ScenarioMarkerKind;
  readonly description: string;
  /** e2e 변환 시 역할 */
  readonly e2eRole: string;
  /** 필수 여부 */
  readonly required: boolean;
}

export const SCENARIO_MARKERS: readonly ScenarioMarkerDef[] = [
  {
    marker: "actor",
    description: "시나리오의 행위자 — 누가 이 흐름을 실행하는가",
    e2eRole: "test.describe context",
    required: false,
  },
  {
    marker: "preconditions",
    description: "시나리오 시작 전 필요한 상태 — 인증, 데이터, 설정",
    e2eRole: "beforeEach / setup",
    required: true,
  },
  {
    marker: "steps",
    description: "실행 스텝 시퀀스 — 번호 매긴 행동 목록",
    e2eRole: "test steps (page.goto, click, fill)",
    required: true,
  },
  {
    marker: "assertions",
    description: "기대 결과 검증 — 각 스텝 또는 최종 상태의 기대값",
    e2eRole: "expect() assertions",
    required: true,
  },
  {
    marker: "variants",
    description: "변형 시나리오 — 에러 케이스, 엣지 케이스, 대안 경로",
    e2eRole: "additional test cases",
    required: false,
  },
  {
    marker: "update-trigger",
    description: "이 시나리오를 재검토해야 하는 변경 목록",
    e2eRole: "test maintenance trigger",
    required: false,
  },
];

export const SCENARIO_MARKER_NAMES: readonly string[] =
  SCENARIO_MARKERS.map(m => m.marker);

export function isScenarioMarker(marker: string): marker is ScenarioMarkerKind {
  return SCENARIO_MARKER_NAMES.includes(marker);
}

export function getScenarioMarkerDef(marker: string): ScenarioMarkerDef | undefined {
  return SCENARIO_MARKERS.find(m => m.marker === marker);
}
