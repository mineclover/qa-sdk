import type {
  DataSchema,
  FacetRole,
  FieldLineage,
  NonLinearPathObservation,
  PathObservation,
} from '@qa-sdk/core';

import {
  createInformationFacetRef,
  type InformationFacetKind,
  type InformationFacetRef,
} from './runtime-core.js';

export function createFieldFacetRef(
  pipeId: string,
  direction: 'consumes' | 'produces',
  field: string,
  facetKind: InformationFacetKind,
): InformationFacetRef {
  return createInformationFacetRef({
    nodeId: `${pipeId}:${direction}:${field}`,
    facetKind,
  });
}

export function createPortEndpointId(pipeId: string, portId: string): string {
  return `endpoint:${pipeId}:port:${portId}`;
}

export function createContractEndpointId(
  pipeId: string,
  direction: 'in' | 'out',
  field: string,
): string {
  return `endpoint:${pipeId}:${direction}:${field}`;
}

export function mapFacetRoleToInformationFacetKind(
  role: FacetRole | string | undefined,
  fallback: InformationFacetKind,
): InformationFacetKind {
  if (!role) {
    return fallback;
  }

  switch (role) {
    case 'produced':
    case 'derived':
      return 'production';
    case 'consumed':
      return 'consumption';
    case 'managed':
      return 'management';
    case 'identity':
      return 'definition';
    default:
      return fallback;
  }
}

export function createSchemaColumnFacetRef(
  schemaId: string,
  column: string,
  facetKind: InformationFacetKind,
): InformationFacetRef {
  return createInformationFacetRef({
    nodeId: `${schemaId}:${column}`,
    facetKind,
  });
}

export function parseSchemaColumnNodeId(
  nodeId: string,
): { schemaId: string; column: string } | undefined {
  const separatorIndex = nodeId.indexOf(':');
  if (separatorIndex === -1) {
    return undefined;
  }

  return {
    schemaId: nodeId.slice(0, separatorIndex),
    column: nodeId.slice(separatorIndex + 1),
  };
}

export function buildSchemaColumnIndex(
  schemas: readonly DataSchema[] | undefined,
): Map<string, { schema: DataSchema; column: string; facetRole?: FacetRole }> {
  const index = new Map<string, { schema: DataSchema; column: string; facetRole?: FacetRole }>();

  for (const schema of schemas ?? []) {
    for (const [column, descriptor] of Object.entries(schema.columns)) {
      index.set(`${schema.schemaId}:${column}`, {
        schema,
        column,
        facetRole: descriptor.facetRole,
      });
    }
  }

  return index;
}

export function buildPipeFieldSchemaHints(
  lineages: readonly FieldLineage[] | undefined,
): Map<string, { consumes: Map<string, Set<string>>; produces: Map<string, Set<string>> }> {
  const hints = new Map<
    string,
    { consumes: Map<string, Set<string>>; produces: Map<string, Set<string>> }
  >();

  for (const lineage of lineages ?? []) {
    const current = hints.get(lineage.pipeId) ?? {
      consumes: new Map<string, Set<string>>(),
      produces: new Map<string, Set<string>>(),
    };

    const targetSchemas = current.produces.get(lineage.target.column) ?? new Set<string>();
    targetSchemas.add(lineage.target.schemaId);
    current.produces.set(lineage.target.column, targetSchemas);

    for (const source of lineage.sources) {
      const sourceSchemas = current.consumes.get(source.column) ?? new Set<string>();
      sourceSchemas.add(source.schemaId);
      current.consumes.set(source.column, sourceSchemas);
    }

    hints.set(lineage.pipeId, current);
  }

  return hints;
}

export function resolveSingleSchemaId(
  hints: Map<string, Set<string>> | undefined,
  field: string,
): string | undefined {
  const matched = hints?.get(field);
  if (!matched || matched.size !== 1) {
    return undefined;
  }

  return [...matched][0];
}

export function dedupeByKey<T>(values: readonly T[], getKey: (value: T) => string): T[] {
  const map = new Map<string, T>();
  for (const value of values) {
    map.set(getKey(value), value);
  }
  return [...map.values()];
}

export function isNonLinearPathObservation(
  observation: PathObservation | NonLinearPathObservation,
): observation is NonLinearPathObservation {
  return Array.isArray((observation as NonLinearPathObservation).branchPoints);
}
