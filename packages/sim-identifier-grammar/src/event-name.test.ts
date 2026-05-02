import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { buildEventName, parseEventName, type EventName } from "./event-name.js";
import {
  EVENT_DOMAINS,
  EVENT_AGGREGATES_BY_DOMAIN,
  EVENT_VERBS_PAST,
} from "../../../simulations/enterprise-pm/contracts/event-vocabulary.catalog.js";

describe("outbox event name grammar (#5)", () => {
  it("builds approval.budget.submitted", () => {
    const out = buildEventName({
      domain: "approval",
      aggregate: "budget",
      verbPast: "submitted",
    });
    expect(out).toBe("approval.budget.submitted");
  });

  it("parses pm.task.completed back to original shape", () => {
    const orig: EventName = { domain: "pm", aggregate: "task", verbPast: "completed" };
    expect(parseEventName(buildEventName(orig))).toEqual(orig);
  });

  it("rejects unknown domain", () => {
    expect(() =>
      buildEventName({ domain: "billing" as never, aggregate: "budget", verbPast: "submitted" }),
    ).toThrow();
  });

  it("rejects aggregate not registered for the domain (approval+user)", () => {
    expect(() =>
      buildEventName({ domain: "approval", aggregate: "user", verbPast: "submitted" }),
    ).toThrow();
  });

  it("rejects verbPast not in catalog (current-tense submit)", () => {
    expect(() =>
      buildEventName({ domain: "approval", aggregate: "budget", verbPast: "submit" as never }),
    ).toThrow();
  });

  it("parser rejects non 3-tier strings", () => {
    expect(() => parseEventName("approval.budget")).toThrow();
    expect(() => parseEventName("approval.budget.submitted.extra")).toThrow();
  });

  it("roundtrip property over catalog combinations", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...EVENT_DOMAINS),
        fc.constantFrom(...EVENT_VERBS_PAST),
        fc.integer({ min: 0, max: 1_000_000 }),
        (domain, verbPast, seed) => {
          const aggregates = EVENT_AGGREGATES_BY_DOMAIN[domain];
          const aggregate = aggregates[seed % aggregates.length];
          const orig: EventName = { domain, aggregate, verbPast };
          expect(parseEventName(buildEventName(orig))).toEqual(orig);
        },
      ),
      { numRuns: 200 },
    );
  });
});
