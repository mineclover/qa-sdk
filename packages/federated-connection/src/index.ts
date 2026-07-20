// @def.doc federated-connection-contract

export {
  ConnectionContractError,
  IDENTIFIER_RULE_STATUSES,
  MappingConflictError,
  MAPPING_STATUSES,
  PROVENANCE_KINDS,
  REVISION_STRATEGIES,
  type ConnectionEndpoint,
  type ConnectionMapping,
  type ConnectionRef,
  type ConnectionSnapshot,
  type IdentifierRuleStatus,
  type MappingProvenance,
  type MappingResolution,
  type MappingStatus,
  type ProvenanceKind,
  type RevisionStrategy,
  type SourceIdentifierRule,
  type SourceRef,
  type TypedRelation,
} from './contract.js';

export { SourceIdentifierRegistry, type SourceIdentifierLookup } from './identifier-registry.js';

export {
  connectionRefKey,
  endpointKey,
  mappingKey,
  relationKey,
  sourceIdentityKey,
  sourceRefKey,
} from './keys.js';

export {
  compareSourceSnapshots,
  observeSource,
  type SourceAdapter,
  type SourceChange,
  type SourceChangeKind,
  type SourceLookup,
  type SourceObservation,
  type SourceSnapshot,
  type SourceSnapshotStatus,
} from './source-adapter.js';

export {
  validateConnectionRef,
  validateEndpoint,
  validateMapping,
  validateProvenance,
  validateRelation,
  validateSourceRef,
} from './validate.js';

export { ConnectionRegistry } from './registry.js';
