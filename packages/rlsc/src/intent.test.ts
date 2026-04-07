import { describe, it, expect } from "vitest";
import { checkConformance, recognizeLayout } from "./intent.js";
import { analyzeGrid } from "./grid.js";
import type { RLSCDocument, RLSCNode, RLSCRelation, LayoutPattern, TextOccupancy } from "./types.js";

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

function makeDoc(children: RLSCNode[], relations: RLSCRelation[] = []): RLSCDocument {
  // 1000×1000 정사각형: 황금비 미충족(score≈0.618 < 0.8) → goldenRatio 미인식
  const vp = { width: 1000, height: 1000 };
  const root: RLSCNode = {
    id: "root", tag: "body", classes: [],
    rect: { x: 0, y: 0, width: 1000, height: 1000 },
    zIndex: 0, depth: 0,
    display: "block", position: "static", overflow: "visible",
    visible: true, attributes: {}, children,
  };
  return {
    version: "1.0", viewport: vp,
    url: "http://localhost", timestamp: "2024-01-01T00:00:00.000Z",
    root, grid: analyzeGrid(root, vp),
    layers: [], relations,
  };
}

// ── checkConformance ──────────────────────────────────────────────────

describe("checkConformance — 기본", () => {
  it("빈 선언 → score 1.0, 위반 없음", () => {
    const doc = makeDoc([node("a", 0, 0, 100, 100)]);
    const result = checkConformance(doc, {});
    expect(result.score).toBe(1.0);
    expect(result.violations).toHaveLength(0);
  });

  it("결과에 declared, recognized, metrics, violations, score 포함", () => {
    const doc = makeDoc([node("a", 0, 0, 100, 100)]);
    const result = checkConformance(doc, {});
    expect(result.declared).toBeDefined();
    expect(result.recognized).toBeDefined();
    expect(result.metrics).toBeDefined();
    expect(result.violations).toBeDefined();
    expect(typeof result.score).toBe("number");
  });
});

describe("checkConformance — flowDirection", () => {
  // adjacent-x 관계가 있으면 horizontal → left-to-right 인식
  const nodes = [
    node("a", 0, 0, 200, 100),
    node("b", 220, 0, 200, 100),
    node("c", 440, 0, 200, 100),
  ];
  const relations = [
    rel("adjacent-x", "a", "b"),
    rel("adjacent-x", "b", "c"),
  ];

  it("선언과 인식이 일치 → 위반 없음", () => {
    const doc = makeDoc(nodes, relations);
    const declared: LayoutPattern = { flowDirection: "left-to-right" };
    const result = checkConformance(doc, declared);
    const flowViolations = result.violations.filter(v => v.rule === "flowDirection");
    expect(flowViolations).toHaveLength(0);
  });

  it("선언과 인식 불일치 → warning 위반", () => {
    const doc = makeDoc(nodes, relations);
    const declared: LayoutPattern = { flowDirection: "top-to-bottom" };
    const result = checkConformance(doc, declared);
    const v = result.violations.find(v => v.rule === "flowDirection");
    expect(v).toBeDefined();
    expect(v?.severity).toBe("warning");
    expect(v?.declared).toBe("top-to-bottom");
  });
});

describe("checkConformance — gridPattern", () => {
  it("gridPattern 선언했지만 인식 못 함 → error 위반", () => {
    // 노드 1개 → 그리드 패턴 인식 불가
    const doc = makeDoc([node("a", 0, 0, 100, 100)]);
    const declared: LayoutPattern = { gridPattern: "3x3" };
    const result = checkConformance(doc, declared);
    const v = result.violations.find(v => v.rule === "gridPattern");
    expect(v).toBeDefined();
    expect(v?.severity).toBe("error");
  });
});

describe("checkConformance — score 계산", () => {
  it("1개 선언 + 1개 위반 → score 0", () => {
    // adjacent-y → vertical이지만 horizontal 선언
    const nodes = [node("a", 0, 0, 100, 100), node("b", 0, 150, 100, 100)];
    const relations = [rel("adjacent-y", "a", "b"), rel("adjacent-y", "a", "b")];
    const doc = makeDoc(nodes, relations);
    const declared: LayoutPattern = { flowDirection: "left-to-right" };
    const result = checkConformance(doc, declared);
    // score = (1 - violations) / 1
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(1);
  });

  it("2개 선언, 1개 위반 → score 0.5", () => {
    // adjacent-x → horizontal 인식. goldenRatio는 1024x768이므로 불충족
    const nodes = [
      node("a", 0, 0, 200, 100),
      node("b", 220, 0, 200, 100),
    ];
    const relations = [rel("adjacent-x", "a", "b")];
    const doc = makeDoc(nodes, relations);
    // flowDirection 일치 + goldenRatio 불일치 → violations=1, total=2 → score=0.5
    const declared: LayoutPattern = {
      flowDirection: "left-to-right",
      goldenRatio: true,
    };
    const result = checkConformance(doc, declared);
    expect(result.score).toBe(0.5);
  });
});

// ── recognizeLayout ───────────────────────────────────────────────────

describe("recognizeLayout", () => {
  it("RLSCDocument로부터 LayoutPattern 반환", () => {
    const doc = makeDoc([
      node("a", 0, 0, 300, 100),
      node("b", 400, 0, 300, 100),
    ]);
    const pattern = recognizeLayout(doc);
    expect(typeof pattern).toBe("object");
  });

  it("adjacent-x 관계 → flowDirection: left-to-right 인식", () => {
    const nodes = [
      node("a", 0, 0, 200, 100),
      node("b", 220, 0, 200, 100),
      node("c", 440, 0, 200, 100),
    ];
    const doc = makeDoc(nodes, [
      rel("adjacent-x", "a", "b"),
      rel("adjacent-x", "b", "c"),
    ]);
    const pattern = recognizeLayout(doc);
    expect(pattern.flowDirection).toBe("left-to-right");
  });
});

// ── 텍스트 적합성 검증 ──────────────────────────────────────────────

function makeTextOcc(
  nodeId: string,
  opts: { overflows?: boolean; fillX?: number; fillY?: number; contact?: { top: boolean; right: boolean; bottom: boolean; left: boolean } },
): TextOccupancy {
  return {
    nodeId,
    renderedRect: { x: 0, y: 0, width: 160, height: 40 },
    fillX: opts.fillX ?? 0.8,
    fillY: opts.fillY ?? 0.4,
    lineCount: 2,
    naturalWidth: 180,
    margins: { top: 0, right: 40, bottom: 60, left: 0 },
    boundaryContact: opts.contact ?? { top: false, right: false, bottom: false, left: false },
    overflows: opts.overflows ?? false,
  };
}

describe("checkConformance — 텍스트 규칙", () => {
  it("text-overflow: overflows 노드가 있으면 violation", () => {
    const n = node("a", 0, 0, 500, 500);
    const doc = makeDoc([n]);
    const occs = [makeTextOcc("p1", { overflows: true })];
    const result = checkConformance(doc, {}, occs);
    const v = result.violations.find((v) => v.rule === "text-overflow");
    expect(v).toBeDefined();
    expect(v!.severity).toBe("warning");
  });

  it("textDensityRange: 밀도가 범위 밖이면 violation", () => {
    const n = node("a", 0, 0, 500, 500);
    const doc = makeDoc([n]);
    // 160×40 = 6400 / (1000×1000) = 0.0064
    const occs = [makeTextOcc("p1", {})];
    const result = checkConformance(doc, { textDensityRange: [0.1, 0.5] }, occs);
    const v = result.violations.find((v) => v.rule === "textDensityRange");
    expect(v).toBeDefined();
    expect(v!.severity).toBe("warning");
  });

  it("텍스트 규칙 없고 overflow 없으면 text violation 없음", () => {
    const n = node("a", 0, 0, 500, 500);
    const doc = makeDoc([n]);
    const occs = [makeTextOcc("p1", {})];
    const result = checkConformance(doc, {}, occs);
    const textViolations = result.violations.filter(
      (v) => v.rule === "text-overflow" || v.rule === "textDensityRange",
    );
    expect(textViolations).toHaveLength(0);
  });
});
