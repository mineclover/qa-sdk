import { describe, expect, it } from "vitest";
import type { MatchResult, SpecGraph, RuntimeGraph, StepMatch } from "@qa-sdk/core";
import { derivePathObservation } from "./observe-path.js";

// ── 헬퍼 ──────────────────────────────────────────────────

function makeSpec(overrides: Partial<SpecGraph> = {}): SpecGraph {
  return {
    scenario_id: "sc_checkout",
    version: "1",
    nodes: [
      { step_id: "s1", event_key: "session_start", required: true, kind: "sequence" },
      { step_id: "s2", event_key: "click",         required: true, kind: "sequence" },
      { step_id: "s3", event_key: "form_submit",   required: true, kind: "sequence" },
    ],
    edges: [
      { source: "s1", target: "s2", type: "sequence" },
      { source: "s2", target: "s3", type: "sequence" },
    ],
    ...overrides,
  };
}

function makeRuntime(overrides: Partial<RuntimeGraph> = {}): RuntimeGraph {
  return {
    trace_id: "trc_001",
    nodes: [
      {
        id: "n1", log_id: "l1", timestamp: "2026-03-14T10:00:00.000Z",
        record_kind: "log", event_key: "session_start", event_version: "001",
        payload: {}, payload_masking_applied: false, payload_masked_fields: [],
      },
      {
        id: "n2", log_id: "l2", timestamp: "2026-03-14T10:00:01.000Z",
        record_kind: "log", event_key: "click", event_version: "001",
        payload: {}, payload_masking_applied: false, payload_masked_fields: [],
      },
      {
        id: "n3", log_id: "l3", timestamp: "2026-03-14T10:00:02.000Z",
        record_kind: "log", event_key: "form_submit", event_version: "001",
        payload: {}, payload_masking_applied: false, payload_masked_fields: [],
      },
    ],
    edges: [
      { source: "n1", target: "n2", type: "temporal" },
      { source: "n2", target: "n3", type: "temporal" },
    ],
    ...overrides,
  };
}

function makeMatch(
  matches: Array<{ step_id: string; node_id: string }>,
  missing: string[] = [],
): MatchResult {
  const step_matches: StepMatch[] = matches.map(({ step_id, node_id }) => ({
    step_id,
    matched_node_id: node_id,
    verdict: "pass",
    constraint_results: [],
  }));

  // 매칭되지 않은 step도 step_matches에 포함 (verdict=fail)
  for (const id of missing) {
    step_matches.push({ step_id: id, verdict: "fail", constraint_results: [] });
  }

  return {
    scenario_id: "sc_checkout",
    trace_id: "trc_001",
    step_matches,
    missing_steps: missing,
    unmatched_nodes: [],
  };
}

// ── 기본 동작 ─────────────────────────────────────────────

describe("derivePathObservation — 기본 동작", () => {
  it("전체 매칭 시 reached_nodes가 timestamp 순으로 정렬된다", () => {
    // n3(10:00:02) → n2(10:00:01) → n1(10:00:00) 역순으로 전달해도 정렬되어야 함
    const match = makeMatch([
      { step_id: "s3", node_id: "n3" },
      { step_id: "s1", node_id: "n1" },
      { step_id: "s2", node_id: "n2" },
    ]);

    const obs = derivePathObservation(match, makeSpec(), makeRuntime());

    expect(obs.reached_nodes.map((n) => n.runtime_node_id)).toEqual(["n1", "n2", "n3"]);
    expect(obs.reached_nodes.map((n) => n.spec_step_id)).toEqual(["s1", "s2", "s3"]);
    expect(obs.reached_nodes.map((n) => n.event_key)).toEqual([
      "session_start", "click", "form_submit",
    ]);
  });

  it("traversed_edges는 양쪽 endpoint가 모두 매칭된 spec 엣지만 포함한다", () => {
    const match = makeMatch([
      { step_id: "s1", node_id: "n1" },
      { step_id: "s2", node_id: "n2" },
      { step_id: "s3", node_id: "n3" },
    ]);

    const obs = derivePathObservation(match, makeSpec(), makeRuntime());

    expect(obs.traversed_edges).toEqual([
      { from_step_id: "s1", to_step_id: "s2", edge_type: "sequence" },
      { from_step_id: "s2", to_step_id: "s3", edge_type: "sequence" },
    ]);
  });

  it("중간 스텝이 누락되면 해당 엣지는 traversed_edges에 포함되지 않는다", () => {
    // s2(click) 누락 → s1→s2 엣지, s2→s3 엣지 모두 포함 안 됨
    const match = makeMatch(
      [{ step_id: "s1", node_id: "n1" }, { step_id: "s3", node_id: "n3" }],
      ["s2"],
    );

    const obs = derivePathObservation(match, makeSpec(), makeRuntime());

    expect(obs.traversed_edges).toHaveLength(0);
  });
});

// ── Terminal 노드 판별 ─────────────────────────────────────

describe("derivePathObservation — terminal 노드 판별", () => {
  it("마지막 spec 노드(outgoing edge 없음)가 reached_goals에 포함된다", () => {
    const match = makeMatch([
      { step_id: "s1", node_id: "n1" },
      { step_id: "s2", node_id: "n2" },
      { step_id: "s3", node_id: "n3" }, // s3 = terminal (no outgoing edge)
    ]);

    const obs = derivePathObservation(match, makeSpec(), makeRuntime());

    expect(obs.reached_goals).toEqual(["s3"]);
    expect(obs.unreachable_goals).toEqual([]);
    expect(obs.terminal_node).toBe("n3");
    expect(obs.terminal_reason).toBe("goal_reached");
  });

  it("terminal 노드에 도달하지 못하면 unreachable_goals에 포함된다", () => {
    // s3 누락
    const match = makeMatch(
      [{ step_id: "s1", node_id: "n1" }, { step_id: "s2", node_id: "n2" }],
      ["s3"],
    );

    const obs = derivePathObservation(match, makeSpec(), makeRuntime());

    expect(obs.reached_goals).toEqual([]);
    expect(obs.unreachable_goals).toEqual(["s3"]);
    expect(obs.terminal_node).toBe("n2");
    expect(obs.terminal_reason).toBe("partial");
  });

  it("매칭이 하나도 없으면 terminal_node는 null", () => {
    const match = makeMatch([], ["s1", "s2", "s3"]);

    const obs = derivePathObservation(match, makeSpec(), makeRuntime());

    expect(obs.reached_nodes).toHaveLength(0);
    expect(obs.terminal_node).toBeNull();
    expect(obs.terminal_reason).toBeNull();
    expect(obs.reached_goals).toEqual([]);
    expect(obs.unreachable_goals).toEqual(["s3"]);
  });
});

// ── Loop 감지 ─────────────────────────────────────────────

describe("derivePathObservation — loop 감지", () => {
  it("같은 event_key가 두 번 매칭되면 loop_detected = true", () => {
    const spec = makeSpec({
      nodes: [
        { step_id: "s1", event_key: "click", required: true, kind: "sequence" },
        { step_id: "s2", event_key: "click", required: true, kind: "sequence" }, // 반복
        { step_id: "s3", event_key: "form_submit", required: true, kind: "sequence" },
      ],
      edges: [
        { source: "s1", target: "s2", type: "sequence" },
        { source: "s2", target: "s3", type: "sequence" },
      ],
    });

    const runtime = makeRuntime({
      nodes: [
        {
          id: "n1", log_id: "l1", timestamp: "2026-03-14T10:00:00.000Z",
          record_kind: "log", event_key: "click", event_version: "001",
          payload: {}, payload_masking_applied: false, payload_masked_fields: [],
        },
        {
          id: "n2", log_id: "l2", timestamp: "2026-03-14T10:00:01.000Z",
          record_kind: "log", event_key: "click", event_version: "001",
          payload: {}, payload_masking_applied: false, payload_masked_fields: [],
        },
        {
          id: "n3", log_id: "l3", timestamp: "2026-03-14T10:00:02.000Z",
          record_kind: "log", event_key: "form_submit", event_version: "001",
          payload: {}, payload_masking_applied: false, payload_masked_fields: [],
        },
      ],
      edges: [],
    });

    const match = makeMatch([
      { step_id: "s1", node_id: "n1" },
      { step_id: "s2", node_id: "n2" },
      { step_id: "s3", node_id: "n3" },
    ]);

    const obs = derivePathObservation(match, spec, runtime);

    expect(obs.loop_detected).toBe(true);
  });

  it("모든 event_key가 고유하면 loop_detected = false", () => {
    const match = makeMatch([
      { step_id: "s1", node_id: "n1" },
      { step_id: "s2", node_id: "n2" },
      { step_id: "s3", node_id: "n3" },
    ]);

    const obs = derivePathObservation(match, makeSpec(), makeRuntime());

    expect(obs.loop_detected).toBe(false);
  });
});

// ── recovery_used ─────────────────────────────────────────

describe("derivePathObservation — recovery_used", () => {
  it("현재 구현에서는 항상 false (true path traversal 미구현)", () => {
    const match = makeMatch([
      { step_id: "s1", node_id: "n1" },
      { step_id: "s2", node_id: "n2" },
      { step_id: "s3", node_id: "n3" },
    ]);

    const obs = derivePathObservation(match, makeSpec(), makeRuntime());

    expect(obs.recovery_used).toBe(false);
  });
});

// ── 복수 terminal 노드 ────────────────────────────────────

describe("derivePathObservation — 복수 terminal 노드 (branch)", () => {
  it("branch 시나리오에서 도달된 goal과 미도달 goal을 올바르게 분류한다", () => {
    // s1 → s2 (success path)
    // s1 → s3 (failure path)
    // s2, s3 모두 terminal (outgoing edge 없음)
    const spec = makeSpec({
      nodes: [
        { step_id: "s1", event_key: "session_start", required: true, kind: "sequence" },
        { step_id: "s2", event_key: "success",       required: false, kind: "branch" },
        { step_id: "s3", event_key: "failure",       required: false, kind: "branch" },
      ],
      edges: [
        { source: "s1", target: "s2", type: "branch" },
        { source: "s1", target: "s3", type: "branch" },
      ],
    });

    const runtime = makeRuntime({
      nodes: [
        {
          id: "n1", log_id: "l1", timestamp: "2026-03-14T10:00:00.000Z",
          record_kind: "log", event_key: "session_start", event_version: "001",
          payload: {}, payload_masking_applied: false, payload_masked_fields: [],
        },
        {
          id: "n2", log_id: "l2", timestamp: "2026-03-14T10:00:01.000Z",
          record_kind: "log", event_key: "success", event_version: "001",
          payload: {}, payload_masking_applied: false, payload_masked_fields: [],
        },
      ],
      edges: [{ source: "n1", target: "n2", type: "temporal" }],
    });

    // success path만 실행됨 → s3(failure)은 unreachable
    const match = makeMatch(
      [{ step_id: "s1", node_id: "n1" }, { step_id: "s2", node_id: "n2" }],
      ["s3"],
    );

    const obs = derivePathObservation(match, spec, runtime);

    expect(obs.reached_goals).toEqual(["s2"]);
    expect(obs.unreachable_goals).toEqual(["s3"]);
    expect(obs.terminal_reason).toBe("goal_reached");
  });
});
