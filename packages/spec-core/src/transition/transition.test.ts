/**
 * Transition Spec DSL — Tier 1 테스트.
 *
 * 타입 검증 + registry CRUD + match 어댑터 변환.
 * 상태는 축(axis) 기반 — slot 체계 없음.
 */

import { describe, it, expect, beforeEach } from "vitest";
import type { TransitionSpec } from "./transition.types.js";
import { EFFECT_KINDS } from "./transition.types.js";
import { validateTransitionSpec } from "./transition.schema.js";
import { TransitionRegistry } from "./transition.registry.js";
import {
  deriveEventKey,
  coordToConstraints,
  transitionMatchToScenarioSteps,
} from "./match-adapter.js";
import {
  CART_CHECKOUT_SPEC,
  USER_LOGIN_SPEC,
  PAYMENT_CAPTURE_SPEC,
  DEMO_TRANSITION_SPECS,
} from "./demo-transition-specs.js";
import { validateWithCatalog } from "./catalog-validator.js";
import { DEMO_CATALOG } from "demo-snapshot";

// ── 예시 spec (일반 도메인) ──────────────────────────────

const ARTICLE_CREATE: TransitionSpec = {
  transition: "article.create",
  version: "v1",
  match: {
    mode: "ordered",
    coordinates: [
      { namespace: "cms", type: "api", resource: "article", action: "submit" },
      { namespace: "cms", type: "service", resource: "article", action: "validate" },
      { namespace: "cms", type: "db", resource: "article", action: "insert" },
    ],
  },
  bind: {
    context_id: "$.events[0].context_id",
    resource_id: "$.events[0].resource_ref_id",
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
      { axis: "resource_location", value: "origin" },
      { axis: "flow_step", value: "processing" },
    ],
  },
  effect: { kind: "create" },
};

const ARTICLE_READ: TransitionSpec = {
  transition: "article.read",
  version: "v1",
  match: {
    mode: "single",
    coordinates: [
      { namespace: "cms", type: "api", resource: "article", action: "get" },
    ],
  },
  bind: {
    context_id: "$.events[0].context_id",
    resource_id: "$.events[0].resource_ref_id",
  },
  input: {
    all: [{ axis: "lifecycle_state", eq: "active" }],
  },
  output: {
    set: [{ axis: "flow_step", value: "complete" }],
  },
  effect: { kind: "consume" },
};

const GENERIC_CHECKOUT: TransitionSpec = {
  transition: "cart.checkout",
  version: "v1",
  match: {
    mode: "ordered",
    coordinates: [
      { namespace: "shop", type: "api", resource: "cart", action: "checkout" },
      { namespace: "shop", type: "service", resource: "payment", action: "capture" },
    ],
  },
  bind: {
    context_id: "$.events[0].context_id",
    resource_id: "$.events[0].cart_id",
  },
  input: {
    all: [
      { axis: "lifecycle_state", eq: "active" },
      { axis: "flow_step", eq: "processing" },
    ],
  },
  output: {
    set: [
      { axis: "lifecycle_state", value: "archived" },
      { axis: "flow_step", value: "complete" },
    ],
  },
  effect: { kind: "close" },
};

// ═══════════════════════════════════════════════════════════════
//  Schema Validation
// ═══════════════════════════════════════════════════════════════

describe("validateTransitionSpec", () => {
  it("유효한 ordered spec 통과", () => {
    const result = validateTransitionSpec(ARTICLE_CREATE);
    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it("유효한 single spec 통과", () => {
    const result = validateTransitionSpec(ARTICLE_READ);
    expect(result.valid).toBe(true);
  });

  it("null → 실패", () => {
    const result = validateTransitionSpec(null);
    expect(result.valid).toBe(false);
  });

  it("잘못된 transition 이름 → 실패", () => {
    const result = validateTransitionSpec({ ...ARTICLE_CREATE, transition: "BAD NAME" });
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.path === "transition")).toBe(true);
  });

  it("single 모드에 좌표 2개 → 실패", () => {
    const result = validateTransitionSpec({
      ...ARTICLE_READ,
      match: {
        mode: "single",
        coordinates: [
          { namespace: "cms", type: "api" },
          { namespace: "cms", type: "db" },
        ],
      },
    });
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.path === "match.coordinates")).toBe(true);
  });

  it("빈 좌표 배열 → 실패", () => {
    const result = validateTransitionSpec({
      ...ARTICLE_CREATE,
      match: { mode: "ordered", coordinates: [] },
    });
    expect(result.valid).toBe(false);
  });

  it("잘못된 bind 경로 → 실패", () => {
    const result = validateTransitionSpec({
      ...ARTICLE_CREATE,
      bind: { context_id: "bad_path", resource_id: "$.events[0].id" },
    });
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.path === "bind.context_id")).toBe(true);
  });

  it("잘못된 axis 이름 → 실패", () => {
    const result = validateTransitionSpec({
      ...ARTICLE_CREATE,
      input: { all: [{ axis: "UPPER_CASE", eq: "active" }] },
    });
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.path.includes("axis"))).toBe(true);
  });

  it("연산자 없는 condition → 실패", () => {
    const result = validateTransitionSpec({
      ...ARTICLE_CREATE,
      input: { all: [{ axis: "lifecycle_state" }] },
    });
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.message.includes("operator"))).toBe(true);
  });

  it("잘못된 effect kind → 실패", () => {
    const result = validateTransitionSpec({
      ...ARTICLE_CREATE,
      effect: { kind: "destroy" },
    });
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.path === "effect.kind")).toBe(true);
  });

  it("output value는 string 또는 null만 허용", () => {
    const result = validateTransitionSpec({
      ...ARTICLE_CREATE,
      output: { set: [{ axis: "lifecycle_state", value: 42 }] },
    });
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.path.includes("value"))).toBe(true);
  });

  it("output value null 허용 (값 제거)", () => {
    const result = validateTransitionSpec({
      ...ARTICLE_CREATE,
      output: { set: [{ axis: "lifecycle_state", value: null }] },
    });
    expect(result.valid).toBe(true);
  });

  it("windowed 모드에 window_ms 누락 → 실패", () => {
    const result = validateTransitionSpec({
      ...ARTICLE_CREATE,
      match: { mode: "windowed", coordinates: ARTICLE_CREATE.match.coordinates },
    });
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.path === "match.window_ms")).toBe(true);
  });

  it("모든 effect kind가 유효", () => {
    for (const kind of EFFECT_KINDS) {
      const result = validateTransitionSpec({
        ...ARTICLE_CREATE,
        effect: { kind },
      });
      expect(result.valid).toBe(true);
    }
  });

  it("input eq 값은 string만 (number 금지)", () => {
    const result = validateTransitionSpec({
      ...ARTICLE_CREATE,
      input: { all: [{ axis: "flow_step", eq: 42 }] },
    });
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.path.includes("eq"))).toBe(true);
  });

  it("input in 배열은 string만", () => {
    const result = validateTransitionSpec({
      ...ARTICLE_CREATE,
      input: { all: [{ axis: "flow_step", in: ["entry", 42] }] },
    });
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.path.includes("in"))).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════
//  Registry
// ═══════════════════════════════════════════════════════════════

describe("TransitionRegistry", () => {
  let registry: TransitionRegistry;

  beforeEach(() => {
    registry = new TransitionRegistry();
  });

  it("register + get", () => {
    const result = registry.register(ARTICLE_CREATE);
    expect(result.valid).toBe(true);
    expect(registry.get("article.create", "v1")).toEqual(ARTICLE_CREATE);
  });

  it("버전 생략 시 최신 반환", () => {
    const v2 = { ...ARTICLE_CREATE, version: "v2" };
    registry.register(ARTICLE_CREATE);
    registry.register(v2);
    expect(registry.get("article.create")).toEqual(v2);
  });

  it("list — 모든 spec 반환", () => {
    registry.register(ARTICLE_CREATE);
    registry.register(ARTICLE_READ);
    registry.register(GENERIC_CHECKOUT);
    expect(registry.list()).toHaveLength(3);
  });

  it("names — transition 이름 목록", () => {
    registry.register(ARTICLE_CREATE);
    registry.register(ARTICLE_READ);
    expect(registry.names().sort()).toEqual(["article.create", "article.read"]);
  });

  it("size — 등록 수", () => {
    registry.register(ARTICLE_CREATE);
    registry.register({ ...ARTICLE_CREATE, version: "v2" });
    registry.register(ARTICLE_READ);
    expect(registry.size).toBe(3);
  });

  it("getVersions — 특정 transition의 모든 버전", () => {
    registry.register(ARTICLE_CREATE);
    registry.register({ ...ARTICLE_CREATE, version: "v2" });
    expect(registry.getVersions("article.create")).toHaveLength(2);
  });

  it("remove — 특정 버전 삭제", () => {
    registry.register(ARTICLE_CREATE);
    registry.register({ ...ARTICLE_CREATE, version: "v2" });
    expect(registry.remove("article.create", "v1")).toBe(true);
    expect(registry.get("article.create", "v1")).toBeUndefined();
    expect(registry.get("article.create", "v2")).toBeDefined();
  });

  it("remove — 전체 삭제", () => {
    registry.register(ARTICLE_CREATE);
    registry.register({ ...ARTICLE_CREATE, version: "v2" });
    expect(registry.remove("article.create")).toBe(true);
    expect(registry.get("article.create")).toBeUndefined();
  });

  it("clear — 전체 초기화", () => {
    registry.register(ARTICLE_CREATE);
    registry.register(ARTICLE_READ);
    registry.clear();
    expect(registry.size).toBe(0);
  });

  it("유효하지 않은 spec 등록 → 검증 실패", () => {
    const result = registry.register({ transition: "BAD" } as unknown as TransitionSpec);
    expect(result.valid).toBe(false);
    expect(registry.size).toBe(0);
  });

  it("미등록 이름 조회 → undefined", () => {
    expect(registry.get("nonexistent")).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════
//  Match Adapter
// ═══════════════════════════════════════════════════════════════

describe("match-adapter", () => {
  describe("deriveEventKey", () => {
    it("차원 값을 정렬된 키 순으로 . 연결", () => {
      const key = deriveEventKey({ namespace: "cms", type: "api", resource: "article", action: "submit" });
      expect(key).toBe("submit.cms.article.api");
    });

    it("단일 차원", () => {
      const key = deriveEventKey({ action: "get" });
      expect(key).toBe("get");
    });
  });

  describe("coordToConstraints", () => {
    it("각 차원을 address_context 기반 eq 제약으로 변환", () => {
      const constraints = coordToConstraints({ namespace: "cms", action: "submit" });
      expect(constraints).toHaveLength(2);
      expect(constraints).toContainEqual({
        field: "address_context.namespace",
        op: "eq",
        value: "cms",
      });
      expect(constraints).toContainEqual({
        field: "address_context.action",
        op: "eq",
        value: "submit",
      });
    });
  });

  describe("transitionMatchToScenarioSteps", () => {
    it("ordered → 순차 steps with next 연결", () => {
      const steps = transitionMatchToScenarioSteps(ARTICLE_CREATE.match, "article.create");
      expect(steps).toHaveLength(3);

      expect(steps[0].id).toBe("article.create__step_0");
      expect(steps[0].next).toEqual(["article.create__step_1"]);
      expect(steps[0].kind).toBe("sequence");
      expect(steps[0].required).toBe(true);

      expect(steps[1].next).toEqual(["article.create__step_2"]);
      expect(steps[2].next).toBeUndefined();
    });

    it("single → 단일 step, next 없음", () => {
      const steps = transitionMatchToScenarioSteps(ARTICLE_READ.match, "article.read");
      expect(steps).toHaveLength(1);
      expect(steps[0].id).toBe("article.read__step_0");
      expect(steps[0].next).toBeUndefined();
    });

    it("constraints에 좌표 차원이 반영됨", () => {
      const steps = transitionMatchToScenarioSteps(ARTICLE_READ.match, "article.read");
      const constraints = steps[0].constraints!;
      expect(constraints).toContainEqual({
        field: "address_context.namespace",
        op: "eq",
        value: "cms",
      });
      expect(constraints).toContainEqual({
        field: "address_context.action",
        op: "eq",
        value: "get",
      });
    });
  });
});

// ═══════════════════════════════════════════════════════════════
//  DEMO_CATALOG 기반 예시 Transition Spec
// ═══════════════════════════════════════════════════════════════

describe("DEMO_CATALOG 기반 예시 specs", () => {
  it("3종 모두 검증 통과", () => {
    for (const spec of DEMO_TRANSITION_SPECS) {
      const result = validateTransitionSpec(spec);
      expect(result.valid, `${spec.transition}: ${JSON.stringify(result.issues)}`).toBe(true);
    }
  });

  it("전체 spec registry에 등록 가능", () => {
    const registry = new TransitionRegistry();
    for (const spec of DEMO_TRANSITION_SPECS) {
      const result = registry.register(spec);
      expect(result.valid, `${spec.transition}: ${JSON.stringify(result.issues)}`).toBe(true);
    }
    expect(registry.size).toBe(DEMO_TRANSITION_SPECS.length);
    // 기본 3종 포함 확인
    expect(registry.names()).toContain("cart.checkout");
    expect(registry.names()).toContain("user.login");
    expect(registry.names()).toContain("payment.capture");
  });

  it("cart.checkout — 축 기반 input/output", () => {
    expect(CART_CHECKOUT_SPEC.match.coordinates).toHaveLength(4);
    expect(CART_CHECKOUT_SPEC.effect.kind).toBe("create");
    // input: lifecycle_state 미설정 + flow_step entry
    expect(CART_CHECKOUT_SPEC.input.all[0]).toEqual({ axis: "lifecycle_state", exists: false });
    expect(CART_CHECKOUT_SPEC.input.all[1]).toEqual({ axis: "flow_step", eq: "entry" });
    // output: lifecycle_state, flow_step, resource_location 축 설정
    expect(CART_CHECKOUT_SPEC.output.set).toContainEqual({ axis: "lifecycle_state", value: "active" });
    expect(CART_CHECKOUT_SPEC.output.set).toContainEqual({ axis: "flow_step", value: "processing" });
    expect(CART_CHECKOUT_SPEC.output.set).toContainEqual({ axis: "resource_location", value: "origin" });
  });

  it("user.login — lifecycle_state + flow_step 축", () => {
    expect(USER_LOGIN_SPEC.match.coordinates).toHaveLength(3);
    expect(USER_LOGIN_SPEC.effect.kind).toBe("open");
    expect(USER_LOGIN_SPEC.input.all[0]).toEqual({ axis: "lifecycle_state", neq: "archived" });
    expect(USER_LOGIN_SPEC.output.set).toContainEqual({ axis: "lifecycle_state", value: "active" });
    expect(USER_LOGIN_SPEC.output.set).toContainEqual({ axis: "flow_step", value: "success" });
  });

  it("payment.capture — lifecycle_state + flow_step 전이", () => {
    expect(PAYMENT_CAPTURE_SPEC.match.coordinates).toHaveLength(3);
    expect(PAYMENT_CAPTURE_SPEC.effect.kind).toBe("close");
    expect(PAYMENT_CAPTURE_SPEC.input.all[0]).toEqual({ axis: "lifecycle_state", eq: "active" });
    expect(PAYMENT_CAPTURE_SPEC.input.all[1]).toEqual({ axis: "flow_step", eq: "payment" });
    expect(PAYMENT_CAPTURE_SPEC.output.set).toContainEqual({ axis: "flow_step", value: "complete" });
  });

  it("match adapter 변환 — DEMO_CATALOG 좌표", () => {
    const steps = transitionMatchToScenarioSteps(CART_CHECKOUT_SPEC.match, "cart.checkout");
    expect(steps).toHaveLength(4);

    const trackConstraints = steps[0].constraints!;
    expect(trackConstraints).toContainEqual({
      field: "address_context.trackAction",
      op: "eq",
      value: "submit",
    });

    const orderConstraints = steps[3].constraints!;
    expect(orderConstraints).toContainEqual({
      field: "address_context.order_action",
      op: "eq",
      value: "create",
    });
  });
});

// ═══════════════════════════════════════════════════════════════
//  Catalog Validator — 2단계 검증
// ═══════════════════════════════════════════════════════════════

describe("validateWithCatalog", () => {
  it("DEMO_CATALOG 기반 예시 3종 모두 통과", () => {
    for (const spec of DEMO_TRANSITION_SPECS) {
      const result = validateWithCatalog(spec, DEMO_CATALOG);
      expect(result.valid, `${spec.transition}: ${JSON.stringify(result.issues)}`).toBe(true);
    }
  });

  it("존재하지 않는 축 → 실패", () => {
    const badSpec: TransitionSpec = {
      ...CART_CHECKOUT_SPEC,
      input: { all: [{ axis: "nonexistent_axis", eq: "value" }] },
    };
    const result = validateWithCatalog(badSpec, DEMO_CATALOG);
    expect(result.valid).toBe(false);
    expect(result.issues[0].message).toContain("not found in catalog");
  });

  it("존재하지 않는 entry 값 → 실패", () => {
    const badSpec: TransitionSpec = {
      ...CART_CHECKOUT_SPEC,
      input: { all: [{ axis: "flow_step", eq: "invalid_step" }] },
    };
    const result = validateWithCatalog(badSpec, DEMO_CATALOG);
    expect(result.valid).toBe(false);
    expect(result.issues[0].message).toContain("not found in axis");
  });

  it("output의 잘못된 entry 값 → 실패", () => {
    const badSpec: TransitionSpec = {
      ...CART_CHECKOUT_SPEC,
      output: { set: [{ axis: "lifecycle_state", value: "nonexistent" }] },
    };
    const result = validateWithCatalog(badSpec, DEMO_CATALOG);
    expect(result.valid).toBe(false);
  });

  it("output value: null은 통과 (축 값 제거)", () => {
    const spec: TransitionSpec = {
      ...CART_CHECKOUT_SPEC,
      output: { set: [{ axis: "lifecycle_state", value: null }] },
    };
    const result = validateWithCatalog(spec, DEMO_CATALOG);
    expect(result.valid).toBe(true);
  });

  it("input in 배열의 잘못된 값 → 실패", () => {
    const badSpec: TransitionSpec = {
      ...CART_CHECKOUT_SPEC,
      input: { all: [{ axis: "flow_step", in: ["entry", "bad_value"] }] },
    };
    const result = validateWithCatalog(badSpec, DEMO_CATALOG);
    expect(result.valid).toBe(false);
    expect(result.issues[0].path).toContain("in[1]");
  });

  it("exists 연산자는 entry 검증 불필요 → 통과", () => {
    const spec: TransitionSpec = {
      ...CART_CHECKOUT_SPEC,
      input: { all: [{ axis: "lifecycle_state", exists: false }] },
    };
    const result = validateWithCatalog(spec, DEMO_CATALOG);
    expect(result.valid).toBe(true);
  });

  // match.coordinates 검증
  it("match.coordinates의 존재하지 않는 축 → 실패", () => {
    const badSpec: TransitionSpec = {
      ...CART_CHECKOUT_SPEC,
      match: {
        mode: "single",
        coordinates: [{ nonexistent_dim: "value" }],
      },
    };
    const result = validateWithCatalog(badSpec, DEMO_CATALOG);
    expect(result.valid).toBe(false);
    expect(result.issues[0].path).toContain("match.coordinates[0]");
  });

  it("match.coordinates의 잘못된 entry 값 → 실패", () => {
    const badSpec: TransitionSpec = {
      ...CART_CHECKOUT_SPEC,
      match: {
        mode: "single",
        coordinates: [{ flow_step: "invalid_step_value" }],
      },
    };
    const result = validateWithCatalog(badSpec, DEMO_CATALOG);
    expect(result.valid).toBe(false);
    expect(result.issues[0].message).toContain("not found in axis");
  });

  it("match.coordinates의 유효한 축+entry → 통과", () => {
    const spec: TransitionSpec = {
      ...CART_CHECKOUT_SPEC,
      match: {
        mode: "single",
        coordinates: [{ flow_step: "entry", flow_name: "checkout" }],
      },
    };
    const result = validateWithCatalog(spec, DEMO_CATALOG);
    expect(result.valid).toBe(true);
  });
});
