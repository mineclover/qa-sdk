/**
 * 소프트웨어 정의 분류 체계 (Taxonomy)
 *
 * 7대 분류(scope) × 세부 측면(aspect)의 트리 구조를 정의한다.
 * def_scope와 def_aspect는 독립 축이지만 유효 조합이 제한된다.
 * VALID_SCOPE_ASPECTS가 이 제약을 표현한다.
 *
 * 좌표 공간(16×64)에서 실제 유효한 조합은 20개뿐이다.
 * 등록 시 validateScopeAspect()로 검증한다.
 */

import type { DefScope, DefAspect, ConcernTag, StructuralTag, TierTag, KnownTag } from "./types.js";

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
 * 16 × 64 = 1,024 가능한 조합 중 20개만 유효.
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

/** 계층 태그 목록 */
export const TIER_TAGS: readonly TierTag[] = [
  "tier-frontend", "tier-backend", "tier-infra", "tier-system",
];

/** 알려진 태그 전체 목록 */
export const KNOWN_TAGS: readonly KnownTag[] = [...CONCERN_TAGS, ...STRUCTURAL_TAGS, ...TIER_TAGS];

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
   * 컨벤션 10: `## 구성 ^overview` — 핵심 사실 나열 (선택)
   *
   * 무엇이 있는가, 몇 개인가, 주요 항목 목록.
   * purpose보다 구체적이지만 상세는 아닌 수준.
   */
  overviewSection: "## 구성 ^overview에 핵심 사실을 나열 (선택, purpose보다 구체적)",

  /**
   * 컨벤션 11: 마커 없는 섹션은 detail (full에서만 보임)
   */
  unmarkedIsDetail: "마커 없는 섹션은 full 추출에서만 보임",

  /**
   * 컨벤션 12: 그룹 문서는 overview depth + contains 링크
   *
   * 그룹 문서의 목적에 시스템 전체 목적,
   * 구성에 멤버 목록과 구성 요약.
   */
  groupDocument: "그룹 문서 = overview depth + contains 링크 + 목적/구성 섹션",

  /**
   * 컨벤션 13: 자유 마커로 scope별 핵심 내용 수집
   *
   * purpose/overview 외에 scope에 맞는 자유 마커를 사용한다.
   * - constraint 문서: `## 불변 조건 ^constraint` → 제약 규칙 수집
   * - state 문서: `## 상태 정의 ^state-def` → 상태 정의 수집
   * - interface 문서: `## 엔드포인트 ^endpoints` → API 목록 수집
   *
   * extractByMarker(body, "constraint") → 해당 섹션만 추출.
   * 마커 이름은 lowercase + 하이픈: ^my-marker
   */
  customMarkers: "자유 마커(^constraint, ^state-def 등)로 scope별 핵심 내용 수집 가능",

  // ── 코드 참조 컨벤션 ──────────────────────────────────

  /**
   * 컨벤션 14: 인라인 코드 블록 금지 — 코드 위치 참조로 대체
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
   * 컨벤션 15: 소스 위치 표기 — `## 관련 소스` 섹션 통일
   *
   * 문서 하단에 `## 관련 소스` 섹션을 두고 소스 파일 경로를 나열한다.
   * 형식: `- packages/<pkg>/src/<path>.ts — <한줄 설명>`
   * 이 섹션이 문서와 코드의 연결점 역할을 한다.
   */
  sourceSection: "문서 하단에 `## 관련 소스` 섹션으로 코드 위치를 통일된 형식으로 나열",

  // ── scope별 표준 마커 ──────────────────────────────────

  /**
   * 컨벤션 16: scope별 권장 마커
   *
   * | scope      | 필수 마커          | 권장 마커      |
   * |------------|-------------------|---------------|
   * | constraint | ^constraint       | —             |
   * | state      | ^state-def        | —             |
   * | interface  | ^api-surface      | ^error-codes  |
   * | feature    | —                 | ^behavior     |
   * | data       | —                 | ^schema       |
   * | flow       | —                 | ^flow-steps   |
   * | ui         | —                 | ^interaction  |
   *
   * 모든 scope: ^purpose (필수), ^overview (권장)
   */
  scopeMarkers: "scope별 표준 마커: constraint→^constraint, state→^state-def, interface→^api-surface",

  // ── scope별 작성 템플릿 ─────────────────────────────────

  /**
   * 컨벤션 17: scope별 최소 구조
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
   */
  scopeTemplates: "scope별 최소 구조: purpose → overview → scope 고유 섹션 → 관련 소스",

  /**
   * 컨벤션 18: overview 그룹 문서 — 자동 파생 가능 정보 생략
   *
   * "overview: 총 N개 멤버." 같은 기계적 prefix 금지.
   * contains 링크에서 멤버 수는 자동 파생된다.
   * overview에는 멤버 목록 + 각 역할 요약만 작성한다.
   */
  overviewNoBoilerplate: "그룹 overview에서 '총 N개 멤버' 등 파생 가능 정보 생략",

  // ── 그룹 분류 컨벤션 ──────────────────────────────────

  /**
   * 컨벤션 19: 그룹 scope는 멤버 투표가 아니라 그룹의 주 책임
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
   * 컨벤션 20: flow/process_flow는 실제 흐름에만 사용
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
   * 컨벤션 21: structural 태그로 조직 계층 식별
   *
   * depth: overview + contains 링크를 가진 그룹 문서에 structural 태그를 부여한다.
   * query({ tags: ["structural"] }) → 조직 그룹만 조회
   * query({ excludeTags: ["structural"] }) → 실질 콘텐츠만 조회
   */
  structuralTag: "그룹 overview 문서에 structural 태그. 조직 계층 필터링용",

  // ── 코드-문서 연결 컨벤션 ─────────────────────────────

  /**
   * 컨벤션 22: svc 필드로 패키지 연결
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
   * 컨벤션 23: 정확성 > 분량
   *
   * 짧은 문서는 문제가 아니다. 부정확한 문서가 문제다.
   * - purpose 1줄이라도 코드와 일치하면 유효
   * - 100줄이라도 코드와 다르면 유해
   * - 코드 변경 시 문서 드리프트를 감지하는 것이 중요
   *   → svc 필드 + 소스 참조로 변경 영향 추적 가능
   */
  accuracyOverVolume: "정확성 > 분량. 짧아도 정확하면 유효, 길어도 부정확하면 유해",

  /**
   * 컨벤션 24: scope 내 aspect 분포를 모니터링
   *
   * 하나의 scope에서 특정 aspect가 80% 이상 집중되면 점검한다.
   * - 도메인 특성(좌표 시스템 = feature가 많음)이면 허용
   * - 분류 오류(store 계약이 domain_data로 분류)면 재분류
   * - 무리한 재분류(의미 왜곡)는 집중보다 나쁨
   */
  aspectDistribution: "scope 내 aspect 집중도 80% 이상이면 점검. 도메인 특성이면 허용, 오류면 재분류",
} as const;
