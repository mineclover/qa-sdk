// @def.boundary shared-utility-group
// @def.doc shared-utility-group

import { describe, expect, it } from "vitest";
import { analyzeAreas, detectAreaOverflow } from "./area-analysis.js";
import type { RLSCNode } from "./types.js";

function node(
  id: string,
  rect: RLSCNode["rect"],
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

describe("detectAreaOverflow", () => {
  it("returns no issue when children stay inside parent bounds", () => {
    const child = node("child", { x: 10, y: 10, width: 40, height: 40 });
    const root = node("root", { x: 0, y: 0, width: 100, height: 100 }, [child]);

    expect(detectAreaOverflow(root)).toEqual([]);
  });

  it("reports the exceeded side and max overflow distance", () => {
    const child = node("child", { x: 80, y: -4, width: 40, height: 20 });
    const root = node("root", { x: 0, y: 0, width: 100, height: 100 }, [child]);

    expect(detectAreaOverflow(root)).toEqual([
      {
        parentId: "root",
        childId: "child",
        overflow: { top: 4, right: 20, bottom: 0, left: 0 },
        exceededPx: 20,
      },
    ]);
  });

  it("is included in analyzeAreas results", () => {
    const child = node("child", { x: -8, y: 10, width: 40, height: 40 });
    const root = node("root", { x: 0, y: 0, width: 100, height: 100 }, [child]);

    const result = analyzeAreas({ root, viewport: { width: 100, height: 100 } });

    expect(result.overflowIssues).toHaveLength(1);
    expect(result.overflowIssues[0]?.childId).toBe("child");
  });
});
