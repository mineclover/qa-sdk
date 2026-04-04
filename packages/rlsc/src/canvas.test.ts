import { describe, it, expect } from "vitest";
import { renderToSVG, assignColors } from "./canvas.js";
import { analyzeGrid } from "./grid.js";
import type { RLSCDocument, RLSCNode, CanvasRenderOptions } from "./types.js";

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
    zIndex: 0, depth: 0,
    display: "block", position: "static", overflow: "visible",
    visible: true, attributes: {}, children: [],
    ...opts,
  };
}

function makeDoc(children: RLSCNode[]): RLSCDocument {
  const vp = { width: 800, height: 600 };
  const root: RLSCNode = {
    id: "root", tag: "body", classes: [],
    rect: { x: 0, y: 0, width: 800, height: 600 },
    zIndex: 0, depth: 0,
    display: "block", position: "static", overflow: "visible",
    visible: true, attributes: {}, children,
  };
  return {
    version: "1.0", viewport: vp,
    url: "http://localhost", timestamp: "2024-01-01T00:00:00.000Z",
    root, grid: analyzeGrid(root, vp),
    layers: [], relations: [],
  };
}

// ── assignColors ──────────────────────────────────────────────────────

describe("assignColors", () => {
  it("colorBy: role → role 팔레트 색상 사용", () => {
    const nodes = [node("n1", 0, 0, 100, 100, { role: "banner" })];
    const colors = assignColors(nodes, { colorBy: "role" });
    expect(colors.get("n1")).toBe("#4A90D9");
  });

  it("알 수 없는 role → fallback #999999", () => {
    const nodes = [node("n1", 0, 0, 100, 100, { role: "unknown-role" })];
    const colors = assignColors(nodes, { colorBy: "role" });
    expect(colors.get("n1")).toBe("#999999");
  });

  it("colorBy: depth → depth에 따라 다른 색상", () => {
    const n0 = node("n0", 0, 0, 100, 100, { depth: 0 });
    const n1 = node("n1", 0, 0, 100, 100, { depth: 2 });
    const colors = assignColors([n0, n1], { colorBy: "depth" });
    expect(colors.get("n0")).not.toBe(colors.get("n1"));
  });

  it("colorBy: custom + palette → palette 색상 사용", () => {
    const nodes = [node("n1", 0, 0, 100, 100)];
    const colors = assignColors(nodes, {
      colorBy: "custom",
      palette: { n1: "#ff0000" },
    });
    expect(colors.get("n1")).toBe("#ff0000");
  });

  it("custom palette에 없는 노드 → fallback #999999", () => {
    const nodes = [node("n1", 0, 0, 100, 100)];
    const colors = assignColors(nodes, { colorBy: "custom", palette: {} });
    expect(colors.get("n1")).toBe("#999999");
  });
});

// ── renderToSVG ───────────────────────────────────────────────────────

describe("renderToSVG — 기본 구조", () => {
  it("유효한 SVG 문자열 반환", () => {
    const svg = renderToSVG(makeDoc([node("a", 10, 20, 200, 100)]));
    expect(svg).toMatch(/^<svg /);
    expect(svg).toContain("</svg>");
  });

  it("viewBox 속성 포함", () => {
    const svg = renderToSVG(makeDoc([]));
    expect(svg).toContain('viewBox="0 0 800 600"');
  });

  it("가시 노드가 rect 요소로 출력된다", () => {
    const svg = renderToSVG(makeDoc([
      node("a", 10, 20, 200, 100),
    ]));
    expect(svg).toContain('<rect x="10"');
    expect(svg).toContain('y="20"');
  });

  it("비가시 노드는 출력되지 않는다", () => {
    const svg = renderToSVG(makeDoc([
      node("vis", 0, 0, 100, 100),
      node("hidden", 0, 0, 200, 200, { visible: false }),
    ]));
    // hidden 노드의 200×200 크기가 없어야 함
    expect(svg).not.toContain('width="200" height="200"');
  });

  it("role 있는 노드는 text 라벨 출력", () => {
    const svg = renderToSVG(makeDoc([node("a", 0, 0, 100, 100, { role: "banner" })]));
    expect(svg).toContain("banner");
  });
});

describe("renderToSVG — 옵션", () => {
  it("showGrid: true → overlay-grid 그룹 포함", () => {
    const svg = renderToSVG(makeDoc([]), { showGrid: true });
    expect(svg).toContain('class="overlay-grid"');
  });

  it("showBalance: true → overlay-balance 그룹 포함", () => {
    const svg = renderToSVG(makeDoc([]), { showBalance: true });
    expect(svg).toContain('class="overlay-balance"');
  });

  it("showGrid: false(기본) → grid 없음", () => {
    const svg = renderToSVG(makeDoc([]));
    expect(svg).not.toContain("overlay-grid");
  });

  it("opacity 옵션 반영", () => {
    const svg = renderToSVG(
      makeDoc([node("a", 0, 0, 100, 100)]),
      { opacity: 0.3 },
    );
    expect(svg).toContain('opacity="0.3"');
  });
});

// ── renderToCanvas — 브라우저 가드 ──────────────────────────────────

describe("renderToCanvas", () => {
  it("Node.js 환경에서 throw한다", async () => {
    const { renderToCanvas } = await import("./canvas.js");
    const doc = makeDoc([]);
    expect(() =>
      renderToCanvas(doc, {} as HTMLCanvasElement)
    ).toThrow("브라우저 환경에서만");
  });
});
