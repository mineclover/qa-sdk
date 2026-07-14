// @def.boundary convergence-layer-group
/**
 * 패턴 규칙 — 시스템 공통 + 도메인별 분리.
 *
 * SYSTEM_PATTERN_RULES: 도메인 무관 (봇/헬스체크/API/에러 복구)
 * DEMO_PATTERN_RULES: 쇼핑 도메인 (구매/장바구니/결제 등) + 시스템 규칙 포함
 *
 * 새 도메인 도입 시: SYSTEM_PATTERN_RULES + 도메인 전용 규칙을 결합.
 *
 * @layer 측정 (Measurement)
 */

import type { PatternRule } from '@qa-sdk/core';

// ── 시스템 공통 규칙 (도메인 무관) ────────────────────

/**
 * 도메인에 무관한 시스템 패턴 규칙.
 * 봇 감지, 헬스체크, API 통합, 에러 복구 — 어떤 비즈니스에서든 적용 가능.
 */
export const SYSTEM_PATTERN_RULES: readonly PatternRule[] = [
  {
    id: 'rule-bot-crawl',
    identificationMode: 'any',
    behaviorPattern: 'bot_crawl',
    defaultConfidence: 'high',
    priority: 100,
    description: '비정상 속도 탐색 (200ms 이내 이벤트 간격)',
    match: {
      eventKeyPatterns: ['page\\..*'],
      minEvents: 10,
      minIntervalMs: 200,
    },
  },
  {
    id: 'rule-health-check',
    identificationMode: 'service',
    behaviorPattern: 'health_check',
    defaultConfidence: 'exact',
    priority: 90,
    description: '서비스 헬스체크 호출',
    match: {
      eventKeyPatterns: ['health\\..*', 'api\\.health'],
      actorCondition: 'any',
    },
  },
  {
    id: 'rule-api-integration',
    identificationMode: 'service',
    behaviorPattern: 'api_integration',
    defaultConfidence: 'exact',
    priority: 80,
    description: '서비스 간 API 호출',
    match: {
      eventKeyPatterns: ['api\\..*'],
      actorCondition: 'any',
    },
  },
  {
    id: 'rule-error-recovery',
    identificationMode: 'any',
    behaviorPattern: 'error_recovery',
    defaultConfidence: 'high',
    priority: 40,
    description: '에러 발생 후 재시도 성공',
    match: {
      requiredKeys: ['*.error', '*.fail*'],
      requiredSequence: ['*.error', '*.success'],
      actorCondition: 'has_actor',
    },
  },
];

// ── 쇼핑 도메인 규칙 ──────────────────────────────────

/**
 * 쇼핑 도메인 전용 패턴 규칙.
 * 구매 완료, 장바구니 이탈, 결제 실패 등 e-commerce 이벤트 시퀀스.
 */
export const SHOPPING_PATTERN_RULES: readonly PatternRule[] = [
  {
    id: 'rule-identified-purchase',
    identificationMode: 'any',
    behaviorPattern: 'purchase_complete',
    defaultConfidence: 'exact',
    priority: 50,
    description: '로그인 후 구매 완료',
    match: {
      requiredKeys: ['auth.*', 'order.*'],
      requiredSequence: ['auth.*', 'cart.*', 'checkout.*', 'payment.*'],
      actorCondition: 'has_actor',
    },
  },
  {
    id: 'rule-checkout-fail',
    identificationMode: 'any',
    behaviorPattern: 'checkout_fail',
    defaultConfidence: 'high',
    priority: 45,
    description: '결제 시도 후 실패 (payment.success 없음)',
    match: {
      requiredKeys: ['checkout.*'],
      excludedKeys: ['payment.success', 'order.complete'],
      actorCondition: 'has_actor',
    },
  },
  {
    id: 'rule-cart-abandon',
    identificationMode: 'any',
    behaviorPattern: 'cart_abandon',
    defaultConfidence: 'high',
    priority: 35,
    description: '장바구니 담기 후 결제 미진행',
    match: {
      requiredKeys: ['cart.*'],
      excludedKeys: ['checkout.*', 'payment.*', 'order.*'],
    },
  },
  {
    id: 'rule-identified-browse',
    identificationMode: 'any',
    behaviorPattern: 'browse_only',
    defaultConfidence: 'medium',
    priority: 20,
    description: '로그인 후 탐색만 (장바구니/결제 없음)',
    match: {
      requiredKeys: ['auth.*'],
      excludedKeys: ['cart.*', 'checkout.*', 'payment.*', 'order.*'],
      actorCondition: 'has_actor',
      minEvents: 2,
    },
  },
  {
    id: 'rule-anonymous-cart',
    identificationMode: 'anonymous',
    behaviorPattern: 'anonymous_cart',
    defaultConfidence: 'high',
    priority: 15,
    description: '비로그인 장바구니 사용',
    match: {
      requiredKeys: ['cart.*'],
      actorCondition: 'no_actor',
    },
  },
  {
    id: 'rule-anonymous-browse',
    identificationMode: 'anonymous',
    behaviorPattern: 'anonymous_browse',
    defaultConfidence: 'medium',
    priority: 10,
    description: '비로그인 탐색',
    match: {
      eventKeyPatterns: ['page\\..*'],
      actorCondition: 'no_actor',
      minEvents: 1,
    },
  },
];

// ── 통합 (하위 호환) ──────────────────────────────────

/**
 * DEMO 기본 패턴 규칙 — 시스템 공통 + 쇼핑 도메인 결합.
 *
 * 새 도메인 도입 시: [...SYSTEM_PATTERN_RULES, ...YOUR_DOMAIN_RULES]
 */
export const DEMO_PATTERN_RULES: readonly PatternRule[] = [
  ...SYSTEM_PATTERN_RULES,
  ...SHOPPING_PATTERN_RULES,
];

// ── 도메인 규칙 결합 헬퍼 ─────────────────────────────

/**
 * 시스템 공통 규칙 + 커스텀 도메인 규칙을 결합.
 * priority 기준 내림차순 정렬.
 *
 * @example
 * const myRules = combinePatternRules(LOGISTICS_RULES);
 * // → SYSTEM_PATTERN_RULES + LOGISTICS_RULES, priority 정렬
 */
export function combinePatternRules(
  ...domainRules: readonly (readonly PatternRule[])[]
): readonly PatternRule[] {
  const all = [...SYSTEM_PATTERN_RULES];
  for (const rules of domainRules) {
    all.push(...rules);
  }
  return all.toSorted((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
}
