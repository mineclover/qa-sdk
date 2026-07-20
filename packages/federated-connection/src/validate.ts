// @def.doc federated-connection-contract

import {
  ConnectionContractError,
  MAPPING_STATUSES,
  PROVENANCE_KINDS,
  type ConnectionEndpoint,
  type ConnectionMapping,
  type ConnectionRef,
  type MappingProvenance,
  type SourceRef,
  type TypedRelation,
} from './contract.js';

function requireText(value: string, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new ConnectionContractError(`${field} must be a non-empty string`);
  }
  return value;
}

function requireVersion(value: number, field: string): number {
  if (!Number.isInteger(value) || value < 1) {
    throw new ConnectionContractError(`${field} must be a positive integer`);
  }
  return value;
}

export function validateSourceRef(ref: SourceRef): SourceRef {
  requireText(ref.sourceSystem, 'sourceSystem');
  requireText(ref.entityType, 'entityType');
  requireText(ref.localId, 'localId');
  requireText(ref.revision, 'revision');
  return ref;
}

export function validateConnectionRef(ref: ConnectionRef): ConnectionRef {
  requireText(ref.namespace, 'namespace');
  requireText(ref.connectionId, 'connectionId');
  requireVersion(ref.version, 'version');
  return ref;
}

export function validateProvenance(provenance: MappingProvenance): MappingProvenance {
  if (!PROVENANCE_KINDS.includes(provenance.kind)) {
    throw new ConnectionContractError(`Unsupported provenance kind: ${provenance.kind}`);
  }
  if (provenance.ref !== undefined) requireText(provenance.ref, 'provenance.ref');
  return provenance;
}

export function validateMapping(mapping: ConnectionMapping): ConnectionMapping {
  requireText(mapping.id, 'mapping.id');
  validateSourceRef(mapping.source);
  validateConnectionRef(mapping.target);
  if (!MAPPING_STATUSES.includes(mapping.status)) {
    throw new ConnectionContractError(`Unsupported mapping status: ${mapping.status}`);
  }
  if (
    mapping.confidence !== undefined &&
    (!Number.isFinite(mapping.confidence) || mapping.confidence < 0 || mapping.confidence > 1)
  ) {
    throw new ConnectionContractError('mapping.confidence must be between 0 and 1');
  }
  if (mapping.effectiveFrom !== undefined) requireText(mapping.effectiveFrom, 'effectiveFrom');
  if (mapping.effectiveTo !== undefined) requireText(mapping.effectiveTo, 'effectiveTo');
  if (mapping.transformVersion !== undefined) {
    requireText(mapping.transformVersion, 'transformVersion');
  }
  validateProvenance(mapping.provenance);
  return mapping;
}

export function validateEndpoint(endpoint: ConnectionEndpoint): ConnectionEndpoint {
  if (endpoint.kind === 'source') validateSourceRef(endpoint.ref);
  else if (endpoint.kind === 'connection') validateConnectionRef(endpoint.ref);
  else throw new ConnectionContractError('Unsupported endpoint kind');
  return endpoint;
}

export function validateRelation(relation: TypedRelation): TypedRelation {
  requireText(relation.id, 'relation.id');
  requireText(relation.relationType, 'relation.relationType');
  validateEndpoint(relation.source);
  validateEndpoint(relation.target);
  validateProvenance(relation.provenance);
  if (relation.effectiveFrom !== undefined) requireText(relation.effectiveFrom, 'effectiveFrom');
  if (relation.effectiveTo !== undefined) requireText(relation.effectiveTo, 'effectiveTo');
  return relation;
}
