import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  buildVersionTag,
  parseVersionTag,
  VersionTagSchema,
  type VersionTag,
} from "./version-tag.js";

describe("version tag grammar (#2)", () => {
  it("stable: { value:3, state:stable } → 'v3'", () => {
    expect(buildVersionTag({ axis: "version", value: 3, state: "stable" })).toBe("v3");
  });

  it("candidate: { value:4, state:candidate } → 'v4-candidate'", () => {
    expect(buildVersionTag({ axis: "version", value: 4, state: "candidate" })).toBe("v4-candidate");
  });

  it("retired uses 'vN-retired' suffix", () => {
    expect(buildVersionTag({ axis: "version", value: 1, state: "retired" })).toBe("v1-retired");
  });

  it("parses 'v3' to stable", () => {
    expect(parseVersionTag("v3")).toEqual({ axis: "version", value: 3, state: "stable" });
  });

  it("parses 'v4-candidate' to candidate", () => {
    expect(parseVersionTag("v4-candidate")).toEqual({ axis: "version", value: 4, state: "candidate" });
  });

  it("rejects negative value", () => {
    expect(() =>
      buildVersionTag({ axis: "version", value: -1, state: "stable" }),
    ).toThrow();
  });

  it("rejects 'v0' (must be ≥ 1)", () => {
    expect(() => parseVersionTag("v0")).toThrow();
  });

  it("Zod schema accepts canonical strings", () => {
    expect(() => VersionTagSchema.parse("v3")).not.toThrow();
    expect(() => VersionTagSchema.parse("v4-candidate")).not.toThrow();
  });

  it("roundtrip property: parse∘build = id", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10_000 }),
        fc.constantFrom("stable", "candidate", "retired"),
        (value, state) => {
          const orig: VersionTag = { axis: "version", value, state };
          expect(parseVersionTag(buildVersionTag(orig))).toEqual(orig);
        },
      ),
      { numRuns: 200 },
    );
  });
});
