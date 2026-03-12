import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { VerdictInsert, VerdictReport } from "@qa-sdk/core";
import { InMemoryVerdictStore } from "./verdict.adapter.js";

function buildReport(overrides: Partial<VerdictReport> = {}): VerdictReport {
  return {
    scenario_id: "scenario_signup",
    trace_id: "trace_1",
    qa_session_id: "session_1",
    overall_verdict: "pass",
    step_matches: [
      {
        step_id: "step_1",
        matched_node_id: "node_1",
        verdict: "pass",
        constraint_results: [],
      },
    ],
    missing_steps: [],
    unexpected_nodes: [],
    latency_violations: [],
    summary: "Scenario matched successfully.",
    computed_at: "2026-03-12T01:00:00.000Z",
    ...overrides,
  };
}

function buildVerdict(overrides: Partial<VerdictInsert> = {}): VerdictInsert {
  return {
    id: "verdict_1",
    scenarioId: "scenario_signup",
    traceId: "trace_1",
    qaSessionId: "session_1",
    overallVerdict: "pass",
    report: buildReport(),
    ...overrides,
  };
}

describe("InMemoryVerdictStore", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-12T01:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("inserts verdicts and queries by scenario/trace and session id", async () => {
    const store = new InMemoryVerdictStore();
    const storedAt = new Date("2026-03-12T01:00:00.000Z");
    const verdict = buildVerdict();
    const otherVerdict = buildVerdict({
      id: "verdict_2",
      scenarioId: "scenario_checkout",
      traceId: "trace_2",
      qaSessionId: "session_1",
      report: buildReport({
        scenario_id: "scenario_checkout",
        trace_id: "trace_2",
      }),
    });

    await store.insert(verdict);
    await store.insert(otherVerdict);

    await expect(
      store.findByScenarioAndTrace("scenario_signup", "trace_1"),
    ).resolves.toEqual({
      ...verdict,
      computedAt: storedAt,
    });

    await expect(store.findBySessionId("session_1")).resolves.toEqual([
      {
        ...verdict,
        computedAt: storedAt,
      },
      {
        ...otherVerdict,
        computedAt: storedAt,
      },
    ]);
  });

  it("rejects duplicate scenario and trace pairs", async () => {
    const store = new InMemoryVerdictStore();

    await store.insert(buildVerdict());

    await expect(
      store.insert(
        buildVerdict({
          id: "verdict_2",
        }),
      ),
    ).rejects.toThrow("Verdict already exists");
  });
});
