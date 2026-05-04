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
  createCssSelector,
  createAreaDocument,
  createMetadataAttributes,
  createScreenIdentifier,
  detectAreaOverflow,
  identifyElement,
} from "./index.js";
import type {
  LayoutRect,
  RLSCDocument,
  RLSCNode,
  ScreenIdentifierElement,
  ScreenMetadata,
} from "./index.js";

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

  it("extracts screen identifiers using the preferred stable order", () => {
    expect(
      createScreenIdentifier({
        nodeId: "button.primary__1",
        cssSelector: "main > button.primary",
        qaAddress: "checkout:submit",
        componentId: "SubmitButton",
      }),
    ).toMatchObject({
      kind: "componentId",
      value: "SubmitButton",
      componentId: "SubmitButton",
      qaAddress: "checkout:submit",
      cssSelector: "main > button.primary",
      nodeId: "button.primary__1",
    });

    expect(
      createScreenIdentifier({
        nodeId: "button.primary__1",
        cssSelector: "main > button.primary",
        attributes: { [QA_ADDRESS_ATTRIBUTE]: "checkout:submit" },
      }),
    ).toMatchObject({
      kind: "qaAddress",
      value: "checkout:submit",
    });

    expect(
      createScreenIdentifier({
        nodeId: "button.primary__1",
        cssSelector: "main > button.primary",
      }),
    ).toMatchObject({
      kind: "cssSelector",
      value: "main > button.primary",
    });

    expect(createScreenIdentifier({ nodeId: "button.primary__1" })).toMatchObject({
      kind: "nodeId",
      value: "button.primary__1",
    });
  });

  it("creates fallback CSS selectors and identifies structural elements", () => {
    const main = element("MAIN", { id: "app" });
    const first = element("BUTTON", { classes: ["cta"], parentElement: main });
    const second = element("BUTTON", {
      classes: ["cta", "primary"],
      attributes: { [COMPONENT_ID_ATTRIBUTE]: "PrimaryCta" },
      parentElement: main,
    });
    main.children = [first, second];

    expect(createCssSelector(second)).toBe("main#app > button.cta.primary:nth-of-type(2)");
    expect(identifyElement(second, { nodeId: "button.cta__2" })).toMatchObject({
      kind: "componentId",
      value: "PrimaryCta",
      componentId: "PrimaryCta",
      cssSelector: "main#app > button.cta.primary:nth-of-type(2)",
      nodeId: "button.cta__2",
    });
  });
});

function element(
  tagName: string,
  options: {
    id?: string;
    classes?: readonly string[];
    attributes?: Readonly<Record<string, string>>;
    parentElement?: MutableScreenIdentifierElement;
  } = {},
): MutableScreenIdentifierElement {
  const attributes = options.attributes ?? {};

  return {
    tagName,
    id: options.id,
    classList: options.classes ?? [],
    parentElement: options.parentElement,
    children: [],
    getAttribute(name: string): string | null {
      return attributes[name] ?? null;
    },
  };
}

interface MutableScreenIdentifierElement extends ScreenIdentifierElement {
  children: ScreenIdentifierElement[];
}
