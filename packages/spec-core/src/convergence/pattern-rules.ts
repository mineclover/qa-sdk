/**
 * DEMO 기본 패턴 규칙 — 쇼핑 도메인.
 *
 * 이 규칙은 DEMO_CATALOG의 쇼핑 이벤트에 맞춰져 있다.
 * 실제 서비스에서는 카탈로그별 커스텀 규칙을 정의해야 한다.
 *
 * @layer 측정 (Measurement)
 */

import type { PatternRule } from "@qa-sdk/core";

export const DEMO_PATTERN_RULES: readonly PatternRule[] = [
  // ── 봇/시스템 패턴 (최고 우선순위) ────────────────
  {
    id: "rule-bot-crawl",
    identificationMode: "any",
    behaviorPattern: "bot_crawl",
    defaultConfidence: "high",
    priority: 100,
    description: "비정상 속도 탐색 (200ms 이내 이벤트 간격)",
    match: {
      eventKeyPatterns: ["page\\..*"],
      minEvents: 10,
      minIntervalMs: 200,  // 200ms 미만 간격이 있으면 매칭 안 됨 → 반전 필요
    },
  },
  {
    id: "rule-health-check",
    identificationMode: "service",
    behaviorPattern: "health_check",
    defaultConfidence: "exact",
    priority: 90,
    description: "서비스 헬스체크 호출",
    match: {
      eventKeyPatterns: ["health\\..*", "api\\.health"],
      actorCondition: "any",
    },
  },
  {
    id: "rule-api-integration",
    identificationMode: "service",
    behaviorPattern: "api_integration",
    defaultConfidence: "exact",
    priority: 80,
    description: "서비스 간 API 호출",
    match: {
      eventKeyPatterns: ["api\\..*"],
      actorCondition: "any",
    },
  },

  // ── 식별된 사용자 패턴 ─────────────────────────
  {
    id: "rule-identified-purchase",
    identificationMode: "any",
    behaviorPattern: "purchase_complete",
    defaultConfidence: "exact",
    priority: 50,
    description: "로그인 후 구매 완료",
    match: {
      requiredKeys: ["auth.*", "order.*"],
      requiredSequence: ["auth.*", "cart.*", "checkout.*", "payment.*"],
      actorCondition: "has_actor",
    },
  },
  {
    id: "rule-checkout-fail",
    identificationMode: "any",
    behaviorPattern: "checkout_fail",
    defaultConfidence: "high",
    priority: 45,
    description: "결제 시도 후 실패 (payment.success 없음)",
    match: {
      requiredKeys: ["checkout.*"],
      excludedKeys: ["payment.success", "order.complete"],
      actorCondition: "has_actor",
    },
  },
  {
    id: "rule-error-recovery",
    identificationMode: "any",
    behaviorPattern: "error_recovery",
    defaultConfidence: "high",
    priority: 40,
    description: "에러 발생 후 재시도 성공",
    match: {
      requiredKeys: ["*.error", "*.fail*"],
      requiredSequence: ["*.error", "*.success"],
      actorCondition: "has_actor",
    },
  },
  {
    id: "rule-cart-abandon",
    identificationMode: "any",
    behaviorPattern: "cart_abandon",
    defaultConfidence: "high",
    priority: 35,
    description: "장바구니 담기 후 결제 미진행",
    match: {
      requiredKeys: ["cart.*"],
      excludedKeys: ["checkout.*", "payment.*", "order.*"],
    },
  },
  {
    id: "rule-identified-browse",
    identificationMode: "any",
    behaviorPattern: "browse_only",
    defaultConfidence: "medium",
    priority: 20,
    description: "로그인 후 탐색만 (장바구니/결제 없음)",
    match: {
      requiredKeys: ["auth.*"],
      excludedKeys: ["cart.*", "checkout.*", "payment.*", "order.*"],
      actorCondition: "has_actor",
      minEvents: 2,
    },
  },

  // ── 비식별 패턴 ────────────────────────────────
  {
    id: "rule-anonymous-cart",
    identificationMode: "anonymous",
    behaviorPattern: "anonymous_cart",
    defaultConfidence: "high",
    priority: 15,
    description: "비로그인 장바구니 사용",
    match: {
      requiredKeys: ["cart.*"],
      actorCondition: "no_actor",
    },
  },
  {
    id: "rule-anonymous-browse",
    identificationMode: "anonymous",
    behaviorPattern: "anonymous_browse",
    defaultConfidence: "medium",
    priority: 10,
    description: "비로그인 탐색",
    match: {
      eventKeyPatterns: ["page\\..*"],
      actorCondition: "no_actor",
      minEvents: 1,
    },
  },
];
