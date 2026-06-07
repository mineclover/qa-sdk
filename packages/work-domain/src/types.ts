// @def.boundary shared-utility-group
// @def.doc shared-utility-group

/**
 * 작업 도메인 분류 체계 — 핵심 타입
 *
 * AI 에이전트가 수행하는 작업을 10 대분류(Work Domain)로 분류하고,
 * 각 분류에 맞는 품질 게이트를 자동 매핑하기 위한 타입 정의.
 */

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
