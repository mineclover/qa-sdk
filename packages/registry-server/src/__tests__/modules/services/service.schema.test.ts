import { describe, expect, it } from "vitest";
import {
  createServiceSchema,
  updateServiceSchema,
} from "../../../modules/services/service.schema.js";

describe("createServiceSchema", () => {
  it("accepts valid input", () => {
    expect(
      createServiceSchema.parse({
        service_name: "mobile_app",
        display_name: "Mobile App",
      }),
    ).toEqual({
      service_name: "mobile_app",
      display_name: "Mobile App",
    });
  });

  it.each(["Mobile_App", "1app", "my-app", ""])(
    "rejects invalid service_name %p",
    (service_name) => {
      const result = createServiceSchema.safeParse({
        service_name,
        display_name: "Mobile App",
      });

      expect(result.success).toBe(false);
    },
  );

  it("rejects an empty display_name", () => {
    const result = createServiceSchema.safeParse({
      service_name: "mobile_app",
      display_name: "",
    });

    expect(result.success).toBe(false);
  });

  it("rejects a display_name longer than 120 characters", () => {
    const result = createServiceSchema.safeParse({
      service_name: "mobile_app",
      display_name: "a".repeat(121),
    });

    expect(result.success).toBe(false);
  });

  it("accepts an optional description", () => {
    expect(
      createServiceSchema.parse({
        service_name: "mobile_app",
        display_name: "Mobile App",
        description: "Client-facing mobile application service.",
      }),
    ).toEqual({
      service_name: "mobile_app",
      display_name: "Mobile App",
      description: "Client-facing mobile application service.",
    });
  });

  it("rejects a description longer than 2000 characters", () => {
    const result = createServiceSchema.safeParse({
      service_name: "mobile_app",
      display_name: "Mobile App",
      description: "a".repeat(2001),
    });

    expect(result.success).toBe(false);
  });
});

describe("updateServiceSchema", () => {
  it("rejects an empty object", () => {
    const result = updateServiceSchema.safeParse({});

    expect(result.success).toBe(false);
  });

  it.each([
    { display_name: "Mobile Platform" },
    { description: "Updated description" },
    { description: null },
    { status: "deprecated" as const },
  ])("accepts partial updates: %p", (input) => {
    expect(updateServiceSchema.parse(input)).toEqual(input);
  });

  it.each(["active", "deprecated", "retired"] as const)(
    "accepts status %p",
    (status) => {
      expect(updateServiceSchema.parse({ status })).toEqual({ status });
    },
  );

  it("rejects an unknown status", () => {
    const result = updateServiceSchema.safeParse({ status: "deleted" });

    expect(result.success).toBe(false);
  });
});
