/**
 * DEMO_CATALOG 기반 예시 Transition Spec 3종.
 *
 * 실제 축 이름과 entry 값을 사용한다.
 * input/output은 축(axis) 기반 — 별도 slot vocabulary 없음.
 *
 * 상태 축 매핑:
 *   flow_step        — 흐름 내 위치 (entry → processing → success)
 *   lifecycle_state   — 자원 생명주기 (draft → active → deprecated)
 *   resource_location — 자원 위치 (origin, cache, queue, external) [신설 예정]
 *   version_lifecycle — 버전 단계 (draft → locked → released)
 */

import type { TransitionSpec } from "./transition.types.js";

// ═══════════════════════════════════════════════════════════════
//  1. cart.checkout — 장바구니 결제
//
//  tracking(submit, checkout) → flow_point(checkout, entry)
//  → flow_point(checkout, processing) → order_event(create)
// ═══════════════════════════════════════════════════════════════

export const CART_CHECKOUT_SPEC: TransitionSpec = {
  transition: "cart.checkout",
  version: "v1",
  match: {
    mode: "ordered",
    coordinates: [
      { trackAction: "submit", page: "checkout", userType: "member" },
      { flow_name: "checkout", flow_step: "entry", flow_variant: "default" },
      { flow_name: "checkout", flow_step: "processing", flow_variant: "default" },
      { order_action: "create" },
    ],
  },
  bind: {
    context_id: "$.events[0].context_id",
    resource_id: "$.events[3].order_id",
  },
  input: {
    all: [
      { axis: "lifecycle_state", exists: false },
      { axis: "flow_step", eq: "entry" },
    ],
  },
  output: {
    set: [
      { axis: "lifecycle_state", value: "active" },
      { axis: "flow_step", value: "processing" },
      { axis: "resource_location", value: "origin" },
    ],
  },
  effect: { kind: "create" },
};

// ═══════════════════════════════════════════════════════════════
//  2. user.login — 사용자 로그인
//
//  endpoint(POST, api) → auth_event(login)
//  → flow_point(login, success)
// ═══════════════════════════════════════════════════════════════

export const USER_LOGIN_SPEC: TransitionSpec = {
  transition: "user.login",
  version: "v1",
  match: {
    mode: "ordered",
    coordinates: [
      { resource_type: "api", http_method: "POST", api_version: "v1" },
      { auth_action: "login" },
      { flow_name: "login", flow_step: "success", flow_variant: "default" },
    ],
  },
  bind: {
    context_id: "$.events[0].context_id",
    resource_id: "$.events[1].actor_id",
  },
  input: {
    all: [
      { axis: "lifecycle_state", neq: "archived" },
    ],
  },
  output: {
    set: [
      { axis: "lifecycle_state", value: "active" },
      { axis: "flow_step", value: "success" },
    ],
  },
  effect: { kind: "open" },
};

// ═══════════════════════════════════════════════════════════════
//  3. payment.capture — 결제 완료
//
//  flow_point(checkout, payment) → order_event(complete)
//  → flow_point(checkout, complete)
// ═══════════════════════════════════════════════════════════════

export const PAYMENT_CAPTURE_SPEC: TransitionSpec = {
  transition: "payment.capture",
  version: "v1",
  match: {
    mode: "ordered",
    coordinates: [
      { flow_name: "checkout", flow_step: "payment", flow_variant: "default" },
      { order_action: "complete" },
      { flow_name: "checkout", flow_step: "complete", flow_variant: "default" },
    ],
  },
  bind: {
    context_id: "$.events[0].context_id",
    resource_id: "$.events[1].order_id",
  },
  input: {
    all: [
      { axis: "lifecycle_state", eq: "active" },
      { axis: "flow_step", eq: "payment" },
    ],
  },
  output: {
    set: [
      { axis: "flow_step", value: "complete" },
    ],
  },
  effect: { kind: "close" },
};

/** DEMO_CATALOG 기반 예시 3종 */
export const DEMO_TRANSITION_SPECS: readonly TransitionSpec[] = [
  CART_CHECKOUT_SPEC,
  USER_LOGIN_SPEC,
  PAYMENT_CAPTURE_SPEC,
] as const;
