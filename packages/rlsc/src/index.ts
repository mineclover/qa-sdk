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
export { flattenTree } from "@qa-sdk/rlsc-analysis";

// 인코딩/디코딩
export { encodeToMarkup, parseMarkup } from "./encoder.js";

// 분석
export { analyzeAreas, createAreaDocument, detectAreaOverflow } from "@qa-sdk/rlsc-analysis";
export type {
  AreaAnalysisOptions,
  AreaAnalysisResult,
  AreaDocumentInput,
  AreaOverflowIssue,
} from "@qa-sdk/rlsc-analysis";
export { analyzeGrid, gridToText } from "@qa-sdk/rlsc-analysis";
export { classifyLayers, layersToText } from "@qa-sdk/rlsc-analysis";
export { detectRelations, relationsToText } from "@qa-sdk/rlsc-analysis";

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
} from "@qa-sdk/rlsc-analysis";
export type { LayoutDiff } from "@qa-sdk/rlsc-analysis";

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
} from "@qa-sdk/rlsc-analysis";

// 패턴 분류
export { classifyLayout } from "@qa-sdk/rlsc-analysis";

// 적합성 검증
export { checkConformance, recognizeLayout } from "@qa-sdk/rlsc-analysis";

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
} from "@qa-sdk/rlsc-analysis";
export type {
  TextPreparedMap,
  TextOccupancyOptions,
} from "@qa-sdk/rlsc-analysis";
