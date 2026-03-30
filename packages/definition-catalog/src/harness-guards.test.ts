import { describe, it, expect } from "vitest";
import { checkGuards, collectCascades } from "./harness-guards.js";
import { createHarnessRegistry, createCompositeInstance } from "./harness-state-model.js";

const registry = createHarnessRegistry();

describe("checkGuards", () => {
  it("guard 조건 충족 시 ok=true", () => {
    // version:active → address:active guard
    const composite = createCompositeInstance(registry, "test:v1", "prefix", ["version-lifecycle", "address-state"]);
    // version을 active로 설정
    (composite.states.get("version-lifecycle") as { current: string }).current = "active";

    const result = checkGuards(registry, composite, "address-state", "active");
    expect(result.ok).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it("guard 조건 미충족 시 ok=false + violation 메시지", () => {
    const composite = createCompositeInstance(registry, "test:v1", "prefix", ["version-lifecycle", "address-state"]);
    // version이 draft인 상태에서 address:active 시도
    const result = checkGuards(registry, composite, "address-state", "active");
    expect(result.ok).toBe(false);
    expect(result.violations.length).toBeGreaterThan(0);
    expect(result.violations[0]).toContain("version-lifecycle");
  });

  it("guard 없는 전이는 ok=true", () => {
    const composite = createCompositeInstance(registry, "test:v1", "prefix", ["metric-health"]);
    const result = checkGuards(registry, composite, "metric-health", "warning");
    expect(result.ok).toBe(true);
  });
});

describe("collectCascades", () => {
  it("version:deprecated → address:inactive cascade 수집", () => {
    const cascades = collectCascades(registry, "version-lifecycle", "deprecated");
    expect(cascades.length).toBeGreaterThan(0);
    expect(cascades.some(c => c.targetMachine === "address-state" && c.targetState === "inactive")).toBe(true);
  });

  it("cascade 없는 전이는 빈 배열", () => {
    const cascades = collectCascades(registry, "metric-health", "ok");
    expect(cascades).toHaveLength(0);
  });
});
