/**
 * DEMO_SCENARIOS — shop-web 13개 트래킹 포인트 기반 정식 ScenarioSpec.
 *
 * ScenarioSpec: "이 흐름이 올바른가?" → Verdict (pass/fail)
 * TransitionSpec: "이 흐름이 무슨 의미인가?" → TransitionInstance (상태 변화)
 *
 * address_context 검증:
 * - 각 step에 기대하는 prefix가 address_context에 존재하는지 constraint로 검증
 * - "이벤트는 있지만 좌표가 누락"을 감지
 */

import type { ScenarioSpec } from "@qa-sdk/core";

// ═══════════════════════════════════════════════════════════════
//  1. login — 사용자 로그인 흐름
// ═══════════════════════════════════════════════════════════════

export const SCENARIO_LOGIN: ScenarioSpec = {
  scenario_id: "shop-login",
  version: "1",
  domain: "auth",
  description: "사용자 로그인: tracking(submit) → auth_event(login) → flow_point(login, entry)",
  steps: [
    {
      id: "track-login-submit",
      event_key: "auth.login",
      required: true,
      kind: "sequence",
      constraints: [
        { field: "payload.trackAction", op: "eq", value: "submit" },
        { field: "payload.page", op: "eq", value: "login" },
        { field: "address_context.tracking", op: "exists" },
        { field: "address_context.page_view", op: "exists" },
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
        { field: "address_context.auth_event", op: "exists" },
        { field: "address_context.endpoint", op: "exists" },
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
        { field: "address_context.flow_point", op: "exists" },
        { field: "address_context.permission", op: "exists" },
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
        { field: "address_context.tracking", op: "exists" },
        { field: "address_context.page_view", op: "exists" },
        { field: "address_context.endpoint", op: "exists" },
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
        { field: "address_context.flow_point", op: "exists" },
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
  description: "전체 결제 흐름: checkout processing → order create → payment → order complete",
  steps: [
    {
      id: "checkout-processing",
      event_key: "checkout.process",
      required: true,
      kind: "sequence",
      constraints: [
        { field: "payload.flow_step", op: "eq", value: "processing" },
        { field: "address_context.flow_point", op: "exists" },
        { field: "address_context.page_view", op: "exists" },
        { field: "address_context.endpoint", op: "exists" },
        { field: "address_context.order_event", op: "exists" },
      ],
      next: ["payment-process"],
    },
    {
      id: "payment-process",
      event_key: "payment.process",
      required: true,
      kind: "sequence",
      constraints: [
        { field: "address_context.endpoint", op: "exists" },
        { field: "address_context.flow_point", op: "exists" },
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
        { field: "address_context.order_event", op: "exists" },
        { field: "address_context.flow_point", op: "exists" },
        { field: "address_context.health_event", op: "exists" },
      ],
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
//  4. full-purchase — 전체 구매 여정
// ═══════════════════════════════════════════════════════════════

export const SCENARIO_FULL_PURCHASE: ScenarioSpec = {
  scenario_id: "shop-full-purchase",
  version: "1",
  domain: "commerce",
  description: "전체 구매 여정: login → browse → cart → checkout → payment",
  entry_conditions: [
    { field: "event_key", op: "eq", value: "auth.login" },
  ],
  steps: [
    {
      id: "login",
      event_key: "auth.login",
      required: true,
      kind: "sequence",
      constraints: [
        { field: "address_context.auth_event", op: "exists" },
      ],
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
        { field: "address_context.cart_event", op: "exists" },
      ],
      next: ["checkout-entry"],
    },
    {
      id: "checkout-entry",
      event_key: "checkout.entry",
      required: true,
      kind: "sequence",
      constraints: [
        { field: "address_context.flow_point", op: "exists" },
        { field: "address_context.endpoint", op: "exists" },
      ],
      next: ["checkout-process"],
    },
    {
      id: "checkout-process",
      event_key: "checkout.process",
      required: true,
      kind: "sequence",
      constraints: [
        { field: "address_context.order_event", op: "exists" },
      ],
      next: ["payment-success"],
    },
    {
      id: "payment-success",
      event_key: "payment.success",
      required: true,
      kind: "sequence",
      constraints: [
        { field: "address_context.order_event", op: "exists" },
        { field: "address_context.health_event", op: "exists" },
      ],
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
//  5. cart-abandon — 장바구니 이탈
// ═══════════════════════════════════════════════════════════════

export const SCENARIO_CART_ABANDON: ScenarioSpec = {
  scenario_id: "shop-cart-abandon",
  version: "1",
  domain: "analytics",
  description: "장바구니 이탈: add to cart → (checkout 미발생)",
  steps: [
    {
      id: "add-to-cart",
      event_key: "cart.add",
      required: true,
      kind: "sequence",
      constraints: [
        { field: "payload.trackAction", op: "eq", value: "add_to_cart" },
        { field: "address_context.cart_event", op: "exists" },
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

// ═══════════════════════════════════════════════════════════════
//  6. deploy-health — 배포 → 헬스체크 흐름 (인프라 도메인)
// ═══════════════════════════════════════════════════════════════

export const SCENARIO_DEPLOY_HEALTH: ScenarioSpec = {
  scenario_id: "infra-deploy-health",
  version: "1",
  domain: "infra",
  description: "배포 후 헬스체크: deploy_event(deploy) → health_event(healthy|degraded)",
  steps: [
    {
      id: "deploy",
      event_key: "deploy.start",
      required: true,
      kind: "sequence",
      constraints: [
        { field: "address_context.deploy_event", op: "exists" },
      ],
      next: ["health-check"],
    },
    {
      id: "health-check",
      event_key: "deploy.health",
      required: true,
      kind: "sequence",
      constraints: [
        { field: "address_context.health_event", op: "exists" },
      ],
      timeout_ms: 30000,
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
//  7. pipeline-ingest — 수집 파이프라인 단계 흐름
// ═══════════════════════════════════════════════════════════════

export const SCENARIO_PIPELINE_INGEST: ScenarioSpec = {
  scenario_id: "infra-pipeline-ingest",
  version: "1",
  domain: "infra",
  description: "수집 파이프라인: ingest → reconstruct → verdict",
  steps: [
    {
      id: "phase-ingest",
      event_key: "pipeline.ingest",
      required: true,
      kind: "sequence",
      constraints: [
        { field: "address_context.pipeline_point", op: "exists" },
      ],
      next: ["phase-reconstruct"],
    },
    {
      id: "phase-reconstruct",
      event_key: "pipeline.reconstruct",
      required: true,
      kind: "sequence",
      constraints: [
        { field: "address_context.pipeline_point", op: "exists" },
      ],
      next: ["phase-verdict"],
    },
    {
      id: "phase-verdict",
      event_key: "pipeline.verdict",
      required: true,
      kind: "sequence",
      constraints: [
        { field: "address_context.pipeline_point", op: "exists" },
      ],
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
//  8. build-test — 빌드 → 테스트 흐름 (자기참조 도메인)
// ═══════════════════════════════════════════════════════════════

export const SCENARIO_BUILD_TEST: ScenarioSpec = {
  scenario_id: "dev-build-test",
  version: "1",
  domain: "dev",
  description: "빌드 성공 후 테스트: build_event(success) → test_event(passed|failed)",
  steps: [
    {
      id: "build",
      event_key: "build.complete",
      required: true,
      kind: "sequence",
      constraints: [
        { field: "address_context.build_event", op: "exists" },
      ],
      next: ["test"],
    },
    {
      id: "test",
      event_key: "test.complete",
      required: true,
      kind: "sequence",
      constraints: [
        { field: "address_context.test_event", op: "exists" },
      ],
    },
  ],
};

/** 정식 ScenarioSpec 8종 (shop-web 5 + infra 2 + dev 1) */
export const DEMO_SCENARIOS: readonly ScenarioSpec[] = [
  SCENARIO_LOGIN,
  SCENARIO_CHECKOUT_ENTRY,
  SCENARIO_CHECKOUT_COMPLETE,
  SCENARIO_FULL_PURCHASE,
  SCENARIO_CART_ABANDON,
  SCENARIO_DEPLOY_HEALTH,
  SCENARIO_PIPELINE_INGEST,
  SCENARIO_BUILD_TEST,
] as const;
