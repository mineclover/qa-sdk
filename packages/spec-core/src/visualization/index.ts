/**
 * visualization — 레이어 맵 + 모니터.
 */

export { buildLayerMap, extractTracePaths, computeActivity } from "./layer-map.js";
export type { LayerLevel, PrefixPlacement, LayerDefinition, LayerMapResult, TraceStep, TracePath, PrefixActivity } from "./layer-map.js";
export { MonitorState } from "./monitor-queries.js";

export {
  intentLinkDiagram,
  allIntentLinksDiagram,
  dslDiagram,
  signalDiagram,
  domainDiagram,
  serviceDiagram,
  constraintDiagram,
  tableDiagram,
  observationLoopDiagram,
  listAllDiagrams,
} from "./mermaid-gen.js";
export type { MermaidDiagramOptions, SignalDefLike, DiagramEntry, ServiceTopologyLike, TracePathLike, TraceStepLike } from "./mermaid-gen.js";
export { traceSequenceDiagram } from "./mermaid-gen.js";
