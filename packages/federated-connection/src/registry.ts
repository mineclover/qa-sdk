// @def.doc federated-connection-contract

import {
  ConnectionContractError,
  MappingConflictError,
  type ConnectionMapping,
  type ConnectionRef,
  type ConnectionSnapshot,
  type MappingResolution,
  type SourceRef,
  type TypedRelation,
} from './contract.js';
import { connectionRefKey, endpointKey, mappingKey, relationKey, sourceRefKey } from './keys.js';
import {
  validateConnectionRef,
  validateMapping,
  validateRelation,
  validateSourceRef,
} from './validate.js';

function cloneMapping(mapping: ConnectionMapping): ConnectionMapping {
  return {
    ...mapping,
    source: { ...mapping.source },
    target: { ...mapping.target },
    provenance: { ...mapping.provenance },
  };
}

function cloneEndpoint(endpoint: TypedRelation['source']): TypedRelation['source'] {
  return endpoint.kind === 'source'
    ? { kind: 'source', ref: { ...endpoint.ref } }
    : { kind: 'connection', ref: { ...endpoint.ref } };
}

function cloneRelation(relation: TypedRelation): TypedRelation {
  return {
    ...relation,
    source: cloneEndpoint(relation.source),
    target: cloneEndpoint(relation.target),
    provenance: { ...relation.provenance },
  };
}

export class ConnectionRegistry {
  private readonly mappings = new Map<string, ConnectionMapping>();
  private readonly relations = new Map<string, TypedRelation>();

  registerMapping(input: ConnectionMapping): void {
    const mapping = validateMapping(input);
    const key = mappingKey(mapping);
    const existing = this.mappings.get(key);
    if (existing) {
      if (existing.id !== mapping.id) {
        throw new ConnectionContractError(`Mapping key already registered with id ${existing.id}`);
      }
      this.mappings.set(key, cloneMapping(mapping));
      return;
    }

    if (mapping.status === 'active') {
      const active = this.activeMappingsFor(mapping.source);
      const conflicting = active.find(
        (candidate) => connectionRefKey(candidate.target) !== connectionRefKey(mapping.target),
      );
      if (conflicting) {
        throw new MappingConflictError(
          sourceRefKey(mapping.source),
          connectionRefKey(conflicting.target),
          connectionRefKey(mapping.target),
        );
      }
    }

    this.mappings.set(key, cloneMapping(mapping));
  }

  registerRelation(input: TypedRelation): void {
    const relation = validateRelation(input);
    const key = relationKey(relation);
    const existing = this.relations.get(key);
    if (existing && existing.id !== relation.id) {
      throw new ConnectionContractError(`Relation key already registered with id ${existing.id}`);
    }
    this.relations.set(key, cloneRelation(relation));
  }

  getMapping(source: SourceRef, target: ConnectionRef): ConnectionMapping | undefined {
    const mapping = this.mappings.get(
      mappingKey({
        id: 'lookup',
        source,
        target,
        status: 'proposed',
        provenance: { kind: 'derived' },
      }),
    );
    return mapping ? cloneMapping(mapping) : undefined;
  }

  mappingsForSource(source: SourceRef, status?: ConnectionMapping['status']): ConnectionMapping[] {
    validateSourceRef(source);
    return [...this.mappings.values()]
      .filter(
        (mapping) =>
          sourceRefKey(mapping.source) === sourceRefKey(source) &&
          (status === undefined || mapping.status === status),
      )
      .sort((left, right) => left.id.localeCompare(right.id))
      .map(cloneMapping);
  }

  resolve(source: SourceRef): MappingResolution {
    validateSourceRef(source);
    const candidates = this.mappingsForSource(source)
      .filter((mapping) => mapping.status === 'active' || mapping.status === 'ambiguous')
      .map(cloneMapping);
    if (candidates.length === 0)
      return { status: 'missing', source: { ...source }, candidates: [] };
    if (candidates.length > 1 || candidates.some((candidate) => candidate.status === 'ambiguous')) {
      return { status: 'ambiguous', source: { ...source }, candidates };
    }
    return {
      status: 'resolved',
      source: { ...source },
      mapping: candidates[0],
      candidates: [candidates[0]],
    };
  }

  relationsFrom(endpoint: TypedRelation['source'], relationType?: string): TypedRelation[] {
    const key = endpointKey(endpoint);
    return [...this.relations.values()]
      .filter(
        (relation) =>
          endpointKey(relation.source) === key &&
          (relationType === undefined || relation.relationType === relationType),
      )
      .sort((left, right) => left.id.localeCompare(right.id))
      .map(cloneRelation);
  }

  snapshot(): ConnectionSnapshot {
    return {
      mappings: [...this.mappings.values()]
        .sort((left, right) => mappingKey(left).localeCompare(mappingKey(right)))
        .map(cloneMapping),
      relations: [...this.relations.values()]
        .sort((left, right) => relationKey(left).localeCompare(relationKey(right)))
        .map(cloneRelation),
    };
  }

  private activeMappingsFor(source: SourceRef): ConnectionMapping[] {
    return this.mappingsForSource(source, 'active');
  }
}
