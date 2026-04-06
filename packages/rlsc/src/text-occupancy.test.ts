import { describe, it, expect, vi } from "vitest";
import type { RLSCNode, RLSCDocument } from "./types.js";
import { analyzeGrid } from "./grid.js";

// ── pretext mock ──────────────────────────────────────────────────────
// pretext는 브라우저 Canvas 필요. Node 환경에서는 mock으로 순수 산술 로직만 검증.

vi.mock("@chenglou/pretext", () => ({
  prepare: vi.fn(() => ({ __brand: "PreparedText" })),
  layout: vi.fn(
    (_prepared: unknown, _maxWidth: number, lineHeight: number) => ({
      lineCount: 2,
      height: lineHeight * 2,
    }),
  ),
  prepareWithSegments: vi.fn(() => ({ __brand: "PreparedTextWithSegments" })),
  layoutWithLines: vi.fn(
    (_prepared: unknown, maxWidth: number, lineHeight: number) => {
      // 큰 maxWidth(자연 너비 측정)인 경우 한 줄
      if (maxWidth > 1e6) {
        return {
          lineCount: 1,
          height: lineHeight,
          lines: [{ text: "Hello World", width: 180, start: { segmentIndex: 0, graphemeIndex: 0 }, end: { segmentIndex: 0, graphemeIndex: 10 } }],
        };
      }
      // 일반 레이아웃: 최대 줄 너비 160, 2줄
      return {
        lineCount: 2,
        height: lineHeight * 2,
        lines: [
          { text: "Hello ", width: 160, start: { segmentIndex: 0, graphemeIndex: 0 }, end: { segmentIndex: 0, graphemeIndex: 5 } },
          { text: "World", width: 120, start: { segmentIndex: 0, graphemeIndex: 6 }, end: { segmentIndex: 0, graphemeIndex: 10 } },
        ],
      };
    },
  ),
}));

// ── 헬퍼 ──────────────────────────────────────────────────────────────

function textNode(
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
  text: string,
  opts?: {
    textAlign?: string;
    padding?: { top: number; right: number; bottom: number; left: number };
  },
): RLSCNode {
  return {
    id,
    tag: "p",
    classes: [],
    rect: { x, y, width: w, height: h },
    zIndex: 0,
    depth: 1,
    display: "block",
    position: "static",
    overflow: "visible",
    visible: true,
    attributes: {},
    children: [],
    textContent: text,
    fontInfo: {
      fontString: "400 16px sans-serif",
      lineHeight: 20,
      textAlign: opts?.textAlign ?? "left",
      padding: opts?.padding ?? { top: 0, right: 0, bottom: 0, left: 0 },
    },
  };
}

function emptyNode(
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
): RLSCNode {
  return {
    id,
    tag: "div",
    classes: [],
    rect: { x, y, width: w, height: h },
    zIndex: 0,
    depth: 1,
    display: "block",
    position: "static",
    overflow: "visible",
    visible: true,
    attributes: {},
    children: [],
  };
}

function makeDoc(children: RLSCNode[]): RLSCDocument {
  const vp = { width: 1024, height: 768 };
  const root: RLSCNode = {
    id: "root",
    tag: "body",
    classes: [],
    rect: { x: 0, y: 0, width: 1024, height: 768 },
    zIndex: 0,
    depth: 0,
    display: "block",
    position: "static",
    overflow: "visible",
    visible: true,
    attributes: {},
    children,
  };
  return {
    version: "1.0",
    viewport: vp,
    url: "http://localhost",
    timestamp: "2024-01-01T00:00:00.000Z",
    root,
    grid: analyzeGrid(root, vp),
    layers: [],
    relations: [],
  };
}

// ── Tests ─────────────────────────────────────────────────────────────

import {
  prepareTextMap,
  analyzeTextOccupancy,
  aggregateTextRegions,
  predictTextReflow,
  findBreakpointWidth,
} from "./text-occupancy.js";
import { prepare, layout as pretextLayout } from "@chenglou/pretext";

describe("prepareTextMap", () => {
  it("fontInfo + textContent가 있는 노드만 prepare 호출", () => {
    const t = textNode("p1", 0, 0, 200, 100, "Hello World");
    const e = emptyNode("div1", 0, 100, 200, 100);
    const doc = makeDoc([t, e]);

    const map = prepareTextMap(doc);

    expect(map.size).toBe(1);
    expect(map.has("p1")).toBe(true);
    expect(map.has("div1")).toBe(false);
    expect(prepare).toHaveBeenCalledWith("Hello World", "400 16px sans-serif");
  });
});

describe("analyzeTextOccupancy", () => {
  it("기본: fillX = maxLineWidth / contentWidth", () => {
    // 컨테이너 200×100, padding 없음, text-align left
    // mock: maxLineWidth=160, height=40 (2줄×20), naturalWidth=180
    const t = textNode("p1", 10, 20, 200, 100, "Hello World");
    const doc = makeDoc([t]);
    const map = prepareTextMap(doc);

    const result = analyzeTextOccupancy(doc, map);

    expect(result).toHaveLength(1);
    const occ = result[0]!;
    expect(occ.nodeId).toBe("p1");
    expect(occ.fillX).toBeCloseTo(160 / 200); // 0.8
    expect(occ.fillY).toBeCloseTo(40 / 100); // 0.4
    expect(occ.lineCount).toBe(2);
    expect(occ.naturalWidth).toBe(180);
    expect(occ.overflows).toBe(false);
  });

  it("padding 반영: contentWidth = rect.width - padding.left - padding.right", () => {
    // 컨테이너 200×100, padding 20 all sides → contentWidth=160, contentHeight=60
    const t = textNode("p1", 10, 20, 200, 100, "Hello", {
      padding: { top: 20, right: 20, bottom: 20, left: 20 },
    });
    const doc = makeDoc([t]);
    const map = prepareTextMap(doc);

    const result = analyzeTextOccupancy(doc, map);
    const occ = result[0]!;

    // fillX = maxLineWidth(160) / contentWidth(160) = 1.0
    expect(occ.fillX).toBeCloseTo(1.0);
    // fillY = textHeight(40) / contentHeight(60) ≈ 0.667
    expect(occ.fillY).toBeCloseTo(40 / 60, 2);
  });
});

describe("analyzeTextOccupancy — boundaryContact", () => {
  it("text-align left, padding 0: left 접촉, right 비접촉", () => {
    // contentWidth=200, maxLineWidth=160
    // margin.left=0 (text-align left → textX=0), margin.right=40
    const t = textNode("p1", 0, 0, 200, 100, "Hello");
    const doc = makeDoc([t]);
    const map = prepareTextMap(doc);

    const result = analyzeTextOccupancy(doc, map);
    const occ = result[0]!;

    expect(occ.boundaryContact.left).toBe(true); // margin=0 < 4
    expect(occ.boundaryContact.right).toBe(false); // margin=40 > 4
    expect(occ.boundaryContact.top).toBe(true); // margin=0 < 4
    // margin.bottom = 100 - 40 - 0 = 60
    expect(occ.boundaryContact.bottom).toBe(false);
  });

  it("text-align center: 좌우 대칭 여백", () => {
    // contentWidth=200, maxLineWidth=160 → 양쪽 (200-160)/2 = 20px
    const t = textNode("p1", 0, 0, 200, 100, "Hello", {
      textAlign: "center",
    });
    const doc = makeDoc([t]);
    const map = prepareTextMap(doc);

    const result = analyzeTextOccupancy(doc, map);
    const occ = result[0]!;

    expect(occ.margins.left).toBeCloseTo(20);
    expect(occ.margins.right).toBeCloseTo(20);
    expect(occ.boundaryContact.left).toBe(false);
    expect(occ.boundaryContact.right).toBe(false);
  });

  it("text-align right: left 비접촉, right 접촉 가능", () => {
    // contentWidth=200, maxLineWidth=160
    // textX = 200 - 160 = 40 → margin.left=40, margin.right=0
    const t = textNode("p1", 0, 0, 200, 100, "Hello", {
      textAlign: "right",
    });
    const doc = makeDoc([t]);
    const map = prepareTextMap(doc);

    const result = analyzeTextOccupancy(doc, map);
    const occ = result[0]!;

    expect(occ.margins.left).toBeCloseTo(40);
    expect(occ.margins.right).toBeCloseTo(0);
    expect(occ.boundaryContact.left).toBe(false);
    expect(occ.boundaryContact.right).toBe(true);
  });
});

describe("analyzeTextOccupancy — overflow", () => {
  it("textHeight > contentHeight → overflows: true", () => {
    // 컨테이너 200×30, mock textHeight=40 → 넘침
    const t = textNode("p1", 0, 0, 200, 30, "Long text");
    const doc = makeDoc([t]);
    const map = prepareTextMap(doc);

    const result = analyzeTextOccupancy(doc, map);
    expect(result[0]!.overflows).toBe(true);
  });
});

describe("aggregateTextRegions", () => {
  it("영역 내 텍스트 밀도 집계", () => {
    const t1 = textNode("p1", 0, 0, 200, 100, "Hello");
    const t2 = textNode("p2", 0, 100, 200, 100, "World");
    const doc = makeDoc([t1, t2]);
    const map = prepareTextMap(doc);
    const occupancies = analyzeTextOccupancy(doc, map);

    const regions = aggregateTextRegions(doc, occupancies);

    // 결과가 있으면 density가 0–1 범위인지 확인
    for (const region of regions) {
      expect(region.density).toBeGreaterThanOrEqual(0);
      expect(region.density).toBeLessThanOrEqual(1);
    }
  });
});

describe("predictTextReflow", () => {
  it("새로운 너비에서 줄 수 변화 반환", () => {
    const t = textNode("p1", 0, 0, 200, 100, "Hello");
    const doc = makeDoc([t]);
    const map = prepareTextMap(doc);

    // mock layout: 어떤 width든 lineCount=2, height=40 반환
    const result = predictTextReflow(map.get("p1")!, 100, 20);
    expect(result.lineCount).toBe(2);
    expect(result.height).toBe(40);
  });
});

describe("findBreakpointWidth", () => {
  it("목표 줄 수가 되는 너비를 이진 탐색", () => {
    // mock을 조정: width ≥ 180이면 1줄, < 180이면 2줄
    vi.mocked(pretextLayout).mockImplementation(
      (_p: unknown, maxWidth: number, lineHeight: number) => {
        const lines = maxWidth >= 180 ? 1 : 2;
        return { lineCount: lines, height: lines * lineHeight };
      },
    );

    const t = textNode("p1", 0, 0, 400, 100, "Hello");
    const doc = makeDoc([t]);
    const map = prepareTextMap(doc);

    const width = findBreakpointWidth(map.get("p1")!, 1, 20, 50, 400);
    // 이진 탐색이 180 근처를 찾아야 함
    expect(width).toBeGreaterThanOrEqual(178);
    expect(width).toBeLessThanOrEqual(182);

    // mock 복원
    vi.mocked(pretextLayout).mockImplementation(
      (_p: unknown, _mw: number, lineHeight: number) => ({
        lineCount: 2,
        height: lineHeight * 2,
      }),
    );
  });
});
