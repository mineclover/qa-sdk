/**
 * DEMO_SCENARIOS — shop-web 13개 트래킹 포인트 기반 정식 ScenarioSpec.
 *
 * ScenarioSpec: "이 흐름이 올바른가?" → Verdict (pass/fail)
 * TransitionSpec: "이 흐름이 무슨 의미인가?" → TransitionInstance (상태 변화)
 *
 * 두 spec은 같은 이벤트 스트림을 소비하지만 다른 질문에 답한다.
 */

import type { ScenarioSpec } from "@qa-sdk/core";

// ═══════════════════════════════════════════════════════════════
//  1. login — 사용자 로그인 흐름
// ═══════════════════════════════════════════════════════════════

export const SCENARIO_LOGIN: ScenarioSpec = {
  scenario_id: "shop-login",
  version: "1",
  domain: "auth",
  description: "사용자 로그인: tracking(submit) → auth_event(login) → flow_point(login, success)",
  steps: [
    {
      id: "track-login-submit",
      event_key: "auth.login",
      required: true,
      kind: "sequence",
      constraints: [
        { field: "payload.trackAction", op: "eq", value: "submit" },
        { field: "payload.page", op: "eq", value: "login" },
      ],
      next: ["auth-login"],
    },
    {
      id: "auth-login",
      event_key: "auth.login",
      required: true,
      kind: "sequence",
      constraints: [
        { field: "payload.auth_action", op: "eq", value: "login" },
      ],
      next: ["flow-login-success"],
    },
    {
      id: "flow-login-success",
      event_key: "auth.login",
      required: true,
      kind: "sequence",
      constraints: [
        { field: "payload.flow_name", op: "eq", value: "login" },
        { field: "payload.flow_step", op: "exists" },
      ],
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
//  2. checkout-entry — 체크아웃 진입
// ═══════════════════════════════════════════════════════════════

export const SCENARIO_CHECKOUT_ENTRY: ScenarioSpec = {
  scenario_id: "shop-checkout-entry",
  version: "1",
  domain: "commerce",
  description: "체크아웃 진입: navigate(checkout) → flow_point(checkout, entry)",
  steps: [
    {
      id: "navigate-checkout",
      event_key: "checkout.entry",
      required: true,
      kind: "sequence",
      constraints: [
        { field: "payload.trackAction", op: "eq", value: "navigate" },
        { field: "payload.page", op: "eq", value: "checkout" },
      ],
      next: ["flow-checkout-entry"],
    },
    {
      id: "flow-checkout-entry",
      event_key: "checkout.entry",
      required: true,
      kind: "sequence",
      constraints: [
        { field: "payload.flow_name", op: "eq", value: "checkout" },
        { field: "payload.flow_step", op: "eq", value: "entry" },
      ],
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
//  3. checkout-complete — 체크아웃 → 주문 생성 → 결제 완료
// ═══════════════════════════════════════════════════════════════

export const SCENARIO_CHECKOUT_COMPLETE: ScenarioSpec = {
  scenario_id: "shop-checkout-complete",
  version: "1",
  domain: "commerce",
  description: "전체 결제 흐름: checkout processing → order create → payment → order complete → checkout success",
  steps: [
    {
      id: "checkout-processing",
      event_key: "checkout.process",
      required: true,
      kind: "sequence",
      constraints: [
        { field: "payload.flow_name", op: "eq", value: "checkout" },
        { field: "payload.flow_step", op: "eq", value: "processing" },
      ],
      next: ["order-create"],
    },
    {
      id: "order-create",
      event_key: "checkout.process",
      required: true,
      kind: "sequence",
      constraints: [
        { field: "payload.order_action", op: "eq", value: "create" },
      ],
      next: ["payment-process"],
    },
    {
      id: "payment-process",
      event_key: "payment.process",
      required: true,
      kind: "sequence",
      constraints: [
        { field: "payload.flow_name", op: "exists" },
        { field: "payload.flow_step", op: "eq", value: "payment" },
      ],
      timeout_ms: 5000,
      next: ["payment-success"],
    },
    {
      id: "payment-success",
      event_key: "payment.success",
      required: true,
      kind: "sequence",
      constraints: [
        { field: "payload.order_action", op: "eq", value: "complete" },
      ],
      next: ["checkout-success"],
    },
    {
      id: "checkout-success",
      event_key: "payment.success",
      required: false,
      kind: "optional",
      constraints: [
        { field: "payload.flow_name", op: "eq", value: "checkout" },
        { field: "payload.flow_step", op: "eq", value: "success" },
      ],
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
//  4. full-purchase — 전체 구매 여정 (login → browse → cart → checkout → payment)
// ═══════════════════════════════════════════════════════════════

export const SCENARIO_FULL_PURCHASE: ScenarioSpec = {
  scenario_id: "shop-full-purchase",
  version: "1",
  domain: "commerce",
  description: "전체 구매 여정: login → product view → add to cart → checkout → payment complete",
  entry_conditions: [
    { field: "event_key", op: "eq", value: "auth.login" },
  ],
  steps: [
    {
      id: "login",
      event_key: "auth.login",
      required: true,
      kind: "sequence",
      next: ["browse-product"],
    },
    {
      id: "browse-product",
      event_key: "page.product_detail",
      required: false,
      kind: "optional",
      next: ["add-to-cart"],
    },
    {
      id: "add-to-cart",
      event_key: "cart.add",
      required: true,
      kind: "sequence",
      constraints: [
        { field: "payload.trackAction", op: "eq", value: "add_to_cart" },
      ],
      next: ["checkout-entry"],
    },
    {
      id: "checkout-entry",
      event_key: "checkout.entry",
      required: true,
      kind: "sequence",
      next: ["checkout-process"],
    },
    {
      id: "checkout-process",
      event_key: "checkout.process",
      required: true,
      kind: "sequence",
      next: ["payment-success"],
    },
    {
      id: "payment-success",
      event_key: "payment.success",
      required: true,
      kind: "sequence",
      next: ["order-complete"],
    },
    {
      id: "order-complete",
      event_key: "page.order_complete",
      required: false,
      kind: "optional",
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
//  5. cart-abandon — 장바구니 이탈 (add to cart 후 checkout 미진행)
// ═══════════════════════════════════════════════════════════════

export const SCENARIO_CART_ABANDON: ScenarioSpec = {
  scenario_id: "shop-cart-abandon",
  version: "1",
  domain: "analytics",
  description: "장바구니 이탈 감지: add to cart → (checkout 미발생) → 세션 종료",
  steps: [
    {
      id: "add-to-cart",
      event_key: "cart.add",
      required: true,
      kind: "sequence",
      constraints: [
        { field: "payload.trackAction", op: "eq", value: "add_to_cart" },
      ],
      next: ["checkout-or-abandon"],
    },
    {
      id: "checkout-or-abandon",
      event_key: "checkout.entry",
      required: false,
      kind: "branch",
      branches: [
        {
          condition: { field: "event_key", op: "eq", value: "checkout.entry" },
          next: ["checkout-entered"],
        },
      ],
    },
    {
      id: "checkout-entered",
      event_key: "checkout.entry",
      required: false,
      kind: "optional",
    },
  ],
};

/** shop-web 기반 정식 ScenarioSpec 5종 */
export const DEMO_SCENARIOS: readonly ScenarioSpec[] = [
  SCENARIO_LOGIN,
  SCENARIO_CHECKOUT_ENTRY,
  SCENARIO_CHECKOUT_COMPLETE,
  SCENARIO_FULL_PURCHASE,
  SCENARIO_CART_ABANDON,
] as const;
