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

export function createOntologyIndexMetaSyncAdapter(
  deps: OntologyIndexMetaSyncAdapterDeps,
): OntologyIndexMetaSyncAdapter<OntologyIndexMetaSyncReport> {
  return new OntologyProductIndexMetaSyncAdapter(deps);
}

export function deriveOntologyAxisLeafPrefix(
  namespace: string,
  axisId: string,
): string {
  return `${normalizeIdentifier(namespace)}_axis_${normalizeIdentifier(axisId)}`;
}

interface OntologyIndexMetaSyncTarget {
  readonly role: OntologyIndexMetaSyncRecordRole;
  readonly axisId?: string;
  readonly prefixRecord: PrefixRegistryRecord;
  readonly schemaVersionRecord: SchemaVersionRecord;
}

interface OntologyIndexMetaPreflightTarget extends OntologyIndexMetaSyncTarget {
  readonly existingPrefixRecord: PrefixRegistryRecord | null;
  readonly existingSchemaVersionRecord: SchemaVersionRecord | null;
}

class OntologyProductIndexMetaSyncAdapter
  implements OntologyIndexMetaSyncAdapter<OntologyIndexMetaSyncReport>
{
  constructor(private readonly deps: OntologyIndexMetaSyncAdapterDeps) {}

  async sync(
    bundle: OntologyIndexMetaSyncBundle,
  ): Promise<OntologyIndexMetaSyncReport> {
    if (bundle.allocation.addressModel !== "product") {
      return {
        ...buildSyncReportBase(bundle),
        syncStatus: "deferred",
        deferredReason: "sum-segment-semantics-unsupported",
      };
    }

    const plan = planProductSyncTargets(bundle);
    if (plan.collisions.length > 0) {
      return buildMaterializationReport(bundle, {
        syncStatus: "blocked",
        collisions: plan.collisions,
      });
    }

    const preflight = await this.preflightTargets(plan.targets);
    if (preflight.collisions.length > 0) {
      return buildMaterializationReport(bundle, {
        syncStatus: "blocked",
        collisions: preflight.collisions,
      });
    }

    return this.writeTargets(bundle, preflight.targets);
  }

  private async preflightTargets(
    targets: readonly OntologyIndexMetaSyncTarget[],
  ): Promise<{
    readonly targets: readonly OntologyIndexMetaPreflightTarget[];
    readonly collisions: readonly OntologyIndexMetaSyncCollision[];
  }> {
    const preflightTargets: OntologyIndexMetaPreflightTarget[] = [];
    const collisions: OntologyIndexMetaSyncCollision[] = [];

    for (const target of targets) {
      const [existingPrefixRecord, existingSchemaVersionRecord] =
        await Promise.all([
          this.deps.prefixRegistry.getRecord(
            target.prefixRecord.prefix,
            target.prefixRecord.versionId,
          ),
          this.deps.schemaVersionStore.getSchemaVersion(
            target.schemaVersionRecord.prefix,
            target.schemaVersionRecord.versionId,
          ),
        ]);

      if (existingPrefixRecord) {
        collisions.push(
          ...comparePrefixRecord(target, existingPrefixRecord),
        );
      }
      if (existingSchemaVersionRecord) {
        collisions.push(
          ...compareSchemaVersionRecord(target, existingSchemaVersionRecord),
        );
      }

      preflightTargets.push({
        ...target,
        existingPrefixRecord,
        existingSchemaVersionRecord,
      });
    }

    return { targets: preflightTargets, collisions };
  }

  private async writeTargets(
    bundle: OntologyIndexMetaSyncBundle,
    targets: readonly OntologyIndexMetaPreflightTarget[],
  ): Promise<OntologyIndexMetaSyncMaterializationReport> {
    const materializedRecords: OntologyIndexMetaSyncRecord[] = [];
    const idempotentRecords: OntologyIndexMetaSyncRecord[] = [];
    const repairedRecords: OntologyIndexMetaSyncRecord[] = [];
    const collisions: OntologyIndexMetaSyncCollision[] = [];

    for (const target of targets) {
      const prefixSyncRecord = toSyncRecord({
        kind: "prefix-registry",
        role: target.role,
        axisId: target.axisId,
        record: target.prefixRecord,
      });
      const schemaVersionSyncRecord = toSyncRecord({
        kind: "schema-version",
        role: target.role,
        axisId: target.axisId,
        record: target.schemaVersionRecord,
      });
      const isRepair =
        Boolean(target.existingPrefixRecord) !==
        Boolean(target.existingSchemaVersionRecord);

      if (target.existingPrefixRecord) {
        idempotentRecords.push(prefixSyncRecord);
      } else {
        try {
          await this.deps.prefixRegistry.register(target.prefixRecord);
          (isRepair ? repairedRecords : materializedRecords).push(
            prefixSyncRecord,
          );
        } catch (error) {
          collisions.push(
            writeConflict(prefixSyncRecord, target.prefixRecord, error),
          );
          break;
        }
      }

      if (target.existingSchemaVersionRecord) {
        idempotentRecords.push(schemaVersionSyncRecord);
      } else {
        try {
          await this.deps.schemaVersionStore.insertSchemaVersion(
            target.schemaVersionRecord,
          );
          (isRepair ? repairedRecords : materializedRecords).push(
            schemaVersionSyncRecord,
          );
        } catch (error) {
          collisions.push(
            writeConflict(
              schemaVersionSyncRecord,
              target.schemaVersionRecord,
              error,
            ),
          );
          break;
        }
      }
    }

    return buildMaterializationReport(bundle, {
      syncStatus: collisions.length > 0 ? "blocked" : "synced",
      materializedRecords,
      idempotentRecords,
      repairedRecords,
      collisions,
    });
  }
}

function planProductSyncTargets(bundle: OntologyIndexMetaSyncBundle): {
  readonly targets: readonly OntologyIndexMetaSyncTarget[];
  readonly collisions: readonly OntologyIndexMetaSyncCollision[];
} {
  const axesById = new Map(bundle.axes.map((axis) => [axis.axisId, axis]));
  const orderedAxes = bundle.taxonomy.axisIds
    .map((axisId) => axesById.get(axisId))
    .filter((axis): axis is OntologyAxisRecord => Boolean(axis));
  const refs: DimRef[] = orderedAxes.map((axis) => ({
    prefix: deriveOntologyAxisLeafPrefix(bundle.namespace.namespace, axis.axisId),
    versionId: axis.versionId,
    capacity: axis.capacity,
  }));
  const parentRecord: PrefixRegistryRecord = {
    prefix: bundle.allocation.prefix,
    versionId: bundle.allocation.versionId,
    capacity: bundle.allocation.capacity,
    refs,
  };
  const parentSyncRecord = toSyncRecord({
    kind: "prefix-registry",
    role: "allocation-prefix",
    record: parentRecord,
  });
  const shapeCollisions = validateProductShape(
    bundle,
    orderedAxes,
    refs,
    parentSyncRecord,
  );
  if (shapeCollisions.length > 0) {
    return { targets: [], collisions: shapeCollisions };
  }

  const createdAt = schemaVersionCreatedAt(bundle.namespace);
  const targets: OntologyIndexMetaSyncTarget[] = orderedAxes.map((axis) => {
    const prefix = deriveOntologyAxisLeafPrefix(
      bundle.namespace.namespace,
      axis.axisId,
    );
    return {
      role: "axis-leaf",
      axisId: axis.axisId,
      prefixRecord: {
        prefix,
        versionId: axis.versionId,
        capacity: axis.capacity,
      },
      schemaVersionRecord: {
        prefix,
        versionId: axis.versionId,
        capacity: axis.capacity,
        createdAt,
      },
    };
  });
  targets.push({
    role: "allocation-prefix",
    prefixRecord: parentRecord,
    schemaVersionRecord: {
      prefix: parentRecord.prefix,
      versionId: parentRecord.versionId,
      capacity: parentRecord.capacity,
      createdAt,
    },
  });

  return {
    targets,
    collisions: validateIntendedTargetSet(targets),
  };
}

function validateProductShape(
  bundle: OntologyIndexMetaSyncBundle,
  orderedAxes: readonly OntologyAxisRecord[],
  refs: readonly DimRef[],
  record: OntologyIndexMetaSyncRecord,
): readonly OntologyIndexMetaSyncCollision[] {
  const collisions: OntologyIndexMetaSyncCollision[] = [];
  const productCapacity = refs.reduce(
    (product, ref) => product * ref.capacity,
    1,
  );
  const productSegment =
    bundle.segments.length === 1 ? bundle.segments[0] : null;
  const messagePrefix = `Cannot materialize product allocation "${bundle.allocation.allocationId}"`;

  if (orderedAxes.length !== bundle.taxonomy.axisIds.length) {
    collisions.push(
      allocationShapeDrift(
        record,
        `${messagePrefix} because not every taxonomy axis is present in the sync bundle`,
      ),
    );
  }
  if (!refs.every((ref) => Number.isInteger(ref.capacity) && ref.capacity > 0)) {
    collisions.push(
      allocationShapeDrift(
        record,
        `${messagePrefix} because every ref capacity must be a positive integer`,
      ),
    );
  }
  if (bundle.allocation.capacity !== bundle.allocation.addressSize) {
    collisions.push(
      allocationShapeDrift(
        record,
        `${messagePrefix} because allocation capacity ${bundle.allocation.capacity} differs from addressSize ${bundle.allocation.addressSize}`,
      ),
    );
  }
  if (bundle.allocation.capacity !== productCapacity) {
    collisions.push(
      allocationShapeDrift(
        record,
        `${messagePrefix} because allocation capacity ${bundle.allocation.capacity} differs from product ref capacity ${productCapacity}`,
      ),
    );
  }
  if (!productSegment) {
    collisions.push(
      allocationShapeDrift(
        record,
        `${messagePrefix} because product allocation must have exactly one product segment`,
      ),
    );
  } else {
    if (!sameStrings(productSegment.consumes, bundle.taxonomy.axisIds)) {
      collisions.push(
        allocationShapeDrift(
          {
            ...record,
            segmentId: productSegment.segmentId,
          },
          `${messagePrefix} because product segment consumes order does not match taxonomy axisIds order`,
        ),
      );
    }
    if (productSegment.addressOffset !== bundle.allocation.addressOffset) {
      collisions.push(
        allocationShapeDrift(
          {
            ...record,
            segmentId: productSegment.segmentId,
          },
          `${messagePrefix} because product segment offset ${productSegment.addressOffset} differs from allocation offset ${bundle.allocation.addressOffset}`,
        ),
      );
    }
    if (productSegment.addressSize !== bundle.allocation.addressSize) {
      collisions.push(
        allocationShapeDrift(
          {
            ...record,
            segmentId: productSegment.segmentId,
          },
          `${messagePrefix} because product segment size ${productSegment.addressSize} differs from allocation addressSize ${bundle.allocation.addressSize}`,
        ),
      );
    }
  }

  return collisions;
}

function validateIntendedTargetSet(
  targets: readonly OntologyIndexMetaSyncTarget[],
): readonly OntologyIndexMetaSyncCollision[] {
  const collisions: OntologyIndexMetaSyncCollision[] = [];
  const seen = new Map<string, OntologyIndexMetaSyncTarget>();
  for (const target of targets) {
    const key = `${target.prefixRecord.prefix}\u0000${target.prefixRecord.versionId}`;
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, target);
      continue;
    }

    if (
      existing.prefixRecord.capacity !== target.prefixRecord.capacity ||
      !sameRefs(existing.prefixRecord.refs, target.prefixRecord.refs)
    ) {
      collisions.push(
        allocationShapeDrift(
          toSyncRecord({
            kind: "prefix-registry",
            role: target.role,
            axisId: target.axisId,
            record: target.prefixRecord,
          }),
          `Ontology sync target "${target.prefixRecord.prefix}/${target.prefixRecord.versionId}" is derived more than once with incompatible shape`,
        ),
      );
    }
  }
  return collisions;
}

function comparePrefixRecord(
  target: OntologyIndexMetaSyncTarget,
  existing: PrefixRegistryRecord,
): readonly OntologyIndexMetaSyncCollision[] {
  const collisions: OntologyIndexMetaSyncCollision[] = [];
  const record = toSyncRecord({
    kind: "prefix-registry",
    role: target.role,
    axisId: target.axisId,
    record: target.prefixRecord,
  });

  if (existing.capacity !== target.prefixRecord.capacity) {
    collisions.push({
      code: "prefix-capacity-drift",
      message: `PrefixRegistry record "${target.prefixRecord.prefix}/${target.prefixRecord.versionId}" has capacity ${existing.capacity}, expected ${target.prefixRecord.capacity}`,
      record,
      existing,
      intended: target.prefixRecord,
    });
  }
  if (!sameRefs(existing.refs, target.prefixRecord.refs)) {
    collisions.push({
      code: "prefix-refs-drift",
      message: `PrefixRegistry record "${target.prefixRecord.prefix}/${target.prefixRecord.versionId}" has refs that differ from ontology allocation shape`,
      record,
      existing,
      intended: target.prefixRecord,
    });
  }

  return collisions;
}

function compareSchemaVersionRecord(
  target: OntologyIndexMetaSyncTarget,
  existing: SchemaVersionRecord,
): readonly OntologyIndexMetaSyncCollision[] {
  if (existing.capacity === target.schemaVersionRecord.capacity) {
    return [];
  }

  return [
    {
      code: "schema-version-capacity-drift",
      message: `SchemaVersion record "${target.schemaVersionRecord.prefix}/${target.schemaVersionRecord.versionId}" has capacity ${existing.capacity}, expected ${target.schemaVersionRecord.capacity}`,
      record: toSyncRecord({
        kind: "schema-version",
        role: target.role,
        axisId: target.axisId,
        record: target.schemaVersionRecord,
      }),
      existing,
      intended: target.schemaVersionRecord,
    },
  ];
}

function buildMaterializationReport(
  bundle: OntologyIndexMetaSyncBundle,
  input: {
    readonly syncStatus: Exclude<OntologyIndexMetaSyncStatus, "deferred">;
    readonly materializedRecords?: readonly OntologyIndexMetaSyncRecord[];
    readonly idempotentRecords?: readonly OntologyIndexMetaSyncRecord[];
    readonly repairedRecords?: readonly OntologyIndexMetaSyncRecord[];
    readonly collisions?: readonly OntologyIndexMetaSyncCollision[];
    readonly deferredSemantics?: readonly OntologyIndexMetaSyncDeferredSemantics[];
  },
): OntologyIndexMetaSyncMaterializationReport {
  return {
    ...buildSyncReportBase(bundle),
    syncStatus: input.syncStatus,
    materializedRecords: input.materializedRecords ?? [],
    idempotentRecords: input.idempotentRecords ?? [],
    repairedRecords: input.repairedRecords ?? [],
    collisions: input.collisions ?? [],
    deferredSemantics: input.deferredSemantics ?? [],
  };
}

function buildSyncReportBase(
  bundle: OntologyIndexMetaSyncBundle,
): OntologyIndexMetaSyncReportBase {
  return {
    allocationId: bundle.allocation.allocationId,
    prefix: bundle.allocation.prefix,
    versionId: bundle.allocation.versionId,
    taxonomyId: bundle.allocation.taxonomyId,
    status: bundle.allocation.status,
  };
}

function toSyncRecord(input: {
  readonly kind: "prefix-registry";
  readonly role: OntologyIndexMetaSyncRecordRole;
  readonly axisId?: string;
  readonly record: PrefixRegistryRecord;
}): OntologyIndexMetaSyncRecord;
function toSyncRecord(input: {
  readonly kind: "schema-version";
  readonly role: OntologyIndexMetaSyncRecordRole;
  readonly axisId?: string;
  readonly record: SchemaVersionRecord;
}): OntologyIndexMetaSyncRecord;
function toSyncRecord(input: {
  readonly kind: "prefix-registry" | "schema-version";
  readonly role: OntologyIndexMetaSyncRecordRole;
  readonly axisId?: string;
  readonly record: PrefixRegistryRecord | SchemaVersionRecord;
}): OntologyIndexMetaSyncRecord {
  return {
    kind: input.kind,
    role: input.role,
    prefix: input.record.prefix,
    versionId: input.record.versionId,
    capacity: input.record.capacity,
    ...(input.axisId ? { axisId: input.axisId } : {}),
    ...("refs" in input.record && input.record.refs
      ? { refs: input.record.refs }
      : {}),
  };
}

function allocationShapeDrift(
  record: OntologyIndexMetaSyncRecord,
  message: string,
): OntologyIndexMetaSyncCollision {
  return {
    code: "allocation-shape-drift",
    message,
    record,
  };
}

function writeConflict(
  record: OntologyIndexMetaSyncRecord,
  intended: PrefixRegistryRecord | SchemaVersionRecord,
  error: unknown,
): OntologyIndexMetaSyncCollision {
  return {
    code: "index-meta-write-conflict",
    message: `Index-meta write failed for "${record.prefix}/${record.versionId}": ${errorMessage(error)}`,
    record,
    intended,
  };
}

function sameRefs(
  left: readonly DimRef[] | undefined,
  right: readonly DimRef[] | undefined,
): boolean {
  const leftRefs = left ?? [];
  const rightRefs = right ?? [];
  if (leftRefs.length !== rightRefs.length) {
    return false;
  }

  return leftRefs.every((leftRef, index) => {
    const rightRef = rightRefs[index];
    return (
      leftRef.prefix === rightRef.prefix &&
      leftRef.versionId === rightRef.versionId &&
      leftRef.capacity === rightRef.capacity
    );
  });
}

function sameStrings(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function schemaVersionCreatedAt(namespace: OntologyNamespaceRecord): string {
  return namespace.updatedAt || namespace.createdAt || new Date(0).toISOString();
}

function normalizeIdentifier(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "ontology"
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
