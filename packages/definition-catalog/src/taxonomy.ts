/**
 * 소프트웨어 정의 분류 체계 (Taxonomy)
 *
 * 6대 분류(scope) × 세부 측면(aspect)의 트리 구조를 정의한다.
 * def_scope와 def_aspect는 독립 축이지만 유효 조합이 제한된다.
 * VALID_SCOPE_ASPECTS가 이 제약을 표현한다.
 *
 * 좌표 공간(16×64)에서 실제 유효한 조합은 17개뿐이다 (나머지 79개는 무효).
 * 등록 시 validateScopeAspect()로 검증한다.
 */

import type { DefScope, DefAspect, ConcernTag, StructuralTag, KnownTag } from "./types.js";

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
        { id: "func_def", name: "기능정의", description: "기능의 명세와 동작 규칙" },
        { id: "scenario", name: "시나리오", description: "기능의 사용 시나리오와 기대 결과" },
      ],
    },
    {
      id: "flow",
      name: "흐름",
      description: "사용자와 시스템 간 흐름의 정의",
      aspects: [
        { id: "user_scenario", name: "사용자시나리오", description: "사용자 관점의 작업 흐름" },
        { id: "process_flow", name: "프로세스흐름", description: "시스템 내부 처리 순서" },
        { id: "relation", name: "연관관계", description: "엔티티/기능 간 연결과 의존성" },
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
        { id: "domain_data", name: "도메인데이터", description: "비즈니스 도메인 엔티티와 스키마" },
        { id: "system_data", name: "시스템데이터", description: "설정, 로그, 메트릭 등 시스템 데이터" },
        { id: "external_data", name: "외부데이터", description: "외부 API, 서드파티 데이터 연동" },
      ],
    },
    {
      id: "interface",
      name: "인터페이스",
      description: "시스템에 접근하는 계약(contract)의 정의 — 기능이 아니라 접근 방식",
      aspects: [
        { id: "api_contract", name: "API계약", description: "REST/gRPC 엔드포인트, 요청/응답 스키마, 인증" },
        { id: "cli_contract", name: "CLI계약", description: "커맨드, 플래그, 옵션, 출력 형식 정의" },
        { id: "event_contract", name: "이벤트계약", description: "이벤트 스키마, 메시지 포맷, 발행/구독 규약" },
      ],
    },
  ],
};

// ─── scope-aspect 유효 조합 제약 ─────────────────────────

/**
 * scope별 유효한 aspect 목록.
 *
 * def_scope × def_aspect 좌표 공간에서 유효한 조합만 허용한다.
 * 16 × 64 = 1,024 가능한 조합 중 17개만 유효.
 */
export const VALID_SCOPE_ASPECTS: Record<DefScope, readonly DefAspect[]> = {
  ui: ["layout", "component", "interaction"],
  feature: ["func_def", "scenario"],
  flow: ["user_scenario", "process_flow", "relation"],
  state: ["app_state", "domain_state", "system_state"],
  constraint: ["tech_constraint", "biz_constraint", "infra_constraint"],
  data: ["domain_data", "system_data", "external_data"],
  interface: ["api_contract", "cli_contract", "event_contract"],
} as const;

/**
 * aspect → scope 역참조 맵 (자동 파생).
 * aspect만 알면 scope를 추론할 수 있다.
 */
export const ASPECT_TO_SCOPE: Record<DefAspect, DefScope> = Object.fromEntries(
  Object.entries(VALID_SCOPE_ASPECTS).flatMap(
    ([scope, aspects]) => aspects.map(a => [a, scope]),
  ),
) as Record<DefAspect, DefScope>;

// ─── 검증 ────────────────────────────────────────────────

/**
 * scope-aspect 조합이 유효한지 검증한다.
 * @throws Error 무효 조합 시
 */
export function validateScopeAspect(scope: DefScope, aspect: DefAspect): void {
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
  const allScopes: DefScope[] = ["ui", "feature", "flow", "state", "constraint", "data", "interface"];
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
} as const;
