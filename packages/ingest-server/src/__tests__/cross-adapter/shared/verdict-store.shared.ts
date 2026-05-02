// @def.boundary ingest-system
// @def.doc ingest-system

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

  it("동일 scenario+trace 중복 insert → 업데이트 또는 에러", async () => {
    await store.insert(makeVerdictInsert({ id: "v1", scenarioId: "sc-1", traceId: "t1", overallVerdict: "pass" }));
    // 두 번째 insert: same scenarioId+traceId → ON CONFLICT 동작 (D1: 업데이트, PG: 에러)
    try {
      await store.insert(makeVerdictInsert({ id: "v2", scenarioId: "sc-1", traceId: "t1", overallVerdict: "fail" }));
      // ON CONFLICT DO UPDATE 경우 — 업데이트 되어야 함
      const verdicts = await store.findByTraceId("t1");
      expect(verdicts).toHaveLength(1);
      expect(verdicts[0].overallVerdict).toBe("fail");
    } catch {
      // UNIQUE constraint 에러 — PG 등에서 정상 동작
      const verdicts = await store.findByTraceId("t1");
      expect(verdicts).toHaveLength(1);
      expect(verdicts[0].overallVerdict).toBe("pass");
    }
  });
}
