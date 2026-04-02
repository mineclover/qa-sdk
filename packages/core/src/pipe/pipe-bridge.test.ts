import { describe, expect, it } from "vitest";
import type { PipeGraph, PipeSpec, PipeStep } from "../types/pipe-spec.js";
import { BindingRegistry } from "../data-object/registry.js";
import type { DataObjectBinding } from "../data-object/types.js";
import { simulate } from "./pipe-simulate.js";
import { validateSimulationLineage } from "./pipe-bridge.js";

describe("validateSimulationLineage", () => {
  it("binding 있는 파이프와 없는 파이프가 섞인 그래프를 warning + unbound로 집계한다", () => {
    const producerPipe: PipeSpec = {
      pipeId: "member-source-pipe",
      version: "v1",
      trigger: { eventKey: "start" },
      flow: makeStep({
        produces: {
          member_id: { type: "string", required: true },
        },
        accesses: [{ schemaId: "orders", columns: ["member_id"], mode: "write" }],
      }),
      produces: ["member-ready"],
    };

    const projectionPipe: PipeSpec = {
      pipeId: "member-projection-pipe",
      version: "v1",
      trigger: { eventKey: "member-ready" },
      flow: makeStep({
        consumes: {
          member_id: { type: "string", required: true },
        },
        produces: {
          member_id: { type: "string", required: true },
        },
        accesses: [{ schemaId: "member_projection", columns: ["member_id"], mode: "write" }],
      }),
      produces: ["audit-requested"],
    };

    const auditPipe: PipeSpec = {
      pipeId: "audit-pipe",
      version: "v1",
      trigger: { eventKey: "audit-requested" },
      flow: makeStep({
        consumes: {
          member_id: { type: "string", required: true },
        },
        accesses: [{ schemaId: "audit_log", columns: ["member_id"], mode: "write" }],
      }),
    };

    const graph: PipeGraph = {
      graphId: "binding-lineage",
      version: "v1",
      pipes: [producerPipe, projectionPipe, auditPipe],
      connections: [
        { from: "member-source-pipe", to: "member-projection-pipe", kind: "event" },
        { from: "member-projection-pipe", to: "audit-pipe", kind: "event" },
      ],
      entryPipeId: "member-source-pipe",
    };

    const result = simulate({
      graph,
      initialEvent: { eventKey: "start" },
    });

    const registry = makeRegistry([
      makeBinding({
        schemaId: "orders",
        columnToAxis: {
          member_id: { dimLabel: "memberId" },
        },
      }),
      makeBinding({
        schemaId: "member_projection",
        columnToAxis: {
          member_id: { dimLabel: "memberId" },
        },
      }),
    ]);

    const validation = validateSimulationLineage(result, graph.pipes, registry);

    expect(validation.lineages).toEqual([
      {
        target: { schemaId: "member_projection", column: "member_id" },
        sources: [{ schemaId: "orders", column: "member_id" }],
        transform: "direct",
        pipeId: "member-projection-pipe",
        stepPath: "flow",
      },
      {
        target: { schemaId: "audit_log", column: "member_id" },
        sources: [{ schemaId: "member_projection", column: "member_id" }],
        transform: "direct",
        pipeId: "audit-pipe",
        stepPath: "flow",
      },
    ]);
    expect(validation.summary).toEqual({
      bound: 1,
      unbound: 1,
      mismatched: 0,
    });
    expect(validation.warnings).toEqual(['pipe "audit-pipe"에 binding 없음']);
  });
});

function makeStep(dataContract: NonNullable<PipeStep["dataContract"]>): PipeStep {
  return {
    kind: "step",
    facet: "저장",
    dataContract,
  };
}

function makeBinding(overrides: Partial<DataObjectBinding> = {}): DataObjectBinding {
  return {
    schemaId: "orders",
    schemaVersion: "v1",
    prefixId: "member_identity",
    prefixVersion: "v1",
    columnToAxis: {
      id: { dimLabel: "memberId" },
    },
    ...overrides,
  };
}

function makeRegistry(bindings: readonly DataObjectBinding[]): BindingRegistry {
  const registry = new BindingRegistry();

  for (const binding of bindings) {
    registry.register(binding);
  }

  return registry;
}
