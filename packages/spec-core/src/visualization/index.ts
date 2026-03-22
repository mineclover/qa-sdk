/**
 * visualization — 레이어 맵 + 모니터.
 */

export {
  buildLayerMap, buildSvcOwnerMap, buildDomainMemberMap,
  SERVICE_PROJECTION, LEGACY_PROJECTION,
  PROD_ASIA_PROJECTION, DEV_PROJECTION, CHECKOUT_PROJECTION,
  extractTracePaths, computeActivity,
} from "./layer-map.js";
export type {
  LayerLevel, PrefixPlacement, LayerDefinition, LayerMapResult,
  Projection,
  TraceStep, TracePath, PrefixActivity,
} from "./layer-map.js";
export { MonitorState, createMonitorStateAsync } from "./monitor-queries.js";

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
  tableErDiagram,
  transitionSpecDiagram,
  transitionDagDiagram,
  listAllDiagrams,
} from "./mermaid-gen.js";
export type { MermaidDiagramOptions, SignalDefLike, DiagramEntry, ServiceTopologyLike, TracePathLike, TraceStepLike } from "./mermaid-gen.js";
export { traceSequenceDiagram } from "./mermaid-gen.js";
