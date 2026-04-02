import { describe, it, expect } from "vitest";
import { computeZoomView, computeLayout } from "./pipe-zoom.js";
import type { PipeGraph } from "../types/pipe-spec.js";
import { chainGraph, branchGraph, makePipe } from "./__fixtures__/pipe-zoom-fixtures.js";

describe("computeLayout", () => {
  it("체인 그래프 → x좌표 단조 증가", () => {
    const graph = chainGraph();
    const view = computeZoomView(graph, "leaf");
    const laid = computeLayout(view);

    const nodeMap = new Map(laid.nodes.map(n => [n.id, n]));
    const ids = ["A", "B", "C", "D", "E", "F"];
    for (let i = 1; i < ids.length; i++) {
      expect(nodeMap.get(ids[i])!.position.x).toBeGreaterThan(
        nodeMap.get(ids[i - 1])!.position.x,
      );
    }
  });

  it("분기 그래프 → 분기 노드는 같은 x에 배치", () => {
    const graph = branchGraph();
    const view = computeZoomView(graph, "leaf");
    const laid = computeLayout(view);

    const nodeMap = new Map(laid.nodes.map(n => [n.id, n]));
    expect(nodeMap.get("C")!.position.x).toBe(nodeMap.get("D")!.position.x);
  });

  it("단일 노드 → 위치 할당", () => {
    const graph: PipeGraph = {
      graphId: "single",
      version: "1.0.0",
      pipes: [makePipe("A")],
      connections: [],
      entryPipeId: "A",
    };
    const view = computeZoomView(graph, "leaf");
    const laid = computeLayout(view);

    expect(laid.nodes).toHaveLength(1);
    expect(laid.nodes[0].position.x).toBe(0);
  });

  it("빈 그래프 → 빈 뷰 반환", () => {
    const graph: PipeGraph = {
      graphId: "empty",
      version: "1.0.0",
      pipes: [],
      connections: [],
      entryPipeId: "",
    };
    const view = computeZoomView(graph, "leaf");
    const laid = computeLayout(view);

    expect(laid.nodes).toHaveLength(0);
    expect(laid.edges).toHaveLength(0);
  });
});
