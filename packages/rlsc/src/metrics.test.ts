// @def.boundary shared-utility-group
// @def.doc shared-utility-group

import { describe, it, expect } from "vitest";
import {
  measureBalance,
  detectGridPattern,
  scoreGoldenRatio,
  detectProximityGroups,
  detectDominantFlow,
  detectColumnSystem,
  measureSpacing,
  measureAspectRatios,
  measureLayout,
} from "./metrics.js";
import { analyzeGrid } from "./grid.js";
import type { RLSCNode, RLSCRelation, RLSCDocument, TextOccupancy } from "./types.js";

// ── 헬퍼 ─────────────────────────────────────────────────────────────

function node(
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
  opts?: Partial<RLSCNode>,
): RLSCNode {
  return {
    id, tag: "div", classes: [],
    rect: { x, y, width: w, height: h },
    zIndex: 0, depth: 1,
    display: "block", position: "static", overflow: "visible",
    visible: true, attributes: {}, children: [],
    ...opts,
  };
}

function rel(type: RLSCRelation["type"], source: string, target: string): RLSCRelation {
  return { type, source, target };
}

function makeDoc(nodes: RLSCNode[], relations: RLSCRelation[] = []): RLSCDocument {
  const vp = { width: 1024, height: 768 };
  const root: RLSCNode = {
    id: "root", tag: "body", classes: [],
    rect: { x: 0, y: 0, width: 1024, height: 768 },
    zIndex: 0, depth: 0,
    display: "block", position: "static", overflow: "visible",
    visible: true, attributes: {}, children: nodes,
  };
  return {
    version: "1.0", viewport: vp,
    url: "http://localhost", timestamp: "2024-01-01T00:00:00.000Z",
    root, grid: analyzeGrid(root, vp),
    layers: [], relations,
  };
}

// ── measureBalance ────────────────────────────────────────────────────

describe("measureBalance", () => {
  const vp = { width: 1000, height: 1000 };

  it("균형 잡힌 레이아웃 → x ≈ 1", () => {
    const nodes = [
      node("a", 0, 0, 490, 100),    // 왼쪽
      node("b", 510, 0, 490, 100),  // 오른쪽
    ];
    const { x } = measureBalance(nodes, vp);
    expect(x).toBeCloseTo(1.0, 1);
  });

  it("왼쪽으로 치우친 레이아웃 → x > 1", () => {
    const nodes = [
      node("a", 0, 0, 800, 100),   // 왼쪽 대형
      node("b", 900, 0, 50, 100),  // 오른쪽 소형
    ];
    const { x } = measureBalance(nodes, vp);
    expect(x).toBeGreaterThan(1);
  });

  it("비가시 노드는 제외된다", () => {
    const nodes = [
      node("a", 0, 0, 490, 100),
      node("b", 510, 0, 490, 100),
      node("h", 0, 0, 1000, 100, { visible: false }),
    ];
    const { x } = measureBalance(nodes, vp);
    expect(x).toBeCloseTo(1.0, 1);
  });

  it("한쪽 면적이 0이면 99 반환", () => {
    const nodes = [node("a", 0, 0, 100, 100)]; // 왼쪽만
    const { x } = measureBalance(nodes, vp);
    expect(x).toBe(99);
  });
});

// ── scoreGoldenRatio ──────────────────────────────────────────────────

describe("scoreGoldenRatio", () => {
  it("황금비(1618:1000) 뷰포트 → 높은 점수", () => {
    expect(scoreGoldenRatio({ width: 1618, height: 1000 })).toBeGreaterThan(0.9);
  });

  it("정사각형 뷰포트 → 낮은 점수 (< 0.7)", () => {
    // 1:1 ratio → score = 1 - 0.618/1.618 ≈ 0.618
    expect(scoreGoldenRatio({ width: 1000, height: 1000 })).toBeLessThan(0.7);
  });

  it("0 크기 뷰포트 → 0", () => {
    expect(scoreGoldenRatio({ width: 0, height: 100 })).toBe(0);
  });

  it("점수는 0–1 범위", () => {
    const score = scoreGoldenRatio({ width: 800, height: 600 });
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });
});

// ── detectProximityGroups ─────────────────────────────────────────────

describe("detectProximityGroups", () => {
  it("가까운 노드들 → 단일 그룹", () => {
    const nodes = [
      node("a", 0, 0, 10, 10),
      node("b", 5, 0, 10, 10),
      node("c", 10, 0, 10, 10),
    ];
    const groups = detectProximityGroups(nodes, 100);
    expect(groups).toHaveLength(1);
    expect(groups[0].nodeIds).toHaveLength(3);
  });

  it("멀리 떨어진 노드들 → 두 그룹", () => {
    const nodes = [
      node("a", 0, 0, 10, 10),
      node("b", 500, 0, 10, 10),
    ];
    const groups = detectProximityGroups(nodes, 32);
    expect(groups).toHaveLength(2);
  });

  it("비가시 노드는 그룹에 포함되지 않는다", () => {
    const nodes = [
      node("a", 0, 0, 10, 10),
      node("h", 5, 0, 10, 10, { visible: false }),
    ];
    const groups = detectProximityGroups(nodes, 100);
    expect(groups[0].nodeIds).toContain("a");
    expect(groups[0].nodeIds).not.toContain("h");
  });
});

// ── detectDominantFlow ────────────────────────────────────────────────

describe("detectDominantFlow", () => {
  it("adjacent-x 다수 → horizontal", () => {
    const rels = [
      rel("adjacent-x", "a", "b"),
      rel("adjacent-x", "b", "c"),
      rel("adjacent-y", "c", "d"),
    ];
    expect(detectDominantFlow(rels)).toBe("horizontal");
  });

  it("adjacent-y 다수 → vertical", () => {
    const rels = [rel("adjacent-y", "a", "b"), rel("adjacent-y", "b", "c")];
    expect(detectDominantFlow(rels)).toBe("vertical");
  });

  it("adjacent-x·y 균형 → grid", () => {
    const rels = [rel("adjacent-x", "a", "b"), rel("adjacent-y", "a", "c")];
    expect(detectDominantFlow(rels)).toBe("grid");
  });

  it("관계 없음 → free", () => {
    expect(detectDominantFlow([])).toBe("free");
  });
});

// ── measureSpacing ────────────────────────────────────────────────────

describe("measureSpacing", () => {
  it("adjacent-x 관계에서 x 간격 추출", () => {
    const nodes = [
      node("a", 0, 0, 100, 50),
      node("b", 108, 0, 100, 50),  // gap = 8
    ];
    const { values, base } = measureSpacing([rel("adjacent-x", "a", "b")], nodes);
    expect(values).toContain(8);
    expect(base).toBe(8);
  });

  it("adjacent-y 관계에서 y 간격 추출", () => {
    const nodes = [
      node("a", 0, 0, 100, 50),
      node("b", 0, 66, 100, 50),   // gap = 16
    ];
    const { values, base } = measureSpacing([rel("adjacent-y", "a", "b")], nodes);
    expect(values).toContain(16);
    expect(base).toBe(8);
  });

  it("관계 없음 → values=[], base=null", () => {
    const { values, base } = measureSpacing([], []);
    expect(values).toHaveLength(0);
    expect(base).toBeNull();
  });
});

// ── measureAspectRatios ───────────────────────────────────────────────

describe("measureAspectRatios", () => {
  it("동일 비율 노드 → count 반영 + 내림차순", () => {
    const nodes = [
      node("a", 0, 0, 200, 100),    // ratio 2.0
      node("b", 0, 200, 200, 100),  // ratio 2.0
      node("c", 0, 400, 100, 100),  // ratio 1.0
    ];
    const dist = measureAspectRatios(nodes);
    expect(dist[0].ratio).toBe(2);
    expect(dist[0].count).toBe(2);
    expect(dist[1].count).toBe(1);
  });

  it("비가시·0크기 노드는 제외된다", () => {
    const nodes = [
      node("a", 0, 0, 100, 100),
      node("zero", 0, 0, 0, 100),
      node("h", 0, 0, 100, 100, { visible: false }),
    ];
    const dist = measureAspectRatios(nodes);
    expect(dist).toHaveLength(1);
  });
});

// ── detectColumnSystem ────────────────────────────────────────────────

describe("detectColumnSystem", () => {
  const vp = { width: 1000, height: 600 };

  it("2개 x 클러스터 → 2-col 감지", () => {
    const nodes = [
      node("a", 0, 0, 400, 100),
      node("b", 0, 150, 400, 100),
      node("c", 500, 0, 400, 100),
      node("d", 500, 150, 400, 100),
    ];
    const cs = detectColumnSystem(nodes, vp);
    expect(cs).not.toBeNull();
    expect(cs?.cols).toBe(2);
  });

  it("노드 없으면 null", () => {
    expect(detectColumnSystem([], vp)).toBeNull();
  });
});

// ── detectGridPattern ─────────────────────────────────────────────────

describe("detectGridPattern", () => {
  it("dominant 없는 그리드 → null", () => {
    const emptyGrid = {
      cellSize: 16, cols: 10, rows: 10,
      cells: Array.from({ length: 10 }, () =>
        Array.from({ length: 10 }, () => ({ nodeIds: [], zStack: [], coverage: 0 }))
      ),
    };
    expect(detectGridPattern(emptyGrid)).toBeNull();
  });

  it("2-col 배치 → {cols:2, rows:1} 반환", () => {
    // cellSize=10, tolerance=20
    // colStart 0 vs 30 → 차이 30 > 20 → 별도 컬럼 그룹
    const n1 = node("n1", 0, 0, 250, 80);
    const n2 = node("n2", 300, 0, 250, 80);
    // root를 invisible로 설정해야 analyzeGrid에서 제외되어 n1/n2가 dominant가 됨
    const root: RLSCNode = {
      id: "root", tag: "div", classes: [],
      rect: { x: 0, y: 0, width: 600, height: 150 },
      zIndex: 0, depth: 0,
      display: "block", position: "static", overflow: "visible",
      visible: false, attributes: {}, children: [n1, n2],
    };
    const grid = analyzeGrid(root, { width: 600, height: 150 }, 10);
    const result = detectGridPattern(grid);
    expect(result).not.toBeNull();
    expect(result?.cols).toBe(2);
  });
});

// ── measureLayout — 통합 ─────────────────────────────────────────────

describe("measureLayout", () => {
  it("RLSCDocument로부터 LayoutMetrics 전체 필드 반환", () => {
    const doc = makeDoc([
      node("a", 0, 0, 300, 200),
      node("b", 400, 0, 300, 200),
    ]);
    const metrics = measureLayout(doc);

    expect(typeof metrics.balance.x).toBe("number");
    expect(typeof metrics.goldenRatioScore).toBe("number");
    expect(metrics.goldenRatioScore).toBeGreaterThanOrEqual(0);
    expect(metrics.goldenRatioScore).toBeLessThanOrEqual(1);
    expect(Array.isArray(metrics.spacingValues)).toBe(true);
    expect(Array.isArray(metrics.proximityGroups)).toBe(true);
    expect(Array.isArray(metrics.aspectRatioDistribution)).toBe(true);
    expect(["horizontal", "vertical", "grid", "free"]).toContain(metrics.dominantFlow);
  });
});

// ── measureLayout — textOccupancies ─────────────────────────────────

function makeTextOcc(
  nodeId: string,
  fillX: number,
  fillY: number,
  overflows: boolean,
  contact: { top: boolean; right: boolean; bottom: boolean; left: boolean },
): TextOccupancy {
  return {
    nodeId,
    renderedRect: { x: 0, y: 0, width: 160, height: 40 },
    fillX,
    fillY,
    lineCount: 2,
    naturalWidth: 180,
    margins: { top: 0, right: 40, bottom: 60, left: 0 },
    boundaryContact: contact,
    overflows,
  };
}

describe("measureLayout — textOccupancies", () => {
  it("TextOccupancy 미제공 시 텍스트 필드 undefined", () => {
    const n = node("a", 0, 0, 500, 500);
    const doc = makeDoc([n]);
    const m = measureLayout(doc);
    expect(m.textDensity).toBeUndefined();
    expect(m.textBoundaryContactRate).toBeUndefined();
    expect(m.textOverflowCount).toBeUndefined();
  });

  it("textDensity = 총 텍스트 면적 / 뷰포트 면적", () => {
    const n = node("a", 0, 0, 500, 500);
    const doc = makeDoc([n]);
    const occs = [
      makeTextOcc("a", 0.8, 0.4, false, { top: true, right: false, bottom: false, left: true }),
      makeTextOcc("b", 0.6, 0.5, true, { top: false, right: false, bottom: false, left: false }),
    ];
    const m = measureLayout(doc, occs);
    expect(m.textDensity).toBeCloseTo(12800 / 786432, 4);
    expect(m.textBoundaryContactRate).toBeCloseTo(0.5);
    expect(m.textOverflowCount).toBe(1);
  });

  it("모든 노드 contact 없고 overflow 없으면 rate=0, count=0", () => {
    const n = node("a", 0, 0, 500, 500);
    const doc = makeDoc([n]);
    const noContact = { top: false, right: false, bottom: false, left: false };
    const occs = [makeTextOcc("a", 0.5, 0.5, false, noContact)];
    const m = measureLayout(doc, occs);
    expect(m.textBoundaryContactRate).toBe(0);
    expect(m.textOverflowCount).toBe(0);
  });
});
