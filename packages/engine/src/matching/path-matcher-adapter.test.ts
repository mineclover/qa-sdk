// @def.doc path-matcher-migration
import { describe, expect, it } from "vitest";
import { matchViaPathMatcher } from "./path-matcher-adapter.js";
import type { SpecGraph, SpecNode, RuntimeGraph, RuntimeNode } from "@qa-sdk/core";

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

function buildSpecGraph(nodes: SpecNode[]): SpecGraph {
  return { scenario_id: "sc_test", version: "1.0.0", nodes, edges: [] };
}

function buildRuntimeGraph(nodes: RuntimeNode[]): RuntimeGraph {
  return { trace_id: "trace_1", nodes, edges: [] };
}

describe("matchViaPathMatcher", () => {
  it("matches spec steps to runtime nodes by event_key — pass", () => {
    const spec = buildSpecGraph([
      buildSpecNode("s1", { event_key: "checkout.start" }),
      buildSpecNode("s2", { event_key: "checkout.end" }),
    ]);
    const runtime = buildRuntimeGraph([
      buildRuntimeNode({ id: "n1", event_key: "checkout.start" }),
      buildRuntimeNode({ id: "n2", event_key: "checkout.end" }),
    ]);

    const result = matchViaPathMatcher(spec, runtime);

    expect(result.scenario_id).toBe("sc_test");
    expect(result.trace_id).toBe("trace_1");
    expect(result.step_matches).toHaveLength(2);
    expect(result.step_matches[0]).toEqual({
      step_id: "s1",
      matched_node_id: "n1",
      verdict: "pass",
      constraint_results: [],
    });
    expect(result.step_matches[1]).toEqual({
      step_id: "s2",
      matched_node_id: "n2",
      verdict: "pass",
      constraint_results: [],
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

    const result = matchViaPathMatcher(spec, runtime);

    expect(result.missing_steps).toEqual(["s1"]);
    expect(result.step_matches[0].verdict).toBe("fail");
    expect(result.step_matches[0].constraint_results).toEqual([]);
    expect(result.unmatched_nodes).toEqual(["n1"]);
  });

  it("reports missing optional step as warn", () => {
    const spec = buildSpecGraph([
      buildSpecNode("s1", { event_key: "checkout.analytics", required: false }),
    ]);
    const runtime = buildRuntimeGraph([]);

    const result = matchViaPathMatcher(spec, runtime);

    expect(result.missing_steps).toEqual(["s1"]);
    expect(result.step_matches[0].verdict).toBe("warn");
    expect(result.step_matches[0].constraint_results).toEqual([]);
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

    const result = matchViaPathMatcher(spec, runtime);

    expect(result.step_matches[0].verdict).toBe("fail");
    expect(result.step_matches[0].matched_node_id).toBe("n1");
    expect(result.step_matches[0].constraint_results).toEqual([
      {
        constraint: { field: "payload.status", op: "eq", value: "completed" },
        passed: false,
        actual: "pending",
      },
    ]);
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

    const result = matchViaPathMatcher(spec, runtime);

    expect(result.step_matches[0].verdict).toBe("pass");
    expect(result.step_matches[0].matched_node_id).toBe("n1");
    expect(result.step_matches[0].constraint_results).toEqual([
      {
        constraint: { field: "payload.status", op: "eq", value: "completed" },
        passed: true,
        actual: "completed",
      },
    ]);
  });

  it("filters candidates by event_version when specified", () => {
    const spec = buildSpecGraph([
      buildSpecNode("s1", { event_key: "checkout.save", event_version: "002" }),
    ]);
    const runtime = buildRuntimeGraph([
      buildRuntimeNode({ id: "n1", event_key: "checkout.save", event_version: "001" }),
      buildRuntimeNode({ id: "n2", event_key: "checkout.save", event_version: "002" }),
    ]);

    const result = matchViaPathMatcher(spec, runtime);

    expect(result.step_matches[0].matched_node_id).toBe("n2");
    expect(result.step_matches[0].verdict).toBe("pass");
    expect(result.step_matches[0].constraint_results).toEqual([]);
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

    const result = matchViaPathMatcher(spec, runtime);

    expect(result.step_matches[0].matched_node_id).toBe("n2");
    expect(result.step_matches[0].constraint_results).toEqual([]);
  });

  it("filters candidates by record_kind when specified", () => {
    const spec = buildSpecGraph([
      buildSpecNode("s1", { event_key: "checkout.save", record_kind: "span" }),
    ]);
    const runtime = buildRuntimeGraph([
      buildRuntimeNode({ id: "n1", event_key: "checkout.save", record_kind: "log" }),
      buildRuntimeNode({ id: "n2", event_key: "checkout.save", record_kind: "span" }),
    ]);

    const result = matchViaPathMatcher(spec, runtime);

    expect(result.step_matches[0].matched_node_id).toBe("n2");
    expect(result.step_matches[0].constraint_results).toEqual([]);
  });

  it("does not reuse already-matched runtime nodes", () => {
    const spec = buildSpecGraph([
      buildSpecNode("s1", { event_key: "checkout.save" }),
      buildSpecNode("s2", { event_key: "checkout.save" }),
    ]);
    const runtime = buildRuntimeGraph([
      buildRuntimeNode({ id: "n1", event_key: "checkout.save" }),
    ]);

    const result = matchViaPathMatcher(spec, runtime);

    expect(result.step_matches[0].matched_node_id).toBe("n1");
    expect(result.step_matches[0].verdict).toBe("pass");
    expect(result.step_matches[0].constraint_results).toEqual([]);
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

    const result = matchViaPathMatcher(spec, runtime);

    expect(result.unmatched_nodes).toEqual(["n2", "n3"]);
  });

  it("skips constraint check when step has no constraints", () => {
    const spec = buildSpecGraph([
      buildSpecNode("s1", { event_key: "event.one" }),
    ]);
    const runtime = buildRuntimeGraph([
      buildRuntimeNode({ id: "n1", event_key: "event.one" }),
    ]);

    const result = matchViaPathMatcher(spec, runtime);

    expect(result.step_matches[0].verdict).toBe("pass");
    expect(result.step_matches[0].constraint_results).toEqual([]);
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

    const result = matchViaPathMatcher(spec, runtime);

    expect(result.step_matches[0].matched_node_id).toBe("n2");
    expect(result.step_matches[0].verdict).toBe("pass");
    expect(result.step_matches[0].constraint_results).toEqual([
      {
        constraint: { field: "payload.amount", op: "gt", value: 100 },
        passed: true,
        actual: 200,
      },
    ]);
  });
});

describe("matchViaPathMatcher — ordering violations", () => {
  it("no violations when steps arrive in sequence order", () => {
    const spec: SpecGraph = {
      scenario_id: "sc_test",
      version: "1.0.0",
      nodes: [
        buildSpecNode("s1", { event_key: "step.a" }),
        buildSpecNode("s2", { event_key: "step.b" }),
      ],
      edges: [{ source: "s1", target: "s2", type: "sequence" }],
    };
    const runtime = buildRuntimeGraph([
      buildRuntimeNode({ id: "n1", event_key: "step.a", timestamp: "2026-03-12T10:00:00.000Z" }),
      buildRuntimeNode({ id: "n2", event_key: "step.b", timestamp: "2026-03-12T10:00:01.000Z" }),
    ]);

    const result = matchViaPathMatcher(spec, runtime);

    expect(result.ordering_violations).toEqual([]);
  });

  it("detects violation when target arrives before source", () => {
    const spec: SpecGraph = {
      scenario_id: "sc_test",
      version: "1.0.0",
      nodes: [
        buildSpecNode("s1", { event_key: "step.a" }),
        buildSpecNode("s2", { event_key: "step.b" }),
      ],
      edges: [{ source: "s1", target: "s2", type: "sequence" }],
    };
    const runtime = buildRuntimeGraph([
      buildRuntimeNode({ id: "n1", event_key: "step.a", timestamp: "2026-03-12T10:00:01.000Z" }),
      buildRuntimeNode({ id: "n2", event_key: "step.b", timestamp: "2026-03-12T10:00:00.000Z" }),
    ]);

    const result = matchViaPathMatcher(spec, runtime);

    expect(result.ordering_violations).toHaveLength(1);
    expect(result.ordering_violations![0].step_id).toBe("s2");
    expect(result.ordering_violations![0].should_follow).toBe("s1");
    expect(result.ordering_violations![0].actual_timestamp).toBe("2026-03-12T10:00:00.000Z");
    expect(result.ordering_violations![0].predecessor_timestamp).toBe("2026-03-12T10:00:01.000Z");
  });

  it("detects violation when timestamps are equal", () => {
    const spec: SpecGraph = {
      scenario_id: "sc_test",
      version: "1.0.0",
      nodes: [
        buildSpecNode("s1", { event_key: "step.a" }),
        buildSpecNode("s2", { event_key: "step.b" }),
      ],
      edges: [{ source: "s1", target: "s2", type: "sequence" }],
    };
    const ts = "2026-03-12T10:00:00.000Z";
    const runtime = buildRuntimeGraph([
      buildRuntimeNode({ id: "n1", event_key: "step.a", timestamp: ts }),
      buildRuntimeNode({ id: "n2", event_key: "step.b", timestamp: ts }),
    ]);

    const result = matchViaPathMatcher(spec, runtime);

    expect(result.ordering_violations).toHaveLength(1);
    expect(result.ordering_violations![0].step_id).toBe("s2");
  });

  it("skips ordering check for optional/branch edges", () => {
    const spec: SpecGraph = {
      scenario_id: "sc_test",
      version: "1.0.0",
      nodes: [
        buildSpecNode("s1", { event_key: "step.a" }),
        buildSpecNode("s2", { event_key: "step.b" }),
      ],
      edges: [{ source: "s1", target: "s2", type: "optional" }],
    };
    const runtime = buildRuntimeGraph([
      buildRuntimeNode({ id: "n1", event_key: "step.a", timestamp: "2026-03-12T10:00:01.000Z" }),
      buildRuntimeNode({ id: "n2", event_key: "step.b", timestamp: "2026-03-12T10:00:00.000Z" }),
    ]);

    const result = matchViaPathMatcher(spec, runtime);

    expect(result.ordering_violations).toEqual([]);
  });

  it("skips ordering check when one of the steps is unmatched", () => {
    const spec: SpecGraph = {
      scenario_id: "sc_test",
      version: "1.0.0",
      nodes: [
        buildSpecNode("s1", { event_key: "step.a" }),
        buildSpecNode("s2", { event_key: "step.b" }),
      ],
      edges: [{ source: "s1", target: "s2", type: "sequence" }],
    };
    const runtime = buildRuntimeGraph([
      buildRuntimeNode({ id: "n1", event_key: "step.a", timestamp: "2026-03-12T10:00:00.000Z" }),
    ]);

    const result = matchViaPathMatcher(spec, runtime);

    expect(result.ordering_violations).toEqual([]);
  });

  it("returns empty ordering_violations when spec has no edges", () => {
    const spec = buildSpecGraph([
      buildSpecNode("s1", { event_key: "step.a" }),
    ]);
    const runtime = buildRuntimeGraph([
      buildRuntimeNode({ id: "n1", event_key: "step.a" }),
    ]);

    const result = matchViaPathMatcher(spec, runtime);

    expect(result.ordering_violations).toEqual([]);
  });
});

describe("matchViaPathMatcher — 엣지 케이스 패싯", () => {
  it("빈 spec (nodes=[]) → 빈 결과", () => {
    const spec: SpecGraph = { scenario_id: "sc", version: "1.0.0", nodes: [], edges: [] };
    const runtime = buildRuntimeGraph([
      buildRuntimeNode({ id: "n1", event_key: "any.event" }),
    ]);

    const result = matchViaPathMatcher(spec, runtime);

    expect(result.step_matches).toEqual([]);
    expect(result.missing_steps).toEqual([]);
    expect(result.unmatched_nodes).toEqual(["n1"]);
  });

  it("빈 runtime → 모든 required step missing", () => {
    const spec = buildSpecGraph([
      buildSpecNode("s1", { event_key: "step.a", required: true }),
      buildSpecNode("s2", { event_key: "step.b", required: true }),
    ]);
    const runtime = buildRuntimeGraph([]);

    const result = matchViaPathMatcher(spec, runtime);

    expect(result.missing_steps).toEqual(["s1", "s2"]);
    expect(result.step_matches.every(m => m.verdict === "fail")).toBe(true);
    expect(result.unmatched_nodes).toEqual([]);
  });

  it("required + optional 혼합 — required만 있으면 optional은 warn", () => {
    const spec = buildSpecGraph([
      buildSpecNode("s1", { event_key: "required.event", required: true }),
      buildSpecNode("s2", { event_key: "optional.event", required: false }),
    ]);
    const runtime = buildRuntimeGraph([
      buildRuntimeNode({ id: "n1", event_key: "required.event" }),
      // optional.event 없음
    ]);

    const result = matchViaPathMatcher(spec, runtime);

    const s1 = result.step_matches.find(m => m.step_id === "s1")!;
    const s2 = result.step_matches.find(m => m.step_id === "s2")!;
    expect(s1.verdict).toBe("pass");
    expect(s2.verdict).toBe("warn");
    expect(result.missing_steps).toEqual(["s2"]);
  });

  it("자동 순차 연결 — edges 없어도 다중 노드 전부 도달 가능", () => {
    // edges=[] 시 s1→s2→s3 자동 생성 → PathMatcher가 모두 reachable로 처리
    const spec = buildSpecGraph([
      buildSpecNode("s1", { event_key: "e1" }),
      buildSpecNode("s2", { event_key: "e2" }),
      buildSpecNode("s3", { event_key: "e3" }),
    ]);
    const runtime = buildRuntimeGraph([
      buildRuntimeNode({ id: "n1", event_key: "e1" }),
      buildRuntimeNode({ id: "n2", event_key: "e2" }),
      buildRuntimeNode({ id: "n3", event_key: "e3" }),
    ]);

    const result = matchViaPathMatcher(spec, runtime);

    expect(result.missing_steps).toEqual([]);
    expect(result.step_matches).toHaveLength(3);
    expect(result.step_matches.every(m => m.verdict === "pass")).toBe(true);
  });
});
