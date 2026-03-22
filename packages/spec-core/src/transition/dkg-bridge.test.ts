/**
 * DKG Bridge 단위 테스트.
 *
 * TransitionSpec → TransitionSpecNode 변환 검증.
 * ID 생성, 축 역할별 분리, slotRefs 합집합, 엣지 케이스.
 */

import { describe, it, expect } from "vitest";
import { toTransitionSpecNode, toTransitionSpecNodes } from "./dkg-bridge.js";
import {
  CART_CHECKOUT_SPEC,
  USER_LOGIN_SPEC,
  PAYMENT_CAPTURE_SPEC,
  DEMO_TRANSITION_SPECS,
} from "./demo-transition-specs.js";
import type { TransitionSpec } from "./transition.types.js";

describe("toTransitionSpecNode", () => {
  it("ID 생성: . → - 변환", () => {
    const node = toTransitionSpecNode(CART_CHECKOUT_SPEC);
    expect(node.id).toBe("TSPEC-cart-checkout");
    expect(node.kind).toBe("transition-spec");
  });

  it("기본 필드 매핑", () => {
    const node = toTransitionSpecNode(CART_CHECKOUT_SPEC);
    expect(node.transition).toBe("cart.checkout");
    expect(node.version).toBe("v1");
    expect(node.matchMode).toBe("ordered");
    expect(node.coordinateCount).toBe(4);
    expect(node.effectKind).toBe("create");
  });

  it("matchAxes — match.coordinates 차원만 수집", () => {
    const node = toTransitionSpecNode(CART_CHECKOUT_SPEC);
    // cart.checkout coordinates: trackAction, page, userType, flow_name, flow_step, flow_variant, order_action
    expect(node.matchAxes).toContain("trackAction");
    expect(node.matchAxes).toContain("flow_name");
    expect(node.matchAxes).toContain("order_action");
    // input/output 전용 축은 match에 없어야 함
    expect(node.matchAxes).not.toContain("lifecycle_state");
    expect(node.matchAxes).not.toContain("resource_location");
  });

  it("inputAxes — input.all 축만 수집", () => {
    const node = toTransitionSpecNode(CART_CHECKOUT_SPEC);
    // cart.checkout input: lifecycle_state(exists:false), flow_step(eq:entry)
    expect(node.inputAxes).toEqual(["flow_step", "lifecycle_state"]);
  });

  it("outputAxes — output.set 축만 수집", () => {
    const node = toTransitionSpecNode(CART_CHECKOUT_SPEC);
    // cart.checkout output: lifecycle_state, flow_step, resource_location
    expect(node.outputAxes).toEqual(["flow_step", "lifecycle_state", "resource_location"]);
  });

  it("slotRefs = matchAxes ∪ inputAxes ∪ outputAxes", () => {
    const node = toTransitionSpecNode(CART_CHECKOUT_SPEC);
    const union = new Set([...node.matchAxes, ...node.inputAxes, ...node.outputAxes]);
    expect(new Set(node.slotRefs)).toEqual(union);
  });

  it("축 정렬: 알파벳순", () => {
    const node = toTransitionSpecNode(CART_CHECKOUT_SPEC);
    const sortedMatch = [...node.matchAxes].sort();
    expect(node.matchAxes).toEqual(sortedMatch);
    const sortedSlots = [...node.slotRefs].sort();
    expect(node.slotRefs).toEqual(sortedSlots);
  });

  it("user.login — effect: open, auth 축 포함", () => {
    const node = toTransitionSpecNode(USER_LOGIN_SPEC);
    expect(node.id).toBe("TSPEC-user-login");
    expect(node.effectKind).toBe("open");
    expect(node.matchAxes).toContain("auth_action");
    expect(node.matchAxes).toContain("http_method");
    expect(node.inputAxes).toEqual(["lifecycle_state"]);
    expect(node.outputAxes).toEqual(["flow_step", "lifecycle_state"]);
  });

  it("payment.capture — effect: close, output 최소", () => {
    const node = toTransitionSpecNode(PAYMENT_CAPTURE_SPEC);
    expect(node.id).toBe("TSPEC-payment-capture");
    expect(node.effectKind).toBe("close");
    expect(node.outputAxes).toEqual(["flow_step"]);
  });

  it("빈 input → inputAxes 빈 배열", () => {
    const spec: TransitionSpec = {
      ...CART_CHECKOUT_SPEC,
      input: { all: [] },
    };
    const node = toTransitionSpecNode(spec);
    expect(node.inputAxes).toEqual([]);
  });

  it("빈 output → outputAxes 빈 배열", () => {
    const spec: TransitionSpec = {
      ...CART_CHECKOUT_SPEC,
      output: { set: [] },
    };
    const node = toTransitionSpecNode(spec);
    expect(node.outputAxes).toEqual([]);
  });

  it("단일 좌표 spec → coordinateCount 1", () => {
    const spec: TransitionSpec = {
      ...CART_CHECKOUT_SPEC,
      match: { mode: "single", coordinates: [{ flow_step: "entry" }] },
    };
    const node = toTransitionSpecNode(spec);
    expect(node.coordinateCount).toBe(1);
    expect(node.matchMode).toBe("single");
  });
});

describe("toTransitionSpecNodes", () => {
  it("배열 변환", () => {
    const nodes = toTransitionSpecNodes(DEMO_TRANSITION_SPECS);
    expect(nodes).toHaveLength(DEMO_TRANSITION_SPECS.length);
    // 기본 3종 포함 확인
    const ids = nodes.map(n => n.id);
    expect(ids).toContain("TSPEC-cart-checkout");
    expect(ids).toContain("TSPEC-user-login");
    expect(ids).toContain("TSPEC-payment-capture");
  });
});

describe("slotRefs 정합성 — 기존 수동 정의와 비교", () => {
  // 기존 demo-dkg-config에서 수동 정의했던 slotRefs (제거됨)
  // bridge 자동 생성이 더 정확한 상위집합인지 검증

  it("cart.checkout: 기존 수동 6개 축이 자동 생성에 포함됨", () => {
    const oldManual = ["lifecycle_state", "flow_step", "resource_location", "trackAction", "page", "order_action"];
    const node = toTransitionSpecNode(CART_CHECKOUT_SPEC);
    for (const axis of oldManual) {
      expect(node.slotRefs, `${axis} should be in slotRefs`).toContain(axis);
    }
    // 자동 생성은 match의 모든 차원을 포함하므로 상위집합
    expect(node.slotRefs.length).toBeGreaterThanOrEqual(oldManual.length);
  });

  it("user.login: 기존 수동 5개 축이 자동 생성에 포함됨", () => {
    const oldManual = ["lifecycle_state", "flow_step", "auth_action", "resource_type", "http_method"];
    const node = toTransitionSpecNode(USER_LOGIN_SPEC);
    for (const axis of oldManual) {
      expect(node.slotRefs).toContain(axis);
    }
  });

  it("payment.capture: 기존 수동 정의의 대부분이 자동 생성에 포함됨", () => {
    // 기존 수동: resource_location이 포함됐지만, 실제 spec에는 input에만 있음(flow_step, lifecycle_state)
    // resource_location은 input.all에 eq:"origin"으로 참조 → inputAxes에 포함
    const node = toTransitionSpecNode(PAYMENT_CAPTURE_SPEC);
    // 실제 spec 기준 검증
    expect(node.inputAxes).toContain("lifecycle_state");
    expect(node.inputAxes).toContain("flow_step");
    expect(node.outputAxes).toContain("flow_step");
    expect(node.matchAxes).toContain("order_action");
  });
});
