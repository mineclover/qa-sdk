import { describe, it, expect } from "vitest";
import {
  collectCoordinateTransitions,
  collectControlFlowTransitions,
  summarizeTransitions,
  validateTransitionBridge,
} from "./transition-bridge.js";
import type { PathSegment } from "./catalog.types.js";
import type { PipeGraph, PipeSpec } from "../types/pipe-spec.js";

// ── 헬퍼 ──────────────────────────────────────────────

function seg(id: string, opts?: { transition?: { eventKey: string }; routes?: PathSegment["routes"]; children?: PathSegment[] }): PathSegment {
  return {
    segmentId: id,
    consumes: ["a"],
    shape: [4],
    addressOffset: 0,
    size: 4,
    ...opts,
  };
}

function makePipe(id: string, flow: PipeSpec["flow"]): PipeSpec {
  return { pipeId: id, version: "v1", trigger: { eventKey: `${id}.start` }, flow };
}

function makeGraph(pipes: PipeSpec[]): PipeGraph {
  return { graphId: "g1", version: "v1", pipes, connections: [], entryPipeId: pipes[0]?.pipeId ?? "" };
}

// ── collectCoordinateTransitions ──────────────────────

describe("collectCoordinateTransitions", () => {
  it("transition이 없는 세그먼트 → 빈 배열", () => {
    expect(collectCoordinateTransitions([seg("s1")])).toEqual([]);
  });

  it("segment transition 수집", () => {
    const segments = [
      seg("s1", { transition: { eventKey: "payment.process" } }),
      seg("s2", { transition: { eventKey: "shipping.dispatch" } }),
    ];
    expect(collectCoordinateTransitions(segments)).toEqual(["payment.process", "shipping.dispatch"]);
  });

  it("route transition 수집", () => {
    const segments = [
      seg("s1", {
        routes: [
          { when: { axis: "method", eq: 0 }, transition: { eventKey: "card.pay" } },
          { when: { axis: "method", eq: 1 }, transition: { eventKey: "bank.transfer" } },
        ],
      }),
    ];
    expect(collectCoordinateTransitions(segments)).toEqual(["card.pay", "bank.transfer"]);
  });

  it("children 재귀 수집", () => {
    const segments = [
      seg("parent", {
        children: [seg("child", { transition: { eventKey: "deep.event" } })],
      }),
    ];
    expect(collectCoordinateTransitions(segments)).toEqual(["deep.event"]);
  });

  it("중복 제거", () => {
    const segments = [
      seg("s1", { transition: { eventKey: "same" } }),
      seg("s2", { transition: { eventKey: "same" } }),
    ];
    expect(collectCoordinateTransitions(segments)).toEqual(["same"]);
  });
});

// ── collectControlFlowTransitions ─────────────────────

describe("collectControlFlowTransitions", () => {
  it("transition-scope 없는 그래프 → 빈 배열", () => {
    const graph = makeGraph([makePipe("p1", { kind: "step", facet: "소비" })]);
    expect(collectControlFlowTransitions(graph)).toEqual([]);
  });

  it("transition-scope의 transitionId 수집", () => {
    const graph = makeGraph([
      makePipe("p1", {
        kind: "transition-scope",
        transitionId: "transfer.execute",
        body: { kind: "step", facet: "소비" },
        events: ["e1"],
      }),
    ]);
    expect(collectControlFlowTransitions(graph)).toEqual(["transfer.execute"]);
  });

  it("중첩된 transition-scope 수집", () => {
    const graph = makeGraph([
      makePipe("p1", {
        kind: "sequence",
        steps: [
          {
            kind: "transition-scope",
            transitionId: "t1",
            body: { kind: "step", facet: "소비" },
            events: ["e1"],
          },
          {
            kind: "transition-scope",
            transitionId: "t2",
            body: { kind: "step", facet: "생산" },
            events: ["e2"],
          },
        ],
      }),
    ]);
    expect(collectControlFlowTransitions(graph)).toEqual(["t1", "t2"]);
  });
});

// ── validateTransitionBridge ──────────────────────────

describe("validateTransitionBridge", () => {
  it("양쪽 일치 → 이슈 없음", () => {
    const segments = [seg("s1", { transition: { eventKey: "transfer.execute" } })];
    const graph = makeGraph([
      makePipe("p1", {
        kind: "transition-scope",
        transitionId: "transfer.execute",
        body: { kind: "step", facet: "소비" },
        events: ["e1"],
      }),
    ]);
    expect(validateTransitionBridge(segments, graph)).toEqual([]);
  });

  it("좌표에만 있고 제어 흐름에 없음 → warning", () => {
    const segments = [seg("s1", { transition: { eventKey: "orphan.coord" } })];
    const graph = makeGraph([makePipe("p1", { kind: "step", facet: "소비" })]);

    const issues = validateTransitionBridge(segments, graph);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.layer).toBe("coordinate");
    expect(issues[0]!.message).toContain("orphan.coord");
  });

  it("제어 흐름에만 있고 좌표에 없음 → warning", () => {
    const segments = [seg("s1")];
    const graph = makeGraph([
      makePipe("p1", {
        kind: "transition-scope",
        transitionId: "orphan.flow",
        body: { kind: "step", facet: "소비" },
        events: ["e1"],
      }),
    ]);

    const issues = validateTransitionBridge(segments, graph);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.layer).toBe("control-flow");
    expect(issues[0]!.message).toContain("orphan.flow");
  });

  it("빈 세그먼트 + 빈 그래프 → 이슈 없음", () => {
    expect(validateTransitionBridge([], makeGraph([]))).toEqual([]);
  });

  it("다중 transition 양방향 불일치", () => {
    const segments = [
      seg("s1", { transition: { eventKey: "shared" } }),
      seg("s2", { transition: { eventKey: "coord_only" } }),
    ];
    const graph = makeGraph([
      makePipe("p1", {
        kind: "sequence",
        steps: [
          {
            kind: "transition-scope",
            transitionId: "shared",
            body: { kind: "step", facet: "소비" },
            events: ["e1"],
          },
          {
            kind: "transition-scope",
            transitionId: "flow_only",
            body: { kind: "step", facet: "생산" },
            events: ["e2"],
          },
        ],
      }),
    ]);

    const issues = validateTransitionBridge(segments, graph);
    expect(issues).toHaveLength(2);
    expect(issues.find(i => i.message.includes("coord_only"))).toBeDefined();
    expect(issues.find(i => i.message.includes("flow_only"))).toBeDefined();
  });
});

// ── summarizeTransitions ──────────────────────────────

describe("summarizeTransitions", () => {
  it("양쪽 수집 결과 반환", () => {
    const segments = [seg("s1", { transition: { eventKey: "t1" } })];
    const graph = makeGraph([
      makePipe("p1", {
        kind: "transition-scope",
        transitionId: "t2",
        body: { kind: "step", facet: "소비" },
        events: ["e1"],
      }),
    ]);

    const summary = summarizeTransitions(segments, graph);
    expect(summary.coordinate).toEqual(["t1"]);
    expect(summary.controlFlow).toEqual(["t2"]);
  });
});
