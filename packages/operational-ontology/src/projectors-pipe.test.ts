import { describe, expect, it } from "vitest";
import type { DataSchema, FieldLineage, PipeGraph } from "@qa-sdk/core";

import { type CorridorTemplateRegistry, projectPipeGraphToOperationalOntology } from "./index.js";

describe("projectPipeGraphToOperationalOntology", () => {
  it("projects pipes and connections into control flow and transmission skeletons", () => {
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
              lineageHints: {
                order: {
                  sources: ["orderInput"],
                  transform: "derive",
                },
              },
            },
          },
          ports: [{ portId: "out", direction: "out", facetType: "produced" }],
          produces: ["order.created"],
        },
        {
          pipeId: "persist-order",
          version: "v1",
          trigger: { eventKey: "order.created" },
          flow: { kind: "step", facet: "consumed" },
          ports: [{ portId: "in", direction: "in", facetType: "consumed" }],
        },
      ],
      connections: [
        {
          from: { pipeId: "collect-order", portId: "out" },
          to: { pipeId: "persist-order", portId: "in" },
          kind: "next",
        },
        {
          from: "collect-order",
          to: "persist-order",
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

    const result = projectPipeGraphToOperationalOntology({ graph, schemas, lineages });

    expect(result.controlFlow.entryNodeId).toBe("collect-order");
    expect(result.controlFlow.nodes).toHaveLength(2);
    expect(result.controlFlow.edges).toEqual([
      {
        from: "collect-order",
        to: "persist-order",
        kind: "next",
        condition: undefined,
        sourceKind: "next",
      },
      {
        from: "collect-order",
        to: "persist-order",
        kind: "conditional",
        condition: "order.valid == true",
        sourceKind: "conditional",
      },
    ]);
    expect(result.transmissions).toHaveLength(1);
    expect(result.transmissions[0]).toMatchObject({
      semantic: "production_to_consumption",
      medium: "direct",
      direction: "forward",
    });
    expect(result.transmissions[0].source.facetKind).toBe("production");
    expect(result.transmissions[0].target.facetKind).toBe("consumption");
    expect(result.dataFlow).toMatchObject({
      flowId: "checkout",
      templateKind: "pipe_graph",
      entryNodeId: "collect-order",
      nodeIds: ["collect-order", "persist-order"],
      schemaIds: ["order_input", "order_state"],
    });
    expect(result.dataFlow.templateValidation?.valid).toBe(true);
    expect(result.corridor).toEqual(result.dataFlow);
    expect(result.dataFlow.contracts).toEqual([
      {
        contractId: "contract:collect-order",
        templateKind: "pipe_contract",
        nodeId: "collect-order",
        consumes: [
          {
            field: "orderInput",
            type: "OrderInput",
            required: true,
            source: undefined,
            schemaId: "order_input",
          },
        ],
        produces: [
          {
            field: "order",
            type: "Order",
            required: true,
            source: undefined,
            schemaId: "order_state",
          },
        ],
        accesses: undefined,
      },
    ]);
    expect(result.dataFlow.endpoints).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          endpointId: "endpoint:collect-order:port:out",
          templateKind: "port",
          nodeId: "collect-order",
          direction: "out",
          facetKind: "production",
        }),
        expect.objectContaining({
          endpointId: "endpoint:collect-order:in:orderInput",
          templateKind: "contract_field",
          nodeId: "collect-order",
          direction: "in",
          field: "orderInput",
          facetKind: "consumption",
          schemaId: "order_input",
        }),
        expect.objectContaining({
          endpointId: "endpoint:collect-order:out:order",
          templateKind: "contract_field",
          nodeId: "collect-order",
          direction: "out",
          field: "order",
          facetKind: "management",
          schemaId: "order_state",
        }),
      ]),
    );
    expect(result.dataFlow.links).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          templateKind: "pipe_connection",
          sourceKind: "connection",
          relationType: "pipe_connection:next",
        }),
        expect.objectContaining({
          templateKind: "pipe_connection",
          sourceKind: "connection",
          relationType: "pipe_connection:conditional",
        }),
        expect.objectContaining({
          templateKind: "lineage_link",
          sourceKind: "lineage",
          relationType: "lineage",
          fromEndpointId: "endpoint:collect-order:in:orderInput",
          toEndpointId: "endpoint:collect-order:out:order",
        }),
      ]),
    );
    expect(result.lineageLinks).toEqual([
      expect.objectContaining({
        transform: "derive",
        transmissionRef: "collect-order",
        target: expect.objectContaining({
          nodeId: "order_state:order",
          facetKind: "management",
        }),
        sources: [
          expect.objectContaining({
            nodeId: "order_input:orderInput",
            facetKind: "consumption",
          }),
        ],
      }),
    ]);
    expect(result.branchDefinitions).toEqual([
      {
        templateKind: "conditional_branch",
        templateDescription: "Junction materialized from conditional PipeConnection paths",
        templateValidation: expect.objectContaining({ valid: true, pathCount: 2 }),
        branchNodeId: "collect-order",
        mode: "first_match",
        paths: [
          {
            pathId: "collect-order->persist-order:0",
            when: undefined,
            nextNodeIds: ["persist-order"],
            priority: 0,
          },
          {
            pathId: "collect-order->persist-order:1",
            when: {
              conditionId: "collect-order:condition:1",
              expression: "order.valid == true",
            },
            nextNodeIds: ["persist-order"],
            priority: 1,
          },
        ],
      },
    ]);
    expect(result.junctions).toEqual(result.branchDefinitions);
  });

  it("materializes corridor metadata through the provided corridor template registry", () => {
    const graph: PipeGraph = {
      graphId: "pipe-custom",
      version: "v1",
      entryPipeId: "only-step",
      pipes: [
        {
          pipeId: "only-step",
          version: "v1",
          trigger: { eventKey: "custom.start" },
          flow: { kind: "step", facet: "produced" },
        },
      ],
      connections: [],
    };

    const customRegistry: CorridorTemplateRegistry = {
      list() {
        return [
          {
            kind: "pipe_graph",
            description: "Custom pipe corridor",
            requiredEndpointKinds: ["port"],
          },
          {
            kind: "event_record_observed",
            description: "Custom event corridor",
          },
        ];
      },
      get(kind) {
        return this.list().find((template) => template.kind === kind);
      },
    };

    const result = projectPipeGraphToOperationalOntology({
      graph,
      corridorTemplateRegistry: customRegistry,
    });

    expect(result.dataFlow.templateDescription).toBe("Custom pipe corridor");
    expect(result.corridor.templateDescription).toBe("Custom pipe corridor");
    expect(result.dataFlow.templateValidation).toEqual({
      valid: false,
      missingEndpointKinds: ["port"],
      disallowedEndpointKinds: [],
      missingContractKinds: [],
      disallowedContractKinds: [],
      missingLinkKinds: [],
      disallowedLinkKinds: [],
    });
  });

  it("materializes junction metadata through the provided junction template registry", () => {
    const graph: PipeGraph = {
      graphId: "pipe-junction",
      version: "v1",
      entryPipeId: "step-a",
      pipes: [
        {
          pipeId: "step-a",
          version: "v1",
          trigger: { eventKey: "custom.start" },
          flow: { kind: "step", facet: "produced" },
        },
        {
          pipeId: "step-b",
          version: "v1",
          trigger: { eventKey: "custom.next" },
          flow: { kind: "step", facet: "consumed" },
        },
      ],
      connections: [
        {
          from: "step-a",
          to: "step-b",
          kind: "conditional",
          condition: "ok == true",
        },
      ],
    };

    const customRegistry = {
      list() {
        return [
          {
            kind: "conditional_branch",
            description: "Custom conditional junction",
            allowedModes: ["first_match"],
          },
          {
            kind: "observed_route_decision",
            description: "Custom route decision junction",
            allowedModes: ["first_match"],
          },
        ] as const;
      },
      get(kind: "conditional_branch" | "observed_route_decision") {
        return this.list().find((template) => template.kind === kind);
      },
    };

    const result = projectPipeGraphToOperationalOntology({
      graph,
      junctionTemplateRegistry: customRegistry,
    });

    expect(result.branchDefinitions).toEqual([
      {
        templateKind: "conditional_branch",
        templateDescription: "Custom conditional junction",
        templateValidation: expect.objectContaining({ valid: true, pathCount: 1 }),
        branchNodeId: "step-a",
        mode: "first_match",
        paths: [
          {
            pathId: "step-a->step-b:0",
            when: {
              conditionId: "step-a:condition:0",
              expression: "ok == true",
            },
            nextNodeIds: ["step-b"],
            priority: 0,
          },
        ],
      },
    ]);
  });
});
