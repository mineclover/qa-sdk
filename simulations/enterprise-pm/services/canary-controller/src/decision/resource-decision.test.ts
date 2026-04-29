// @def.boundary sim-canary-controller
// @def.doc canary-controller-config
// spec 01 §4 의사 코드 1:1 — 분기 8 케이스 검증.

import { describe, it, expect, beforeEach } from "vitest";
import {
  ResourceDecisionService,
  type ResourceConfig,
} from "./resource-decision.service.js";
import type { CategoryVerdicts } from "../verdict/category-verdict.service.js";

const cfg: ResourceConfig = {
  cooldownUpMs: 60_000,
  cooldownDownMs: 180_000,
  minReplicasV1: 1,
  minReplicasV2: 0,
};

function verdicts(
  overrides: Partial<CategoryVerdicts> = {},
): CategoryVerdicts {
  return {
    perf: "PASS",
    compatibility: "PASS",
    decisionQuality: "PASS",
    auditSafety: "PASS",
    replicationHealth: "PASS",
    loadPressure: "PASS",
    resourceHeadroom: "PASS",
    stability: "PASS",
    hardFail: [],
    triggerSignals: [],
    ...overrides,
  };
}

describe("ResourceDecisionService (spec 01 §4)", () => {
  let svc: ResourceDecisionService;
  beforeEach(() => {
    svc = new ResourceDecisionService(cfg);
  });

  it("(a) stability=WARN → hold", () => {
    const d = svc.decide({
      verdicts: verdicts({ stability: "WARN" }),
      currentWeight: 25,
      current: { v1: 2, v2: 1 },
      timeSinceLastChangeMs: 200_000,
      confidence: 0.9,
    });
    expect(d.verdict).toBe("hold");
  });

  it("(b) load+headroom 둘 다 FAIL → rejected + rejectedBy=resourceHeadroom + alert=true", () => {
    const d = svc.decide({
      verdicts: verdicts({
        loadPressure: "FAIL",
        resourceHeadroom: "FAIL",
      }),
      currentWeight: 25,
      current: { v1: 2, v2: 1 },
      timeSinceLastChangeMs: 200_000,
      confidence: 0.9,
    });
    expect(d.verdict).toBe("rejected");
    expect(d.rejectedBy).toBe("resourceHeadroom");
    expect(d.alert).toBe(true);
    expect(d.action).toEqual({ kind: "noop" });
  });

  it("(c) load=FAIL & headroom OK & weight∈{5,25,50} → scale-up v2+1", () => {
    const d = svc.decide({
      verdicts: verdicts({ loadPressure: "FAIL" }),
      currentWeight: 25,
      current: { v1: 2, v2: 1 },
      timeSinceLastChangeMs: 200_000,
      confidence: 0.9,
    });
    expect(d.verdict).toBe("scale-up");
    expect(d.action).toMatchObject({
      kind: "scale",
      target: { v1: 2, v2: 2 },
    });
  });

  it("(d) weight=100 → scale-up v1+1", () => {
    const d = svc.decide({
      verdicts: verdicts({ loadPressure: "FAIL" }),
      currentWeight: 100,
      current: { v1: 2, v2: 1 },
      timeSinceLastChangeMs: 200_000,
      confidence: 0.9,
    });
    expect(d.verdict).toBe("scale-up");
    expect(d.action).toMatchObject({
      kind: "scale",
      target: { v1: 3, v2: 1 },
    });
  });

  it("(e) weight=0 → scale-up v1+1", () => {
    const d = svc.decide({
      verdicts: verdicts({ loadPressure: "FAIL" }),
      currentWeight: 0,
      current: { v1: 2, v2: 0 },
      timeSinceLastChangeMs: 200_000,
      confidence: 0.9,
    });
    expect(d.verdict).toBe("scale-up");
    expect(d.action).toMatchObject({
      kind: "scale",
      target: { v1: 3, v2: 0 },
    });
  });

  it("(f) load=PASS & cooldown 경과 + replicas>min → scale-down v1-1", () => {
    const d = svc.decide({
      verdicts: verdicts(),
      currentWeight: 100,
      current: { v1: 3, v2: 0 },
      timeSinceLastChangeMs: 200_000,
      confidence: 0.9,
    });
    expect(d.verdict).toBe("scale-down");
    expect(d.action).toMatchObject({
      kind: "scale",
      target: { v1: 2, v2: 0 },
    });
  });

  it("(g) cooldown 미경과 → hold", () => {
    const d = svc.decide({
      verdicts: verdicts(),
      currentWeight: 100,
      current: { v1: 3, v2: 0 },
      timeSinceLastChangeMs: 60_000,
      confidence: 0.9,
    });
    expect(d.verdict).toBe("hold");
  });

  it("(h) replicas at min → hold", () => {
    const d = svc.decide({
      verdicts: verdicts(),
      currentWeight: 100,
      current: { v1: 1, v2: 0 },
      timeSinceLastChangeMs: 200_000,
      confidence: 0.9,
    });
    expect(d.verdict).toBe("hold");
  });
});
