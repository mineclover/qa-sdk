import { describe, it, expect } from "vitest";
import { computeZoomView } from "./pipe-zoom.js";
import type { PipeGraph } from "./types/pipe-spec.js";
import { step } from "./__fixtures__/pipe-fixtures.js";
import { chainGraph, branchGraph, makePipe, conn } from "./__fixtures__/pipe-zoom-fixtures.js";

// ── 타입 확실성 fixture ──────────────────────────────

function certaintyGraph(): PipeGraph {
  return {
    graphId: "certainty",
    version: "1.0.0",
    pipes: [
      makePipe("strict-pipe", {
        flow: {
          kind: "step",
          facet: "소비",
          dataContract: {
            consumes: { id: { type: "number", required: true } },
            produces: { name: { type: "string", required: true } },
          },
        },
      }),
      makePipe("flexible-pipe", {
        flow: {
          kind: "step",
          facet: "생산",
          dataContract: {
            consumes: { data: { type: "Record<string, any>", required: true } },
            produces: { result: { type: "unknown", required: false } },
          },
        },
      }),
      makePipe("mixed-pipe", {
        flow: {
          kind: "step",
          facet: "관리",
          dataContract: {
            consumes: { config: { type: "string", required: true } },
            produces: { output: { type: "any", required: false } },
          },
        },
      }),
    ],
    connections: [
      conn("strict-pipe", "flexible-pipe"),
      conn("flexible-pipe", "mixed-pipe"),
    ],
    entryPipeId: "strict-pipe",
  };
}

// ── 타입 확실성 시각 인코딩 ──────────────────────────

describe("타입 확실성 시각 인코딩", () => {
  it("strict 타입 → polygon + solid", () => {
    const view = computeZoomView(certaintyGraph(), "leaf");
    const node = view.nodes.find(n => n.id === "strict-pipe")!;

    expect(node.style.certainty).toBe("strict");
    expect(node.style.shape).toBe("polygon");
    expect(node.style.borderStyle).toBe("solid");
  });

  it("flexible 타입(any/unknown) → cloud + dashed", () => {
    const view = computeZoomView(certaintyGraph(), "leaf");
    const node = view.nodes.find(n => n.id === "flexible-pipe")!;

    expect(node.style.certainty).toBe("flexible");
    expect(node.style.shape).toBe("cloud");
    expect(node.style.borderStyle).toBe("dashed");
  });

  it("혼합(strict+flexible) → mixed + cloud + dashed", () => {
    const view = computeZoomView(certaintyGraph(), "leaf");
    const node = view.nodes.find(n => n.id === "mixed-pipe")!;

    expect(node.style.certainty).toBe("mixed");
    expect(node.style.shape).toBe("cloud");
    expect(node.style.borderStyle).toBe("dashed");
  });
});

// ── 노드 크기 ───────────────────────────────────────

describe("노드 크기", () => {
  it("분기 파이프는 단순 파이프보다 크기가 큼", () => {
    const view = computeZoomView(branchGraph(), "leaf");
    const nodeMap = new Map(view.nodes.map(n => [n.id, n]));

    expect(nodeMap.get("B")!.size.width).toBeGreaterThan(nodeMap.get("A")!.size.width);
  });

  it("접힌 노드의 크기는 내부 복잡도 반영", () => {
    const view = computeZoomView(chainGraph(), "group");
    const folded = view.nodes.filter(n => n.isFolded);

    if (folded.length > 0) {
      for (const node of folded) {
        expect(node.size.width).toBeGreaterThanOrEqual(120);
      }
    }
  });
});

// ── 관심사 분포 ─────────────────────────────────────

describe("관심사 분포", () => {
  it("leaf 뷰에서 관심사가 추출됨", () => {
    const graph: PipeGraph = {
      graphId: "concerns",
      version: "1.0.0",
      pipes: [
        makePipe("A", {
          flow: { kind: "retry", step: step("소비"), maxAttempts: 3 },
        }),
        makePipe("B", {
          flow: { kind: "timeout", body: step("관리"), duration: 5000 },
        }),
      ],
      connections: [conn("A", "B")],
      entryPipeId: "A",
    };

    const view = computeZoomView(graph, "leaf");

    expect(view.nodes.find(n => n.id === "A")!.concerns).toContain("resilience");
    expect(view.nodes.find(n => n.id === "B")!.concerns).toContain("latency");
    expect(view.summary.concernCounts.resilience).toBeGreaterThan(0);
    expect(view.summary.concernCounts.latency).toBeGreaterThan(0);
  });
});
