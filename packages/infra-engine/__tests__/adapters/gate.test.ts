import { describe, it, expect } from "vitest";
import { createGateAdapter } from "../../src/adapters/gate.js";
import type { GateCheckResult } from "../../src/core/types.js";

describe("GateAdapter", () => {
  const gate = createGateAdapter();

  it("모든 게이트 pass → pass", () => {
    const checks: GateCheckResult[] = [
      { gate: "health", verdict: "pass", detail: "200 OK" },
      { gate: "latency", verdict: "pass", detail: "50ms" },
    ];
    expect(gate.evaluate(checks)).toBe("pass");
  });

  it("빈 체크 → pass", () => {
    expect(gate.evaluate([])).toBe("pass");
  });

  it("하나라도 fail → fail", () => {
    const checks: GateCheckResult[] = [
      { gate: "health", verdict: "pass", detail: "ok" },
      { gate: "db", verdict: "fail", detail: "timeout" },
    ];
    expect(gate.evaluate(checks)).toBe("fail");
  });

  it("fail 없고 warn 있으면 → warn", () => {
    const checks: GateCheckResult[] = [
      { gate: "health", verdict: "pass", detail: "ok" },
      { gate: "latency", verdict: "warn", detail: "2.5s" },
    ];
    expect(gate.evaluate(checks)).toBe("warn");
  });
});
