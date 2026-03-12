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
