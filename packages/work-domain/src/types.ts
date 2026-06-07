// @def.boundary shared-utility-group
// @def.doc shared-utility-group

/**
 * 작업 도메인 분류 체계 — 핵심 타입
 *
 * AI 에이전트가 수행하는 작업을 10 대분류(Work Domain)로 분류하고,
 * 각 분류에 맞는 품질 게이트를 자동 매핑하기 위한 타입 정의.
 *
 * 기존 definition-catalog의 scope(문서 분류)와 직교하는 개념:
 *   scope = "이 문서는 무엇에 대한 것인가"
 *   workDomain = "이 작업은 어떤 종류의 엔지니어링인가"
 */

import type { GateKindId } from "./gate-kind.js";

// ─── 작업 도메인 ID (대분류 10종) ────────────────────────

/** 작업 도메인 식별자 — Ralph TUI Atomic Story Master Guide v2.1 기준 */
export type WorkDomainId =
  | "data-infra"          // 1. 데이터 인프라
  | "backend-logic"       // 2. 백엔드 로직
  | "ui-component"        // 3. UI 컴포넌트
  | "frontend-app"        // 4. 프론트엔드 앱
  | "ai-engineering"      // 5. AI 엔지니어링
  | "observability"       // 6. 관측 가능성
  | "global-inclusion"    // 7. 글로벌/포용성
  import type {
    GateKindId,
    WorkDomainId,
    QualityGateSpec,
    SubDomain,
    QualityGate,
    WorkDomainDef,
  } from "test-types";

  export type {
    GateKindId,
    WorkDomainId,
    QualityGateSpec,
    SubDomain,
    QualityGate,
    WorkDomainDef,
  };

  // ─── 분류 결과 ──────────────────────────────────────────
/** classifyUserStory() 반환 타입 */
export interface ClassificationResult {
  /** 추론된 작업 도메인 */
  readonly domain: WorkDomainId;
  /** 신뢰도 (0~1) */
  readonly confidence: number;
  /** 매칭된 신호 키워드 */
  readonly signals: readonly string[];
}
 readonly QualityGate[];
}

// ─── 분류 결과 ──────────────────────────────────────────

/** classifyUserStory() 반환 타입 */
export interface ClassificationResult {
  /** 추론된 작업 도메인 */
  readonly domain: WorkDomainId;
  /** 신뢰도 (0~1) */
  readonly confidence: number;
  /** 매칭된 신호 키워드 */
  readonly signals: readonly string[];
}
