import { describe, expect, it } from "vitest";
import { matchGraphs } from "./graph-matcher.js";
import type { SpecGraph, SpecNode, RuntimeGraph, RuntimeNode, ScenarioStep } from "@qa-sdk/core";

function buildStep(overrides: Partial<ScenarioStep> = {}): ScenarioStep {
  return {
    id: "s1",
    event_key: "event.one",
    required: true,
    kind: "sequence",
    ...overrides,
  };
}

function buildSpecNode(id: string, step: Partial<ScenarioStep> = {}): SpecNode {
  return { id, step: buildStep({ id, ...step }) };
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

function buildSpecGraph(nodes: SpecNode[]): SpecGraph {
  return { scenario_id: "sc_test", version: "1.0.0", nodes, edges: [] };
}

function buildRuntimeGraph(nodes: RuntimeNode[]): RuntimeGraph {
  return { trace_id: "trace_1", nodes, edges: [] };
}

describe("matchGraphs", () => {
  it("matches spec steps to runtime nodes by event_key — pass", () => {
    const spec = buildSpecGraph([
      buildSpecNode("s1", { event_key: "checkout.start" }),
      buildSpecNode("s2", { event_key: "checkout.end" }),
    ]);
    const runtime = buildRuntimeGraph([
      buildRuntimeNode({ id: "n1", event_key: "checkout.start" }),
      buildRuntimeNode({ id: "n2", event_key: "checkout.end" }),
    ]);

    const result = matchGraphs(spec, runtime);

    expect(result.scenario_id).toBe("sc_test");
    expect(result.trace_id).toBe("trace_1");
    expect(result.step_matches).toHaveLength(2);
    expect(result.step_matches[0]).toEqual({
      step_id: "s1",
      matched_node_id: "n1",
      verdict: "pass",
      reason: undefined,
    });
    expect(result.step_matches[1]).toEqual({
      step_id: "s2",
      matched_node_id: "n2",
      verdict: "pass",
      reason: undefined,
    });
    expect(result.missing_steps).toEqual([]);
    expect(result.unmatched_nodes).toEqual([]);
  });

  it("reports missing required step as fail", () => {
    const spec = buildSpecGraph([
      buildSpecNode("s1", { event_key: "checkout.start", required: true }),
    ]);
    const runtime = buildRuntimeGraph([
      buildRuntimeNode({ id: "n1", event_key: "other.event" }),
    ]);

    const result = matchGraphs(spec, runtime);

    expect(result.missing_steps).toEqual(["s1"]);
    expect(result.step_matches[0].verdict).toBe("fail");
    expect(result.step_matches[0].reason).toContain("required step not found");
    expect(result.unmatched_nodes).toEqual(["n1"]);
  });

  it("reports missing optional step as warn", () => {
    const spec = buildSpecGraph([
      buildSpecNode("s1", { event_key: "checkout.analytics", required: false }),
    ]);
    const runtime = buildRuntimeGraph([]);

    const result = matchGraphs(spec, runtime);

    expect(result.missing_steps).toEqual(["s1"]);
    expect(result.step_matches[0].verdict).toBe("warn");
    expect(result.step_matches[0].reason).toContain("optional step not found");
  });

  it("returns fail when constraint evaluation fails", () => {
    const spec = buildSpecGraph([
      buildSpecNode("s1", {
        event_key: "checkout.save",
        constraints: [{ field: "payload.status", op: "eq", value: "completed" }],
      }),
    ]);
    const runtime = buildRuntimeGraph([
      buildRuntimeNode({ id: "n1", event_key: "checkout.save", payload: { status: "pending" } }),
    ]);

    const result = matchGraphs(spec, runtime);

    expect(result.step_matches[0].verdict).toBe("fail");
    expect(result.step_matches[0].reason).toBe("constraint evaluation failed");
    expect(result.step_matches[0].matched_node_id).toBe("n1");
  });

  it("passes when constraint evaluation succeeds", () => {
    const spec = buildSpecGraph([
      buildSpecNode("s1", {
        event_key: "checkout.save",
        constraints: [{ field: "payload.status", op: "eq", value: "completed" }],
      }),
    ]);
    const runtime = buildRuntimeGraph([
      buildRuntimeNode({ id: "n1", event_key: "checkout.save", payload: { status: "completed" } }),
    ]);

    const result = matchGraphs(spec, runtime);

    expect(result.step_matches[0].verdict).toBe("pass");
    expect(result.step_matches[0].matched_node_id).toBe("n1");
  });

  it("filters candidates by event_version when specified", () => {
    const spec = buildSpecGraph([
      buildSpecNode("s1", { event_key: "checkout.save", event_version: "002" }),
    ]);
    const runtime = buildRuntimeGraph([
      buildRuntimeNode({ id: "n1", event_key: "checkout.save", event_version: "001" }),
      buildRuntimeNode({ id: "n2", event_key: "checkout.save", event_version: "002" }),
    ]);

    const result = matchGraphs(spec, runtime);

    expect(result.step_matches[0].matched_node_id).toBe("n2");
    expect(result.step_matches[0].verdict).toBe("pass");
    expect(result.unmatched_nodes).toEqual(["n1"]);
  });

  it("filters candidates by source when specified", () => {
    const spec = buildSpecGraph([
      buildSpecNode("s1", { event_key: "order.placed", source: "order-svc" }),
    ]);
    const runtime = buildRuntimeGraph([
      buildRuntimeNode({ id: "n1", event_key: "order.placed", service_name: "payment-svc" }),
      buildRuntimeNode({ id: "n2", event_key: "order.placed", service_name: "order-svc" }),
    ]);

    const result = matchGraphs(spec, runtime);

    expect(result.step_matches[0].matched_node_id).toBe("n2");
  });

  it("filters candidates by record_kind when specified", () => {
    const spec = buildSpecGraph([
      buildSpecNode("s1", { event_key: "checkout.save", record_kind: "span" }),
    ]);
    const runtime = buildRuntimeGraph([
      buildRuntimeNode({ id: "n1", event_key: "checkout.save", record_kind: "log" }),
      buildRuntimeNode({ id: "n2", event_key: "checkout.save", record_kind: "span" }),
    ]);

    const result = matchGraphs(spec, runtime);

    expect(result.step_matches[0].matched_node_id).toBe("n2");
  });

  it("does not reuse already-matched runtime nodes", () => {
    const spec = buildSpecGraph([
      buildSpecNode("s1", { event_key: "checkout.save" }),
      buildSpecNode("s2", { event_key: "checkout.save" }),
    ]);
    const runtime = buildRuntimeGraph([
      buildRuntimeNode({ id: "n1", event_key: "checkout.save" }),
    ]);

    const result = matchGraphs(spec, runtime);

    // s1 matches n1, s2 has no candidate left
    expect(result.step_matches[0].matched_node_id).toBe("n1");
    expect(result.step_matches[0].verdict).toBe("pass");
    expect(result.missing_steps).toEqual(["s2"]);
  });

  it("reports unmatched runtime nodes", () => {
    const spec = buildSpecGraph([
      buildSpecNode("s1", { event_key: "checkout.start" }),
    ]);
    const runtime = buildRuntimeGraph([
      buildRuntimeNode({ id: "n1", event_key: "checkout.start" }),
      buildRuntimeNode({ id: "n2", event_key: "checkout.analytics" }),
      buildRuntimeNode({ id: "n3", event_key: "checkout.metrics" }),
    ]);

    const result = matchGraphs(spec, runtime);

    expect(result.unmatched_nodes).toEqual(["n2", "n3"]);
  });

  it("skips constraint check when step has no constraints", () => {
    const spec = buildSpecGraph([
      buildSpecNode("s1", { event_key: "event.one" }),
    ]);
    const runtime = buildRuntimeGraph([
      buildRuntimeNode({ id: "n1", event_key: "event.one" }),
    ]);

    const result = matchGraphs(spec, runtime);

    expect(result.step_matches[0].verdict).toBe("pass");
  });

  it("tries multiple candidates until constraint passes", () => {
    const spec = buildSpecGraph([
      buildSpecNode("s1", {
        event_key: "checkout.save",
        constraints: [{ field: "payload.amount", op: "gt", value: 100 }],
      }),
    ]);
    const runtime = buildRuntimeGraph([
      buildRuntimeNode({ id: "n1", event_key: "checkout.save", payload: { amount: 50 } }),
      buildRuntimeNode({ id: "n2", event_key: "checkout.save", payload: { amount: 200 } }),
    ]);

    const result = matchGraphs(spec, runtime);

    expect(result.step_matches[0].matched_node_id).toBe("n2");
    expect(result.step_matches[0].verdict).toBe("pass");
  });
});
