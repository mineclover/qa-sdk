import type { CoreEventDef } from "./types.js";
import { navigationEvents } from "./categories/navigation.js";
import { interactionEvents } from "./categories/interaction.js";
import { formEvents } from "./categories/form.js";
import { sessionEvents } from "./categories/session.js";
import { networkEvents } from "./categories/network.js";
import { executionEvents } from "./categories/execution.js";
import { outcomeEvents } from "./categories/outcome.js";
import { qualityEvents } from "./categories/quality.js";
import { infrastructureEvents } from "./categories/infrastructure.js";

/** All core events by category. */
export const coreEventsByCategory = {
  navigation: navigationEvents,
  interaction: interactionEvents,
  form: formEvents,
  session: sessionEvents,
  network: networkEvents,
  execution: executionEvents,
  outcome: outcomeEvents,
  quality: qualityEvents,
  infrastructure: infrastructureEvents,
} as const;

/** Flat list of all core events. */
export const allCoreEvents: readonly CoreEventDef[] = [
  ...navigationEvents,
  ...interactionEvents,
  ...formEvents,
  ...sessionEvents,
  ...networkEvents,
  ...executionEvents,
  ...outcomeEvents,
  ...qualityEvents,
  ...infrastructureEvents,
];

/** Lookup map: event_key → CoreEventDef */
export const coreEventMap: ReadonlyMap<string, CoreEventDef> = new Map(
  allCoreEvents.map((e) => [e.event_key, e]),
);

/** Check if an event_key is a core event. */
export function isCoreEvent(eventKey: string): boolean {
  return coreEventMap.has(eventKey);
}

/** Get core event definition by key. */
export function getCoreEvent(eventKey: string): CoreEventDef | undefined {
  return coreEventMap.get(eventKey);
}

/** Get all auto-collectable core events. */
export const autoCollectableEvents: readonly CoreEventDef[] =
  allCoreEvents.filter((e) => e.auto_collectable);
