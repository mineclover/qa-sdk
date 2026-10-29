// ── Types ───────────────────────────────────────────────
export type {
  CoreEventDef,
  EventCategory,
  Channel,
  GraphHint,
  GraphRole,
  PayloadFieldDef,
  PayloadFieldGuide,
  PayloadFieldType,
} from './types.js';

// ── Categories ─────────────────────────────────────────
export { navigationEvents } from './categories/navigation.js';
export { interactionEvents } from './categories/interaction.js';
export { formEvents } from './categories/form.js';
export { sessionEvents } from './categories/session.js';
export { networkEvents } from './categories/network.js';
export { executionEvents } from './categories/execution.js';
export { outcomeEvents } from './categories/outcome.js';
export { qualityEvents } from './categories/quality.js';
export { infrastructureEvents } from './categories/infrastructure.js';

// ── Registry ───────────────────────────────────────────
export {
  allCoreEvents,
  autoCollectableEvents,
  coreEventMap,
  coreEventsByCategory,
  getCoreEvent,
  isCoreEvent,
} from './registry.js';

// ── Payload Guides ─────────────────────────────────────
export { getPayloadGuide, payloadGuideMap, payloadGuides } from './payload-guides.js';

// ── v1 Minimal Set ─────────────────────────────────────
export { isV1MinimalEvent, v1MinimalSet, type V1MinimalEventKey } from './v1-minimal.js';

// ── Tracking Context ────────────────────────────────────
export type { TrackingContextConfig, TrackingContextManager } from './tracking-context.js';
export { createTrackingContext } from './tracking-context.js';

// ── Auto Tracker ────────────────────────────────────────
export type { AutoTrackerConfig, AutoTracker } from './auto-track.js';
export { createAutoTracker, createDefaultSvcRefResolver } from './auto-track.js';

// ── Prefix Mapping ──────────────────────────────────────
export type {
  DimSource,
  PrefixDimMapping,
  EventPrefixEntry,
  EventPrefixMapping,
  EventMappingPack,
  TrackingContext,
} from './prefix-mapping.js';
export {
  resolvePrefixDims,
  registerMappings,
  registerPack,
  getMapping,
  getAllMappings,
  getPack,
  getAllPacks,
  getPacksForEvent,
  SHOP_EVENT_MAPPINGS,
  SHOP_EVENT_PACK,
  HARNESS_EVENT_PACK,
  GATE_EVENT_PACK,
  TRANSITION_EVENT_PACK,
  CONVERGENCE_EVENT_PACK,
  QUALITY_EVENT_PACK,
  EXECUTION_EVENT_PACK,
  SDK_EVENT_PACK,
  RPC_EVENT_PACK,
  DECISION_OBSERVE_PACK,
  INFRA_OBSERVE_PACK,
  CLI_OBSERVE_PACK,
  GRAPH_EVENT_PACK,
} from './prefix-mapping.js';

// ── Transition ─────────────────────────────────────
export type { TransitionDef } from './types.js';
export type { TransitionIssue } from './transition.js';
export {
  registerTransitions,
  getTransition,
  getAllTransitions,
  clearTransitions,
  validateTransitionEvents,
} from './transition.js';
