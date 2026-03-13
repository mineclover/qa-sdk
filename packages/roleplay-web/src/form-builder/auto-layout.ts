import type { DomNode } from "./dom-tree.js";

export interface AutoLayoutConfig {
  direction: "horizontal" | "vertical";
  gap: number;
  paddingTop: number;
  paddingRight: number;
  paddingBottom: number;
  paddingLeft: number;
  alignItems: "start" | "center" | "end" | "stretch";
  justifyContent: "start" | "center" | "end" | "space-between";
}

export function defaultAutoLayout(): AutoLayoutConfig {
  return {
    direction: "vertical",
    gap: 8,
    paddingTop: 0,
    paddingRight: 0,
    paddingBottom: 0,
    paddingLeft: 0,
    alignItems: "stretch",
    justifyContent: "start",
  };
}

const ALIGN_MAP: Record<AutoLayoutConfig["alignItems"], string> = {
  start: "flex-start",
  center: "center",
  end: "flex-end",
  stretch: "stretch",
};

const JUSTIFY_MAP: Record<AutoLayoutConfig["justifyContent"], string> = {
  start: "flex-start",
  center: "center",
  end: "flex-end",
  "space-between": "space-between",
};

export function applyAutoLayout(
  node: DomNode,
  config: AutoLayoutConfig,
): void {
  node.styles.display = "flex";
  node.styles.flexDirection = config.direction === "horizontal" ? "row" : "column";
  node.styles.gap = `${config.gap}px`;
  node.styles.paddingTop = `${config.paddingTop}px`;
  node.styles.paddingRight = `${config.paddingRight}px`;
  node.styles.paddingBottom = `${config.paddingBottom}px`;
  node.styles.paddingLeft = `${config.paddingLeft}px`;
  node.styles.alignItems = ALIGN_MAP[config.alignItems];
  node.styles.justifyContent = JUSTIFY_MAP[config.justifyContent];
}

export function readAutoLayout(node: DomNode): AutoLayoutConfig {
  const config = defaultAutoLayout();

  if (node.styles.flexDirection === "row" || node.styles.flexDirection === "row-reverse") {
    config.direction = "horizontal";
  } else {
    config.direction = "vertical";
  }

  config.gap = parsePixelValue(node.styles.gap);
  config.paddingTop = parsePixelValue(node.styles.paddingTop ?? node.styles.padding);
  config.paddingRight = parsePixelValue(node.styles.paddingRight ?? node.styles.padding);
  config.paddingBottom = parsePixelValue(node.styles.paddingBottom ?? node.styles.padding);
  config.paddingLeft = parsePixelValue(node.styles.paddingLeft ?? node.styles.padding);

  const alignReverse = Object.fromEntries(
    Object.entries(ALIGN_MAP).map(([k, v]) => [v, k]),
  ) as Record<string, AutoLayoutConfig["alignItems"]>;
  config.alignItems = alignReverse[node.styles.alignItems ?? ""] ?? "stretch";

  const justifyReverse = Object.fromEntries(
    Object.entries(JUSTIFY_MAP).map(([k, v]) => [v, k]),
  ) as Record<string, AutoLayoutConfig["justifyContent"]>;
  config.justifyContent = justifyReverse[node.styles.justifyContent ?? ""] ?? "start";

  return config;
}

function parsePixelValue(value: string | undefined): number {
  if (!value) return 0;
  const n = parseInt(value, 10);
  return isNaN(n) ? 0 : n;
}
