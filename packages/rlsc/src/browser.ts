// @def.boundary shared-utility-group
// @def.doc shared-utility-group

export type {
  CollectorOptions,
  LayoutChange,
  LayoutMonitor,
  MonitorOptions,
  RLSCDocument,
  ScreenIdentifier,
} from "./types.js";

export { collectLayout, collectLayoutWithText } from "./collector.js";
export { createLayoutMonitor } from "./monitor.js";
export { createCssSelector, createScreenIdentifier, identifyElement } from "@qa-sdk/rlsc-analysis";
export type {
  ScreenIdentifierElement,
  ScreenIdentifierKind,
  ScreenIdentifierSource,
} from "@qa-sdk/rlsc-analysis";
