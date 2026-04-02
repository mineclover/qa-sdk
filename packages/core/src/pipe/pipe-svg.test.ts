import { describe, it, expect } from "vitest";
import { pipeGraphToSvg, zoomViewToSvg, pipeGraphToD3, zoomViewToD3 } from "./pipe-svg.js";
import { computeZoomView, computeLayout } from "./pipe-zoom.js";
import type { PipeGraph, PipeSpec, PipeConnection } from "../types/pipe-spec.js";
import { step } from "./__fixtures__/pipe-fixtures.js";

function makePipe(id: string, overrides?: Partial<PipeSpec>): PipeSpec {
  return { pipeId: id, version: "1.0.0", trigger: { eventKey: `${id}_trigger` }, flow: step(), ...overrides };
}
function conn(from: string, to: string, kind: PipeConnection["kind"] = "next"): PipeConnection {
  return { from, to, kind };
}

function makeChainGraph(ids: string[]): PipeGraph {
  return {
    graphId: "g1", version: "1.0.0",
    pipes: ids.map(id => makePipe(id)),
    connections: ids.slice(0, -1).map((id, i) => conn(id, ids[i + 1])),
    entryPipeId: ids[0],
  };
}

function makePortGraph(connection: PipeConnection): PipeGraph {
  return {
    graphId: "ports",
    version: "1.0.0",
    pipes: [
      makePipe("A", {
        ports: [
          { portId: "normalized", direction: "out" },
          { portId: "receipt", direction: "out" },
        ],
      }),
      makePipe("B", {
        ports: [
          { portId: "normalized", direction: "in" },
          { portId: "receipt", direction: "in" },
        ],
      }),
    ],
    connections: [connection],
    entryPipeId: "A",
  };
}

// ── pipeGraphToSvg ────────────────────────────────────

describe("pipeGraphToSvg", () => {
  it("체인 그래프 → SVG 문자열 생성", () => {
    const graph = makeChainGraph(["A", "B", "C"]);
    const svg = pipeGraphToSvg(graph);

    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
    expect(svg).toContain("xmlns=\"http://www.w3.org/2000/svg\"");
  });

  it("노드 ID가 SVG에 포함됨", () => {
    const graph = makeChainGraph(["A", "B"]);
    const svg = pipeGraphToSvg(graph);

    expect(svg).toContain("data-id=\"A\"");
    expect(svg).toContain("data-id=\"B\"");
  });

  it("엣지 path 요소 포함", () => {
    const graph = makeChainGraph(["A", "B"]);
    const svg = pipeGraphToSvg(graph);

    expect(svg).toContain("<path");
    expect(svg).toContain("marker-end");
  });

  it("conditional → strokeDash 스타일", () => {
    const graph: PipeGraph = {
      graphId: "g1", version: "1.0.0",
      pipes: [makePipe("A"), makePipe("B")],
      connections: [{ from: "A", to: "B", kind: "conditional", condition: "type=card" }],
      entryPipeId: "A",
    };
    const svg = pipeGraphToSvg(graph);

    expect(svg).toContain("stroke-dasharray");
    expect(svg).toContain("type=card");
  });

  it("error → 빨간색 stroke", () => {
    const graph: PipeGraph = {
      graphId: "g1", version: "1.0.0",
      pipes: [makePipe("A"), makePipe("B")],
      connections: [{ from: "A", to: "B", kind: "error" }],
      entryPipeId: "A",
    };
    const svg = pipeGraphToSvg(graph);
    expect(svg).toContain("#c62828");
  });

  it("connection facetType을 edge 라벨로 전달한다", () => {
    const graph: PipeGraph = {
      graphId: "g1", version: "1.0.0",
      pipes: [makePipe("A"), makePipe("B")],
      connections: [{ from: "A", to: "B", kind: "next", facetType: "payment.result" }],
      entryPipeId: "A",
    };
    const svg = pipeGraphToSvg(graph);

    expect(svg).toContain('class="edge-facet-label"');
    expect(svg).toContain(">payment.result</text>");
  });

  it("PortRef edge는 해당 port dot 좌표에서 시작/종료한다", () => {
    const graph = makePortGraph({
      from: { pipeId: "A", portId: "receipt" },
      to: { pipeId: "B", portId: "receipt" },
      kind: "next",
    });
    const svg = pipeGraphToSvg(graph);

    expect(svg).toContain('d="M 168 88 C 208 88, 208 88, 248 88"');
  });

  it("PortRef가 없으면 기존 node center 기준 edge를 유지한다", () => {
    const graph = makePortGraph({
      from: "A",
      to: "B",
      kind: "next",
    });
    const svg = pipeGraphToSvg(graph);

    expect(svg).toContain('d="M 168 78 C 208 78, 208 78, 248 78"');
  });

  it("group 줌 레벨 → 접힌 노드 스타일", () => {
    const graph = makeChainGraph(["A", "B", "C", "D", "E", "F"]);
    const svg = pipeGraphToSvg(graph, "group");

    expect(svg).toContain("<svg");
  });

  it("TB padding 옵션 적용 → viewBox 여백 증가", () => {
    const graph = makeChainGraph(["A", "B"]);
    const svgDefault = pipeGraphToSvg(graph);
    const svgPadded = pipeGraphToSvg(graph, "leaf", { padding: 80 });

    // padding이 크면 width/height도 커짐
    const defaultWidth = parseFloat(svgDefault.match(/width="([\d.]+)"/)![1]);
    const paddedWidth = parseFloat(svgPadded.match(/width="([\d.]+)"/)![1]);
    expect(paddedWidth).toBeGreaterThanOrEqual(defaultWidth);
  });

  it("빈 그래프 → 최소 크기 SVG", () => {
    const graph: PipeGraph = {
      graphId: "g1", version: "1.0.0",
      pipes: [],
      connections: [],
      entryPipeId: "none",
    };
    const svg = pipeGraphToSvg(graph);
    expect(svg).toContain("<svg");
    expect(svg).toContain("400");
  });
});

// ── zoomViewToSvg ─────────────────────────────────────

describe("zoomViewToSvg", () => {
  it("ZoomView 직접 변환", () => {
    const graph = makeChainGraph(["A", "B"]);
    const view = computeLayout(computeZoomView(graph, "leaf"));
    const svg = zoomViewToSvg(view);

    expect(svg).toContain("<svg");
    expect(svg).toContain("data-id=\"A\"");
  });
});

// ── pipeGraphToD3 ─────────────────────────────────────

describe("pipeGraphToD3", () => {
  it("nodes + links 반환", () => {
    const graph = makeChainGraph(["A", "B", "C"]);
    const d3 = pipeGraphToD3(graph);

    expect(d3.nodes).toHaveLength(3);
    expect(d3.links).toHaveLength(2);
    expect(d3.entryNodeId).toBe("A");
  });

  it("노드에 위치/크기 포함", () => {
    const graph = makeChainGraph(["A", "B"]);
    const d3 = pipeGraphToD3(graph);
    const nodeA = d3.nodes.find(n => n.id === "A")!;

    expect(nodeA.x).toBeDefined();
    expect(nodeA.y).toBeDefined();
    expect(nodeA.width).toBeGreaterThan(0);
    expect(nodeA.height).toBeGreaterThan(0);
  });

  it("링크에 kind 포함", () => {
    const graph: PipeGraph = {
      graphId: "g1", version: "1.0.0",
      pipes: [makePipe("A"), makePipe("B")],
      connections: [{ from: "A", to: "B", kind: "event" }],
      entryPipeId: "A",
    };
    const d3 = pipeGraphToD3(graph);
    expect(d3.links[0].kind).toBe("event");
  });

  it("conditional 링크 → condition 포함", () => {
    const graph: PipeGraph = {
      graphId: "g1", version: "1.0.0",
      pipes: [makePipe("A"), makePipe("B")],
      connections: [{ from: "A", to: "B", kind: "conditional", condition: "x=1" }],
      entryPipeId: "A",
    };
    const d3 = pipeGraphToD3(graph);
    expect(d3.links[0].condition).toBe("x=1");
  });

  it("노드에 concerns/role 포함", () => {
    const graph = makeChainGraph(["A"]);
    const d3 = pipeGraphToD3(graph);
    expect(Array.isArray(d3.nodes[0].concerns)).toBe(true);
    expect(typeof d3.nodes[0].role).toBe("string");
  });

  it("PortRef 링크 → sourcePorts/targetPorts 포함", () => {
    const graph = makePortGraph({
      from: { pipeId: "A", portId: "receipt" },
      to: { pipeId: "B", portId: "receipt" },
      kind: "next",
    });
    const d3 = pipeGraphToD3(graph);

    expect(d3.links[0].sourcePorts).toEqual(["receipt"]);
    expect(d3.links[0].targetPorts).toEqual(["receipt"]);
  });
});

// ── zoomViewToD3 ──────────────────────────────────────

describe("zoomViewToD3", () => {
  it("ZoomView 직접 변환", () => {
    const graph = makeChainGraph(["A", "B"]);
    const view = computeLayout(computeZoomView(graph, "leaf"));
    const d3 = zoomViewToD3(view);

    expect(d3.nodes).toHaveLength(2);
    expect(d3.links).toHaveLength(1);
  });
});
