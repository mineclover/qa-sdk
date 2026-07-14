// @def.boundary ingest-system
// @def.doc ingest-system

/**
 * 패턴 분류 파이프라인 포트 — ingest-server에서 spec-core 의존 없이 사용.
 *
 * 세션 종료 시 호출되어 이벤트 시퀀스를 패턴으로 분류한다.
 */

import type { PatternClassification, PatternAnomaly } from '@qa-sdk/core';

/** 패턴 분류 결과 */
export interface PatternClassificationResult {
  readonly sessionId: string;
  readonly classification: PatternClassification;
  readonly anomalies: readonly PatternAnomaly[];
}

/** 패턴 분류 파이프라인 포트 (순환 의존 방지) */
export interface PatternClassificationPort {
  /**
   * 세션 종료 시 호출. 세션의 이벤트를 조회하여 패턴을 분류한다.
   * 비동기 — 분류 실패 시 에러를 삼키고 로깅만.
   */
  classifySession(sessionId: string): Promise<PatternClassificationResult | null>;
}
