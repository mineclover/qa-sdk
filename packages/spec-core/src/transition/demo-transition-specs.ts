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

// ═══════════════════════════════════════════════════════════════
//  4. deploy.rollout — 배포 후 헬스 전이 (인프라 도메인)
//
//  deploy_event(deploy) → health_event(healthy|degraded)
// ═══════════════════════════════════════════════════════════════

export const DEPLOY_ROLLOUT_SPEC: TransitionSpec = {
  transition: "deploy.rollout",
  version: "v1",
  match: {
    mode: "ordered",
    coordinates: [
      { deploy_action: "deploy" },
      { health_status: "healthy" },
    ],
  },
  bind: {
    context_id: "$.events[0].context_id",
    resource_id: "$.events[0].service_id",
  },
  input: {
    all: [
      { axis: "lifecycle_state", eq: "active" },
    ],
  },
  output: {
    set: [
      { axis: "health_status", value: "healthy" },
      { axis: "version_lifecycle", value: "released" },
    ],
  },
  effect: { kind: "update" },
};

// ═══════════════════════════════════════════════════════════════
//  5. deploy.degraded — 배포 후 성능 저하 (인프라 도메인)
//
//  deploy_event(deploy) → health_event(degraded)
// ═══════════════════════════════════════════════════════════════

export const DEPLOY_DEGRADED_SPEC: TransitionSpec = {
  transition: "deploy.degraded",
  version: "v1",
  match: {
    mode: "ordered",
    coordinates: [
      { deploy_action: "deploy" },
      { health_status: "degraded" },
    ],
  },
  bind: {
    context_id: "$.events[0].context_id",
    resource_id: "$.events[0].service_id",
  },
  input: {
    all: [
      { axis: "lifecycle_state", eq: "active" },
    ],
  },
  output: {
    set: [
      { axis: "health_status", value: "degraded" },
    ],
  },
  effect: { kind: "update" },
};

// ═══════════════════════════════════════════════════════════════
//  6. pipeline.ingest — 수집 파이프라인 전이
//
//  pipeline_point(ingest) → pipeline_point(reconstruct) → pipeline_point(verdict)
// ═══════════════════════════════════════════════════════════════

export const PIPELINE_INGEST_SPEC: TransitionSpec = {
  transition: "pipeline.ingest",
  version: "v1",
  match: {
    mode: "ordered",
    coordinates: [
      { pipeline_phase: "ingest" },
      { pipeline_phase: "reconstruct" },
      { pipeline_phase: "verdict" },
    ],
  },
  bind: {
    context_id: "$.events[0].context_id",
    resource_id: "$.events[0].trace_id",
  },
  input: {
    all: [
      { axis: "lifecycle_state", exists: false },
    ],
  },
  output: {
    set: [
      { axis: "lifecycle_state", value: "active" },
      { axis: "flow_step", value: "complete" },
    ],
  },
  effect: { kind: "create" },
};

// ═══════════════════════════════════════════════════════════════
//  7. build.success — 빌드 성공 후 테스트 (자기참조 도메인)
//
//  build_event(success) → test_event(passed)
// ═══════════════════════════════════════════════════════════════

export const BUILD_SUCCESS_SPEC: TransitionSpec = {
  transition: "build.success",
  version: "v1",
  match: {
    mode: "ordered",
    coordinates: [
      { build_result: "success" },
      { test_result: "passed" },
    ],
  },
  bind: {
    context_id: "$.events[0].context_id",
    resource_id: "$.events[0].package_id",
  },
  input: {
    all: [
      { axis: "lifecycle_state", exists: false },
    ],
  },
  output: {
    set: [
      { axis: "lifecycle_state", value: "active" },
      { axis: "version_lifecycle", value: "locked" },
    ],
  },
  effect: { kind: "create" },
};

// ═══════════════════════════════════════════════════════════════
//  8. permission.grant — 권한 부여 전이
//
//  permission(role=customer → role=admin)
// ═══════════════════════════════════════════════════════════════

export const PERMISSION_GRANT_SPEC: TransitionSpec = {
  transition: "permission.grant",
  version: "v1",
  match: {
    mode: "single",
    coordinates: [
      { role: "admin", action: "write" },
    ],
  },
  bind: {
    context_id: "$.events[0].context_id",
    resource_id: "$.events[0].user_id",
  },
  input: {
    all: [
      { axis: "lifecycle_state", eq: "active" },
    ],
  },
  output: {
    set: [
      { axis: "flow_step", value: "complete" },
    ],
  },
  effect: { kind: "update" },
};

// ═══════════════════════════════════════════════════════════════
//  9. pattern.anomaly — 패턴 이상 감지 전이
//
//  pattern_match → pattern_anomaly
// ═══════════════════════════════════════════════════════════════

export const PATTERN_ANOMALY_SPEC: TransitionSpec = {
  transition: "pattern.anomaly",
  version: "v1",
  match: {
    mode: "ordered",
    coordinates: [
      { behavior_pattern: "unclassified" },
      { anomaly_kind: "ratio_shift" },
    ],
  },
  bind: {
    context_id: "$.events[0].context_id",
    resource_id: "$.events[0].session_id",
  },
  input: {
    all: [
      { axis: "lifecycle_state", exists: false },
    ],
  },
  output: {
    set: [
      { axis: "lifecycle_state", value: "active" },
    ],
  },
  effect: { kind: "open" },
};

/** DEMO_CATALOG 기반 TransitionSpec — shop-web 3종 + 인프라 3종 + dev 1종 + 관측 2종 */
export const DEMO_TRANSITION_SPECS: readonly TransitionSpec[] = [
  CART_CHECKOUT_SPEC,
  USER_LOGIN_SPEC,
  PAYMENT_CAPTURE_SPEC,
  DEPLOY_ROLLOUT_SPEC,
  DEPLOY_DEGRADED_SPEC,
  PIPELINE_INGEST_SPEC,
  BUILD_SUCCESS_SPEC,
  PERMISSION_GRANT_SPEC,
  PATTERN_ANOMALY_SPEC,
] as const;
