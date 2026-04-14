import type {
  DimRef,
  PrefixRegistry,
  PrefixRegistryRecord,
  SchemaVersionRecord,
} from "index-meta";
import type {
  OntologyAddressAllocationRecord,
  OntologyAddressSegmentRecord,
  OntologyAxisRecord,
  OntologyNamespaceRecord,
  OntologyTaxonomyRecord,
} from "../../stores/ontology-registry-store.js";

export type OntologyActiveAddressAllocationRecord =
  OntologyAddressAllocationRecord & {
    readonly status: "active";
  };

export interface OntologyIndexMetaSchemaVersionStore {
  getSchemaVersion(
    prefix: string,
    versionId: string,
  ): Promise<SchemaVersionRecord | null>;
  insertSchemaVersion(record: SchemaVersionRecord): Promise<void>;
}

export interface OntologyIndexMetaSyncAdapterDeps {
  readonly prefixRegistry: PrefixRegistry;
  readonly schemaVersionStore: OntologyIndexMetaSchemaVersionStore;
}

export interface OntologyIndexMetaSyncAdapter<
  TReport extends OntologyIndexMetaSyncReport = OntologyIndexMetaSyncReport,
> {
  sync(bundle: OntologyIndexMetaSyncBundle): Promise<TReport>;
}

export interface OntologyIndexMetaSyncBundle {
  readonly allocation: OntologyActiveAddressAllocationRecord;
  readonly namespace: OntologyNamespaceRecord;
  readonly taxonomy: OntologyTaxonomyRecord;
  readonly axes: readonly OntologyAxisRecord[];
  readonly segments: readonly OntologyAddressSegmentRecord[];
}

export type OntologyIndexMetaSyncStatus = "synced" | "blocked" | "deferred";

export interface OntologyIndexMetaSyncReportBase {
  readonly allocationId: string;
  readonly prefix: string;
  readonly versionId: string;
  readonly taxonomyId: string;
  readonly status: "active";
}

export interface OntologyIndexMetaSyncDeferredReport
  extends OntologyIndexMetaSyncReportBase {
  readonly syncStatus: "deferred";
  readonly deferredReason:
    | "phase-4-index-meta-sync-not-implemented"
    | "sum-segment-semantics-unsupported";
}

export interface OntologyIndexMetaSyncMaterializationReport
  extends OntologyIndexMetaSyncReportBase {
  readonly syncStatus: Exclude<OntologyIndexMetaSyncStatus, "deferred">;
  readonly materializedRecords: readonly OntologyIndexMetaSyncRecord[];
  readonly idempotentRecords: readonly OntologyIndexMetaSyncRecord[];
  readonly repairedRecords: readonly OntologyIndexMetaSyncRecord[];
  readonly collisions: readonly OntologyIndexMetaSyncCollision[];
  readonly deferredSemantics: readonly OntologyIndexMetaSyncDeferredSemantics[];
}

export type OntologyIndexMetaSyncReport =
  | OntologyIndexMetaSyncDeferredReport
  | OntologyIndexMetaSyncMaterializationReport;

export type OntologyIndexMetaSyncRecordKind =
  | "prefix-registry"
  | "schema-version"
  | "segment-sidecar";

export type OntologyIndexMetaSyncRecordRole =
  | "axis-leaf"
  | "allocation-prefix"
  | "sum-segment-sidecar";

export interface OntologyIndexMetaSyncRecord {
  readonly kind: OntologyIndexMetaSyncRecordKind;
  readonly role: OntologyIndexMetaSyncRecordRole;
  readonly prefix: string;
  readonly versionId: string;
  readonly capacity: number;
  readonly axisId?: string;
  readonly segmentId?: string;
  readonly refs?: readonly DimRef[];
}

export type OntologyIndexMetaSyncCollisionCode =
  | "prefix-capacity-drift"
  | "prefix-refs-drift"
  | "schema-version-capacity-drift"
  | "allocation-shape-drift"
  | "sum-segment-coverage-drift"
  | "index-meta-write-conflict";

export interface OntologyIndexMetaSyncCollision {
  readonly code: OntologyIndexMetaSyncCollisionCode;
  readonly message: string;
  readonly record: OntologyIndexMetaSyncRecord;
  readonly existing?: PrefixRegistryRecord | SchemaVersionRecord;
  readonly intended?: PrefixRegistryRecord | SchemaVersionRecord;
}

export interface OntologyIndexMetaSyncDeferredSemantics {
  readonly code:
    | "sum-segment-prefix-ref-unsupported"
    | "index-meta-segment-store-unavailable";
  readonly message: string;
  readonly segments: readonly OntologyIndexMetaSyncSegmentSidecar[];
}

export interface OntologyIndexMetaSyncSegmentSidecar {
  readonly segmentId: string;
  readonly consumes: readonly string[];
  readonly addressOffset: number;
  readonly addressSize: number;
}

export function buildDeferredOntologyIndexMetaSyncReport(
  bundle: OntologyIndexMetaSyncBundle,
): OntologyIndexMetaSyncDeferredReport;
export function buildDeferredOntologyIndexMetaSyncReport(
  allocation: OntologyActiveAddressAllocationRecord,
): OntologyIndexMetaSyncDeferredReport;
export function buildDeferredOntologyIndexMetaSyncReport(
  input: OntologyIndexMetaSyncBundle | OntologyActiveAddressAllocationRecord,
): OntologyIndexMetaSyncDeferredReport {
  const allocation = "allocation" in input ? input.allocation : input;

  return {
    allocationId: allocation.allocationId,
    prefix: allocation.prefix,
    versionId: allocation.versionId,
    taxonomyId: allocation.taxonomyId,
    status: allocation.status,
    syncStatus: "deferred",
    deferredReason: "phase-4-index-meta-sync-not-implemented",
  };
}
