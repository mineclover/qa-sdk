import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { ulid } from "ulid";
import { buildDecisionId, parseDecisionId, type DecisionId } from "./decision-id.js";

describe("decision id grammar (#7)", () => {
  it("builds safety-decision-<ULID>", () => {
    const cycleId = "01HVZABCDEFGHJKMNPQRSTVWXY";
    const out = buildDecisionId({ pass: "safety", cycleId });
    expect(out).toBe(`safety-decision-${cycleId}`);
  });

  it("builds resource-decision-<ULID>", () => {
    const cycleId = ulid();
    const out = buildDecisionId({ pass: "resource", cycleId });
    expect(out).toBe(`resource-decision-${cycleId}`);
  });

  it("parses safety-decision-<ULID> back to original shape", () => {
    const orig: DecisionId = { pass: "safety", cycleId: ulid() };
    expect(parseDecisionId(buildDecisionId(orig))).toEqual(orig);
  });

  it("rejects unknown pass", () => {
    expect(() =>
      buildDecisionId({ pass: "rollout" as never, cycleId: ulid() }),
    ).toThrow();
  });

  it("rejects invalid ULID (lowercase)", () => {
    expect(() =>
      buildDecisionId({ pass: "safety", cycleId: "01hvzabcdefghjkmnpqrstvwxy" }),
    ).toThrow();
  });

  it("rejects parse on underscore separator", () => {
    expect(() => parseDecisionId("resource_decision_42")).toThrow();
  });

  it("roundtrip property", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("safety", "resource"),
        fc.constant(null).map(() => ulid()),
        (pass, cycleId) => {
          const orig: DecisionId = { pass: pass as "safety" | "resource", cycleId };
          expect(parseDecisionId(buildDecisionId(orig))).toEqual(orig);
        },
      ),
      { numRuns: 200 },
    );
  });
});
