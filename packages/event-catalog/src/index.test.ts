import { describe, expect, it } from "vitest";
import {
  allCoreEvents,
  coreEventMap,
  coreEventsByCategory,
  isCoreEvent,
  isV1MinimalEvent,
  payloadGuideMap,
  payloadGuides,
  v1MinimalSet,
} from "./index.js";
import type { EventCategory, GraphRole } from "./types.js";

const expectedCategoryCounts = {
  navigation: 7,
  interaction: 10,
  form: 5,
  session: 6,
  network: 8,
  execution: 9,
  outcome: 7,
  quality: 8,
} satisfies Record<EventCategory, number>;

const expectedV1MinimalKeys = [
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

const expectedRequiredFields = {
  page_view: ["page"],
  screen_view: ["screen"],
  route_change: ["from", "to"],
  app_open: [],
  click: ["element_id"],
  tap: ["element_id"],
  input_change: ["field_name"],
  form_submit: ["form_id"],
  session_start: [],
  session_end: [],
  http_request: ["method", "route"],
  http_response: ["method", "route", "status_code"],
  sdk_init: [],
  sdk_flush: [],
  task_start: ["task_name"],
  task_finish: ["task_name"],
  success: [],
  failure: ["reason"],
  error: ["error_type"],
  assertion: ["assertion_key", "passed"],
} satisfies Record<(typeof expectedV1MinimalKeys)[number], readonly string[]>;

const validGraphRoles = [
  "entry",
  "transition",
  "terminal",
  "observation",
] as const satisfies readonly GraphRole[];

describe("@qa-sdk/event-catalog", () => {
  it("registers all 60 core events with the expected category counts", () => {
    expect(allCoreEvents).toHaveLength(60);
    expect(new Set(allCoreEvents.map((event) => event.event_key)).size).toBe(60);

    const categoryCounts = Object.fromEntries(
      Object.entries(coreEventsByCategory).map(([category, events]) => [
        category,
        events.length,
      ]),
    );

    expect(categoryCounts).toEqual(expectedCategoryCounts);
  });

  it("supports looking up every core event by event key", () => {
    expect(coreEventMap.size).toBe(allCoreEvents.length);

    for (const event of allCoreEvents) {
      expect(coreEventMap.get(event.event_key)).toBe(event);
    }
  });

  it("identifies core events and rejects unknown event keys", () => {
    for (const event of allCoreEvents) {
      expect(isCoreEvent(event.event_key)).toBe(true);
    }

    expect(isCoreEvent("not_registered")).toBe(false);
    expect(coreEventMap.get("not_registered")).toBeUndefined();
  });

  it("exposes the v1 minimal set of 20 expected events", () => {
    expect(v1MinimalSet).toHaveLength(20);
    expect(v1MinimalSet.map((event) => event.event_key)).toEqual(
      expectedV1MinimalKeys,
    );

    for (const eventKey of expectedV1MinimalKeys) {
      expect(coreEventMap.has(eventKey)).toBe(true);
    }
  });

  it("identifies v1 minimal events correctly", () => {
    for (const eventKey of expectedV1MinimalKeys) {
      expect(isV1MinimalEvent(eventKey)).toBe(true);
    }

    for (const eventKey of [
      "scroll",
      "form_submit_success",
      "complete",
      "warning",
    ]) {
      expect(isV1MinimalEvent(eventKey)).toBe(false);
    }
  });

  it("provides payload guides for the 20 v1 minimal events", () => {
    expect(payloadGuides).toHaveLength(20);
    expect(payloadGuideMap.size).toBe(20);

    expect(new Set(payloadGuides.map((guide) => guide.event_key))).toEqual(
      new Set(expectedV1MinimalKeys),
    );
  });

  it("marks each required payload field as required", () => {
    for (const [eventKey, requiredFields] of Object.entries(
      expectedRequiredFields,
    )) {
      const guide = payloadGuideMap.get(eventKey);

      expect(guide, `payload guide missing for ${eventKey}`).toBeDefined();

      for (const fieldName of requiredFields) {
        const field = guide?.fields.find((candidate) => candidate.name === fieldName);

        expect(field, `payload field missing for ${eventKey}.${fieldName}`).toBeDefined();
        expect(field?.required).toBe(true);
      }
    }
  });

  it("defines a valid graph hint for every core event", () => {
    for (const event of allCoreEvents) {
      expect(event.graph_hint).toBeDefined();
      expect(validGraphRoles).toContain(event.graph_hint.role);
      expect(typeof event.graph_hint.goal_eligible).toBe("boolean");
      expect(typeof event.graph_hint.loopable).toBe("boolean");
    }
  });

  it("marks exactly the expected four goal-eligible events", () => {
    const goalEligibleEvents = allCoreEvents
      .filter((event) => event.graph_hint.goal_eligible)
      .map((event) => event.event_key)
      .sort();

    expect(goalEligibleEvents).toEqual(
      ["success", "complete", "conversion", "form_submit_success"].sort(),
    );
  });
});
