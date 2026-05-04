// @def.boundary shared-utility-group
// @def.doc shared-utility-group

// ─── R.L.S.C.™ — Relative Layout Structured Content ─────────────────
//
// 디자인의 시각적 구조(레이아웃, 계층, Role)를 좌표계 DSL로 표현하고,
// 검색·대치·생성이 가능한 마크업 언어.
//

// 타입
export type {
  LayoutRect,
  RLSCNode,
  CollectorOptions,
  GridCell,
  LayoutGrid,
  LayerRole,
  LayerStack,
  RelationType,
  RLSCRelation,
  RLSCDocument,
  ContextPurpose,
  ContextOptions,
  DesignContext,
  RLSCQuery,
  // 메트릭
  ProximityGroup,
  LayoutMetrics,
  // 패턴
  GridSystemPattern,
  SpacingPattern,
  ProportionPattern,
  GestaltPattern,
  LayoutPattern,
  // 적합성
  ConformanceViolation,
  ConformanceResult,
  // 캔버스
  CanvasRenderOptions,
  // 모니터
  LayoutChange,
  LayoutMonitor,
  MonitorOptions,
  // 텍스트 점유
  TextFontInfo,
  TextOccupancy,
  TextRegionDensity,
} from "./types.js";

// 수집 (브라우저 전용)
export { collectLayout, collectLayoutWithText } from "./collector.js";
export { flattenTree } from "./tree-utils.js";

// 인코딩/디코딩
export { encodeToMarkup, parseMarkup } from "./encoder.js";

// 분석
export { analyzeGrid, gridToText } from "./grid.js";
export { classifyLayers, layersToText } from "./layers.js";
export { detectRelations, relationsToText } from "./relations.js";

// Context Engineering
export { generateDesignContext } from "./context.js";

// 쿼리
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

// 메트릭
export {
  measureLayout,
  measureBalance,
  detectGridPattern,
  scoreGoldenRatio,
  detectProximityGroups,
  detectDominantFlow,
  detectColumnSystem,
  measureSpacing,
  measureAspectRatios,
} from "./metrics.js";

// 패턴 분류
export { classifyLayout } from "./pattern.js";

// 적합성 검증
export { checkConformance, recognizeLayout } from "./intent.js";

// 렌더링
export { assignColors, renderToSVG, renderToCanvas } from "./canvas.js";

// 모니터 (브라우저 전용)
export { createLayoutMonitor } from "./monitor.js";

// 텍스트 점유 분석
export {
  prepareTextMap,
  analyzeTextOccupancy,
  aggregateTextRegions,
  predictTextReflow,
  findBreakpointWidth,
} from "./text-occupancy.js";
export type {
  TextPreparedMap,
  TextOccupancyOptions,
} from "./text-occupancy.js";

// Split-package compatibility APIs
export {
  DATA_QA_ADDRESS_ATTRIBUTE,
  DATA_COMPONENT_ID_ATTRIBUTE,
  DATA_DEBUG_LABEL_ATTRIBUTE,
  DATA_BOUNDARY_ATTRIBUTE,
  QA_ADDRESS_ATTRIBUTE,
  COMPONENT_ID_ATTRIBUTE,
  DEBUG_LABEL_ATTRIBUTE,
  BOUNDARY_ATTRIBUTE,
  createMetadataAttributes,
  annotateElement,
  createScreenIdentifier,
  createAreaDocument,
  analyzeAreas,
  detectAreaOverflow,
} from "@qa-sdk/rlsc-analysis";
export type {
  ScreenIdentifier,
  ScreenMetadata,
  MetadataAttributes,
  MetadataAttributeTarget,
  AreaOverflowIssue,
  AreaDocumentInput,
  AreaAnalysisOptions,
  AreaAnalysisNode,
  AreaAnalysisResult,
} from "@qa-sdk/rlsc-analysis";
