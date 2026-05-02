// @def.boundary sim-canary-controller
// @def.doc canary-controller-config
// spec 01 §6 — grammar #7/#8 식별자 + (cycleId, pass) 복합 키 멱등 write.

import { describe, it, expect, vi, afterEach } from "vitest";
import { DecisionBuilderService } from "./decision-builder.service.js";
import type { CategoryVerdicts } from "../verdict/category-verdict.service.js";
import type { SafetyDecisionOutput } from "./safety-decision.service.js";
import type {
  SourceStatus,
  SignalSample,
} from "../metrics/metrics-scrape.service.js";

const cfg = { controllerId: "CTRL0001", auditUrl: "http://audit" };

function ok(): CategoryVerdicts {
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
  };
}

const sources: SourceStatus[] = [
  { name: "metrics", ok: true, weight: 1 },
  { name: "ingest", ok: true, weight: 1 },
  { name: "audit", ok: true, weight: 1 },
];

const signals: Record<string, SignalSample> = {
  "perf.errorRate": { value: 0.001, sourceName: "metrics" },
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("DecisionBuilderService (spec 01 §6 + grammar #7/#8/#14/#15)", () => {
  it("buildSafety는 grammar #7/#8로 id 합성 (decisionId === safety-decision-${cycleId})", () => {
    const svc = new DecisionBuilderService(cfg);
    const cycleAt = Date.now();
    const decision: SafetyDecisionOutput = {
      verdict: "promote",
      triggerSignals: [],
      action: { kind: "weight-update", weight: 25, revision: 1 },
    };
    const record = svc.buildSafety({
      cycleAt,
      verdicts: ok(),
      decision,
      sources,
      signals,
      confidence: 1.0,
    });
    expect(record.cycleId).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/); // ULID
    expect(record.decisionId).toBe(`safety-decision-${record.cycleId}`);
    expect(record.pass).toBe("safety");
  });

  it("evidence는 sources(3건) + signals(1건) 양쪽으로 채워짐", () => {
    const svc = new DecisionBuilderService(cfg);
    const decision: SafetyDecisionOutput = {
      verdict: "hold",
      triggerSignals: [],
      action: { kind: "noop" },
    };
    const record = svc.buildSafety({
      cycleAt: Date.now(),
      verdicts: ok(),
      decision,
      sources,
      signals,
      confidence: 1.0,
    });
    expect(record.evidence.length).toBe(4); // 3 sources + 1 signal
    expect(
      record.evidence.some((e) => e.source.startsWith("metrics:")),
    ).toBe(true);
    expect(
      record.evidence.some((e) => e.source.startsWith("signal:")),
    ).toBe(true);
  });

  it("write — 409 응답은 silent (throw 하지 않음)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 409 })),
    );
    const svc = new DecisionBuilderService(cfg);
    const decision: SafetyDecisionOutput = {
      verdict: "hold",
      triggerSignals: [],
      action: { kind: "noop" },
    };
    const record = svc.buildSafety({
      cycleAt: Date.now(),
      verdicts: ok(),
      decision,
      sources,
      signals,
      confidence: 1.0,
    });
    await expect(svc.write(record)).resolves.toBeUndefined();
  });

  it("write — 500 응답은 throw", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 500 })),
    );
    const svc = new DecisionBuilderService(cfg);
    const decision: SafetyDecisionOutput = {
      verdict: "hold",
      triggerSignals: [],
      action: { kind: "noop" },
    };
    const record = svc.buildSafety({
      cycleAt: Date.now(),
      verdicts: ok(),
      decision,
      sources,
      signals,
      confidence: 1.0,
    });
    await expect(svc.write(record)).rejects.toThrow(/500/);
  });

  it("idempotency-key 헤더가 ${cycleId}:${pass} 형식", async () => {
    const fetchSpy = vi.fn(async () => new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchSpy);
    const svc = new DecisionBuilderService(cfg);
    const decision: SafetyDecisionOutput = {
      verdict: "hold",
      triggerSignals: [],
      action: { kind: "noop" },
    };
    const record = svc.buildSafety({
      cycleAt: Date.now(),
      verdicts: ok(),
      decision,
      sources,
      signals,
      confidence: 1.0,
    });
    await svc.write(record);
    const callOpts = fetchSpy.mock.calls[0]?.[1] as { headers?: Record<string, string> };
    expect(callOpts?.headers?.["idempotency-key"]).toBe(
      `${record.cycleId}:safety`,
    );
  });
});
