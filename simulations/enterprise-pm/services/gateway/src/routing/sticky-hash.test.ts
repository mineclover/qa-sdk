// @def.boundary sim-gateway
// @def.doc canary-routing-decision

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { stickyHashBucket } from "./sticky-hash.js";

describe("stickyHashBucket (FNV-1a 32-bit, mod 100)", () => {
  it("returns integer in [0,99]; deterministic; rejects empty", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 64 }), (uid) => {
        const b = stickyHashBucket(uid);
        return Number.isInteger(b) && b >= 0 && b < 100;
      }),
      { numRuns: 500 },
    );
    expect(stickyHashBucket("user-42")).toBe(stickyHashBucket("user-42"));
    expect(() => stickyHashBucket("")).toThrow();
  });

  it("smoke distribution: 1000 inputs hit > 50 buckets", () => {
    const buckets = new Set<number>();
    for (let i = 0; i < 1000; i++) buckets.add(stickyHashBucket(`u-${i}`));
    expect(buckets.size).toBeGreaterThan(50);
  });
});
