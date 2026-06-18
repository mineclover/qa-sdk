// @def.boundary dkg-system-root
// @def.doc dkg-system-root

import { describe, expect, it } from "vitest";
import { GraphRegistry } from "../graph-registry.js";
import { traceFlows, validateDslInvariants } from "./flow-trace.js";

describe("flow-trace", () => {
  it("detects missing IntentLink prerequisites", () => {
    const graph = new GraphRegistry();
    graph.addNode({
      kind: "intent-link",
      id: "IL-checkout",
      endpoints: ["page_view", "flow_point"],
      via: "address_context",
      intent: "checkout",
      invariant: "page_view 없이 flow_point가 관측되면 안 됨",
    });

    const result = traceFlows(graph, [
      { address_context: { flow_point: "flow_point:v1:0" }, timestamp: "2026-06-18T00:00:00Z" },
    ]);

    expect(result.violations).toHaveLength(1);
    expect(result.violations[0]?.missingPrefixes).toContain("page_view");
    expect(result.observations[0]?.id).toContain("OBS-FLOW-IL-checkout");
  });

  it("validates DSL bundle invariants with exclusions", () => {
    const graph = new GraphRegistry();
    graph.addNode({
      kind: "dsl-bundle",
      id: "dsl-checkout",
      name: "Checkout",
      description: "Checkout flow",
      memberPrefixes: ["page_view", "flow_point"],
      serviceBindingPrefix: "service",
      fixedDims: [],
      invariants: ["page_view 없이 flow_point가 관측되면 안 됨"],
    });

    const records = [{ address_context: { flow_point: "flow_point:v1:0" } }];

    expect(validateDslInvariants(graph, records).violations).toHaveLength(1);
    expect(validateDslInvariants(graph, records, { excludeBundles: ["dsl-checkout"] }).violations).toHaveLength(0);
  });
});
