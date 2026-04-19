// @def.boundary spec-engine-system
// @def.doc spec-engine-system

/**
 * Transition Engine — Tier 2 테스트.
 *
 * StateStore + bind + input/output + engine 7단계 파이프라인.
 * deterministic replay + cart.checkout→payment.capture 연쇄 전이.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { InMemoryStateStore } from "./state-store.js";
import { extractBind } from "./bind-extractor.js";
import { validateInput } from "./input-validator.js";
import { applyOutput } from "./output-applier.js";
import { TransitionEngine } from "./transition-engine.js";
import { TransitionRegistry } from "./transition.registry.js";
import {
  CART_CHECKOUT_SPEC,
  PAYMENT_CAPTURE_SPEC,
  USER_LOGIN_SPEC,
} from "./demo-transition-specs.js";
import type { TransitionEvent } from "./transition-engine.js";

// ═══════════════════════════════════════════════════════════════
//  StateStore
// ═══════════════════════════════════════════════════════════════

describe("InMemoryStateStore", () => {
  let store: InMemoryStateStore;

  beforeEach(() => {
    store = new InMemoryStateStore();
  });

  it("set + get", () => {
    store.set("ctx1", "res1", "flow_step", "entry");
    expect(store.get("ctx1", "res1", "flow_step")).toBe("entry");
  });

  it("미설정 축 → null", () => {
    expect(store.get("ctx1", "res1", "flow_step")).toBeNull();
  });

  it("unset", () => {
    store.set("ctx1", "res1", "flow_step", "entry");
    store.unset("ctx1", "res1", "flow_step");
    expect(store.get("ctx1", "res1", "flow_step")).toBeNull();
  });

  it("snapshot — 전체 축 상태", () => {
    store.set("ctx1", "res1", "flow_step", "entry");
    store.set("ctx1", "res1", "lifecycle_state", "active");
    expect(store.snapshot("ctx1", "res1")).toEqual({
      flow_step: "entry",
      lifecycle_state: "active",
    });
  });

  it("다른 context+resource는 격리", () => {
    store.set("ctx1", "res1", "flow_step", "entry");
    store.set("ctx2", "res2", "flow_step", "complete");
    expect(store.get("ctx1", "res1", "flow_step")).toBe("entry");
    expect(store.get("ctx2", "res2", "flow_step")).toBe("complete");
  });

  it("clear", () => {
    store.set("ctx1", "res1", "flow_step", "entry");
    store.clear();
    expect(store.get("ctx1", "res1", "flow_step")).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════
//  Bind Extractor
// ═══════════════════════════════════════════════════════════════

describe("extractBind", () => {
  const events = [
    { context_id: "ctx_123", cart_id: "cart_456", payload: { note: "test" } },
    { actor_id: "user_789", order_id: "order_001" },
  ];

  it("정상 추출", () => {
    const result = extractBind(
      { context_id: "$.events[0].context_id", resource_id: "$.events[1].order_id" },
      events,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result.context_id).toBe("ctx_123");
      expect(result.result.resource_id).toBe("order_001");
    }
  });

  it("추가 바인딩 추출", () => {
    const result = extractBind(
      {
        context_id: "$.events[0].context_id",
        resource_id: "$.events[0].cart_id",
        actor_id: "$.events[1].actor_id",
      },
      events,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result.actor_id).toBe("user_789");
    }
  });

  it("payload 내 필드 추출", () => {
    const result = extractBind(
      { context_id: "$.events[0].context_id", resource_id: "$.events[0].payload.note" },
      events,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result.resource_id).toBe("test");
    }
  });

  it("범위 초과 인덱스 → 에러", () => {
    const result = extractBind(
      { context_id: "$.events[5].context_id", resource_id: "$.events[0].cart_id" },
      events,
    );
    expect(result.ok).toBe(false);
  });

  it("존재하지 않는 필드 → 에러", () => {
    const result = extractBind(
      { context_id: "$.events[0].missing_field", resource_id: "$.events[0].cart_id" },
      events,
    );
    expect(result.ok).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════
//  Input Validator
// ═══════════════════════════════════════════════════════════════

describe("validateInput", () => {
  const meta = { transition: "test", context_id: "ctx", resource_id: "res" };

  it("eq 통과", () => {
    const result = validateInput(
      { all: [{ axis: "flow_step", eq: "entry" }] },
      { flow_step: "entry" },
      meta,
    );
    expect(result.valid).toBe(true);
  });

  it("eq 실패", () => {
    const result = validateInput(
      { all: [{ axis: "flow_step", eq: "entry" }] },
      { flow_step: "processing" },
      meta,
    );
    expect(result.valid).toBe(false);
    expect(result.violations[0].axis).toBe("flow_step");
  });

  it("neq 통과", () => {
    const result = validateInput(
      { all: [{ axis: "lifecycle_state", neq: "archived" }] },
      { lifecycle_state: "active" },
      meta,
    );
    expect(result.valid).toBe(true);
  });

  it("in 통과", () => {
    const result = validateInput(
      { all: [{ axis: "flow_step", in: ["entry", "processing"] }] },
      { flow_step: "entry" },
      meta,
    );
    expect(result.valid).toBe(true);
  });

  it("in 실패 — null 값", () => {
    const result = validateInput(
      { all: [{ axis: "flow_step", in: ["entry", "processing"] }] },
      {},
      meta,
    );
    expect(result.valid).toBe(false);
  });

  it("exists: false — 축 미설정", () => {
    const result = validateInput(
      { all: [{ axis: "lifecycle_state", exists: false }] },
      {},
      meta,
    );
    expect(result.valid).toBe(true);
  });

  it("exists: true — 축 설정됨", () => {
    const result = validateInput(
      { all: [{ axis: "lifecycle_state", exists: true }] },
      { lifecycle_state: "active" },
      meta,
    );
    expect(result.valid).toBe(true);
  });

  it("exists: true — 축 미설정 시 실패", () => {
    const result = validateInput(
      { all: [{ axis: "lifecycle_state", exists: true }] },
      {},
      meta,
    );
    expect(result.valid).toBe(false);
  });

  it("복합 조건 (all)", () => {
    const result = validateInput(
      {
        all: [
          { axis: "lifecycle_state", eq: "active" },
          { axis: "flow_step", eq: "payment" },
        ],
      },
      { lifecycle_state: "active", flow_step: "payment" },
      meta,
    );
    expect(result.valid).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════
//  Output Applier
// ═══════════════════════════════════════════════════════════════

describe("applyOutput", () => {
  it("set — 축 값 설정", () => {
    const store = new InMemoryStateStore();
    const snapshot = applyOutput(
      { set: [{ axis: "flow_step", value: "processing" }, { axis: "lifecycle_state", value: "active" }] },
      store, "ctx", "res",
    );
    expect(snapshot).toEqual({ flow_step: "processing", lifecycle_state: "active" });
  });

  it("null — 축 값 제거", () => {
    const store = new InMemoryStateStore();
    store.set("ctx", "res", "flow_step", "entry");
    const snapshot = applyOutput(
      { set: [{ axis: "flow_step", value: null }] },
      store, "ctx", "res",
    );
    expect(snapshot).toEqual({});
  });
});

// ═══════════════════════════════════════════════════════════════
//  TransitionEngine — 7단계 파이프라인
// ═══════════════════════════════════════════════════════════════

describe("TransitionEngine", () => {
  let engine: TransitionEngine;
  let store: InMemoryStateStore;

  beforeEach(() => {
    const registry = new TransitionRegistry();
    store = new InMemoryStateStore();
    engine = new TransitionEngine(registry, store);
  });

  // ── 헬퍼 ─────────────────────────────────────────────

  function makeEvent(
    id: string,
    timestamp: string,
    addressContext: Record<string, string>,
    extra?: Record<string, unknown>,
  ): TransitionEvent {
    return { log_id: id, timestamp, address_context: addressContext, ...extra };
  }

  // ── cart.checkout 단일 전이 ───────────────────────────

  it("cart.checkout — 단일 전이 성공", () => {
    engine.registry.register(CART_CHECKOUT_SPEC);

    // flow_step: entry 상태로 초기화 (input 조건)
    store.set("ctx_1", "order_1", "flow_step", "entry");

    const events: TransitionEvent[] = [
      makeEvent("e1", "2026-03-22T10:00:00Z",
        { trackAction: "submit", page: "checkout", userType: "member" },
        { context_id: "ctx_1" }),
      makeEvent("e2", "2026-03-22T10:00:01Z",
        { flow_name: "checkout", flow_step: "entry", flow_variant: "default" },
        { context_id: "ctx_1" }),
      makeEvent("e3", "2026-03-22T10:00:02Z",
        { flow_name: "checkout", flow_step: "processing", flow_variant: "default" },
        { context_id: "ctx_1" }),
      makeEvent("e4", "2026-03-22T10:00:03Z",
        { order_action: "create" },
        { context_id: "ctx_1", order_id: "order_1" }),
    ];

    const result = engine.process(events);

    expect(result.instances).toHaveLength(1);
    expect(result.violations).toHaveLength(0);

    const instance = result.instances[0];
    expect(instance.transition_name).toBe("cart.checkout");
    expect(instance.context_id).toBe("ctx_1");
    expect(instance.resource_id).toBe("order_1");
    expect(instance.effect_kind).toBe("create");
    expect(instance.matched_event_ids).toEqual(["e1", "e2", "e3", "e4"]);

    // output 반영 확인
    expect(instance.output_snapshot.lifecycle_state).toBe("active");
    expect(instance.output_snapshot.flow_step).toBe("processing");
    expect(instance.output_snapshot.resource_location).toBe("origin");
  });

  // ── input 조건 실패 ──────────────────────────────────

  it("input 조건 미충족 → violation", () => {
    engine.registry.register(CART_CHECKOUT_SPEC);

    // lifecycle_state가 이미 설정됨 → exists: false 조건 실패
    store.set("ctx_1", "order_1", "lifecycle_state", "active");
    store.set("ctx_1", "order_1", "flow_step", "entry");

    const events: TransitionEvent[] = [
      makeEvent("e1", "2026-03-22T10:00:00Z",
        { trackAction: "submit", page: "checkout", userType: "member" },
        { context_id: "ctx_1" }),
      makeEvent("e2", "2026-03-22T10:00:01Z",
        { flow_name: "checkout", flow_step: "entry", flow_variant: "default" },
        { context_id: "ctx_1" }),
      makeEvent("e3", "2026-03-22T10:00:02Z",
        { flow_name: "checkout", flow_step: "processing", flow_variant: "default" },
        { context_id: "ctx_1" }),
      makeEvent("e4", "2026-03-22T10:00:03Z",
        { order_action: "create" },
        { context_id: "ctx_1", order_id: "order_1" }),
    ];

    const result = engine.process(events);

    expect(result.instances).toHaveLength(0);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].axis).toBe("lifecycle_state");
  });

  // ── 매칭 실패 → unmatched ────────────────────────────

  it("좌표 패턴 미매칭 → unmatched_events", () => {
    engine.registry.register(CART_CHECKOUT_SPEC);

    const events: TransitionEvent[] = [
      makeEvent("e1", "2026-03-22T10:00:00Z", { trackAction: "click", page: "home" }),
    ];

    const result = engine.process(events);
    expect(result.instances).toHaveLength(0);
    expect(result.unmatched_events).toEqual(["e1"]);
  });

  // ── user.login ───────────────────────────────────────

  it("user.login — open 전이", () => {
    engine.registry.register(USER_LOGIN_SPEC);

    const events: TransitionEvent[] = [
      makeEvent("e1", "2026-03-22T10:00:00Z",
        { resource_type: "api", http_method: "POST", api_version: "v1" },
        { context_id: "ctx_1" }),
      makeEvent("e2", "2026-03-22T10:00:01Z",
        { auth_action: "login" },
        { context_id: "ctx_1", actor_id: "user_42" }),
      makeEvent("e3", "2026-03-22T10:00:02Z",
        { flow_name: "login", flow_step: "success", flow_variant: "default" },
        { context_id: "ctx_1" }),
    ];

    const result = engine.process(events);
    expect(result.instances).toHaveLength(1);
    expect(result.instances[0].effect_kind).toBe("open");
    expect(result.instances[0].output_snapshot.lifecycle_state).toBe("active");
    expect(result.instances[0].output_snapshot.flow_step).toBe("success");
  });

  // ── cart.checkout → payment.capture 연쇄 전이 ─────────

  it("연쇄 전이: cart.checkout → payment.capture", () => {
    engine.registry.register(CART_CHECKOUT_SPEC);
    engine.registry.register(PAYMENT_CAPTURE_SPEC);

    // Step 1: checkout 전이를 위한 초기 상태
    store.set("ctx_1", "order_1", "flow_step", "entry");

    const checkoutEvents: TransitionEvent[] = [
      makeEvent("e1", "2026-03-22T10:00:00Z",
        { trackAction: "submit", page: "checkout", userType: "member" },
        { context_id: "ctx_1" }),
      makeEvent("e2", "2026-03-22T10:00:01Z",
        { flow_name: "checkout", flow_step: "entry", flow_variant: "default" },
        { context_id: "ctx_1" }),
      makeEvent("e3", "2026-03-22T10:00:02Z",
        { flow_name: "checkout", flow_step: "processing", flow_variant: "default" },
        { context_id: "ctx_1" }),
      makeEvent("e4", "2026-03-22T10:00:03Z",
        { order_action: "create" },
        { context_id: "ctx_1", order_id: "order_1" }),
    ];

    const r1 = engine.process(checkoutEvents);
    expect(r1.instances).toHaveLength(1);
    expect(r1.instances[0].transition_name).toBe("cart.checkout");

    // checkout 후 상태 확인
    expect(store.get("ctx_1", "order_1", "lifecycle_state")).toBe("active");
    expect(store.get("ctx_1", "order_1", "flow_step")).toBe("processing");

    // Step 2: payment 전이를 위해 flow_step을 payment로 전환
    store.set("ctx_1", "order_1", "flow_step", "payment");

    const paymentEvents: TransitionEvent[] = [
      makeEvent("p1", "2026-03-22T10:01:00Z",
        { flow_name: "checkout", flow_step: "payment", flow_variant: "default" },
        { context_id: "ctx_1" }),
      makeEvent("p2", "2026-03-22T10:01:01Z",
        { order_action: "complete" },
        { context_id: "ctx_1", order_id: "order_1" }),
      makeEvent("p3", "2026-03-22T10:01:02Z",
        { flow_name: "checkout", flow_step: "complete", flow_variant: "default" },
        { context_id: "ctx_1" }),
    ];

    const r2 = engine.process(paymentEvents);
    expect(r2.instances).toHaveLength(1);
    expect(r2.instances[0].transition_name).toBe("payment.capture");
    expect(r2.instances[0].effect_kind).toBe("close");

    // 최종 상태
    expect(store.get("ctx_1", "order_1", "flow_step")).toBe("complete");
    expect(store.get("ctx_1", "order_1", "lifecycle_state")).toBe("active");
    expect(store.get("ctx_1", "order_1", "resource_location")).toBe("origin");
  });

  // ── Deterministic Replay ─────────────────────────────

  it("deterministic replay — 같은 이벤트 → 같은 최종 상태", () => {
    engine.registry.register(USER_LOGIN_SPEC);

    const events: TransitionEvent[] = [
      makeEvent("e1", "2026-03-22T10:00:00Z",
        { resource_type: "api", http_method: "POST", api_version: "v1" },
        { context_id: "ctx_1" }),
      makeEvent("e2", "2026-03-22T10:00:01Z",
        { auth_action: "login" },
        { context_id: "ctx_1", actor_id: "user_42" }),
      makeEvent("e3", "2026-03-22T10:00:02Z",
        { flow_name: "login", flow_step: "success", flow_variant: "default" },
        { context_id: "ctx_1" }),
    ];

    // 1차 실행
    const r1 = engine.process(events);
    const snapshot1 = store.snapshot("ctx_1", "user_42");

    // 초기화 후 2차 실행
    store.clear();
    const r2 = engine.process(events);
    const snapshot2 = store.snapshot("ctx_1", "user_42");

    // 같은 결과
    expect(r1.instances).toHaveLength(1);
    expect(r2.instances).toHaveLength(1);
    expect(snapshot1).toEqual(snapshot2);
    expect(r1.instances[0].output_snapshot).toEqual(r2.instances[0].output_snapshot);
  });

  // ── timestamp 순서 보장 ──────────────────────────────

  it("이벤트가 역순으로 들어와도 timestamp 정렬 후 처리", () => {
    engine.registry.register(USER_LOGIN_SPEC);

    // 역순 입력
    const events: TransitionEvent[] = [
      makeEvent("e3", "2026-03-22T10:00:02Z",
        { flow_name: "login", flow_step: "success", flow_variant: "default" },
        { context_id: "ctx_1" }),
      makeEvent("e1", "2026-03-22T10:00:00Z",
        { resource_type: "api", http_method: "POST", api_version: "v1" },
        { context_id: "ctx_1" }),
      makeEvent("e2", "2026-03-22T10:00:01Z",
        { auth_action: "login" },
        { context_id: "ctx_1", actor_id: "user_42" }),
    ];

    const result = engine.process(events);
    expect(result.instances).toHaveLength(1);
    // 정렬 후 매칭이므로 순서대로 e1, e2, e3
    expect(result.instances[0].matched_event_ids).toEqual(["e1", "e2", "e3"]);
  });
});
