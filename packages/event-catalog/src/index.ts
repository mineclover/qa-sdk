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
} from "./types.js";

// ── Categories ─────────────────────────────────────────
export { navigationEvents } from "./categories/navigation.js";
export { interactionEvents } from "./categories/interaction.js";
export { formEvents } from "./categories/form.js";
export { sessionEvents } from "./categories/session.js";
export { networkEvents } from "./categories/network.js";
export { executionEvents } from "./categories/execution.js";
export { outcomeEvents } from "./categories/outcome.js";
export { qualityEvents } from "./categories/quality.js";
export { infrastructureEvents } from "./categories/infrastructure.js";

// ── Registry ───────────────────────────────────────────
export {
  allCoreEvents,
  autoCollectableEvents,
  coreEventMap,
  coreEventsByCategory,
  getCoreEvent,
  isCoreEvent,
} from "./registry.js";

// ── Payload Guides ─────────────────────────────────────
export {
  getPayloadGuide,
  payloadGuideMap,
  payloadGuides,
} from "./payload-guides.js";

// ── v1 Minimal Set ─────────────────────────────────────
export {
  isV1MinimalEvent,
  v1MinimalSet,
  type V1MinimalEventKey,
} from "./v1-minimal.js";

// ── Tracking Context ────────────────────────────────────
export type { TrackingContextConfig, TrackingContextManager } from "./tracking-context.js";
export { createTrackingContext } from "./tracking-context.js";

// ── Auto Tracker ────────────────────────────────────────
export type { AutoTrackerConfig, AutoTracker } from "./auto-track.js";
export { createAutoTracker, createDefaultSvcRefResolver } from "./auto-track.js";

// ── Prefix Mapping ──────────────────────────────────────
export type {
  DimSource,
  PrefixDimMapping,
  EventPrefixEntry,
  EventPrefixMapping,
  TrackingContext,
} from "./prefix-mapping.js";
export {
  resolvePrefixDims,
  registerMappings,
  getMapping,
  getAllMappings,
  SHOP_EVENT_MAPPINGS,
} from "./prefix-mapping.js";

// ── Track Codegen ──────────────────────────────────────
export type { TrackCodegenOptions } from "./track-codegen.js";
export { generateTrackCode, summarizeMappings } from "./track-codegen.js";

// ── Transition ─────────────────────────────────────
export type { TransitionDef } from "./types.js";
export type { TransitionIssue } from "./transition.js";
export {
  registerTransitions,
  getTransition,
  getAllTransitions,
  clearTransitions,
  validateTransitionEvents,
} from "./transition.js";
