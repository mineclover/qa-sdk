// @def.doc federated-connection-contract

import type {
  ConnectionEndpoint,
  ConnectionMapping,
  ConnectionRef,
  SourceRef,
  TypedRelation,
} from './contract.js';

function encodePart(value: string): string {
  return encodeURIComponent(value);
}

export function sourceRefKey(ref: SourceRef): string {
  return [
    'source',
    encodePart(ref.sourceSystem),
    encodePart(ref.entityType),
    encodePart(ref.localId),
    encodePart(ref.revision),
  ].join(':');
}

export function sourceIdentityKey(ref: SourceRef): string {
  return [
    'source-identity',
    encodePart(ref.sourceSystem),
    encodePart(ref.entityType),
    encodePart(ref.localId),
  ].join(':');
}

export function connectionRefKey(ref: ConnectionRef): string {
  return ['connection', encodePart(ref.namespace), encodePart(ref.connectionId), ref.version].join(
    ':',
  );
}

export function endpointKey(endpoint: ConnectionEndpoint): string {
  return endpoint.kind === 'source' ? sourceRefKey(endpoint.ref) : connectionRefKey(endpoint.ref);
}

export function mappingKey(mapping: ConnectionMapping): string {
  return `mapping:${sourceRefKey(mapping.source)}=>${connectionRefKey(mapping.target)}`;
}

export function relationKey(relation: TypedRelation): string {
  return [
    'relation',
    encodePart(relation.relationType),
    endpointKey(relation.source),
    endpointKey(relation.target),
  ].join(':');
}
