// sim-service-catalog — 시뮬 서비스 버전 카탈로그 진입점.
// spec: docs/superpowers/specs/2026-04-28-canary-scaling/02-canary-topology.md §2 §5

export { getServiceVersionTag } from "./get-service-version-tag.js";
export { transitionState } from "./transition-state.js";
export type { TransitionInput, TransitionResult } from "./transition-state.js";
export { getCurrentTopology } from "./get-current-topology.js";
export type { TopologyOptions } from "./get-current-topology.js";
export type {
  CatalogPrefixDefinition,
  ServiceState,
  Topology,
  TransitionLog,
  VersionEntry,
} from "./types.js";
