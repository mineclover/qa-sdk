import { describe, it, expect } from "vitest";
import { detectRelations } from "./relations.js";
import type { RLSCNode } from "./types.js";

// ─── 헬퍼 ────────────────────────────────────────────────────────────

let idSeq = 0;
function node(
  overrides: Partial<RLSCNode> & { rect: RLSCNode["rect"] },
): RLSCNode {
  return {
    id: `n${++idSeq}`,
    tag: "div",
    classes: [],
    rect: overrides.rect,
    zIndex: overrides.zIndex ?? 0,
    depth: overrides.depth ?? 0,
    display: "block",
    position: "static",
    overflow: "visible",
    visible: overrides.visible ?? true,
    attributes: {},
    children: overrides.children ?? [],
    ...overrides,
  };
}

function rel(nodes: RLSCNode[], type: string) {
  return detectRelations(nodes).filter((r) => r.type === type);
}

// ─── contains ────────────────────────────────────────────────────────

describe("contains", () => {
  it("A가 B를 완전 포함 (depth A < B)", () => {
    const a = node({ rect: { x: 0, y: 0, width: 200, height: 200 }, depth: 0 });
    const b = node({ rect: { x: 10, y: 10, width: 100, height: 100 }, depth: 1 });
    const result = rel([a, b], "contains");
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ source: a.id, target: b.id });
  });

  it("contains 판정 시 다른 관계 skip", () => {
    const a = node({ rect: { x: 0, y: 0, width: 200, height: 200 }, depth: 0 });
    const b = node({ rect: { x: 10, y: 10, width: 100, height: 100 }, depth: 1 });
    const rels = detectRelations([a, b]);
    const types = rels.map((r) => r.type);
    expect(types).not.toContain("overlaps");
    expect(types).not.toContain("adjacent-x");
  });

  it("depth가 같으면 contains 판정 안 함", () => {
    const a = node({ rect: { x: 0, y: 0, width: 200, height: 200 }, depth: 0 });
    const b = node({ rect: { x: 10, y: 10, width: 100, height: 100 }, depth: 0 });
    expect(rel([a, b], "contains")).toHaveLength(0);
  });
});

// ─── stacked ─────────────────────────────────────────────────────────

describe("stacked", () => {
  it("겹침 비율 0.8 초과, 다른 z-index → stacked", () => {
    const a = node({ rect: { x: 0, y: 0, width: 100, height: 100 }, zIndex: 0 });
    const b = node({ rect: { x: 5, y: 5, width: 90, height: 90 }, zIndex: 10 });
    const result = rel([a, b], "stacked");
    expect(result).toHaveLength(1);
    expect(result[0].source).toBe(a.id); // 낮은 z가 source
  });

  it("겹침 비율 정확히 0.8 → stacked 미포함 (> 0.8 조건)", () => {
    // 100×100 위에 80×100 = 교차 8000, min(10000, 8000) = 8000 → ratio = 1.0
    // 정확히 0.8이 되려면: 100×100 위에 90×90 → 교차 = 90×90 = 8100, min = 8100 → ratio = 1.0
    // ratio = intersection / min. 정확히 0.8: intersection = 0.8 * min
    // a: 100×100, b 위치를 조정해서 intersection = 80×100 = 8000, min(10000, 10000) = 10000 → 0.8
    const a = node({ rect: { x: 0, y: 0, width: 100, height: 100 }, zIndex: 0 });
    const b = node({ rect: { x: 20, y: 0, width: 100, height: 100 }, zIndex: 5 });
    // 교차: x[20,100] y[0,100] = 80×100 = 8000, min(10000,10000)=10000 → ratio=0.8 → not > 0.8
    const result = rel([a, b], "stacked");
    expect(result).toHaveLength(0);
  });

  it("같은 z-index → stacked 판정 안 함", () => {
    const a = node({ rect: { x: 0, y: 0, width: 100, height: 100 }, zIndex: 5 });
    const b = node({ rect: { x: 5, y: 5, width: 90, height: 90 }, zIndex: 5 });
    expect(rel([a, b], "stacked")).toHaveLength(0);
  });
});

// ─── overlaps ────────────────────────────────────────────────────────

describe("overlaps", () => {
  it("겹침 비율 0.1 초과 → overlaps 포함", () => {
    const a = node({ rect: { x: 0, y: 0, width: 100, height: 100 } });
    // 교차: x[80,100] y[0,100] = 20×100 = 2000, min(10000,10000)=10000 → 0.2
    const b = node({ rect: { x: 80, y: 0, width: 100, height: 100 } });
    expect(rel([a, b], "overlaps")).toHaveLength(1);
  });

  it("겹침 비율 정확히 0.1 → overlaps 미포함 (> 0.1 조건)", () => {
    // 교차: 10×100 = 1000, min=10000 → ratio=0.1 → not > 0.1
    const a = node({ rect: { x: 0, y: 0, width: 100, height: 100 } });
    const b = node({ rect: { x: 90, y: 0, width: 100, height: 100 } });
    expect(rel([a, b], "overlaps")).toHaveLength(0);
  });

  it("겹치지 않으면 overlaps 없음", () => {
    const a = node({ rect: { x: 0, y: 0, width: 100, height: 100 } });
    const b = node({ rect: { x: 200, y: 0, width: 100, height: 100 } });
    expect(rel([a, b], "overlaps")).toHaveLength(0);
  });
});

// ─── adjacent-x ──────────────────────────────────────────────────────

describe("adjacent-x", () => {
  it("x 간격 16px, y 겹침 있음 → adjacent-x 포함", () => {
    const a = node({ rect: { x: 0, y: 0, width: 100, height: 100 } });
    const b = node({ rect: { x: 116, y: 0, width: 100, height: 100 } });
    expect(rel([a, b], "adjacent-x")).toHaveLength(1);
  });

  it("x 간격 17px → adjacent-x 미포함", () => {
    const a = node({ rect: { x: 0, y: 0, width: 100, height: 100 } });
    const b = node({ rect: { x: 117, y: 0, width: 100, height: 100 } });
    expect(rel([a, b], "adjacent-x")).toHaveLength(0);
  });

  it("x 간격 16px지만 y 겹침 없음 → adjacent-x 미포함", () => {
    const a = node({ rect: { x: 0, y: 0, width: 100, height: 100 } });
    const b = node({ rect: { x: 116, y: 200, width: 100, height: 100 } });
    expect(rel([a, b], "adjacent-x")).toHaveLength(0);
  });
});

// ─── adjacent-y ──────────────────────────────────────────────────────

describe("adjacent-y", () => {
  it("y 간격 16px, x 겹침 있음 → adjacent-y 포함", () => {
    const a = node({ rect: { x: 0, y: 0, width: 100, height: 100 } });
    const b = node({ rect: { x: 0, y: 116, width: 100, height: 100 } });
    expect(rel([a, b], "adjacent-y")).toHaveLength(1);
  });

  it("y 간격 17px → adjacent-y 미포함", () => {
    const a = node({ rect: { x: 0, y: 0, width: 100, height: 100 } });
    const b = node({ rect: { x: 0, y: 117, width: 100, height: 100 } });
    expect(rel([a, b], "adjacent-y")).toHaveLength(0);
  });
});

// ─── aligned-x ───────────────────────────────────────────────────────

describe("aligned-x", () => {
  it("left 차이 4px → aligned-x 포함", () => {
    const a = node({ rect: { x: 0, y: 0, width: 100, height: 50 } });
    const b = node({ rect: { x: 4, y: 100, width: 100, height: 50 } });
    expect(rel([a, b], "aligned-x")).toHaveLength(1);
  });

  it("left 차이 5px → aligned-x 미포함", () => {
    const a = node({ rect: { x: 0, y: 0, width: 100, height: 50 } });
    const b = node({ rect: { x: 5, y: 100, width: 100, height: 50 } });
    expect(rel([a, b], "aligned-x")).toHaveLength(0);
  });
});

// ─── flow ────────────────────────────────────────────────────────────

describe("flow", () => {
  it("같은 부모 아래 형제 노드 3개 → flow 2건", () => {
    const c1 = node({ rect: { x: 0, y: 0, width: 50, height: 50 }, depth: 1 });
    const c2 = node({ rect: { x: 60, y: 0, width: 50, height: 50 }, depth: 1 });
    const c3 = node({ rect: { x: 120, y: 0, width: 50, height: 50 }, depth: 1 });
    const parent = node({
      rect: { x: 0, y: 0, width: 200, height: 50 },
      depth: 0,
      children: [c1, c2, c3],
    });
    const result = rel([parent, c1, c2, c3], "flow");
    expect(result).toHaveLength(2);
  });

  it("비가시 노드는 flow에서 건너뜀 — 남은 가시 형제끼리 연결", () => {
    const c1 = node({ rect: { x: 0, y: 0, width: 50, height: 50 }, depth: 1 });
    const c2 = node({ rect: { x: 60, y: 0, width: 50, height: 50 }, depth: 1, visible: false });
    const c3 = node({ rect: { x: 120, y: 0, width: 50, height: 50 }, depth: 1 });
    const parent = node({
      rect: { x: 0, y: 0, width: 200, height: 50 },
      depth: 0,
      children: [c1, c2, c3],
    });
    // c2 visible=false → visibleChildren = [c1, c3] → flow: c1→c3 (1건)
    const result = rel([parent, c1, c2, c3], "flow");
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ source: c1.id, target: c3.id });
  });
});
