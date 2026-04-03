/**
 * Transition Engine 실증 테스트.
 *
 * shop-web의 실제 checkout 흐름 13개 이벤트를 기반으로,
 * Verdict(pass/fail)로는 알 수 없지만 TransitionInstance로는 알 수 있는 것을 보여준다.
 *
 * 시나리오:
 *   A. 정상 흐름 — login → browse → add_to_cart → checkout → payment → complete
 *   B. 비정상 흐름 — payment.success가 order.create보다 먼저 도착 (이벤트 순서 역전)
 *   C. 시점 질의 — "10:00:05 시점에 이 주문의 상태는?"
 *
 * 증명 목표:
 *   Verdict는 A, B 모두 "이벤트가 존재한다"로 판단할 수 있지만,
 *   Transition은 B에서 input violation을 잡는다 — "아직 주문이 없는데 결제가 완료됐다."
 */

import { describe, it, expect } from "vitest";
import { InMemoryStateStore } from "./state-store.js";
import { TransitionEngine } from "./transition-engine.js";
import { extractBind } from "./bind-extractor.js";
import { TransitionRegistry } from "./transition.registry.js";
import { validateWithCatalog } from "./catalog-validator.js";
import { DEMO_CATALOG } from "demo-snapshot";
import type { TransitionSpec } from "./transition.types.js";
import type { TransitionEvent } from "./transition-engine.js";

// ═══════════════════════════════════════════════════════════════
//  shop-web 실제 흐름 기반 Transition Spec 4종
//
//  shop-web의 13개 트래킹 포인트에서 추출한 실제 축 이름/entry 사용.
// ═══════════════════════════════════════════════════════════════

/** 세션 전이: login → 세션(TRACE, TRACE) 생성 */
const LOGIN_SPEC: TransitionSpec = {
  transition: "user.login",
  version: "v1",
  match: {
    mode: "ordered",
    coordinates: [
      { trackAction: "submit", page: "login" },
      { auth_action: "login" },
      { flow_name: "login", flow_step: "entry", flow_variant: "default" },
    ],
  },
  bind: {
    context_id: "$.events[0].trace_id",
    resource_id: "$.events[0].trace_id",
  },
  input: {
    all: [{ axis: "lifecycle_state", exists: false }],
  },
  output: {
    set: [
      { axis: "lifecycle_state", value: "active" },
      { axis: "flow_step", value: "entry" },
    ],
  },
  effect: { kind: "open" },
};

/** 세션 전이: checkout 진입 → 세션(TRACE, TRACE) 업데이트 */
const CHECKOUT_ENTRY_SPEC: TransitionSpec = {
  transition: "checkout.entry",
  version: "v1",
  match: {
    mode: "ordered",
    coordinates: [
      { trackAction: "navigate", page: "checkout" },
      { flow_name: "checkout", flow_step: "entry", flow_variant: "default" },
    ],
  },
  bind: {
    context_id: "$.events[0].trace_id",
    resource_id: "$.events[0].trace_id",
  },
  input: {
    all: [{ axis: "lifecycle_state", eq: "active" }],
  },
  output: {
    set: [{ axis: "flow_step", value: "entry" }],
  },
  effect: { kind: "update" },
};

/** 주문 전이: order.create → 주문(TRACE, ORDER) 생성. 주문은 아직 없어야 함. */
const ORDER_CREATE_SPEC: TransitionSpec = {
  transition: "order.create",
  version: "v1",
  match: {
    mode: "ordered",
    coordinates: [
      { flow_name: "checkout", flow_step: "processing", flow_variant: "default" },
      { order_action: "create" },
    ],
  },
  bind: {
    context_id: "$.events[0].trace_id",
    resource_id: "$.events[1].order_id",
  },
  input: {
    all: [
      { axis: "lifecycle_state", exists: false },
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

const PAYMENT_COMPLETE_SPEC: TransitionSpec = {
  transition: "payment.complete",
  version: "v1",
  match: {
    mode: "ordered",
    coordinates: [
      { flow_name: "payment", flow_step: "payment", flow_variant: "default" },
      { order_action: "complete" },
      { flow_name: "checkout", flow_step: "success", flow_variant: "default" },
    ],
  },
  bind: {
    context_id: "$.events[0].trace_id",
    resource_id: "$.events[1].order_id",
  },
  input: {
    all: [
      { axis: "lifecycle_state", eq: "active" },
      { axis: "flow_step", eq: "processing" },
      { axis: "resource_location", eq: "origin" },
    ],
  },
  output: {
    set: [{ axis: "flow_step", value: "success" }],
  },
  effect: { kind: "close" },
};

const ALL_SPECS = [LOGIN_SPEC, CHECKOUT_ENTRY_SPEC, ORDER_CREATE_SPEC, PAYMENT_COMPLETE_SPEC];

// ═══════════════════════════════════════════════════════════════
//  이벤트 팩토리 — shop-web 실제 흐름 재현
// ═══════════════════════════════════════════════════════════════

const TRACE = "trc_shop_1711094400000";
const SESSION = "ses_1711094400000";
const ACTOR = "user_member_42";
const ORDER = "order_20260322_001";

function evt(
  id: string, ts: string, ctx: Record<string, string>, extra?: Record<string, unknown>,
): TransitionEvent {
  return { log_id: id, timestamp: ts, address_context: ctx, trace_id: TRACE, ...extra };
}

/** 시나리오 A: 정상 checkout 흐름 (shop-web 13개 포인트 중 핵심 8개) */
function normalFlow(): TransitionEvent[] {
  return [
    // 1. 로그인
    evt("e01", "2026-03-22T10:00:00.000Z", { trackAction: "submit", page: "login", userType: "guest" }),
    evt("e02", "2026-03-22T10:00:00.100Z", { auth_action: "login" }, { actor_id: ACTOR }),
    evt("e03", "2026-03-22T10:00:00.200Z", { flow_name: "login", flow_step: "entry", flow_variant: "default" }),
    // 2. 상품 탐색 + 장바구니 (transition spec 없음 → unmatched)
    evt("e04", "2026-03-22T10:00:30.000Z", { trackAction: "view", page: "product_detail", userType: "member" }),
    evt("e05", "2026-03-22T10:00:45.000Z", { trackAction: "add_to_cart", page: "product_detail", userType: "member" }),
    // 3. 체크아웃 진입
    evt("e06", "2026-03-22T10:01:00.000Z", { trackAction: "navigate", page: "checkout", userType: "member" }),
    evt("e07", "2026-03-22T10:01:00.100Z", { flow_name: "checkout", flow_step: "entry", flow_variant: "default" }),
    // 4. 주문 생성
    evt("e08", "2026-03-22T10:01:05.000Z", { flow_name: "checkout", flow_step: "processing", flow_variant: "default" }),
    evt("e09", "2026-03-22T10:01:05.500Z", { order_action: "create" }, { order_id: ORDER }),
    // 5. 결제 처리 → 완료
    evt("e10", "2026-03-22T10:01:06.000Z", { flow_name: "payment", flow_step: "payment", flow_variant: "default" }),
    evt("e11", "2026-03-22T10:01:07.500Z", { order_action: "complete" }, { order_id: ORDER }),
    evt("e12", "2026-03-22T10:01:07.600Z", { flow_name: "checkout", flow_step: "success", flow_variant: "default" }),
    // 6. 주문 완료 페이지 (transition spec 없음)
    evt("e13", "2026-03-22T10:01:10.000Z", { trackAction: "view", page: "order_complete", userType: "member" }),
  ];
}

/** 시나리오 B: 비정상 흐름 — 주문 생성 없이 결제 완료 이벤트 도착 */
function anomalousFlow(): TransitionEvent[] {
  return [
    // 로그인 (정상)
    evt("b01", "2026-03-22T10:00:00.000Z", { trackAction: "submit", page: "login", userType: "guest" }),
    evt("b02", "2026-03-22T10:00:00.100Z", { auth_action: "login" }, { actor_id: ACTOR }),
    evt("b03", "2026-03-22T10:00:00.200Z", { flow_name: "login", flow_step: "entry", flow_variant: "default" }),
    // 체크아웃 진입 (정상)
    evt("b04", "2026-03-22T10:01:00.000Z", { trackAction: "navigate", page: "checkout", userType: "member" }),
    evt("b05", "2026-03-22T10:01:00.100Z", { flow_name: "checkout", flow_step: "entry", flow_variant: "default" }),
    // ⚠ 비정상: order.create 없이 바로 결제 완료
    // order_event(create)가 누락 → payment.complete의 input 조건(lifecycle_state=active) 불충족
    evt("b06", "2026-03-22T10:01:05.000Z", { flow_name: "payment", flow_step: "payment", flow_variant: "default" }),
    evt("b07", "2026-03-22T10:01:06.000Z", { order_action: "complete" }, { order_id: ORDER }),
    evt("b08", "2026-03-22T10:01:06.100Z", { flow_name: "checkout", flow_step: "success", flow_variant: "default" }),
  ];
}

// ═══════════════════════════════════════════════════════════════
//  실증 테스트
// ═══════════════════════════════════════════════════════════════

describe("실증: shop-web checkout 흐름", () => {

  it("spec 4종이 DEMO_CATALOG 검증 통과", () => {
    for (const spec of ALL_SPECS) {
      const result = validateWithCatalog(spec, DEMO_CATALOG);
      expect(result.valid, `${spec.transition}: ${JSON.stringify(result.issues)}`).toBe(true);
    }
  });

  // ── 시나리오 A: 정상 흐름 ────────────────────────────

  describe("시나리오 A: 정상 checkout 흐름", () => {
    let engine: TransitionEngine;
    let store: InMemoryStateStore;

    it("4개 전이가 순서대로 실행된다", () => {
      const registry = new TransitionRegistry();
      store = new InMemoryStateStore();
      engine = new TransitionEngine(registry, store);
      for (const spec of ALL_SPECS) registry.register(spec);

      const result = engine.process(normalFlow());

      expect(result.violations).toHaveLength(0);
      expect(result.instances).toHaveLength(4);

      // 전이 순서 확인
      const names = result.instances.map(i => i.transition_name);
      expect(names).toEqual([
        "user.login",
        "checkout.entry",
        "order.create",
        "payment.complete",
      ]);
    });

    it("최종 상태: 주문 완료", () => {
      const registry = new TransitionRegistry();
      store = new InMemoryStateStore();
      engine = new TransitionEngine(registry, store);
      for (const spec of ALL_SPECS) registry.register(spec);

      engine.process(normalFlow());

      // 세션 상태 (login으로 생성, checkout.entry로 업데이트)
      const sessionState = store.snapshot(TRACE, TRACE);
      expect(sessionState.lifecycle_state).toBe("active");
      expect(sessionState.flow_step).toBe("entry");

      // 주문 상태 (order.create로 생성, payment.complete로 업데이트)
      const orderState = store.snapshot(TRACE, ORDER);
      expect(orderState.lifecycle_state).toBe("active");
      expect(orderState.flow_step).toBe("success");
      expect(orderState.resource_location).toBe("origin");
    });

    it("unmatched 이벤트 = transition spec 없는 탐색/장바구니", () => {
      const registry = new TransitionRegistry();
      store = new InMemoryStateStore();
      engine = new TransitionEngine(registry, store);
      for (const spec of ALL_SPECS) registry.register(spec);

      const result = engine.process(normalFlow());

      // e04(product_detail view), e05(add_to_cart), e13(order_complete view)는 매칭 안 됨
      expect(result.unmatched_events.length).toBeGreaterThan(0);
      expect(result.unmatched_events).toContain("e04");
      expect(result.unmatched_events).toContain("e05");
      expect(result.unmatched_events).toContain("e13");
    });

    it("각 전이의 input/output 스냅샷이 상태 변화를 기록한다", () => {
      const registry = new TransitionRegistry();
      store = new InMemoryStateStore();
      engine = new TransitionEngine(registry, store);
      for (const spec of ALL_SPECS) registry.register(spec);

      const result = engine.process(normalFlow());

      // login: {} → { lifecycle_state: active, flow_step: entry }
      const login = result.instances[0];
      expect(login.input_snapshot).toEqual({});
      expect(login.output_snapshot.lifecycle_state).toBe("active");

      // order.create: {} → { lifecycle_state: active, flow_step: processing, resource_location: origin }
      const orderCreate = result.instances[2];
      expect(orderCreate.input_snapshot).toEqual({});  // 주문은 새로 생성
      expect(orderCreate.output_snapshot.lifecycle_state).toBe("active");
      expect(orderCreate.output_snapshot.resource_location).toBe("origin");
      expect(orderCreate.output_snapshot.flow_step).toBe("processing");

      // payment.complete: flow_step: processing → success
      const payment = result.instances[3];
      expect(payment.input_snapshot.flow_step).toBe("processing");
      expect(payment.output_snapshot.flow_step).toBe("success");
    });
  });

  // ── 시나리오 B: 비정상 흐름 ──────────────────────────

  describe("시나리오 B: 이벤트 순서 역전 (payment before order)", () => {

    it("payment.complete에서 input violation 발생", () => {
      const registry = new TransitionRegistry();
      const store = new InMemoryStateStore();
      const engine = new TransitionEngine(registry, store);
      for (const spec of ALL_SPECS) registry.register(spec);

      const result = engine.process(anomalousFlow());

      // login + checkout.entry는 정상 실행
      const succeeded = result.instances.map(i => i.transition_name);
      expect(succeeded).toContain("user.login");
      expect(succeeded).toContain("checkout.entry");

      // order.create 이벤트 자체가 없으므로 order.create 전이도 없음
      expect(succeeded).not.toContain("order.create");

      // payment.complete는 input violation — 주문이 생성되지 않아 상태가 없음.
      expect(result.violations.length).toBeGreaterThan(0);

      const paymentViolation = result.violations.find(v => v.transition === "payment.complete");
      expect(paymentViolation).toBeDefined();
      // lifecycle_state가 "active"여야 하는데 null (주문이 만들어지지 않음)
      expect(paymentViolation!.axis).toBe("lifecycle_state");
    });

    it("Verdict가 놓치는 것을 Transition이 잡는다", () => {
      const registry = new TransitionRegistry();
      const store = new InMemoryStateStore();
      const engine = new TransitionEngine(registry, store);
      for (const spec of ALL_SPECS) registry.register(spec);

      const normalResult = engine.process(normalFlow());
      store.clear();
      const anomalyResult = engine.process(anomalousFlow());

      // 정상 흐름: 4개 전이, 0 violation
      expect(normalResult.instances).toHaveLength(4);
      expect(normalResult.violations).toHaveLength(0);

      // 비정상 흐름: 전이 수 감소 + violation 발생
      // login + checkout.entry만 성공 (order.create 이벤트 없음)
      expect(anomalyResult.instances.length).toBeLessThan(normalResult.instances.length);
      expect(anomalyResult.violations.length).toBeGreaterThan(0);

      // 이것이 핵심:
      // Verdict는 "payment 이벤트가 존재하는가"만 본다 → 존재하므로 pass 가능.
      // Transition은 "주문이 생성된 상태에서 결제가 일어났는가"를 본다
      // → 주문 생성 전이가 없으므로 violation.
    });
  });

  // ── 시나리오 C: 시점 질의 ────────────────────────────

  describe("시나리오 C: 시점별 상태 재구성", () => {

    it("이벤트를 절반만 넣으면 중간 상태를 얻는다", () => {
      const registry = new TransitionRegistry();
      const store = new InMemoryStateStore();
      const engine = new TransitionEngine(registry, store);
      for (const spec of ALL_SPECS) registry.register(spec);

      const allEvents = normalFlow();

      // 10:01:05 시점까지만 (e01~e09, 주문 생성까지)
      const eventsUntilOrder = allEvents.filter(
        e => e.timestamp <= "2026-03-22T10:01:05.500Z",
      );

      const result = engine.process(eventsUntilOrder);

      // login + checkout.entry + order.create = 3개 전이
      expect(result.instances).toHaveLength(3);
      expect(result.instances.map(i => i.transition_name)).toEqual([
        "user.login",
        "checkout.entry",
        "order.create",
      ]);

      // 이 시점의 주문 상태: 생성됨, 아직 결제 안 됨
      const orderState = store.snapshot(TRACE, ORDER);
      expect(orderState.lifecycle_state).toBe("active");
      expect(orderState.flow_step).toBe("processing");  // 아직 processing
      expect(orderState.resource_location).toBe("origin");

      // payment.complete는 아직 실행 안 됨 → flow_step이 "success"가 아님
      expect(orderState.flow_step).not.toBe("success");
    });

    it("전체 이벤트 replay → 최종 상태", () => {
      const registry = new TransitionRegistry();
      const store = new InMemoryStateStore();
      const engine = new TransitionEngine(registry, store);
      for (const spec of ALL_SPECS) registry.register(spec);

      engine.process(normalFlow());

      const orderState = store.snapshot(TRACE, ORDER);
      expect(orderState.flow_step).toBe("success");  // 결제 완료
    });

    it("같은 이벤트 → 같은 시점 상태 (deterministic)", () => {
      const allEvents = normalFlow();
      const cutoff = "2026-03-22T10:01:05.500Z";
      const partialEvents = allEvents.filter(e => e.timestamp <= cutoff);

      // 1차
      const reg1 = new TransitionRegistry();
      const store1 = new InMemoryStateStore();
      const eng1 = new TransitionEngine(reg1, store1);
      for (const spec of ALL_SPECS) reg1.register(spec);
      eng1.process(partialEvents);
      const snap1 = store1.snapshot(TRACE, ORDER);

      // 2차
      const reg2 = new TransitionRegistry();
      const store2 = new InMemoryStateStore();
      const eng2 = new TransitionEngine(reg2, store2);
      for (const spec of ALL_SPECS) reg2.register(spec);
      eng2.process(partialEvents);
      const snap2 = store2.snapshot(TRACE, ORDER);

      expect(snap1).toEqual(snap2);
    });
  });
});
