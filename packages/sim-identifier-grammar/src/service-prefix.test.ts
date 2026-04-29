import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  buildServicePrefix,
  parseServicePrefix,
  ServicePrefixSchema,
  type ServicePrefix,
} from "./service-prefix.js";

describe("service prefix grammar (#1)", () => {
  it("builds canonical sim.svc.approval", () => {
    const out = buildServicePrefix({
      namespace: "sim",
      category: "svc",
      name: "approval",
    });
    expect(out).toBe("sim.svc.approval");
  });

  it("parses sim.svc.approval back to original shape", () => {
    const orig = { namespace: "sim", category: "svc", name: "approval" } as const;
    expect(parseServicePrefix(buildServicePrefix(orig))).toEqual(orig);
  });

  it("rejects unknown namespace", () => {
    expect(() =>
      buildServicePrefix({ namespace: "prod" as never, category: "svc", name: "x" }),
    ).toThrow();
  });

  it("rejects name with uppercase", () => {
    expect(() => buildServicePrefix({ namespace: "sim", category: "svc", name: "Approval" }))
      .toThrow();
  });

  it("Zod schema accepts valid string", () => {
    expect(() => ServicePrefixSchema.parse("sim.svc.approval")).not.toThrow();
  });

  it("Zod schema rejects invalid category", () => {
    expect(() => ServicePrefixSchema.parse("sim.unknown.x")).toThrow();
  });

  it("roundtrip property: build∘parse = id", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("svc", "slice", "evt", "cache"),
        fc.stringMatching(/^[a-z][a-z0-9-]{0,30}$/),
        (category, name) => {
          const orig: ServicePrefix = { namespace: "sim", category, name };
          expect(parseServicePrefix(buildServicePrefix(orig))).toEqual(orig);
        },
      ),
      { numRuns: 200 },
    );
  });
});
