// @def.doc federated-connection-contract

export const MAPPING_STATUSES = ['proposed', 'active', 'ambiguous', 'rejected', 'retired'] as const;

export type MappingStatus = (typeof MAPPING_STATUSES)[number];

export const PROVENANCE_KINDS = ['manual', 'source', 'derived', 'imported'] as const;

export type ProvenanceKind = (typeof PROVENANCE_KINDS)[number];

export const REVISION_STRATEGIES = ['opaque', 'monotonic', 'timestamp'] as const;

export type RevisionStrategy = (typeof REVISION_STRATEGIES)[number];

export const IDENTIFIER_RULE_STATUSES = ['draft', 'active', 'retired'] as const;

export type IdentifierRuleStatus = (typeof IDENTIFIER_RULE_STATUSES)[number];

export type SourceRef = Readonly<{
  sourceSystem: string;
  entityType: string;
  localId: string;
  revision: string;
}>;

export type SourceIdentifierRule = Readonly<{
  id: string;
  sourceSystem: string;
  entityType: string;
  version: number;
  localIdPattern: string;
  revisionPattern?: string;
  revisionStrategy: RevisionStrategy;
  status: IdentifierRuleStatus;
  provenance: MappingProvenance;
}>;

export type ConnectionRef = Readonly<{
  namespace: string;
  connectionId: string;
  version: number;
}>;

export type MappingProvenance = Readonly<{
  kind: ProvenanceKind;
  ref?: string;
}>;

export type ConnectionMapping = Readonly<{
  id: string;
  source: SourceRef;
  target: ConnectionRef;
  status: MappingStatus;
  confidence?: number;
  effectiveFrom?: string;
  effectiveTo?: string;
  transformVersion?: string;
  provenance: MappingProvenance;
}>;

export type ConnectionEndpoint =
  | Readonly<{ kind: 'source'; ref: SourceRef }>
  | Readonly<{ kind: 'connection'; ref: ConnectionRef }>;

export type TypedRelation = Readonly<{
  id: string;
  relationType: string;
  source: ConnectionEndpoint;
  target: ConnectionEndpoint;
  provenance: MappingProvenance;
  effectiveFrom?: string;
  effectiveTo?: string;
}>;

export type MappingResolution =
  | Readonly<{ status: 'missing'; source: SourceRef; candidates: readonly [] }>
  | Readonly<{
      status: 'resolved';
      source: SourceRef;
      mapping: ConnectionMapping;
      candidates: readonly [ConnectionMapping];
    }>
  | Readonly<{
      status: 'ambiguous';
      source: SourceRef;
      candidates: readonly ConnectionMapping[];
    }>;

export type ConnectionSnapshot = Readonly<{
  mappings: readonly ConnectionMapping[];
  relations: readonly TypedRelation[];
}>;

export class ConnectionContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConnectionContractError';
  }
}

export class MappingConflictError extends ConnectionContractError {
  constructor(sourceKey: string, existingTargetKey: string, incomingTargetKey: string) {
    super(`Active mapping conflict for ${sourceKey}: ${existingTargetKey} != ${incomingTargetKey}`);
    this.name = 'MappingConflictError';
  }
}
