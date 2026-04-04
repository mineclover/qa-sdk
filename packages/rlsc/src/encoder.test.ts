import { describe, it, expect } from "vitest";
import { encodeToMarkup, parseMarkup } from "./encoder.js";
import type { RLSCDocument, RLSCNode } from "./types.js";

// ─── 헬퍼 ────────────────────────────────────────────────────────────

function makeNode(overrides: Partial<RLSCNode> = {}): RLSCNode {
  return {
    id: "div#root",
    tag: "div",
    classes: [],
    rect: { x: 0, y: 0, width: 1920, height: 1080 },
    zIndex: 0,
    depth: 0,
    display: "block",
    position: "static",
    overflow: "visible",
    visible: true,
    attributes: {},
    children: [],
    ...overrides,
  };
}

function makeDoc(overrides: Partial<RLSCDocument> = {}): RLSCDocument {
  return {
    version: "1.0",
    viewport: { width: 1920, height: 1080 },
    url: "https://test.example",
    timestamp: "2026-01-01T00:00:00Z",
    root: makeNode(),
    grid: { cellSize: 16, cols: 0, rows: 0, cells: [] },
    layers: [],
    relations: [],
    ...overrides,
  };
}

// ─── 라운드트립 ───────────────────────────────────────────────────────

describe("encodeToMarkup → parseMarkup 라운드트립", () => {
  it("viewport 복원", () => {
    const doc = makeDoc({ viewport: { width: 1280, height: 720 } });
    const markup = encodeToMarkup(doc);
    const parsed = parseMarkup(markup);
    expect(parsed.viewport).toEqual({ width: 1280, height: 720 });
  });

  it("url 복원", () => {
    const doc = makeDoc({ url: "https://shop.example/cart" });
    const markup = encodeToMarkup(doc);
    const parsed = parseMarkup(markup);
    expect(parsed.url).toBe("https://shop.example/cart");
  });

  it("timestamp 복원", () => {
    const doc = makeDoc({ timestamp: "2026-03-01T12:00:00Z" });
    const markup = encodeToMarkup(doc);
    const parsed = parseMarkup(markup);
    expect(parsed.timestamp).toBe("2026-03-01T12:00:00Z");
  });

  it("address 필드 있는 문서 — addr: 직렬화 + 복원", () => {
    const doc = makeDoc({ address: "def_document:v2:42" });
    const markup = encodeToMarkup(doc);
    expect(markup).toContain("address: def_document:v2:42");
    const parsed = parseMarkup(markup);
    expect(parsed.address).toBe("def_document:v2:42");
  });

  it("root.id 복원", () => {
    const doc = makeDoc({ root: makeNode({ id: "div#root" }) });
    const markup = encodeToMarkup(doc);
    const parsed = parseMarkup(markup);
    expect(parsed.root).toBeDefined();
  });
});

// ─── 이스케이프 ───────────────────────────────────────────────────────

describe("textContent 이스케이프", () => {
  it('큰따옴표 이스케이프 → \\"', () => {
    const nodeWithQuote = makeNode({ textContent: 'Say "hello"' });
    const doc = makeDoc({ root: nodeWithQuote });
    const markup = encodeToMarkup(doc);
    expect(markup).toContain('\\"hello\\"');
  });
});

// ─── relations 없는 문서 ──────────────────────────────────────────────

describe("relations 없는 문서", () => {
  it("relations 빈 배열 → Relations 섹션 생략", () => {
    const doc = makeDoc({ relations: [] });
    const markup = encodeToMarkup(doc);
    expect(markup).not.toContain("# Relations");
  });

  it("relations 있으면 Relations 섹션 포함", () => {
    const doc = makeDoc({
      relations: [{ type: "contains", source: "a", target: "b" }],
    });
    const markup = encodeToMarkup(doc);
    expect(markup).toContain("# Relations");
  });
});

// ─── parseMarkup 기본값 ───────────────────────────────────────────────

describe("parseMarkup — 재계산 플레이스홀더", () => {
  it("파싱 결과 grid.cellSize = 0 (재계산 필요 시그널)", () => {
    const doc = makeDoc();
    const markup = encodeToMarkup(doc);
    const parsed = parseMarkup(markup);
    expect(parsed.grid?.cellSize).toBe(0);
  });

  it("파싱 결과 layers = []", () => {
    const doc = makeDoc();
    const markup = encodeToMarkup(doc);
    const parsed = parseMarkup(markup);
    expect(parsed.layers).toEqual([]);
  });
});

// ─── addr 필드 (노드 수준) ────────────────────────────────────────────

describe("addr 노드 수준 직렬화", () => {
  it("노드에 address 있으면 addr: 포함", () => {
    const nodeWithAddr = makeNode({ address: "evt:v1:7" });
    const doc = makeDoc({ root: nodeWithAddr });
    const markup = encodeToMarkup(doc);
    expect(markup).toContain("addr:evt:v1:7");
  });
});
