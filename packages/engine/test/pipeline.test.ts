import { describe, expect, it } from "vitest";
import type {
  EventRecord,
  MatchResult,
  RuntimeGraph,
  RuntimeNode,
  ScenarioSpec,
  ScenarioStep,
  SpecGraph,
  StepConstraint,
} from "@qa-sdk/core";
import {
  compileSpec,
  computeVerdict,
  evaluateConstraint,
  matchViaPathMatcher,
  reconstruct,
} from "../src/index.js";

function buildRecord(overrides: Partial<EventRecord> & Pick<EventRecord, "log_id">): EventRecord {
  return {
    log_id: overrides.log_id,
    timestamp: "2026-03-12T00:00:00.000Z",
    record_kind: "log",
    trace_id: "trace_checkout",
    span_id: "span_root",
    event_key: "checkout.started",
    event_version: "1",
    payload_format: "json",
    payload_encoding: "raw",
    payload_masking_applied: false,
    payload_masked_fields: [],
    payload: {},
    ...overrides,
  };
}

function buildStep(overrides: Partial<ScenarioStep> & Pick<ScenarioStep, "id" | "event_key">): ScenarioStep {
  return {
    id: overrides.id,
    event_key: overrides.event_key,
    required: true,
    kind: "sequence",
    ...overrides,
  };
}

function buildSpec(steps: ScenarioStep[]): ScenarioSpec {
  return {
    scenario_id: "scenario_checkout",
    version: "1.0.0",
    domain: "checkout",
    steps,
  };
}

function buildRuntimeNode(
  overrides: Partial<RuntimeNode> & Pick<RuntimeNode, "id" | "event_key">,
): RuntimeNode {
  return {
    id: overrides.id,
    log_id: overrides.id,
    timestamp: "2026-03-12T00:00:00.000Z",
    record_kind: "log",
    event_key: overrides.event_key,
    event_version: "1",
    payload: {},
    payload_masking_applied: false,
    payload_masked_fields: [],
    ...overrides,
  };
}

function buildRuntimeGraph(nodes: RuntimeNode[]): RuntimeGraph {
  return {
    trace_id: "trace_checkout",
    nodes,
    edges: [],
  };
}

function buildEmptyMatchResult(): MatchResult {
  return {
    scenario_id: "scenario_checkout",
    trace_id: "trace_checkout",
    step_matches: [],
    missing_steps: [],
    unmatched_nodes: [],
  };
}

describe("reconstruct", () => {
  it("builds parent-child edges and temporal edges from event records", () => {
    const graph = reconstruct("trace_checkout", [
      buildRecord({
        log_id: "root_span_record",
        record_kind: "span",
        span_id: "span_root",
        event_key: "checkout.root",
        span_name: "Checkout Root",
        timestamp: "2026-03-12T00:00:00.000Z",
        start_time: "2026-03-12T00:00:00.000Z",
        end_time: "2026-03-12T00:00:03.000Z",
      }),
      buildRecord({
        log_id: "root_log_record",
        record_kind: "log",
        span_id: "span_root",
        event_key: "checkout.validated",
        timestamp: "2026-03-12T00:00:02.000Z",
      }),
      buildRecord({
        log_id: "child_span_record",
        record_kind: "span",
        span_id: "span_child",
        parent_span_id: "span_root",
        event_key: "checkout.persisted",
        span_name: "Persist Order",
        timestamp: "2026-03-12T00:00:01.000Z",
        start_time: "2026-03-12T00:00:01.000Z",
        end_time: "2026-03-12T00:00:02.000Z",
      }),
    ]);

    expect(graph.trace_id).toBe("trace_checkout");
    expect(graph.nodes.map((node) => node.id)).toEqual([
      "root_span_record",
      "child_span_record",
      "root_log_record",
    ]);
    expect(graph.edges).toEqual(
      expect.arrayContaining([
        {
          source: "root_span_record",
          target: "child_span_record",
          type: "parent_child",
        },
        {
          source: "root_span_record",
          target: "root_log_record",
          type: "temporal",
        },
      ]),
    );
  });

  it("treats records without parent_span_id as root nodes", () => {
    const graph = reconstruct("trace_checkout", [
      buildRecord({
        log_id: "root_span_record",
        record_kind: "span",
        span_id: "span_root",
        event_key: "checkout.root",
        timestamp: "2026-03-12T00:00:00.000Z",
      }),
      buildRecord({
        log_id: "child_span_record",
        record_kind: "span",
        span_id: "span_child",
        parent_span_id: "span_root",
        event_key: "checkout.child",
        timestamp: "2026-03-12T00:00:01.000Z",
      }),
    ]);

    const rootNodeIds = graph.nodes
      .filter((node) =>
        !graph.edges.some((edge) => edge.type === "parent_child" && edge.target === node.id)
      )
      .map((node) => node.id);

    expect(rootNodeIds).toEqual(["root_span_record"]);
  });
});

describe("compileSpec", () => {
  it("compiles sequence, branch, and optional edges from a scenario spec", () => {
    const branchConditionApproved: StepConstraint = {
      field: "payload.outcome",
      op: "eq",
      value: "approved",
    };
    const branchConditionRejected: StepConstraint = {
      field: "payload.outcome",
      op: "eq",
      value: "rejected",
    };

    const graph = compileSpec(
      buildSpec([
        buildStep({
          id: "start",
          event_key: "checkout.started",
          next: ["optional-review"],
        }),
        buildStep({
          id: "optional-review",
          event_key: "checkout.reviewed",
          required: false,
          kind: "optional",
          next: ["decision"],
        }),
        buildStep({
          id: "decision",
          event_key: "checkout.decided",
          kind: "branch",
          branches: [
            { condition: branchConditionApproved, next: ["approved"] },
            { condition: branchConditionRejected, next: ["rejected"] },
          ],
        }),
        buildStep({
          id: "approved",
          event_key: "checkout.approved",
        }),
        buildStep({
          id: "rejected",
          event_key: "checkout.rejected",
        }),
      ]),
    );

    expect(graph.nodes.map((node) => node.step_id)).toEqual([
      "start",
      "optional-review",
      "decision",
      "approved",
      "rejected",
    ]);
    expect(graph.edges).toEqual([
      { source: "start", target: "optional-review", type: "sequence" },
      { source: "optional-review", target: "decision", type: "optional" },
      {
        source: "decision",
        target: "approved",
        type: "branch",
        condition: branchConditionApproved,
      },
      {
        source: "decision",
        target: "rejected",
        type: "branch",
        condition: branchConditionRejected,
      },
    ]);
  });
});

describe("matchViaPathMatcher", () => {
  it("matches spec steps to runtime nodes by event_key and tracks unmatched nodes", () => {
    const spec = compileSpec(
      buildSpec([
        buildStep({
          id: "start",
          event_key: "checkout.started",
          event_version: "1",
        }),
        buildStep({
          id: "completed",
          event_key: "checkout.completed",
          event_version: "1",
        }),
      ]),
    );
    const runtime = buildRuntimeGraph([
      buildRuntimeNode({ id: "runtime-start", event_key: "checkout.started" }),
      buildRuntimeNode({ id: "runtime-completed", event_key: "checkout.completed" }),
      buildRuntimeNode({ id: "runtime-audit", event_key: "checkout.audit" }),
    ]);

    const result = matchViaPathMatcher(spec, runtime);

    expect(result.step_matches).toEqual([
      {
        step_id: "start",
        matched_node_id: "runtime-start",
        verdict: "pass",
        constraint_results: [],
      },
      {
        step_id: "completed",
        matched_node_id: "runtime-completed",
        verdict: "pass",
        constraint_results: [],
      },
    ]);
    expect(result.missing_steps).toEqual([]);
    expect(result.unmatched_nodes).toEqual(["runtime-audit"]);
  });
});

describe("evaluateConstraint", () => {
  const node = buildRuntimeNode({
    id: "runtime-step",
    event_key: "checkout.completed",
    status_code: "ok",
    payload: {
      amount: 120,
      attempt: 2,
      orderId: "ord_123",
      status: "approved",
      message: "checkout completed successfully",
    },
    payload_masked_fields: ["cardNumber"],
  });

  it.each([
    [{ field: "payload.status", op: "eq", value: "approved" }, true],
    [{ field: "payload.status", op: "neq", value: "declined" }, true],
    [{ field: "payload.orderId", op: "exists" }, true],
    [{ field: "payload.amount", op: "gt", value: 100 }, true],
    [{ field: "payload.attempt", op: "lt", value: 3 }, true],
    [{ field: "payload.message", op: "contains", value: "completed" }, true],
    [{ field: "payload.cardNumber", op: "masked" }, true],
    [{ field: "status_code", op: "eq", value: "error" }, false],
    [{ field: "payload.missing", op: "exists" }, false],
  ] satisfies [StepConstraint, boolean][])(
    "evaluates %o",
    (constraint, expected) => {
      expect(evaluateConstraint(constraint, node)).toBe(expected);
    },
  );
});

describe("computeVerdict", () => {
  it("returns pass when all required steps pass", () => {
    const spec = compileSpec(
      buildSpec([
        buildStep({
          id: "start",
          event_key: "checkout.started",
        }),
      ]),
    );
    const runtime = buildRuntimeGraph([
      buildRuntimeNode({
        id: "runtime-start",
        event_key: "checkout.started",
      }),
    ]);

    const report = computeVerdict(
      matchViaPathMatcher(spec, runtime),
      spec,
      runtime,
      "qas_1",
    );

    expect(report.overall_verdict).toBe("pass");
    expect(report.step_matches).toEqual([
      {
        step_id: "start",
        matched_node_id: "runtime-start",
        verdict: "pass",
        constraint_results: [],
      },
    ]);
    expect(report.qa_session_id).toBe("qas_1");
  });

  it("returns warn when only optional steps are missing", () => {
    const spec = compileSpec(
      buildSpec([
        buildStep({
          id: "start",
          event_key: "checkout.started",
        }),
        buildStep({
          id: "review",
          event_key: "checkout.reviewed",
          required: false,
          kind: "optional",
        }),
      ]),
    );
    const runtime = buildRuntimeGraph([
      buildRuntimeNode({
        id: "runtime-start",
        event_key: "checkout.started",
      }),
    ]);

    const report = computeVerdict(matchViaPathMatcher(spec, runtime), spec, runtime);

    expect(report.overall_verdict).toBe("warn");
    expect(report.step_matches.filter((stepMatch) => stepMatch.verdict === "warn")).toEqual([
      {
        step_id: "review",
        verdict: "warn",
        constraint_results: [],
      },
    ]);
    expect(report.missing_steps).toEqual(["review"]);
  });

  it("returns degraded when only latency constraints are violated", () => {
    const spec = compileSpec(
      buildSpec([
        buildStep({
          id: "persist",
          event_key: "checkout.persisted",
          timeout_ms: 500,
        }),
      ]),
    );
    const runtime = buildRuntimeGraph([
      buildRuntimeNode({
        id: "runtime-persist",
        event_key: "checkout.persisted",
        record_kind: "span",
        start_time: "2026-03-12T00:00:00.000Z",
        end_time: "2026-03-12T00:00:01.000Z",
      }),
    ]);

    const report = computeVerdict(matchViaPathMatcher(spec, runtime), spec, runtime);

    expect(report.overall_verdict).toBe("degraded");
    expect(report.latency_violations).toEqual([
      {
        step_id: "persist",
        expected_ms: 500,
        actual_ms: 1000,
      },
    ]);
  });

  it("returns fail when a required step matches but fails constraints", () => {
    const spec = compileSpec(
      buildSpec([
        buildStep({
          id: "decision",
          event_key: "checkout.decided",
          constraints: [
            {
              field: "payload.outcome",
              op: "eq",
              value: "approved",
            },
          ],
        }),
      ]),
    );
    const runtime = buildRuntimeGraph([
      buildRuntimeNode({
        id: "runtime-decision",
        event_key: "checkout.decided",
        payload: { outcome: "rejected" },
      }),
    ]);

    const report = computeVerdict(matchViaPathMatcher(spec, runtime), spec, runtime);

    expect(report.overall_verdict).toBe("fail");
    expect(report.step_matches.filter((stepMatch) => stepMatch.verdict === "fail")).toEqual([
      {
        step_id: "decision",
        matched_node_id: "runtime-decision",
        verdict: "fail",
        constraint_results: [
          {
            constraint: {
              field: "payload.outcome",
              op: "eq",
              value: "approved",
            },
            passed: false,
            actual: "rejected",
          },
        ],
      },
    ]);
  });

  it("returns unknown when no steps can be evaluated", () => {
    const spec: SpecGraph = {
      scenario_id: "scenario_checkout",
      version: "1.0.0",
      nodes: [],
      edges: [],
    };
    const runtime = buildRuntimeGraph([]);

    const report = computeVerdict(
      buildEmptyMatchResult(),
      spec,
      runtime,
    );

    expect(report.overall_verdict).toBe("unknown");
    expect(report.summary).toBe("verdict=unknown");
  });
});
