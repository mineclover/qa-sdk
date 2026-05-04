// @def.boundary shared-utility-group
// @def.doc shared-utility-group

import { describe, expect, it } from "vitest";
import {
  DATA_QA_ADDRESS_ATTRIBUTE,
  analyzeAreas,
  createMetadataAttributes,
} from "./index.js";
import * as analysis from "./analysis.js";
import * as browser from "./browser.js";
import * as rendering from "./rendering.js";
import type { RLSCDocument, RLSCNode } from "./types.js";

describe("split-package compatibility exports", () => {
  it("keeps selected analysis APIs available from the root rlsc entrypoint", () => {
    expect(DATA_QA_ADDRESS_ATTRIBUTE).toBe("data-qa-address");
    expect(createMetadataAttributes({ qaAddress: "qa:root" })).toEqual({
      "data-qa-address": "qa:root",
    });

    const result = analyzeAreas(documentWithRoot(node({
      id: "root",
      rect: { x: 0, y: 0, width: 100, height: 80 },
    })));

    expect(result.doc.root.id).toBe("root");
    expect(result.nodes[0]?.identifier.value).toBe("root");
  });

  it("keeps rlsc/analysis as an analysis package compatibility entrypoint", () => {
    expect(analysis.analyzeAreas).toBe(analyzeAreas);
    expect(analysis.detectAreaOverflow(documentWithRoot(node({
      id: "root",
      rect: { x: 0, y: 0, width: 100, height: 80 },
    })))).toEqual([]);
  });

  it("keeps rlsc/browser and rlsc/rendering subpath entrypoints", () => {
    expect(typeof browser.collectLayout).toBe("function");
    expect(typeof browser.collectLayoutWithText).toBe("function");
    expect(typeof browser.createLayoutMonitor).toBe("function");
    expect(typeof rendering.renderToSVG).toBe("function");
    expect(typeof rendering.renderToCanvas).toBe("function");
  });
});

function documentWithRoot(root: RLSCNode): RLSCDocument {
  return {
    version: "1.0",
    viewport: { width: 200, height: 120 },
    url: "about:blank",
    timestamp: "2026-05-04T00:00:00.000Z",
    root,
    grid: { cellSize: 8, cols: 1, rows: 1, cells: [] },
    layers: [],
    relations: [],
  };
}

function node(overrides: Partial<RLSCNode> & Pick<RLSCNode, "id" | "rect">): RLSCNode {
  return {
    id: overrides.id,
    tag: overrides.tag ?? "div",
    classes: overrides.classes ?? [],
    role: overrides.role,
    rect: overrides.rect,
    zIndex: overrides.zIndex ?? 0,
    depth: overrides.depth ?? 0,
    display: overrides.display ?? "block",
    position: overrides.position ?? "static",
    overflow: overrides.overflow ?? "visible",
    visible: overrides.visible ?? true,
    textContent: overrides.textContent,
    address: overrides.address,
    fontInfo: overrides.fontInfo,
    attributes: overrides.attributes ?? {},
    children: overrides.children ?? [],
  };
}
