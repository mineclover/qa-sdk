import { describe, expect, it } from "vitest";
import type { DataSchema, EventRecord, FieldLineage, NonLinearPathObservation, PipeGraph } from "@qa-sdk/core";

import { type ObservationTopologyTemplateRegistry, projectOperationalOntologySnapshot } from "./index.js";

describe("projectOperationalOntologySnapshot", () => {
  it("combines corridor, checkpoint, lineage, and traversal views into one snapshot", () => {
    const graph: PipeGraph = {
      graphId: "checkout",
      version: "v1",
      entryPipeId: "collect-order",
      pipes: [
        {
          pipeId: "collect-order",
          version: "v1",
          trigger: { eventKey: "order.submit" },
          flow: {
            kind: "step",
            facet: "produced",
            dataContract: {
              consumes: {
                orderInput: { type: "OrderInput", required: true },
              },
              produces: {
                order: { type: "Order", required: true },
              },
            },
          },
          ports: [{ portId: "out", direction: "out", facetType: "produced" }],
        },
        {
          pipeId: "validate-order",
          version: "v1",
          trigger: { eventKey: "order.created" },
          flow: { kind: "step", facet: "consumed" },
          ports: [{ portId: "in", direction: "in", facetType: "consumed" }],
        },
      ],
      connections: [
        {
          from: "collect-order",
          to: "validate-order",
          kind: "conditional",
          condition: "order.valid == true",
        },
      ],
    };

    const schemas: DataSchema[] = [
      {
        schemaId: "order_input",
        version: "v1",
        schemaHash: "hash-input",
        primaryKey: ["id"],
        columns: {
          orderInput: {
            ref: { kind: "scalar", type: "OrderInput" },
            required: true,
            facetRole: "consumed",
          },
        },
      },
      {
        schemaId: "order_state",
        version: "v1",
        schemaHash: "hash-state",
        primaryKey: ["id"],
        columns: {
          order: {
            ref: { kind: "scalar", type: "Order" },
            required: true,
            facetRole: "managed",
          },
        },
      },
    ];

    const lineages: FieldLineage[] = [
      {
        target: { schemaId: "order_state", column: "order" },
        sources: [{ schemaId: "order_input", column: "orderInput" }],
        transform: "derive",
        pipeId: "collect-order",
        stepPath: "collect-order/order",
      },
    ];

    const record: EventRecord = {
      log_id: "log-1",
      timestamp: "2026-04-09T00:00:00.000Z",
      record_kind: "log",
      trace_id: "trace-1",
      span_id: "span-1",
      event_key: "order.submit",
      event_version: "v1",
      payload_format: "json",
      payload_encoding: "identity",
      payload_masking_applied: false,
      payload_masked_fields: [],
      payload: { orderId: "ord_1" },
      address_context: {
        order_event: "order_event:v1:5",
      },
    };

    const observation: NonLinearPathObservation = {
      reached_nodes: [
        {
          spec_step_id: "collect-order",
          runtime_node_id: "run-1",
          event_key: "order.submit",
          timestamp: "2026-04-09T00:00:00.000Z",
        },
        {
          spec_step_id: "validate-order",
          runtime_node_id: "run-2",
          event_key: "order.created",
          timestamp: "2026-04-09T00:00:01.000Z",
        },
      ],
      traversed_edges: [
        {
          from_step_id: "collect-order",
          to_step_id: "validate-order",
          edge_type: "branch",
        },
      ],
      reached_goals: ["validate-order"],
      unreachable_goals: [],
      loop_detected: false,
      recovery_used: false,
      terminal_node: "run-2",
      terminal_reason: "goal_reached",
      branchPoints: [
        {
          sourceStepId: "collect-order",
          branches: [
            {
              targetStepId: "validate-order",
              edgeType: "branch",
              taken: true,
              reachedNodes: [],
            },
          ],
        },
      ],
      branchCoverage: { taken: 1, total: 1, rate: 1 },
    };

    const snapshot = projectOperationalOntologySnapshot({
      graph,
      record,
      schemas,
      lineages,
      pathObservation: observation,
    });

    expect(snapshot.topologyTemplateKind).toBe("runtime_snapshot");
    expect(snapshot.topologyValidation).toEqual({
      valid: true,
      corridorCount: 2,
      maxCheckpointLatticeDepth: 2,
      missingCorridorKinds: [],
      missingJunctionTemplateKinds: [],
      missingCheckpointTemplateKinds: [],
      missingCheckpointLattices: false,
      missingRouteDecisions: false,
      missingTraversals: false,
      tooFewCorridors: false,
      tooManyCorridors: false,
      checkpointDepthTooShallow: false,
      routeDecisionsMissingRefs: [],
      checkpointsMissingCorridor: [],
    });
    expect(snapshot.corridors).toHaveLength(2);
    expect(snapshot.controlFlows).toHaveLength(1);
    expect(snapshot.checkpoints).toHaveLength(4);
    expect(snapshot.checkpoints[0]).toMatchObject({
      templateKind: "root",
      corridorId: "event-record:log-1",
      junctionId: "collect-order",
      traversalKey: "traversal:observe:collect-order->edge:collect-order->path:branch->validate-order->validate-order",
    });
    expect(snapshot.checkpointLattices).toHaveLength(1);
    expect(snapshot.checkpointLattices[0]).toMatchObject({
      corridorId: "event-record:log-1",
      rootCheckpointId: "checkpoint:event-record:log-1",
    });
    expect(snapshot.checkpointLattices[0].links).toContainEqual({
      fromCheckpointId: "checkpoint:event-record:log-1",
      toCheckpointId: "checkpoint:event-record:log-1:route:collect-order",
      relation: "decides",
    });
    expect(snapshot.checkpointLattices[0].definitions).toContainEqual(
      expect.objectContaining({
        checkpointId: "checkpoint:event-record:log-1:route:collect-order",
        templateKind: "route_decision",
        nodeId: "collect-order",
        observedPrefixIds: [],
        observedFields: [],
        templateValidation: {
          valid: true,
          missingObservedFields: false,
          missingObservedPrefixIds: false,
          nodeNotObserved: false,
        },
      }),
    );
    expect(snapshot.junctions).toEqual([
      {
        templateKind: "conditional_branch",
        templateDescription: "Junction materialized from conditional PipeConnection paths",
        templateValidation: expect.objectContaining({ valid: true, pathCount: 1 }),
        branchNodeId: "collect-order",
        mode: "first_match",
        paths: [
          {
            pathId: "collect-order->validate-order:0",
            when: {
              conditionId: "collect-order:condition:0",
              expression: "order.valid == true",
            },
            nextNodeIds: ["validate-order"],
            priority: 0,
          },
        ],
      },
    ]);
    expect(snapshot.routeDecisions).toEqual([
      {
        templateKind: "observed_route_decision",
        templateDescription: "Route decision materialized from observed branch outcomes",
        templateValidation: expect.objectContaining({ valid: true, pathCount: 1 }),
        branchNodeId: "collect-order",
        mode: "first_match",
        selectedPathIds: ["collect-order->validate-order"],
        skippedPathIds: [],
        reason: "observed-paths",
        junctionId: "collect-order",
        corridorId: "checkout",
        traversalKey: "traversal:observe:collect-order->edge:collect-order->path:branch->validate-order->validate-order",
      },
    ]);
    expect(snapshot.transmissions.length).toBeGreaterThan(0);
    expect(snapshot.lineageLinks).toEqual([
      expect.objectContaining({
        target: expect.objectContaining({
          nodeId: "order_state:order",
        }),
      }),
    ]);
    expect(snapshot.traversals).toHaveLength(1);
  });

  it("validates snapshot shape through the provided observation topology template registry", () => {
    const record: EventRecord = {
      log_id: "log-topology",
      timestamp: "2026-04-09T00:00:00.000Z",
      record_kind: "log",
      trace_id: "trace-topology",
      span_id: "span-topology",
      event_key: "order.submit",
      event_version: "v1",
      payload_format: "json",
      payload_encoding: "identity",
      payload_masking_applied: false,
      payload_masked_fields: [],
      payload: { orderId: "ord_topology" },
      address_context: {},
    };

    const customRegistry: ObservationTopologyTemplateRegistry = {
      list() {
        return [
          {
            kind: "runtime_snapshot",
            description: "Route decision required topology",
            requireCorridorKinds: ["event_record_observed"],
            requireCheckpointLattices: true,
            requireRouteDecisions: true,
            requireTraversals: true,
          },
        ];
      },
      get(kind) {
        return this.list().find((template) => template.kind === kind);
      },
    };

    const snapshot = projectOperationalOntologySnapshot({
      record,
      topologyTemplateRegistry: customRegistry,
    });

    expect(snapshot.topologyTemplateDescription).toBe("Route decision required topology");
    expect(snapshot.topologyValidation).toEqual({
      valid: false,
      corridorCount: 1,
      maxCheckpointLatticeDepth: 2,
      missingCorridorKinds: [],
      missingJunctionTemplateKinds: [],
      missingCheckpointTemplateKinds: [],
      missingCheckpointLattices: false,
      missingRouteDecisions: true,
      missingTraversals: true,
      tooFewCorridors: false,
      tooManyCorridors: false,
      checkpointDepthTooShallow: false,
      routeDecisionsMissingRefs: [],
      checkpointsMissingCorridor: [],
    });
  });

  it("materializes snapshot topology metadata through the provided observation topology template registry", () => {
    const record: EventRecord = {
      log_id: "log-topology-2",
      timestamp: "2026-04-09T00:00:00.000Z",
      record_kind: "log",
      trace_id: "trace-topology-2",
      span_id: "span-topology-2",
      event_key: "order.submit",
      event_version: "v1",
      payload_format: "json",
      payload_encoding: "identity",
      payload_masking_applied: false,
      payload_masked_fields: [],
      payload: { orderId: "ord_topology_2" },
      address_context: {},
    };

    const customRegistry: ObservationTopologyTemplateRegistry = {
      list() {
        return [
          {
            kind: "runtime_snapshot",
            description: "Custom observation topology",
            requireCorridorKinds: ["event_record_observed"],
            requireCheckpointLattices: true,
          },
        ];
      },
      get(kind) {
        return this.list().find((template) => template.kind === kind);
      },
    };

    const snapshot = projectOperationalOntologySnapshot({
      record,
      topologyTemplateRegistry: customRegistry,
    });

    expect(snapshot.topologyTemplateDescription).toBe("Custom observation topology");
    expect(snapshot.topologyValidation).toEqual({
      valid: true,
      corridorCount: 1,
      maxCheckpointLatticeDepth: 2,
      missingCorridorKinds: [],
      missingJunctionTemplateKinds: [],
      missingCheckpointTemplateKinds: [],
      missingCheckpointLattices: false,
      missingRouteDecisions: false,
      missingTraversals: false,
      tooFewCorridors: false,
      tooManyCorridors: false,
      checkpointDepthTooShallow: false,
      routeDecisionsMissingRefs: [],
      checkpointsMissingCorridor: [],
    });
  });

  it("validates snapshot layout rules through the provided observation topology template registry", () => {
    const record: EventRecord = {
      log_id: "log-topology-layout",
      timestamp: "2026-04-09T00:00:00.000Z",
      record_kind: "log",
      trace_id: "trace-topology-layout",
      span_id: "span-topology-layout",
      event_key: "order.submit",
      event_version: "v1",
      payload_format: "json",
      payload_encoding: "identity",
      payload_masking_applied: false,
      payload_masked_fields: [],
      payload: { orderId: "ord_layout" },
      address_context: {},
    };

    const customRegistry: ObservationTopologyTemplateRegistry = {
      list() {
        return [
          {
            kind: "runtime_snapshot",
            description: "Layout constrained topology",
            requireCorridorKinds: ["event_record_observed"],
            requireCheckpointLattices: true,
            minCorridors: 2,
            minCheckpointLatticeDepth: 3,
            requireRouteDecisionReferences: true,
          },
        ];
      },
      get(kind) {
        return this.list().find((template) => template.kind === kind);
      },
    };

    const snapshot = projectOperationalOntologySnapshot({
      record,
      topologyTemplateRegistry: customRegistry,
    });

    expect(snapshot.topologyValidation).toEqual({
      valid: false,
      corridorCount: 1,
      maxCheckpointLatticeDepth: 2,
      missingCorridorKinds: [],
      missingJunctionTemplateKinds: [],
      missingCheckpointTemplateKinds: [],
      missingCheckpointLattices: false,
      missingRouteDecisions: false,
      missingTraversals: false,
      tooFewCorridors: true,
      tooManyCorridors: false,
      checkpointDepthTooShallow: true,
      routeDecisionsMissingRefs: [],
      checkpointsMissingCorridor: [],
    });
  });
});
