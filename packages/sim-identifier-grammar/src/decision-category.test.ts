import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  buildDecisionCategory,
  parseDecisionCategory,
  CATEGORIES,
  type DecisionCategory,
} from "./decision-category.js";

describe("decision category grammar (#14)", () => {
  it("builds safety.compatibility from canonical input", () => {
    const out = buildDecisionCategory({ pass: "safety", name: "compatibility" });
    expect(out).toBe("safety.compatibility");
  });

  it("parses resource.loadPressure back to original shape", () => {
    const orig: DecisionCategory = { pass: "resource", name: "loadPressure" };
    expect(parseDecisionCategory(buildDecisionCategory(orig))).toEqual(orig);
  });

  it("rejects pass outside allowlist", () => {
    expect(() =>
      buildDecisionCategory({ pass: "performance" as never, name: "perf" }),
    ).toThrow();
  });

  it("rejects name outside global allowlist", () => {
    expect(() =>
      buildDecisionCategory({ pass: "safety", name: "errorBudget" as never }),
    ).toThrow();
  });

  it("rejects safety.loadPressure (matrix 위반: name이 다른 pass 소속)", () => {
    expect(() =>
      buildDecisionCategory({ pass: "safety", name: "loadPressure" as never }),
    ).toThrow();
  });

  it("rejects parsing of safety:compatibility (separator 위반)", () => {
    expect(() => parseDecisionCategory("safety:compatibility")).toThrow();
  });

  it("roundtrip property over all matrix combinations", () => {
    const pairs = (Object.keys(CATEGORIES) as Array<keyof typeof CATEGORIES>)
      .flatMap((pass) => CATEGORIES[pass].map((name) => ({ pass, name })));
    fc.assert(
      fc.property(fc.constantFrom(...pairs), (orig) => {
        expect(parseDecisionCategory(buildDecisionCategory(orig))).toEqual(orig);
      }),
      { numRuns: 100 },
    );
  });
});
