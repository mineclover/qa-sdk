import type { VerdictStore, VerdictInsert } from "@qa-sdk/core";
import type { VerdictReport } from "@qa-sdk/core";
import { expect, it, beforeEach, afterEach } from "vitest";

function makeReport(overrides: Partial<VerdictReport> = {}): VerdictReport {
  return {
    scenario_id: "sc-1",
    trace_id: "t1",
    overall_verdict: "pass",
    step_matches: [],
    missing_steps: [],
    unexpected_nodes: [],
    latency_violations: [],
    ordering_violations: [],
    summary: "테스트 verdict",
    computed_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

export function makeVerdictInsert(overrides: Partial<VerdictInsert> = {}): VerdictInsert {
  return {
    id: "v1",
    scenarioId: "sc-1",
    traceId: "t1",
    overallVerdict: "pass",
    report: makeReport(),
    ...overrides,
  };
}

export function verdictStoreTests(
  factory: () => Promise<{ store: VerdictStore; cleanup: () => Promise<void> }>,
) {
  let store: VerdictStore;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    ({ store, cleanup } = await factory());
  });
  afterEach(async () => cleanup());

  it("insert + findByTraceId", async () => {
    await store.insert(makeVerdictInsert());
    const results = await store.findByTraceId("t1");
    expect(results).toHaveLength(1);
    expect(results[0].overallVerdict).toBe("pass");
  });

  it("여러 verdict 동일 trace", async () => {
    await store.insert(makeVerdictInsert({ id: "v1", scenarioId: "sc-1", traceId: "t1" }));
    await store.insert(makeVerdictInsert({ id: "v2", scenarioId: "sc-2", traceId: "t1" }));
    const results = await store.findByTraceId("t1");
    expect(results).toHaveLength(2);
  });

  it("findByTraceId 미존재 → empty array", async () => {
    const results = await store.findByTraceId("nonexistent");
    expect(results).toEqual([]);
  });
}
