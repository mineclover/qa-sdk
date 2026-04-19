// @def.boundary shared-utility-group
// @def.doc shared-utility-group

import { describe, it, expect } from "vitest";
import {
  queryNodes,
  diffDocuments,
  replaceNode,
  removeNode,
} from "./query.js";
import type { RLSCDocument, RLSCNode } from "./types.js";

// ─── 헬퍼 ────────────────────────────────────────────────────────────

function makeNode(
  id: string,
  overrides: Partial<RLSCNode> = {},
): RLSCNode {
  return {
    id,
    tag: "div",
    classes: [],
    rect: overrides.rect ?? { x: 0, y: 0, width: 100, height: 100 },
    zIndex: overrides.zIndex ?? 0,
    depth: 0,
    display: "block",
    position: "static",
    overflow: "visible",
    visible: overrides.visible ?? true,
    attributes: {},
    children: overrides.children ?? [],
    role: overrides.role,
    textContent: overrides.textContent,
    address: overrides.address,
    ...overrides,
  };
}

function makeDoc(root: RLSCNode): RLSCDocument {
  return {
    version: "1.0",
    viewport: { width: 1920, height: 1080 },
    url: "https://test.example",
    timestamp: "2026-01-01T00:00:00Z",
    root,
    grid: { cellSize: 16, cols: 120, rows: 68, cells: [] },
    layers: [],
    relations: [],
  };
}

// ─── queryNodes ───────────────────────────────────────────────────────

describe("queryNodes — role 필터", () => {
  it("role 정확 일치", () => {
    const banner = makeNode("banner", { role: "banner" });
    const main = makeNode("main", { role: "main" });
    const root = makeNode("root", { children: [banner, main] });
    const doc = makeDoc(root);
    const result = queryNodes(doc, { role: "banner" });
    expect(result.map((n) => n.id)).toContain("banner");
    expect(result.map((n) => n.id)).not.toContain("main");
  });
});

describe("queryNodes — 면적 범위", () => {
  it("minArea 이상만 반환", () => {
    const big = makeNode("big", { rect: { x: 0, y: 0, width: 200, height: 200 } }); // 40000
    const small = makeNode("small", { rect: { x: 0, y: 0, width: 10, height: 10 } }); // 100
    const root = makeNode("root", { children: [big, small] });
    const doc = makeDoc(root);
    const result = queryNodes(doc, { minArea: 1000 });
    expect(result.map((n) => n.id)).toContain("big");
    expect(result.map((n) => n.id)).not.toContain("small");
  });

  it("maxArea 이하만 반환", () => {
    const big = makeNode("big", { rect: { x: 0, y: 0, width: 200, height: 200 } });
    const small = makeNode("small", { rect: { x: 0, y: 0, width: 10, height: 10 } });
    const root = makeNode("root", { children: [big, small] });
    const doc = makeDoc(root);
    const result = queryNodes(doc, { maxArea: 500 });
    expect(result.map((n) => n.id)).toContain("small");
    expect(result.map((n) => n.id)).not.toContain("big");
  });
});

describe("queryNodes — zRange", () => {
  it("zRange.min 이상만 반환", () => {
    const high = makeNode("high", { zIndex: 100 });
    const low = makeNode("low", { zIndex: 0 });
    const root = makeNode("root", { children: [high, low] });
    const doc = makeDoc(root);
    const result = queryNodes(doc, { zRange: { min: 10 } });
    expect(result.map((n) => n.id)).toContain("high");
    expect(result.map((n) => n.id)).not.toContain("low");
  });
});

describe("queryNodes — textContains", () => {
  it("대소문자 무관 텍스트 검색", () => {
    const hello = makeNode("hello", { textContent: "Hello World" });
    const other = makeNode("other", { textContent: "Goodbye" });
    const root = makeNode("root", { children: [hello, other] });
    const doc = makeDoc(root);
    const result = queryNodes(doc, { textContains: "hello" });
    expect(result.map((n) => n.id)).toContain("hello");
    expect(result.map((n) => n.id)).not.toContain("other");
  });
});

// ─── diffDocuments ────────────────────────────────────────────────────

describe("diffDocuments — added", () => {
  it("after에만 있는 노드 → added", () => {
    const before = makeDoc(makeNode("root", { children: [] }));
    const newNode = makeNode("new");
    const after = makeDoc(makeNode("root", { children: [newNode] }));
    const diffs = diffDocuments(before, after);
    expect(diffs.some((d) => d.type === "added" && d.nodeId === "new")).toBe(true);
  });
});

describe("diffDocuments — removed", () => {
  it("before에만 있는 노드 → removed", () => {
    const old = makeNode("old");
    const before = makeDoc(makeNode("root", { children: [old] }));
    const after = makeDoc(makeNode("root", { children: [] }));
    const diffs = diffDocuments(before, after);
    expect(diffs.some((d) => d.type === "removed" && d.nodeId === "old")).toBe(true);
  });
});

describe("diffDocuments — moved", () => {
  it("같은 id, 위치만 변경 → moved", () => {
    const before = makeDoc(
      makeNode("root", {
        children: [makeNode("n", { rect: { x: 0, y: 0, width: 100, height: 100 } })],
      }),
    );
    const after = makeDoc(
      makeNode("root", {
        children: [makeNode("n", { rect: { x: 50, y: 50, width: 100, height: 100 } })],
      }),
    );
    const diffs = diffDocuments(before, after);
    expect(diffs.some((d) => d.type === "moved" && d.nodeId === "n")).toBe(true);
  });
});

describe("diffDocuments — resized", () => {
  it("같은 id, 크기 변경 → resized", () => {
    const before = makeDoc(
      makeNode("root", {
        children: [makeNode("n", { rect: { x: 0, y: 0, width: 100, height: 100 } })],
      }),
    );
    const after = makeDoc(
      makeNode("root", {
        children: [makeNode("n", { rect: { x: 0, y: 0, width: 200, height: 100 } })],
      }),
    );
    const diffs = diffDocuments(before, after);
    expect(diffs.some((d) => d.type === "resized" && d.nodeId === "n")).toBe(true);
  });
});

describe("diffDocuments — reordered", () => {
  it("같은 id, zIndex 변경 → reordered", () => {
    const before = makeDoc(
      makeNode("root", { children: [makeNode("n", { zIndex: 0 })] }),
    );
    const after = makeDoc(
      makeNode("root", { children: [makeNode("n", { zIndex: 10 })] }),
    );
    const diffs = diffDocuments(before, after);
    expect(diffs.some((d) => d.type === "reordered" && d.nodeId === "n")).toBe(true);
  });
});

// ─── replaceNode / removeNode ─────────────────────────────────────────

describe("replaceNode", () => {
  it("원본 문서 변경 없음 (불변)", () => {
    const child = makeNode("child");
    const doc = makeDoc(makeNode("root", { children: [child] }));
    const newDoc = replaceNode(doc, "child", { zIndex: 99 });
    expect(doc.root.children[0]?.zIndex).toBe(0);
    expect(newDoc.root.children[0]?.zIndex).toBe(99);
  });
});

describe("removeNode", () => {
  it("노드 제거 후 원본 불변", () => {
    const child = makeNode("child");
    const doc = makeDoc(makeNode("root", { children: [child] }));
    const newDoc = removeNode(doc, "child");
    expect(doc.root.children).toHaveLength(1);
    expect(newDoc.root.children).toHaveLength(0);
  });
});
