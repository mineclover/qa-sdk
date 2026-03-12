import { describe, expect, it } from "vitest";
import {
  createEventSchema,
  updateEventSchema,
} from "../../../modules/events/event.schema.js";

describe("createEventSchema", () => {
  it("accepts valid input and defaults record_kind to log and bump to major", () => {
    expect(
      createEventSchema.parse({
        event_key: "app_started",
        display_name: "App Started",
      }),
    ).toEqual({
      event_key: "app_started",
      display_name: "App Started",
      record_kind: "log",
      bump: "major",
    });
  });

  it.each(["Mobile_App", "1event", "my-event", ""])(
    "rejects invalid event_key %p",
    (event_key) => {
      const result = createEventSchema.safeParse({
        event_key,
        display_name: "App Started",
      });

      expect(result.success).toBe(false);
    },
  );

  it("rejects an empty display_name", () => {
    const result = createEventSchema.safeParse({
      event_key: "app_started",
      display_name: "",
    });

    expect(result.success).toBe(false);
  });

  it("rejects a display_name longer than 120 characters", () => {
    const result = createEventSchema.safeParse({
      event_key: "app_started",
      display_name: "a".repeat(121),
    });

    expect(result.success).toBe(false);
  });

  it("accepts an optional description", () => {
    expect(
      createEventSchema.parse({
        event_key: "app_started",
        display_name: "App Started",
        description: "Emitted when the mobile app boots successfully.",
      }),
    ).toEqual({
      event_key: "app_started",
      display_name: "App Started",
      description: "Emitted when the mobile app boots successfully.",
      record_kind: "log",
      bump: "major",
    });
  });

  it("rejects a description longer than 2000 characters", () => {
    const result = createEventSchema.safeParse({
      event_key: "app_started",
      display_name: "App Started",
      description: "a".repeat(2001),
    });

    expect(result.success).toBe(false);
  });

  it.each(["log", "span", "both"] as const)(
    "accepts record_kind %p",
    (record_kind) => {
      expect(
        createEventSchema.parse({
          event_key: "app_started",
          display_name: "App Started",
          record_kind,
        }),
      ).toEqual({
        event_key: "app_started",
        display_name: "App Started",
        record_kind,
        bump: "major",
      });
    },
  );

  it("rejects an unknown record_kind", () => {
    const result = createEventSchema.safeParse({
      event_key: "app_started",
      display_name: "App Started",
      record_kind: "metric",
    });

    expect(result.success).toBe(false);
  });

  it.each(["major", "minor", "patch"] as const)(
    "accepts bump type %p",
    (bump) => {
      const parsed = createEventSchema.parse({
        event_key: "app_started",
        display_name: "App Started",
        bump,
      });
      expect(parsed.bump).toBe(bump);
    },
  );

  it("rejects an unknown bump type", () => {
    const result = createEventSchema.safeParse({
      event_key: "app_started",
      display_name: "App Started",
      bump: "breaking",
    });

    expect(result.success).toBe(false);
  });
});

describe("updateEventSchema", () => {
  it("rejects an empty object", () => {
    const result = updateEventSchema.safeParse({});

    expect(result.success).toBe(false);
  });

  it.each([
    { display_name: "App Launch" },
    { description: "Updated description" },
    { description: null },
    { status: "retired" as const },
  ])("accepts partial updates: %p", (input) => {
    expect(updateEventSchema.parse(input)).toEqual(input);
  });

  it.each(["active", "deprecated", "retired"] as const)(
    "accepts status %p",
    (status) => {
      expect(updateEventSchema.parse({ status })).toEqual({ status });
    },
  );

  it("rejects an unknown status", () => {
    const result = updateEventSchema.safeParse({ status: "deleted" });

    expect(result.success).toBe(false);
  });
});
