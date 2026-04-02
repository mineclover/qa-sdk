import { describe, it, expect } from "vitest";
import { computeZoomLevels, computeZoomView } from "./pipe-zoom.js";
import type { PipeGraph } from "../types/pipe-spec.js";
import { chainGraph, scopeGraph, branchGraph, loopGraph, makePipe, conn } from "./__fixtures__/pipe-zoom-fixtures.js";

// ── computeZoomView ─────────────────────────────────

describe("computeZoomView", () => {
  describe("leaf 레벨", () => {
    it("접기 없이 전체 파이프 노출", () => {
      const graph = chainGraph();
      const view = computeZoomView(graph, "leaf");

      expect(view.level).toBe("leaf");
      expect(view.nodes).toHaveLength(6);
      expect(view.edges).toHaveLength(5);
      expect(view.entryNodeId).toBe("A");
      expect(view.nodes.every(n => !n.isFolded)).toBe(true);
    });

    it("summary에 원본 파이프 수와 경로 수 포함", () => {
      const graph = chainGraph();
      const view = computeZoomView(graph, "leaf");

      expect(view.summary.nodeCount).toBe(6);
      expect(view.summary.edgeCount).toBe(5);
      expect(view.summary.foldedNodeCount).toBe(0);
      expect(view.summary.originalPipeCount).toBe(6);
      expect(view.summary.totalPaths).toBeGreaterThan(0);
    });

    it("각 노드에 역할(role) 분류", () => {
      const graph = chainGraph();
      const view = computeZoomView(graph, "leaf");

      for (const node of view.nodes) {
        expect(["producer", "consumer", "transformer", "router", "observer"]).toContain(node.role);
      }
    });
  });

  describe("group 레벨", () => {
    it("체인 6노드 → 접기로 노드 수 감소", () => {
      const graph = chainGraph();
      const view = computeZoomView(graph, "group");

      expect(view.nodes.length).toBeLessThan(6);
      expect(view.summary.originalPipeCount).toBe(6);
    });

    it("scope 그래프에서 scope-cluster 접기", () => {
      const graph = scopeGraph();
      const view = computeZoomView(graph, "group");

      expect(view.nodes.length).toBeLessThan(5);

      const folded = view.nodes.filter(n => n.isFolded);
      expect(folded.length).toBeGreaterThan(0);

      for (const node of folded) {
        expect(node.contract).toBeDefined();
        expect(node.foldedChildCount).toBeGreaterThan(1);
      }
    });

    it("접힌 노드의 totalPaths는 내부 경로 수", () => {
      const graph = scopeGraph();
      const view = computeZoomView(graph, "group");

      const folded = view.nodes.filter(n => n.isFolded);
      for (const node of folded) {
        expect(node.totalPaths).toBeGreaterThan(0);
      }
    });
  });

  describe("module 레벨", () => {
    it("scope-cluster는 유지하고 linear-chain만 접기", () => {
      const graph = scopeGraph();
      const viewGroup = computeZoomView(graph, "group");
      const viewModule = computeZoomView(graph, "module");

      expect(viewModule.nodes.length).toBeGreaterThanOrEqual(viewGroup.nodes.length);
    });

    it("체인이 있으면 linear-chain 접기 적용", () => {
      const graph = chainGraph();
      const viewModule = computeZoomView(graph, "module");
      const viewLeaf = computeZoomView(graph, "leaf");

      expect(viewModule.nodes.length).toBeLessThan(viewLeaf.nodes.length);
    });
  });
});

// ── computeZoomLevels ───────────────────────────────

describe("computeZoomLevels", () => {
  it("3단계 줌 레벨 맵 반환", () => {
    const graph = scopeGraph();
    const levels = computeZoomLevels(graph);

    expect(levels.group.level).toBe("group");
    expect(levels.module.level).toBe("module");
    expect(levels.leaf.level).toBe("leaf");
  });

  it("group ≤ module ≤ leaf 노드 수 단조 증가", () => {
    const graph = scopeGraph();
    const levels = computeZoomLevels(graph);

    expect(levels.group.nodes.length).toBeLessThanOrEqual(levels.module.nodes.length);
    expect(levels.module.nodes.length).toBeLessThanOrEqual(levels.leaf.nodes.length);
  });

  it("모든 레벨에서 entryNodeId가 존재하는 노드를 가리킴", () => {
    const graph = chainGraph();
    const levels = computeZoomLevels(graph);

    for (const level of [levels.group, levels.module, levels.leaf]) {
      const nodeIds = new Set(level.nodes.map(n => n.id));
      expect(nodeIds.has(level.entryNodeId)).toBe(true);
    }
  });

  it("originalPipeCount는 모든 레벨에서 동일", () => {
    const graph = chainGraph();
    const levels = computeZoomLevels(graph);

    const original = graph.pipes.length;
    expect(levels.group.summary.originalPipeCount).toBe(original);
    expect(levels.module.summary.originalPipeCount).toBe(original);
    expect(levels.leaf.summary.originalPipeCount).toBe(original);
  });
});

// ── 피드백 루프 ─────────────────────────────────────

describe("피드백 루프 그래프", () => {
  it("SCC가 group 레벨에서 접힘", () => {
    const graph = loopGraph();
    const view = computeZoomView(graph, "group");

    expect(view.nodes.length).toBeLessThan(4);
    expect(view.summary.foldedNodeCount).toBeGreaterThan(0);
  });

  it("leaf 레벨에서는 모든 노드 노출", () => {
    const graph = loopGraph();
    const view = computeZoomView(graph, "leaf");

    expect(view.nodes).toHaveLength(4);
    expect(view.nodes.every(n => !n.isFolded)).toBe(true);
  });
});

// ── 엣지 ────────────────────────────────────────────

describe("엣지", () => {
  it("조건부 엣지에 condition 포함", () => {
    const graph = branchGraph();
    const view = computeZoomView(graph, "leaf");

    const condEdges = view.edges.filter(e => e.kind === "conditional");
    expect(condEdges.length).toBe(2);
    expect(condEdges.every(e => e.condition !== undefined)).toBe(true);
  });

  it("fan-out 엣지가 정상 변환", () => {
    const graph: PipeGraph = {
      graphId: "fanout",
      version: "1.0.0",
      pipes: [makePipe("A"), makePipe("B"), makePipe("C"), makePipe("D")],
      connections: [
        { from: "A", to: ["B", "C"], kind: "fan-out" },
        { from: ["B", "C"], to: "D", kind: "join" },
      ],
      entryPipeId: "A",
    };

    const view = computeZoomView(graph, "leaf");
    expect(view.edges).toHaveLength(4);
  });

  it("PortRef 연결 메타데이터를 ZoomEdge에 보존한다", () => {
    const graph: PipeGraph = {
      graphId: "ports",
      version: "1.0.0",
      pipes: [
        makePipe("A", {
          ports: [{ portId: "receipt", direction: "out" }],
        }),
        makePipe("B", {
          ports: [{ portId: "receipt", direction: "in" }],
        }),
      ],
      connections: [{
        from: { pipeId: "A", portId: "receipt" },
        to: { pipeId: "B", portId: "receipt" },
        kind: "next",
      }],
      entryPipeId: "A",
    };

    const view = computeZoomView(graph, "leaf");
    expect(view.edges).toHaveLength(1);
    expect(view.edges[0].sourcePorts).toEqual(["receipt"]);
    expect(view.edges[0].targetPorts).toEqual(["receipt"]);
  });
});
