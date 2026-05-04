// @def.boundary event-vocab-system
import type { CoreEventDef } from "./types.js";
import { coreEventMap } from "./registry.js";

/** v1 핵심 20개 event_key 목록. */
const V1_MINIMAL_KEYS = [
  "page_view",
  "screen_view",
  "route_change",
  "app_open",
  "click",
  "tap",
  "input_change",
  "form_submit",
  "session_start",
  "session_end",
  "http_request",
  "http_response",
  "sdk_init",
  "sdk_flush",
  "task_start",
  "task_finish",
  "success",
  "failure",
  "error",
  "assertion",
] as const;

export type V1MinimalEventKey = (typeof V1_MINIMAL_KEYS)[number];

/** v1 최소 핵심 세트 — 이 20개만으로 QA DSL 기본 운영 가능. */
export const v1MinimalSet: readonly CoreEventDef[] = V1_MINIMAL_KEYS.map(
  (key) => {
    const event = coreEventMap.get(key);
    if (!event) {
      throw new Error(`v1 minimal event not found in registry: ${key}`);
    }
    return event;
  },
);

/** Check if an event_key is in the v1 minimal set. */
export function isV1MinimalEvent(eventKey: string): boolean {
  return (V1_MINIMAL_KEYS as readonly string[]).includes(eventKey);
}
