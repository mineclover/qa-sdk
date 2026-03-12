import { describe, expect, it } from "vitest";
import { compileSpec } from "./compile.js";
import type { ScenarioSpec, ScenarioStep } from "@qa-sdk/core";

function buildStep(overrides: Partial<ScenarioStep> = {}): ScenarioStep {
  return {
    id: "s1",
    event_key: "event.one",
    required: true,
    kind: "sequence",
    ...overrides,
  };
}

function buildSpec(overrides: Partial<ScenarioSpec> & { steps?: ScenarioStep[] } = {}): ScenarioSpec {
  return {
    scenario_id: "test-scenario",
    version: "1.0.0",
    domain: "test",
    steps: [buildStep()],
    ...overrides,
  };
}

describe("compileSpec", () => {
  it("creates nodes from steps", () => {
    const spec = buildSpec({
      steps: [
        buildStep({ id: "s1", event_key: "checkout.start" }),
        buildStep({ id: "s2", event_key: "checkout.end" }),
      ],
    });

    const graph = compileSpec(spec);

    expect(graph.nodes).toHaveLength(2);
    expect(graph.nodes[0].id).toBe("s1");
    expect(graph.nodes[0].step.event_key).toBe("checkout.start");
    expect(graph.nodes[1].id).toBe("s2");
  });

  it("preserves scenario_id and version", () => {
    const graph = compileSpec(buildSpec({ scenario_id: "sc-1", version: "2.0.0" }));

    expect(graph.scenario_id).toBe("sc-1");
    expect(graph.version).toBe("2.0.0");
  });

  it("creates sequence edges from next array", () => {
    const spec = buildSpec({
      steps: [
        buildStep({ id: "s1", next: ["s2", "s3"] }),
        buildStep({ id: "s2" }),
        buildStep({ id: "s3" }),
      ],
    });

    const graph = compileSpec(spec);

    expect(graph.edges).toEqual([
      { from: "s1", to: "s2", type: "sequence" },
      { from: "s1", to: "s3", type: "sequence" },
    ]);
  });

  it("creates optional edges when step kind is optional", () => {
    const spec = buildSpec({
      steps: [
        buildStep({ id: "s1", kind: "optional", required: false, next: ["s2"] }),
        buildStep({ id: "s2" }),
      ],
    });

    const graph = compileSpec(spec);

    expect(graph.edges).toEqual([
      { from: "s1", to: "s2", type: "optional" },
    ]);
  });

  it("creates branch edges with conditions", () => {
    const condition = { field: "payload.type", op: "eq" as const, value: "premium" };
    const spec = buildSpec({
      steps: [
        buildStep({
          id: "s1",
          kind: "branch",
          branches: [
            { condition, next: ["s2", "s3"] },
          ],
        }),
        buildStep({ id: "s2" }),
        buildStep({ id: "s3" }),
      ],
    });

    const graph = compileSpec(spec);

    expect(graph.edges).toEqual([
      { from: "s1", to: "s2", type: "branch", condition },
      { from: "s1", to: "s3", type: "branch", condition },
    ]);
  });

  it("creates no edges when step has no next or branches", () => {
    const spec = buildSpec({
      steps: [buildStep({ id: "s1" })],
    });

    const graph = compileSpec(spec);

    expect(graph.edges).toEqual([]);
  });

  it("handles step with both next and branches", () => {
    const condition = { field: "payload.x", op: "exists" as const };
    const spec = buildSpec({
      steps: [
        buildStep({
          id: "s1",
          next: ["s2"],
          branches: [{ condition, next: ["s3"] }],
        }),
        buildStep({ id: "s2" }),
        buildStep({ id: "s3" }),
      ],
    });

    const graph = compileSpec(spec);

    expect(graph.edges).toHaveLength(2);
    expect(graph.edges[0]).toEqual({ from: "s1", to: "s2", type: "sequence" });
    expect(graph.edges[1]).toEqual({ from: "s1", to: "s3", type: "branch", condition });
  });

  it("handles multiple branches with different conditions", () => {
    const spec = buildSpec({
      steps: [
        buildStep({
          id: "s1",
          kind: "branch",
          branches: [
            { condition: { field: "payload.type", op: "eq" as const, value: "a" }, next: ["s2"] },
            { condition: { field: "payload.type", op: "eq" as const, value: "b" }, next: ["s3"] },
          ],
        }),
        buildStep({ id: "s2" }),
        buildStep({ id: "s3" }),
      ],
    });

    const graph = compileSpec(spec);

    expect(graph.edges).toHaveLength(2);
    expect(graph.edges[0].to).toBe("s2");
    expect(graph.edges[1].to).toBe("s3");
  });
});
