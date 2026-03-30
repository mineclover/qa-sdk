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
  LayoutChange,
  LayoutMonitor,
} from "./types.js";

// 수집 (브라우저 전용)
export { collectLayout } from "./collector.js";
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
