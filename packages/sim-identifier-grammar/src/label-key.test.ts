import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  buildLabelKey,
  parseLabelKey,
  LABEL_KEYS,
  type LabelKey,
} from "./label-key.js";

describe("label key grammar (#9)", () => {
  it("builds sim.role from canonical input", () => {
    expect(buildLabelKey({ namespace: "sim", key: "role" })).toBe("sim.role");
  });

  it("builds sim.version", () => {
    expect(buildLabelKey({ namespace: "sim", key: "version" })).toBe(
      "sim.version",
    );
  });

  it("builds sim.replica-of (multi-segment key)", () => {
    expect(buildLabelKey({ namespace: "sim", key: "replica-of" })).toBe(
      "sim.replica-of",
    );
  });

  it("parses sim.version back to original shape", () => {
    const orig: LabelKey = { namespace: "sim", key: "version" };
    expect(parseLabelKey(buildLabelKey(orig))).toEqual(orig);
  });

  it("rejects namespace outside allowlist", () => {
    expect(() =>
      buildLabelKey({ namespace: "app" as never, key: "version" }),
    ).toThrow();
    expect(() => parseLabelKey("app.version")).toThrow();
  });

  it("rejects key outside allowlist", () => {
    expect(() =>
      buildLabelKey({ namespace: "sim", key: "owner" as never }),
    ).toThrow();
    expect(() => parseLabelKey("sim.owner")).toThrow();
    expect(() => parseLabelKey("app.kubernetes.io/version")).toThrow();
  });

  it("roundtrip property over allowlist combinations", () => {
    fc.assert(
      fc.property(fc.constantFrom(...LABEL_KEYS), (key) => {
        const orig: LabelKey = { namespace: "sim", key };
        expect(parseLabelKey(buildLabelKey(orig))).toEqual(orig);
      }),
      { numRuns: 100 },
    );
  });
});
