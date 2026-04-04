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

// ── Pipe Mermaid ──
export {
  pipeGraphToMermaid, zoomViewToMermaid,
  type MermaidOptions,
} from "./pipe-mermaid.js";

// ── Scope Nesting Mermaid ──
export {
  nestingToMermaid, mountSnapshotToMermaid, timingToMermaid,
} from "./scope-mermaid.js";

// ── Scope Nesting D3 ──
export {
  scopeNestingToD3,
  type D3ScopeNode, type D3ContractEdge, type D3ScopeGraph,
} from "./scope-d3.js";
