import { describe, expect, it } from "vitest";
import { analyzeAreas, createAreaDocument, detectAreaOverflow } from "./index.js";
import type { LayoutRect, RLSCDocument, RLSCNode } from "./index.js";

function node(
  id: string,
  rect: LayoutRect,
  children: readonly RLSCNode[] = [],
): RLSCNode {
  return {
    id,
    tag: "div",
    classes: [],
    rect,
    zIndex: 0,
    depth: 0,
    display: "block",
    position: "static",
    overflow: "visible",
    visible: true,
    attributes: {},
    children,
  };
}

describe("@qa-sdk/rlsc-analysis public API", () => {
  it("exports the screen document model and area analysis APIs", () => {
    const child = node("child", { x: 90, y: 10, width: 20, height: 20 });
    const root = node("root", { x: 0, y: 0, width: 100, height: 100 }, [child]);

    const doc: RLSCDocument = createAreaDocument({
      root,
      viewport: { width: 100, height: 100 },
    });

    expect(doc.version).toBe("1.0");
    expect(detectAreaOverflow(root)).toHaveLength(1);
    expect(analyzeAreas(doc).doc).toBe(doc);
  });
});
