import { describe, expect, it } from "vitest";
import {
  BOUNDARY_ATTRIBUTE,
  COMPONENT_ID_ATTRIBUTE,
  DATA_BOUNDARY_ATTRIBUTE,
  DATA_COMPONENT_ID_ATTRIBUTE,
  DATA_DEBUG_LABEL_ATTRIBUTE,
  DATA_QA_ADDRESS_ATTRIBUTE,
  DEBUG_LABEL_ATTRIBUTE,
  QA_ADDRESS_ATTRIBUTE,
  analyzeAreas,
  annotateElement,
  createAreaDocument,
  createMetadataAttributes,
  detectAreaOverflow,
} from "./index.js";
import type { LayoutRect, RLSCDocument, RLSCNode, ScreenMetadata } from "./index.js";

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

  it("exports pure metadata annotation helpers", () => {
    expect(DATA_QA_ADDRESS_ATTRIBUTE).toBe(QA_ADDRESS_ATTRIBUTE);
    expect(DATA_COMPONENT_ID_ATTRIBUTE).toBe(COMPONENT_ID_ATTRIBUTE);
    expect(DATA_DEBUG_LABEL_ATTRIBUTE).toBe(DEBUG_LABEL_ATTRIBUTE);
    expect(DATA_BOUNDARY_ATTRIBUTE).toBe(BOUNDARY_ATTRIBUTE);

    const metadata: ScreenMetadata = {
      address: "screen:home:primary-cta",
      componentId: "PrimaryCta",
      debugLabel: "Start trial",
      boundary: "hero",
    };

    expect(createMetadataAttributes(metadata)).toEqual({
      [QA_ADDRESS_ATTRIBUTE]: "screen:home:primary-cta",
      [COMPONENT_ID_ATTRIBUTE]: "PrimaryCta",
      [DEBUG_LABEL_ATTRIBUTE]: "Start trial",
      [BOUNDARY_ATTRIBUTE]: "hero",
    });

    const applied: Record<string, string> = {};
    const element = {
      setAttribute(name: string, value: string) {
        applied[name] = value;
      },
    };

    expect(annotateElement(element, metadata)).toBe(element);
    expect(applied).toEqual(createMetadataAttributes(metadata));
  });

  it("omits undefined metadata fields when creating attributes", () => {
    expect(createMetadataAttributes({ componentId: "Toolbar" })).toEqual({
      [COMPONENT_ID_ATTRIBUTE]: "Toolbar",
    });
  });
});
