import type { PipeGraph } from "@qa-sdk/core";

import type { DataLineageLink, LineageTransformKind } from "./lineage-core.js";
import { createDataLineageId } from "./lineage-core.js";
import type { DataFlowField } from "./corridor-core.js";
import type { LineageProjectionInput } from "./projector-types.js";
import {
  buildSchemaColumnIndex,
  createFieldFacetRef,
  createSchemaColumnFacetRef,
  mapFacetRoleToInformationFacetKind,
  parseSchemaColumnNodeId,
  resolveSingleSchemaId,
} from "./projector-shared.js";

export function normalizeContractFields(
  fields: Record<string, { type: string; required: boolean; source?: string }> | undefined,
  schemaHints: Map<string, Set<string>> | undefined,
): DataFlowField[] {
  return Object.entries(fields ?? {}).map(([field, spec]) => ({
    field,
    type: spec.type,
    required: spec.required,
    source: spec.source,
    schemaId: resolveSingleSchemaId(schemaHints, field),
  }));
}

export function inferLineageLinksFromPipe(
  pipe: PipeGraph["pipes"][number],
): DataLineageLink[] {
  if (pipe.flow.kind !== "step" || !pipe.flow.dataContract) {
    return [];
  }

  const { consumes = {}, produces = {}, lineageHints = {} } = pipe.flow.dataContract;
  const consumeKeys = Object.keys(consumes);

  return Object.entries(produces).flatMap(([targetField]) => {
    const hint = lineageHints[targetField];
    const hintedSources = hint?.sources ?? [];
    const sourceFields =
      hintedSources.length > 0
        ? hintedSources
        : targetField in consumes
          ? [targetField]
          : consumeKeys.length === 1
            ? consumeKeys
            : [];

    if (sourceFields.length === 0) {
      return [];
    }

    const target = createFieldFacetRef(pipe.pipeId, "produces", targetField, "production");
    const sources = sourceFields.map((sourceField: string) =>
      createFieldFacetRef(pipe.pipeId, "consumes", sourceField, "consumption"),
    );
    const transform = (hint?.transform ?? "direct") as LineageTransformKind;

    return [
      {
        lineageId: createDataLineageId({
          target,
          sources,
          transform,
        }),
        target,
        sources,
        transform,
        expression: hint ? `${targetField} <= ${sourceFields.join(",")}` : undefined,
        transmissionRef: pipe.pipeId,
      },
    ];
  });
}

export function projectLineageToOperationalOntology(
  input: LineageProjectionInput,
): DataLineageLink[] {
  const schemaColumnIndex = buildSchemaColumnIndex(input.schemas);

  return (input.lineages ?? []).map((lineage) => {
    const targetMeta = schemaColumnIndex.get(
      `${lineage.target.schemaId}:${lineage.target.column}`,
    );
    const target = createSchemaColumnFacetRef(
      lineage.target.schemaId,
      lineage.target.column,
      mapFacetRoleToInformationFacetKind(targetMeta?.facetRole, "production"),
    );
    const sources = lineage.sources.map((source) =>
      createSchemaColumnFacetRef(
        source.schemaId,
        source.column,
        mapFacetRoleToInformationFacetKind(
          schemaColumnIndex.get(`${source.schemaId}:${source.column}`)?.facetRole,
          "consumption",
        ),
      ),
    );

    return {
      lineageId: createDataLineageId({
        target,
        sources,
        transform: lineage.transform as LineageTransformKind,
      }),
      target,
      sources,
      transform: lineage.transform as LineageTransformKind,
      expression: lineage.expression,
      transmissionRef: lineage.pipeId,
    };
  });
}

export {
  parseSchemaColumnNodeId,
  buildSchemaColumnIndex,
  createSchemaColumnFacetRef,
  mapFacetRoleToInformationFacetKind,
  createFieldFacetRef,
};
