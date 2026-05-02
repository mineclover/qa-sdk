// @def.boundary sim-canary-controller
// @def.doc canary-controller-config
// spec 01 §2 매트릭스 1:1 + hard rule + worst-signal aggregation 검증.

import { describe, it, expect, beforeEach } from "vitest";
import {
  CategoryVerdictService,
  type VerdictConfig,
} from "./category-verdict.service.js";
import type {
  ScrapeResult,
  SignalSample,
} from "../metrics/metrics-scrape.service.js";

const cfg: VerdictConfig = {
  perf: {
    errorRate: { warn: 1.2, fail: 1.5, baselineMultiplier: true },
    p95LatencyDelta: { warn: 0.2, fail: 0.5 },
  },
  decisionQuality: {
    denyRateDelta: { warn: 0.05, fail: 0.15 },
    avgConfidenceDelta: { warn: -0.05, fail: -0.15 },
  },
  replicationHealth: {
    replicationLagMs: { warn: 500, fail: 2000 },
  },
  baselines: {
    errorRate: 0.01,
    RPS: 100,
    CPU: 80,
    dbPoolUtilization: 0.8,
    cooldownUpMs: 60_000,
  },
};

function sample(overrides: Record<string, number>): ScrapeResult {
  const signals: Record<string, SignalSample> = {};
  for (const [id, value] of Object.entries(overrides)) {
    signals[id] = { value, sourceName: "test" };
  }
  return { scrapedAt: new Date().toISOString(), signals, sources: [] };
}

describe("CategoryVerdictService (spec 01 §2)", () => {
  let svc: CategoryVerdictService;
  beforeEach(() => {
    svc = new CategoryVerdictService(cfg);
  });

  it("compatibility < 1.0 → FAIL hard + hardFail에 'compatibility' 포함", () => {
    const r = svc.evaluate(sample({ "compatibility.schemaCompatRate": 0.9 }));
    expect(r.compatibility).toBe("FAIL");
    expect(r.hardFail).toContain("compatibility");
    expect(r.triggerSignals).toContain("compatibility.schemaCompatRate");
  });

  it("auditSafety > 0 → FAIL hard (perf WARN과 동시여도 hardFail 우선)", () => {
    const r = svc.evaluate(
      sample({
        "auditSafety.criticalAnomalyRate": 1,
        "perf.p95LatencyDelta": 0.3,
      }),
    );
    expect(r.auditSafety).toBe("FAIL");
    expect(r.hardFail).toContain("auditSafety");
    expect(r.perf).toBe("WARN");
  });

  it("perf.errorRate 3 구간 (baseline×1.2 / 1.5 / >1.5)", () => {
    // PASS: baseline×1.2 이하
    const r1 = svc.evaluate(sample({ "perf.errorRate": 0.011 }));
    expect(r1.perf).toBe("PASS");
    // WARN: baseline×1.2 ~ ×1.5 사이
    const r2 = svc.evaluate(sample({ "perf.errorRate": 0.013 }));
    expect(r2.perf).toBe("WARN");
    // FAIL: baseline×1.5 초과
    const r3 = svc.evaluate(sample({ "perf.errorRate": 0.02 }));
    expect(r3.perf).toBe("FAIL");
  });

  it("perf.p95LatencyDelta 3 구간 (0.2 / 0.5)", () => {
    expect(svc.evaluate(sample({ "perf.p95LatencyDelta": 0.1 })).perf).toBe(
      "PASS",
    );
    expect(svc.evaluate(sample({ "perf.p95LatencyDelta": 0.3 })).perf).toBe(
      "WARN",
    );
    expect(svc.evaluate(sample({ "perf.p95LatencyDelta": 0.6 })).perf).toBe(
      "FAIL",
    );
  });

  it("replicationLag 3 구간 (500 / 2000)", () => {
    expect(
      svc.evaluate(sample({ "replicationHealth.replicationLagMs": 100 }))
        .replicationHealth,
    ).toBe("PASS");
    expect(
      svc.evaluate(sample({ "replicationHealth.replicationLagMs": 1000 }))
        .replicationHealth,
    ).toBe("WARN");
    expect(
      svc.evaluate(sample({ "replicationHealth.replicationLagMs": 3000 }))
        .replicationHealth,
    ).toBe("FAIL");
  });

  it("카테고리 = worst signal (perf.p95 FAIL → category FAIL)", () => {
    const r = svc.evaluate(
      sample({
        "perf.errorRate": 0.001,
        "perf.p95LatencyDelta": 0.6,
      }),
    );
    expect(r.perf).toBe("FAIL");
  });

  it("loadPressure.RPS 임계 (100 / 80)", () => {
    expect(
      svc.evaluate(sample({ "loadPressure.RPS": 50 })).loadPressure,
    ).toBe("PASS");
    expect(
      svc.evaluate(sample({ "loadPressure.RPS": 85 })).loadPressure,
    ).toBe("WARN");
    expect(
      svc.evaluate(sample({ "loadPressure.RPS": 110 })).loadPressure,
    ).toBe("FAIL");
  });

  it("resourceHeadroom.CPU 임계 (60 / 80)", () => {
    expect(
      svc.evaluate(sample({ "resourceHeadroom.CPU": 40 })).resourceHeadroom,
    ).toBe("PASS");
    expect(
      svc.evaluate(sample({ "resourceHeadroom.CPU": 70 })).resourceHeadroom,
    ).toBe("WARN");
    expect(
      svc.evaluate(sample({ "resourceHeadroom.CPU": 90 })).resourceHeadroom,
    ).toBe("FAIL");
  });

  it("stability — timeSinceLastReplicaChange < cooldownUpMs → WARN", () => {
    const r = svc.evaluate(
      sample({ "stability.timeSinceLastReplicaChange": 30_000 }),
    );
    expect(r.stability).toBe("WARN");
  });

  it("모든 signal 결측 → 모두 PASS", () => {
    const r = svc.evaluate(sample({}));
    expect(r.perf).toBe("PASS");
    expect(r.compatibility).toBe("PASS");
    expect(r.auditSafety).toBe("PASS");
    expect(r.hardFail).toEqual([]);
    expect(r.triggerSignals).toEqual([]);
  });
});
