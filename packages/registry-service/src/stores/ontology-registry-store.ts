// @def.boundary registry-system
// @def.doc registry-system

export type OntologyRegistryLifecycle = 'draft' | 'active' | 'deprecated';
export type OntologyAddressModel = 'product' | 'sum';
export type OntologyAddressAllocationStatus = 'reserved' | 'active' | 'deprecated';

export interface OntologyNamespaceRecord {
  readonly ontologyId: string;
  readonly namespace: string;
  readonly owner?: string;
  readonly lifecycle: OntologyRegistryLifecycle;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface OntologyAxisRecord {
  readonly ontologyId: string;
  readonly axisId: string;
  readonly versionId: string;
  readonly values: readonly string[];
  readonly valuesHash: string;
  readonly capacity: number;
  readonly lifecycle: OntologyRegistryLifecycle;
}

export interface OntologyTaxonomyRecord {
  readonly ontologyId: string;
  readonly taxonomyId: string;
  readonly versionId: string;
  readonly appliesTo: readonly string[];
  readonly axisIds: readonly string[];
  readonly identityAxisIds: readonly string[];
  readonly space?: string;
  readonly lifecycle: OntologyRegistryLifecycle;
}

export interface OntologyAddressAllocationRecord {
  readonly allocationId: string;
  readonly ontologyId: string;
  readonly taxonomyId: string;
  readonly prefix: string;
  readonly versionId: string;
  readonly addressModel: OntologyAddressModel;
  readonly capacity: number;
  readonly addressOffset: number;
  readonly addressSize: number;
  readonly status: OntologyAddressAllocationStatus;
}

export interface OntologyAddressSegmentRecord {
  readonly allocationId: string;
  readonly segmentId: string;
  readonly consumes: readonly string[];
  readonly addressOffset: number;
  readonly addressSize: number;
}

export type OntologyNamespaceWriteInput = OntologyNamespaceRecord;
export type OntologyAxisWriteInput = OntologyAxisRecord;
export type OntologyTaxonomyWriteInput = OntologyTaxonomyRecord;
export type OntologyAddressAllocationWriteInput = OntologyAddressAllocationRecord;
export type OntologyAddressSegmentWriteInput = OntologyAddressSegmentRecord;

export interface OntologyAllocationPlanWriteSet {
  readonly namespace: OntologyNamespaceWriteInput;
  readonly axes: readonly OntologyAxisWriteInput[];
  readonly taxonomies: readonly OntologyTaxonomyWriteInput[];
  readonly allocations: readonly OntologyAddressAllocationWriteInput[];
  readonly segments: readonly OntologyAddressSegmentWriteInput[];
}

export type OntologyRegistryRecordKind =
  | 'namespace'
  | 'axis'
  | 'taxonomy'
  | 'allocation'
  | 'segment';

export type OntologyRegistryRecordSnapshot =
  | OntologyNamespaceRecord
  | OntologyAxisRecord
  | OntologyTaxonomyRecord
  | OntologyAddressAllocationRecord
  | OntologyAddressSegmentRecord;

export type OntologyRegistryRecordKey =
  | OntologyNamespaceRecordKey
  | OntologyAxisRecordKey
  | OntologyTaxonomyRecordKey
  | OntologyAddressAllocationRecordKey
  | OntologyAddressSegmentRecordKey;

export interface OntologyNamespaceRecordKey {
  readonly recordKind: 'namespace';
  readonly ontologyId?: string;
  readonly namespace?: string;
}

export interface OntologyAxisRecordKey {
  readonly recordKind: 'axis';
  readonly ontologyId: string;
  readonly axisId: string;
  readonly versionId: string;
}

export interface OntologyTaxonomyRecordKey {
  readonly recordKind: 'taxonomy';
  readonly ontologyId: string;
  readonly taxonomyId: string;
  readonly versionId: string;
}

export interface OntologyAddressAllocationRecordKey {
  readonly recordKind: 'allocation';
  readonly allocationId?: string;
  readonly ontologyId?: string;
  readonly taxonomyId?: string;
  readonly prefix?: string;
  readonly versionId?: string;
}

export interface OntologyAddressSegmentRecordKey {
  readonly recordKind: 'segment';
  readonly allocationId: string;
  readonly segmentId: string;
}

export type OntologyRegistryStoreErrorCode =
  | 'duplicate-key'
  | 'drift'
  | 'missing-taxonomy-axis'
  | 'invalid-segment'
  | 'segment-overlap'
  | 'partial-write-rejected';

export type OntologyRegistryStoreConflict =
  | OntologyRegistryDuplicateKeyConflict
  | OntologyRegistryDriftConflict
  | OntologyRegistryMissingTaxonomyAxisConflict
  | OntologyRegistryInvalidSegmentConflict
  | OntologyRegistrySegmentOverlapConflict
  | OntologyRegistryPartialWriteRejectedConflict;

export interface OntologyRegistryConflictBase {
  readonly code: OntologyRegistryStoreErrorCode;
  readonly message: string;
}

export interface OntologyRegistryDuplicateKeyConflict extends OntologyRegistryConflictBase {
  readonly code: 'duplicate-key';
  readonly key: OntologyRegistryRecordKey;
}

export interface OntologyRegistryDriftConflict extends OntologyRegistryConflictBase {
  readonly code: 'drift';
  readonly key: OntologyRegistryRecordKey;
  readonly fields: readonly string[];
  readonly existing?: OntologyRegistryRecordSnapshot;
  readonly attempted?: OntologyRegistryRecordSnapshot;
}

export interface OntologyRegistryMissingTaxonomyAxisConflict extends OntologyRegistryConflictBase {
  readonly code: 'missing-taxonomy-axis';
  readonly ontologyId: string;
  readonly taxonomyId: string;
  readonly versionId: string;
  readonly axisId: string;
}

export interface OntologyRegistryInvalidSegmentConflict extends OntologyRegistryConflictBase {
  readonly code: 'invalid-segment';
  readonly allocationId: string;
  readonly segmentId: string;
  readonly reason:
    | 'missing-allocation'
    | 'empty-consumes'
    | 'non-positive-size'
    | 'negative-offset'
    | 'outside-allocation-range';
}

export interface OntologyRegistrySegmentOverlapConflict extends OntologyRegistryConflictBase {
  readonly code: 'segment-overlap';
  readonly allocationId: string;
  readonly segmentId: string;
  readonly overlapsWithSegmentId: string;
  readonly addressOffset: number;
  readonly addressSize: number;
}

export interface OntologyRegistryPartialWriteRejectedConflict extends OntologyRegistryConflictBase {
  readonly code: 'partial-write-rejected';
  readonly conflicts: readonly Exclude<
    OntologyRegistryStoreConflict,
    OntologyRegistryPartialWriteRejectedConflict
  >[];
}

export class OntologyRegistryStoreError extends Error {
  readonly conflict: OntologyRegistryStoreConflict;

  constructor(conflict: OntologyRegistryStoreConflict) {
    super(conflict.message);
    this.name = 'OntologyRegistryStoreError';
    this.conflict = conflict;
  }
}

export interface OntologyRegistryStore {
  writeAllocationPlan(writeSet: OntologyAllocationPlanWriteSet): Promise<void>;
  updateAllocationStatus(
    allocationId: string,
    status: OntologyAddressAllocationStatus,
  ): Promise<OntologyAddressAllocationRecord | null>;
  listNamespaces(): Promise<OntologyNamespaceRecord[]>;
  getNamespace(ontologyId: string): Promise<OntologyNamespaceRecord | null>;
  listAxes(ontologyId: string, versionId: string): Promise<OntologyAxisRecord[]>;
  listTaxonomies(ontologyId: string, versionId: string): Promise<OntologyTaxonomyRecord[]>;
  listAllocations(
    ontologyId: string,
    versionId: string,
  ): Promise<OntologyAddressAllocationRecord[]>;
  getAllocation(allocationId: string): Promise<OntologyAddressAllocationRecord | null>;
  listSegments(allocationId: string): Promise<OntologyAddressSegmentRecord[]>;
  listActiveAllocations(): Promise<OntologyAddressAllocationRecord[]>;
}
