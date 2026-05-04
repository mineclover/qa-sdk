import { describe, expect, it } from "vitest";
import type { AreaOverflowIssue, RLSCDocument } from "./index.js";

describe("@qa-sdk/rlsc-analysis public API", () => {
  it("exports RLSCDocument and issue data types without rendering dependencies", () => {
    const doc = {
      version: "1.0",
      viewport: { width: 100, height: 100 },
      url: "about:blank",
      timestamp: "2026-05-04T00:00:00.000Z",
      root: {
        id: "root",
        tag: "main",
        classes: [],
        rect: { x: 0, y: 0, width: 100, height: 100 },
        zIndex: 0,
        depth: 0,
        display: "block",
        position: "static",
        overflow: "visible",
        visible: true,
        attributes: {},
        children: [],
      },
      grid: { cellSize: 8, cols: 1, rows: 1, cells: [] },
      layers: [],
      relations: [],
    } satisfies RLSCDocument;
    const issue = {
      parentId: "root",
      childId: "child",
      overflow: { top: 0, right: 1, bottom: 0, left: 0 },
      exceededPx: 1,
    } satisfies AreaOverflowIssue;

    expect(doc.root.id).toBe("root");
    expect(issue.childId).toBe("child");
  });
});
