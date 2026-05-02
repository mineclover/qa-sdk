import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { buildImageTag, parseImageTag, type ImageTag } from "./image-tag.js";

describe("image tag grammar (#3)", () => {
  it("builds qa-sdk/sim-approval-api:v3", () => {
    const out = buildImageTag({
      registry: "qa-sdk",
      servicePrefix: { namespace: "sim", category: "svc", name: "approval" },
      versionTag: { axis: "version", value: 3, state: "stable" },
    });
    expect(out).toBe("qa-sdk/sim-approval-api:v3");
  });

  it("derives image name from prefix: sim.svc.approval → sim-approval-api", () => {
    const out = buildImageTag({
      registry: "qa-sdk",
      servicePrefix: { namespace: "sim", category: "svc", name: "auth" },
      versionTag: { axis: "version", value: 1, state: "candidate" },
    });
    expect(out).toBe("qa-sdk/sim-auth-api:v1-candidate");
  });

  it("rejects unknown registry", () => {
    expect(() =>
      buildImageTag({
        registry: "untrusted" as never,
        servicePrefix: { namespace: "sim", category: "svc", name: "approval" },
        versionTag: { axis: "version", value: 1, state: "stable" },
      }),
    ).toThrow();
  });

  it("rejects non-svc category in image tag context", () => {
    expect(() =>
      buildImageTag({
        registry: "qa-sdk",
        servicePrefix: { namespace: "sim", category: "evt", name: "approval" },
        versionTag: { axis: "version", value: 1, state: "stable" },
      }),
    ).toThrow();
  });

  it("parses qa-sdk/sim-approval-api:v3 back to original shape", () => {
    const orig: ImageTag = {
      registry: "qa-sdk",
      servicePrefix: { namespace: "sim", category: "svc", name: "approval" },
      versionTag: { axis: "version", value: 3, state: "stable" },
    };
    expect(parseImageTag(buildImageTag(orig))).toEqual(orig);
  });

  it("roundtrip property", () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-z][a-z0-9-]{0,20}$/),
        fc.integer({ min: 1, max: 999 }),
        fc.constantFrom("stable", "candidate", "retired"),
        (name, value, state) => {
          const orig: ImageTag = {
            registry: "qa-sdk",
            servicePrefix: { namespace: "sim", category: "svc", name },
            versionTag: { axis: "version", value, state },
          };
          expect(parseImageTag(buildImageTag(orig))).toEqual(orig);
        },
      ),
      { numRuns: 200 },
    );
  });
});
