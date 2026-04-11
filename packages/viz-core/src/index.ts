/**
 * viz-core — QA-SDK 시각화 코어
 *
 * SVG primitives, 디자인 토큰, pipe/scope 렌더러.
 * @qa-sdk/core에서 데이터 타입만 의존. 역방향 금지.
 */

// ── SVG Primitives ──
export {
  svgRect, svgCircle, svgPolygon, svgLine, svgPath, svgText, svgGroup, svgSvg,
  svgMarker, svgDefs, bezierH, arcAbove,
  r as svgR, escapeXml, escapeAttr,
  type Attrs as SvgAttrs, type MarkerDef as SvgMarkerDef,
} from "./primitives.js";

// ── Design Tokens + Shapes ──
export {
  ROLE_TOKENS, CERTAINTY_STROKE_DASH, CONCERN_TOKENS, EDGE_TOKENS,
  renderMarkerDefs,
  drawNodeShape, drawFoldedNode, drawEntryMarker,
  drawConcernBadges, drawNodeLabel, drawFoldedCount,
  drawPortDots,
  drawEdgePath, drawConditionBadge,
  standaloneNodeSvg, standaloneEdgeSvg,
} from "./shapes.js";
export type {
  RoleTokens, ConcernTokens, EdgeTokens,
  NodeShapeOptions, EdgePathOptions,
  StandaloneNodeOptions, StandaloneEdgeOptions,
} from "./shapes.js";

// ── Pipe Mermaid ──
export {
  pipeGraphToMermaid, zoomViewToMermaid,
  type MermaidOptions,
} from "./pipe-mermaid.js";

// ── Scope Nesting Mermaid ──
export {
  nestingToMermaid, mountSnapshotToMermaid, timingToMermaid,
} from "./scope-mermaid.js";

// ── Pipe SVG / D3 ──
export {
  pipeGraphToSvg, zoomViewToSvg, pipeGraphToD3, zoomViewToD3,
} from "./pipe-svg.js";
export type {
  SvgOptions, D3Node, D3Link, D3GraphData, D3LineageSummary,
} from "./pipe-svg.js";

// ── Scope Nesting D3 ──
export {
  scopeNestingToD3,
  type D3ScopeNode, type D3ContractEdge, type D3ScopeGraph,
} from "./scope-d3.js";

// ── Concept Hierarchy Grid ──
export {
  buildConceptHierarchyGrid,
  type ConceptGridColumn,
  type ConceptGridRow,
  type ConceptGridCell,
  type ConceptGridBoundary,
  type ConceptGridLink,
  type ConceptHierarchyGrid,
} from "./concept-grid.js";

// ── Scope Nesting Timeline ──
export {
  SCOPE_DEPTH_COLORS, CONTRACT_TYPE_COLORS, TIMING_COLORS,
  buildTimelineRows, scopeTimelineToSvg, scopeTimelineToD3,
} from "./scope-nesting-timeline.js";
export type {
  RowType, TimelineBlock, ScopeTimelineRow,
  ScopeTimelineData, ScopeTimelineSvgOptions, D3TimelineData,
} from "./scope-nesting-timeline.js";

// ── Ontology Graph ──
export {
  operationalStoreToOntologyView,
  authorizationGraphToOntologyView,
  layoutOntologyGraph,
  renderOntologyGraphSvg,
} from "./ontology-graph.js";
export type {
  OntologyLane,
  OntologyNodeStatus,
  OntologyViewNode,
  OntologyViewEdge,
  OntologyGraphViewModel,
  PositionedOntologyNode,
  PositionedOntologyGraph,
  OntologyLayoutOptions,
  OperationalStoreLike,
  AuthorizationGraphLike,
} from "./ontology-graph.js";
