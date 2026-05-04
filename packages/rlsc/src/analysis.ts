// @def.boundary shared-utility-group
// @def.doc shared-utility-group

export type {
  ConformanceResult,
  ConformanceViolation,
  GestaltPattern,
  GridCell,
  GridSystemPattern,
  LayoutGrid,
  LayoutMetrics,
  LayoutPattern,
  LayoutRect,
  LayerRole,
  LayerStack,
  ProportionPattern,
  ProximityGroup,
  RelationType,
  RLSCDocument,
  RLSCNode,
  RLSCQuery,
  RLSCRelation,
  SpacingPattern,
  TextFontInfo,
  TextOccupancy,
  TextRegionDensity,
} from "./types.js";

export type {
  AreaAnalysisOptions,
  AreaAnalysisResult,
  AreaDocumentInput,
  AreaOverflowIssue,
} from "./area-analysis.js";
export { analyzeAreas, createAreaDocument, detectAreaOverflow } from "./area-analysis.js";

export { analyzeGrid, gridToText } from "./grid.js";
export { classifyLayers, layersToText } from "./layers.js";
export { detectRelations, relationsToText } from "./relations.js";
export { flattenTree } from "./tree-utils.js";

export {
  measureBalance,
  detectGridPattern,
  scoreGoldenRatio,
  detectProximityGroups,
  detectDominantFlow,
  detectColumnSystem,
  measureSpacing,
  measureAspectRatios,
  measureLayout,
} from "./metrics.js";

export { classifyLayout } from "./pattern.js";
export { checkConformance, recognizeLayout } from "./intent.js";

export {
  queryNodes,
  findByRect,
  findByRole,
  findByAddress,
  findById,
  replaceNode,
  removeNode,
  diffDocuments,
} from "./query.js";
export type { LayoutDiff } from "./query.js";

export {
  prepareTextMap,
  analyzeTextOccupancy,
  aggregateTextRegions,
  predictTextReflow,
  findBreakpointWidth,
} from "./text-occupancy.js";
export type {
  TextOccupancyOptions,
  TextPreparedMap,
} from "./text-occupancy.js";
