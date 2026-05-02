import { describe, expect, it } from "vitest";
import type { DataSchema, FieldLineage } from "@qa-sdk/core";

import { projectLineageToOperationalOntology } from "./index.js";

describe("projectLineageToOperationalOntology", () => {
  it("uses DataSchema facetRole to refine source and target facet kinds", () => {
    const schemas: DataSchema[] = [
      {
        schemaId: "order_input",
        version: "v1",
        schemaHash: "hash-input",
        primaryKey: ["id"],
        columns: {
          id: {
            ref: { kind: "scalar", type: "string" },
            required: true,
            facetRole: "identity",
          },
          status: {
            ref: { kind: "scalar", type: "string" },
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
          status: {
            ref: { kind: "scalar", type: "string" },
            required: true,
            facetRole: "managed",
          },
        },
      },
    ];

    const lineages: FieldLineage[] = [
      {
        target: { schemaId: "order_state", column: "status" },
        sources: [
          { schemaId: "order_input", column: "id" },
          { schemaId: "order_input", column: "status" },
        ],
        transform: "derive",
        pipeId: "sync-order",
        stepPath: "sync-order/status",
      },
    ];

    const result = projectLineageToOperationalOntology({ schemas, lineages });

    expect(result).toHaveLength(1);
    expect(result[0].target).toMatchObject({
      nodeId: "order_state:status",
      facetKind: "management",
    });
    expect(result[0].sources).toEqual([
      expect.objectContaining({
        nodeId: "order_input:id",
        facetKind: "definition",
      }),
      expect.objectContaining({
        nodeId: "order_input:status",
        facetKind: "consumption",
      }),
    ]);
  });
});
