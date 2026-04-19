// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

import { describe, it, expect } from "vitest";
import { pipeGraphToMermaid, zoomViewToMermaid } from "viz-core";
import { computeZoomView } from "./pipe-zoom.js";
import type { PipeGraph, PipeSpec, PipeConnection } from "../types/pipe-spec.js";
import { step } from "./__fixtures__/pipe-fixtures.js";

function makePipe(id: string, overrides?: Partial<PipeSpec>): PipeSpec {
  return { pipeId: id, version: "1.0.0", trigger: { eventKey: `${id}_trigger` }, flow: step(), ...overrides };
}
function conn(from: string, to: string, kind: PipeConnection["kind"] = "next"): PipeConnection {
  return { from, to, kind };
}

describe("pipeGraphToMermaid", () => {
  it("체인 그래프 → flowchart LR", () => {
    const graph: PipeGraph = {
      graphId: "g1", version: "1.0.0",
      pipes: [makePipe("A"), makePipe("B"), makePipe("C")],
      connections: [conn("A", "B"), conn("B", "C")],
      entryPipeId: "A",
    };
    const mermaid = pipeGraphToMermaid(graph);

    expect(mermaid).toContain("flowchart LR");
    expect(mermaid).toContain("A");
    expect(mermaid).toContain("B");
    expect(mermaid).toContain("C");
    expect(mermaid).toContain("-->");
  });

  it("conditional → 점선 화살표", () => {
    const graph: PipeGraph = {
      graphId: "g1", version: "1.0.0",
      pipes: [makePipe("A"), makePipe("B")],
      connections: [{ from: "A", to: "B", kind: "conditional", condition: "type=card" }],
      entryPipeId: "A",
    };
    const mermaid = pipeGraphToMermaid(graph);

    expect(mermaid).toContain("-.->"); // 점선
    expect(mermaid).toContain("type=card");
  });

  it("event → 두꺼운 화살표", () => {
    const graph: PipeGraph = {
      graphId: "g1", version: "1.0.0",
      pipes: [makePipe("A"), makePipe("B")],
      connections: [{ from: "A", to: "B", kind: "event" }],
      entryPipeId: "A",
    };
    const mermaid = pipeGraphToMermaid(graph);
    expect(mermaid).toContain("==>");
  });

  it("group 줌 레벨 → 접힌 노드 스타일", () => {
    const graph: PipeGraph = {
      graphId: "g1", version: "1.0.0",
      pipes: [makePipe("A"), makePipe("B"), makePipe("C"), makePipe("D"), makePipe("E"), makePipe("F")],
      connections: [conn("A","B"), conn("B","C"), conn("C","D"), conn("D","E"), conn("E","F")],
      entryPipeId: "A",
    };
    const mermaid = pipeGraphToMermaid(graph, "group");

    // 접힌 노드가 있으면 stadium 형태 사용
    expect(mermaid).toContain("flowchart LR");
  });

  it("TB 방향 지정", () => {
    const graph: PipeGraph = {
      graphId: "g1", version: "1.0.0",
      pipes: [makePipe("A"), makePipe("B")],
      connections: [conn("A", "B")],
      entryPipeId: "A",
    };
    const mermaid = pipeGraphToMermaid(graph, "leaf", { direction: "TB" });
    expect(mermaid).toContain("flowchart TB");
  });
});

describe("zoomViewToMermaid", () => {
  it("ZoomView 직접 변환", () => {
    const graph: PipeGraph = {
      graphId: "g1", version: "1.0.0",
      pipes: [makePipe("A"), makePipe("B")],
      connections: [conn("A", "B")],
      entryPipeId: "A",
    };
    const view = computeZoomView(graph, "leaf");
    const mermaid = zoomViewToMermaid(view);

    expect(mermaid).toContain("flowchart LR");
    expect(mermaid).toContain("A");
  });
});
