import { describe, expect, it } from "vitest";
import { computeVerdict } from "./compute.js";
import type { MatchResult, SpecGraph, SpecNode, RuntimeGraph, RuntimeNode } from "@qa-sdk/core";

function buildSpecNode(
  stepId: string,
  overrides: Partial<Omit<SpecNode, "step_id">> = {},
): SpecNode {
  return {
    step_id: stepId,
    event_key: "event.one",
    required: true,
    kind: "sequence",
    ...overrides,
  };
}

function buildRuntimeNode(overrides: Partial<RuntimeNode> = {}): RuntimeNode {
  return {
    id: "node_1",
    log_id: "log_1",
    timestamp: "2026-03-12T10:00:00.000Z",
    record_kind: "log",
    event_key: "event.one",
    event_version: "001",
    payload: {},
    payload_masking_applied: false,
    payload_masked_fields: [],
    ...overrides,
  };
}

function buildStepMatch(
  overrides: Partial<MatchResult["step_matches"][number]> = {},
): MatchResult["step_matches"][number] {
  return {
    step_id: "s1",
    verdict: "pass",
    constraint_results: [],
    ...overrides,
  };
}

describe("computeVerdict", () => {
  it("returns pass when all required steps pass", () => {
    const specGraph: SpecGraph = {
      scenario_id: "sc_1",
      version: "1.0.0",
      nodes: [
        buildSpecNode("s1", { required: true }),
        buildSpecNode("s2", { required: true }),
      ],
      edges: [],
    };
    const runtimeGraph: RuntimeGraph = {
      trace_id: "trace_1",
      nodes: [
        buildRuntimeNode({ id: "n1" }),
        buildRuntimeNode({ id: "n2" }),
      ],
      edges: [],
    };
    const matchResult: MatchResult = {
      scenario_id: "sc_1",
      trace_id: "trace_1",
      step_matches: [
        buildStepMatch({ step_id: "s1", matched_node_id: "n1" }),
        buildStepMatch({ step_id: "s2", matched_node_id: "n2" }),
      ],
      missing_steps: [],
      unmatched_nodes: [],
    };

    const report = computeVerdict(matchResult, specGraph, runtimeGraph, "qas_1");

    expect(report.overall_verdict).toBe("pass");
    expect(report.step_matches).toEqual(matchResult.step_matches);
    expect(report.missing_steps).toEqual([]);
    expect(report.qa_session_id).toBe("qas_1");
    expect(report.summary).toContain("verdict=pass");
    expect(new Date(report.computed_at).toISOString()).toBe(report.computed_at);
  });

  it("returns fail when a required step fails", () => {
    const specGraph: SpecGraph = {
      scenario_id: "sc_1",
      version: "1.0.0",
      nodes: [
        buildSpecNode("s1", { required: true }),
        buildSpecNode("s2", { required: true }),
      ],
      edges: [],
    };
    const runtimeGraph: RuntimeGraph = { trace_id: "trace_1", nodes: [], edges: [] };
    const matchResult: MatchResult = {
      scenario_id: "sc_1",
      trace_id: "trace_1",
      step_matches: [
        buildStepMatch({ step_id: "s1", matched_node_id: "n1" }),
        buildStepMatch({
          step_id: "s2",
          matched_node_id: "n2",
          verdict: "fail",
          constraint_results: [
            {
              constraint: { field: "payload.status", op: "eq", value: "completed" },
              passed: false,
              actual: "pending",
            },
          ],
        }),
      ],
      missing_steps: [],
      unmatched_nodes: [],
    };

    const report = computeVerdict(matchResult, specGraph, runtimeGraph);

    expect(report.overall_verdict).toBe("fail");
    expect(report.step_matches.filter((stepMatch) => stepMatch.verdict === "fail")).toEqual([
      matchResult.step_matches[1],
    ]);
    expect(report.summary).toContain("verdict=fail");
  });

  it("returns fail when a required step is missing", () => {
    const specGraph: SpecGraph = {
      scenario_id: "sc_1",
      version: "1.0.0",
      nodes: [buildSpecNode("s1", { required: true })],
      edges: [],
    };
    const runtimeGraph: RuntimeGraph = { trace_id: "trace_1", nodes: [], edges: [] };
    const matchResult: MatchResult = {
      scenario_id: "sc_1",
      trace_id: "trace_1",
      step_matches: [
        buildStepMatch({ step_id: "s1", verdict: "fail" }),
      ],
      missing_steps: ["s1"],
      unmatched_nodes: [],
    };

    const report = computeVerdict(matchResult, specGraph, runtimeGraph);

    expect(report.overall_verdict).toBe("fail");
    expect(report.missing_steps).toEqual(["s1"]);
  });

  it("returns warn when only optional steps are missing", () => {
    const specGraph: SpecGraph = {
      scenario_id: "sc_1",
      version: "1.0.0",
      nodes: [
        buildSpecNode("s1", { required: true }),
        buildSpecNode("s2", { required: false }),
      ],
      edges: [],
    };
    const runtimeGraph: RuntimeGraph = {
      trace_id: "trace_1",
      nodes: [buildRuntimeNode({ id: "n1" })],
      edges: [],
    };
    const matchResult: MatchResult = {
      scenario_id: "sc_1",
      trace_id: "trace_1",
      step_matches: [
        buildStepMatch({ step_id: "s1", matched_node_id: "n1" }),
        buildStepMatch({ step_id: "s2", verdict: "warn" }),
      ],
      missing_steps: ["s2"],
      unmatched_nodes: [],
    };

    const report = computeVerdict(matchResult, specGraph, runtimeGraph);

    expect(report.overall_verdict).toBe("warn");
    expect(report.step_matches.filter((stepMatch) => stepMatch.verdict === "warn")).toEqual([
      matchResult.step_matches[1],
    ]);
  });

  it("returns degraded when latency exceeds timeout_ms", () => {
    const specGraph: SpecGraph = {
      scenario_id: "sc_1",
      version: "1.0.0",
      nodes: [
        buildSpecNode("s1", { required: true, timeout_ms: 500 }),
      ],
      edges: [],
    };
    const runtimeGraph: RuntimeGraph = {
      trace_id: "trace_1",
      nodes: [
        buildRuntimeNode({
          id: "n1",
          start_time: "2026-03-12T10:00:00.000Z",
          end_time: "2026-03-12T10:00:01.000Z", // 1000ms > 500ms
        }),
      ],
      edges: [],
    };
    const matchResult: MatchResult = {
      scenario_id: "sc_1",
      trace_id: "trace_1",
      step_matches: [
        buildStepMatch({ step_id: "s1", matched_node_id: "n1" }),
      ],
      missing_steps: [],
      unmatched_nodes: [],
    };

    const report = computeVerdict(matchResult, specGraph, runtimeGraph);

    expect(report.overall_verdict).toBe("degraded");
    expect(report.latency_violations).toEqual([
      { step_id: "s1", expected_ms: 500, actual_ms: 1000 },
    ]);
  });

  it("returns pass when latency is within timeout", () => {
    const specGraph: SpecGraph = {
      scenario_id: "sc_1",
      version: "1.0.0",
      nodes: [
        buildSpecNode("s1", { required: true, timeout_ms: 2000 }),
      ],
      edges: [],
    };
    const runtimeGraph: RuntimeGraph = {
      trace_id: "trace_1",
      nodes: [
        buildRuntimeNode({
          id: "n1",
          start_time: "2026-03-12T10:00:00.000Z",
          end_time: "2026-03-12T10:00:01.000Z", // 1000ms < 2000ms
        }),
      ],
      edges: [],
    };
    const matchResult: MatchResult = {
      scenario_id: "sc_1",
      trace_id: "trace_1",
      step_matches: [
        buildStepMatch({ step_id: "s1", matched_node_id: "n1" }),
      ],
      missing_steps: [],
      unmatched_nodes: [],
    };

    const report = computeVerdict(matchResult, specGraph, runtimeGraph);

    expect(report.overall_verdict).toBe("pass");
    expect(report.latency_violations).toEqual([]);
  });

  it("returns unknown when no steps match", () => {
    const specGraph: SpecGraph = {
      scenario_id: "sc_1",
      version: "1.0.0",
      nodes: [],
      edges: [],
    };
    const runtimeGraph: RuntimeGraph = { trace_id: "trace_1", nodes: [], edges: [] };
    const matchResult: MatchResult = {
      scenario_id: "sc_1",
      trace_id: "trace_1",
      step_matches: [],
      missing_steps: [],
      unmatched_nodes: [],
    };

    const report = computeVerdict(matchResult, specGraph, runtimeGraph);

    expect(report.overall_verdict).toBe("unknown");
  });

  it("fail takes priority over degraded", () => {
    const specGraph: SpecGraph = {
      scenario_id: "sc_1",
      version: "1.0.0",
      nodes: [
        buildSpecNode("s1", { required: true, timeout_ms: 100 }),
        buildSpecNode("s2", { required: true }),
      ],
      edges: [],
    };
    const runtimeGraph: RuntimeGraph = {
      trace_id: "trace_1",
      nodes: [
        buildRuntimeNode({
          id: "n1",
          start_time: "2026-03-12T10:00:00.000Z",
          end_time: "2026-03-12T10:00:01.000Z", // latency violation
        }),
      ],
      edges: [],
    };
    const matchResult: MatchResult = {
      scenario_id: "sc_1",
      trace_id: "trace_1",
      step_matches: [
        buildStepMatch({ step_id: "s1", matched_node_id: "n1" }),
        buildStepMatch({ step_id: "s2", verdict: "fail" }),
      ],
      missing_steps: ["s2"],
      unmatched_nodes: [],
    };

    const report = computeVerdict(matchResult, specGraph, runtimeGraph);

    // fail wins over degraded
    expect(report.overall_verdict).toBe("fail");
  });

  it("reports unexpected_nodes from unmatched runtime nodes", () => {
    const specGraph: SpecGraph = {
      scenario_id: "sc_1",
      version: "1.0.0",
      nodes: [buildSpecNode("s1")],
      edges: [],
    };
    const runtimeGraph: RuntimeGraph = { trace_id: "trace_1", nodes: [], edges: [] };
    const matchResult: MatchResult = {
      scenario_id: "sc_1",
      trace_id: "trace_1",
      step_matches: [
        buildStepMatch({ step_id: "s1", matched_node_id: "n1" }),
      ],
      missing_steps: [],
      unmatched_nodes: ["n2", "n3"],
    };

    const report = computeVerdict(matchResult, specGraph, runtimeGraph);

    expect(report.unexpected_nodes).toEqual(["n2", "n3"]);
  });

  it("skips latency check when node has no start_time or end_time", () => {
    const specGraph: SpecGraph = {
      scenario_id: "sc_1",
      version: "1.0.0",
      nodes: [buildSpecNode("s1", { required: true, timeout_ms: 100 })],
      edges: [],
    };
    const runtimeGraph: RuntimeGraph = {
      trace_id: "trace_1",
      nodes: [
        buildRuntimeNode({ id: "n1" }), // no start_time/end_time
      ],
      edges: [],
    };
    const matchResult: MatchResult = {
      scenario_id: "sc_1",
      trace_id: "trace_1",
      step_matches: [
        buildStepMatch({ step_id: "s1", matched_node_id: "n1" }),
      ],
      missing_steps: [],
      unmatched_nodes: [],
    };

    const report = computeVerdict(matchResult, specGraph, runtimeGraph);

    expect(report.overall_verdict).toBe("pass");
    expect(report.latency_violations).toEqual([]);
  });

  it("builds summary string correctly", () => {
    const specGraph: SpecGraph = {
      scenario_id: "sc_1",
      version: "1.0.0",
      nodes: [
        buildSpecNode("s1", { required: true }),
        buildSpecNode("s2", { required: true }),
        buildSpecNode("s3", { required: false }),
      ],
      edges: [],
    };
    const runtimeGraph: RuntimeGraph = { trace_id: "trace_1", nodes: [], edges: [] };
    const matchResult: MatchResult = {
      scenario_id: "sc_1",
      trace_id: "trace_1",
      step_matches: [
        buildStepMatch({ step_id: "s1", matched_node_id: "n1" }),
        buildStepMatch({ step_id: "s2", verdict: "fail" }),
        buildStepMatch({ step_id: "s3", verdict: "warn" }),
      ],
      missing_steps: ["s2", "s3"],
      unmatched_nodes: [],
    };

    const report = computeVerdict(matchResult, specGraph, runtimeGraph);

    expect(report.summary).toBe("verdict=fail, passed=1, failed=1, warned=1, missing=2");
  });
});
