/**
 * definition-catalog 브릿지
 *
 * Work Domain → DefScope + DefLayer + ConcernTag + TierTag 매핑.
 * definition-catalog/bridge.ts의 패턴을 따른다.
 *
 * 의존 방향: work-domain → definition-catalog (타입만 참조, 런타임 의존 없음).
 * definition-catalog 타입을 직접 import하지 않고 문자열 리터럴로 재선언하여
 * zero-dependency를 유지한다.
 */

import type { WorkDomainId } from "./types.js";

// ─── definition-catalog 타입 재선언 (의존 없이) ─────────

/** definition-catalog DefScope 7종 (참조용) */
export type DefScope = "ui" | "feature" | "flow" | "state" | "constraint" | "data" | "interface";

/** definition-catalog DefLayer 4종 (참조용) */
export type DefLayer = "domain" | "operation" | "mediation" | "experience";

/** definition-catalog ConcernTag 7종 (참조용) */
export type ConcernTag = "security" | "performance" | "accessibility" | "observability" | "testing" | "migration" | "deprecation";

// ─── 매핑 인터페이스 ────────────────────────────────────

/** Work Domain → Definition 분류 체계 매핑 */
export interface ScopeMapping {
  /** 관련 문서 scope (복수 가능) */
  readonly primaryScopes: readonly DefScope[];
  /** 주요 존재론적 계층 */
  readonly primaryLayer: DefLayer;
  /** 관련 횡단 관심사 */
  readonly concerns: readonly ConcernTag[];
}

// ─── 매핑 테이블 ────────────────────────────────────────

/**
 * 10 대분류 → definition-catalog 좌표 매핑.
 *
 * Work Domain이 결정되면 이 매핑을 통해
 * 관련 문서를 definition-service에서 검색할 수 있다.
 */
export const DOMAIN_TO_DEF_MAP: Record<WorkDomainId, ScopeMapping> = {
  "data-infra": {
    primaryScopes: ["data"],
    primaryLayer: "operation",
    concerns: ["migration"],
  },
  "backend-logic": {
    primaryScopes: ["feature", "interface"],
    primaryLayer: "domain",
    concerns: [],
  },
  "ui-component": {
    primaryScopes: ["ui"],
    primaryLayer: "experience",
    concerns: ["accessibility"],
  },
  "frontend-app": {
    primaryScopes: ["ui", "flow"],
    primaryLayer: "experience",
    concerns: ["performance"],
  },
  "ai-engineering": {
    primaryScopes: ["feature", "data"],
    primaryLayer: "domain",
    concerns: ["performance"],
  },
  "observability": {
    primaryScopes: ["state"],
    primaryLayer: "operation",
    concerns: ["observability"],
  },
  "global-inclusion": {
    primaryScopes: ["constraint"],
    primaryLayer: "experience",
    concerns: ["accessibility"],
  },
  "security-guardrail": {
    primaryScopes: ["constraint"],
    primaryLayer: "domain",
    concerns: ["security"],
  },
  "productivity": {
    primaryScopes: ["constraint", "flow"],
    primaryLayer: "operation",
    concerns: ["testing"],
  },
  "tech-docs": {
    primaryScopes: ["data", "interface"],
    primaryLayer: "mediation",
    concerns: [],
  },
};

// ─── 쿼리 빌더 ──────────────────────────────────────────

/** definition-service 쿼리 파라미터 */
export interface DocQueryParams {
  readonly scopes: readonly DefScope[];
  readonly layer: DefLayer;
  readonly tags: readonly string[];
}

/**
 * Work Domain에서 definition-service 문서 검색 쿼리를 생성한다.
 *
 * 사용: `GET /docs?scope={scopes}&layer={layer}&tag={tags}`
 */
export function buildDocQuery(domainId: WorkDomainId): DocQueryParams {
  const mapping = DOMAIN_TO_DEF_MAP[domainId];
  return {
    scopes: mapping.primaryScopes,
    layer: mapping.primaryLayer,
    tags: [...mapping.concerns],
  };
}

// ─── decision-flow artifactType 역매핑 ──────────────────

/**
 * decision-flow의 artifactType에서 WorkDomain을 추론한다.
 *
 * definition-catalog/bridge.ts의 suggestScopeFromArtifact()와 대칭 관계.
 * 알려진 값만 매핑하고, 알 수 없는 값은 undefined를 반환한다.
 */
const ARTIFACT_DOMAIN_MAP: Record<string, WorkDomainId> = {
  // data-infra
  "schema": "data-infra",
  "migration": "data-infra",
  "table": "data-infra",

  // backend-logic
  "module": "backend-logic",
  "service": "backend-logic",
  "endpoint": "backend-logic",
  "api": "backend-logic",

  // ui-component
  "component": "ui-component",
  "widget": "ui-component",

  // frontend-app
  "page": "frontend-app",
  "screen": "frontend-app",
  "layout": "frontend-app",

  // observability
  "metric": "observability",
  "trace": "observability",
  "alert": "observability",

  // security-guardrail
  "policy": "security-guardrail",
  "rule": "security-guardrail",

  // productivity
  "refactor": "productivity",
  "config": "productivity",
  "config-change": "productivity",

  // tech-docs
  "doc": "tech-docs",
  "guide": "tech-docs",
  "readme": "tech-docs",
};

export function suggestDomainFromArtifact(artifactType: string): WorkDomainId | undefined {
  return ARTIFACT_DOMAIN_MAP[artifactType];
}
