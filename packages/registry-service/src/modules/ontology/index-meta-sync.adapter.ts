// @def.boundary registry-system
// @def.doc registry-system

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
  readonly postSyncChecks: OntologyIndexMetaPostSyncChecks;
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
  readonly consumes?: readonly string[];
  readonly addressOffset?: number;
  readonly addressSize?: number;
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
  readonly coveragePolicy?: "exact-allocation-range";
  readonly segments: readonly OntologyIndexMetaSyncSegmentSidecar[];
}

export interface OntologyIndexMetaSyncSegmentSidecar {
  readonly segmentId: string;
  readonly consumes: readonly string[];
  readonly addressOffset: number;
  readonly addressSize: number;
}

export interface OntologyIndexMetaPostSyncChecks {
  readonly targetRecords: readonly OntologyIndexMetaTargetPostSyncCheck[];
  readonly productAllocation?: OntologyIndexMetaProductAllocationPostSyncCheck;
  readonly sumAllocation?: OntologyIndexMetaSumAllocationPostSyncCheck;
}

export interface OntologyIndexMetaTargetPostSyncCheck {
  readonly role: OntologyIndexMetaSyncRecordRole;
  readonly prefix: string;
  readonly versionId: string;
  readonly expectedCapacity: number;
  readonly prefixRegistryRecordExists: boolean;
  readonly prefixRegistryRecordMatchesIntended: boolean;
  readonly prefixRegistryCapacityMatches: boolean;
  readonly prefixRegistryRefsMatch: boolean;
  readonly schemaVersionCapacityExists: boolean;
  readonly schemaVersionCapacityMatches: boolean;
  readonly axisId?: string;
  readonly prefixRegistryCapacity?: number;
  readonly schemaVersionCapacity?: number;
}

export interface OntologyIndexMetaProductAllocationPostSyncCheck {
  readonly prefix: string;
  readonly versionId: string;
  readonly expectedShape: readonly number[];
  readonly actualShape: readonly number[] | null;
  readonly shapeMatchesOrderedAxisCapacities: boolean;
  readonly resolverChecks: OntologyIndexMetaResolverPostSyncChecks;
}

export interface OntologyIndexMetaResolverPostSyncChecks {
  readonly lastValidAddress: OntologyIndexMetaAddressPostSyncCheck;
  readonly capacityAddress: OntologyIndexMetaAddressPostSyncCheck;
  readonly lastValidAddressInRange: boolean;
  readonly capacityAddressOutOfRange: boolean;
}

export interface OntologyIndexMetaAddressPostSyncCheck {
  readonly serialized: string;
  readonly index: number;
  readonly resolved: boolean;
  readonly valid: boolean;
}

export interface OntologyIndexMetaSumAllocationPostSyncCheck {
  readonly prefix: string;
  readonly versionId: string;
  readonly coveragePolicy: "exact-allocation-range" | null;
  readonly segmentSidecarCoversAllocation: boolean;
  readonly allocationStart: number;
  readonly allocationEnd: number;
  readonly coveredSize: number;
  readonly segments: readonly OntologyIndexMetaSyncSegmentSidecar[];
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
  return new OntologyIndexMetaSyncAdapterImpl(deps);
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

interface OntologyIndexMetaSyncPlan {
  readonly targets: readonly OntologyIndexMetaSyncTarget[];
  readonly collisions: readonly OntologyIndexMetaSyncCollision[];
  readonly deferredSemantics?: readonly OntologyIndexMetaSyncDeferredSemantics[];
}

class OntologyIndexMetaSyncAdapterImpl
  implements OntologyIndexMetaSyncAdapter<OntologyIndexMetaSyncReport>
{
  constructor(private readonly deps: OntologyIndexMetaSyncAdapterDeps) {}

  async sync(
    bundle: OntologyIndexMetaSyncBundle,
  ): Promise<OntologyIndexMetaSyncReport> {
    const plan: OntologyIndexMetaSyncPlan =
      bundle.allocation.addressModel === "product"
        ? planProductSyncTargets(bundle)
        : planSumSyncTargets(bundle);
    if (plan.collisions.length > 0) {
      return buildMaterializationReport(bundle, {
        syncStatus: "blocked",
        collisions: plan.collisions,
        deferredSemantics: plan.deferredSemantics,
      });
    }

    const preflight = await this.preflightTargets(plan.targets);
    if (preflight.collisions.length > 0) {
      return buildMaterializationReport(bundle, {
        syncStatus: "blocked",
        collisions: preflight.collisions,
        deferredSemantics: plan.deferredSemantics,
      });
    }

    return this.writeTargets(bundle, preflight.targets, plan.deferredSemantics);
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
    deferredSemantics?: readonly OntologyIndexMetaSyncDeferredSemantics[],
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

    const postSyncChecks =
      collisions.length === 0
        ? await collectPostSyncChecks(
            this.deps,
            bundle,
            targets,
            deferredSemantics ?? [],
          )
        : emptyPostSyncChecks();

    return buildMaterializationReport(bundle, {
      syncStatus: collisions.length > 0 ? "blocked" : "synced",
      materializedRecords,
      idempotentRecords,
      repairedRecords,
      collisions,
      deferredSemantics,
      postSyncChecks,
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

function planSumSyncTargets(
  bundle: OntologyIndexMetaSyncBundle,
): OntologyIndexMetaSyncPlan {
  const prefixRecord: PrefixRegistryRecord = {
    prefix: bundle.allocation.prefix,
    versionId: bundle.allocation.versionId,
    capacity: bundle.allocation.capacity,
  };
  const syncRecord = toSyncRecord({
    kind: "prefix-registry",
    role: "allocation-prefix",
    record: prefixRecord,
  });
  const shapeCollisions = validateSumSegmentCoverage(bundle, syncRecord);
  const deferredSemantics = [buildSumSegmentDeferredSemantics(bundle)];
  if (shapeCollisions.length > 0) {
    return {
      targets: [],
      collisions: shapeCollisions,
      deferredSemantics,
    };
  }

  const target = {
    role: "allocation-prefix",
    prefixRecord,
    schemaVersionRecord: {
      prefix: prefixRecord.prefix,
      versionId: prefixRecord.versionId,
      capacity: prefixRecord.capacity,
      createdAt: schemaVersionCreatedAt(bundle.namespace),
    },
  } satisfies OntologyIndexMetaSyncTarget;

  return {
    targets: [target],
    collisions: validateIntendedTargetSet([target]),
    deferredSemantics,
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

function validateSumSegmentCoverage(
  bundle: OntologyIndexMetaSyncBundle,
  record: OntologyIndexMetaSyncRecord,
): readonly OntologyIndexMetaSyncCollision[] {
  const collisions: OntologyIndexMetaSyncCollision[] = [];
  const allocation = bundle.allocation;
  const allocationStart = allocation.addressOffset;
  const allocationEnd = allocationStart + allocation.addressSize;
  const messagePrefix = `Cannot materialize sum allocation "${allocation.allocationId}"`;

  if (
    !Number.isInteger(allocation.capacity) ||
    !Number.isInteger(allocation.addressSize) ||
    allocation.capacity <= 0 ||
    allocation.addressSize <= 0
  ) {
    collisions.push(
      sumSegmentCoverageDrift(
        record,
        `${messagePrefix} because allocation capacity and addressSize must be positive integers`,
      ),
    );
  }
  if (allocation.capacity !== allocation.addressSize) {
    collisions.push(
      sumSegmentCoverageDrift(
        record,
        `${messagePrefix} because allocation capacity ${allocation.capacity} differs from addressSize ${allocation.addressSize}`,
      ),
    );
  }
  if (bundle.segments.length === 0) {
    collisions.push(
      sumSegmentCoverageDrift(
        record,
        `${messagePrefix} because sum allocation must have at least one segment sidecar`,
      ),
    );
  }

  const orderedSegments = [...bundle.segments].toSorted((left, right) => {
    const offsetDelta = left.addressOffset - right.addressOffset;
    return offsetDelta !== 0
      ? offsetDelta
      : left.segmentId.localeCompare(right.segmentId);
  });
  let expectedOffset = allocationStart;
  let totalCovered = 0;

  for (const segment of orderedSegments) {
    const segmentRecord = toSegmentSidecarSyncRecord(bundle, segment);
    const segmentStart = segment.addressOffset;
    const segmentEnd = segmentStart + segment.addressSize;

    if (
      !Number.isInteger(segment.addressOffset) ||
      !Number.isInteger(segment.addressSize) ||
      segment.addressSize <= 0
    ) {
      collisions.push(
        sumSegmentCoverageDrift(
          segmentRecord,
          `${messagePrefix} because segment "${segment.segmentId}" must have an integer offset and positive integer size`,
        ),
      );
      continue;
    }
    if (segment.consumes.length === 0) {
      collisions.push(
        sumSegmentCoverageDrift(
          segmentRecord,
          `${messagePrefix} because segment "${segment.segmentId}" must declare consumed axes`,
        ),
      );
    }
    if (segmentStart < allocationStart || segmentEnd > allocationEnd) {
      collisions.push(
        sumSegmentCoverageDrift(
          segmentRecord,
          `${messagePrefix} because segment "${segment.segmentId}" range [${segmentStart}, ${segmentEnd}) falls outside allocation range [${allocationStart}, ${allocationEnd})`,
        ),
      );
    }
    if (segmentStart < expectedOffset) {
      collisions.push(
        sumSegmentCoverageDrift(
          segmentRecord,
          `${messagePrefix} because segment "${segment.segmentId}" overlaps a previous segment before offset ${expectedOffset}`,
        ),
      );
    }
    if (segmentStart > expectedOffset) {
      collisions.push(
        sumSegmentCoverageDrift(
          segmentRecord,
          `${messagePrefix} because segment "${segment.segmentId}" leaves a coverage gap [${expectedOffset}, ${segmentStart})`,
        ),
      );
    }

    expectedOffset = Math.max(expectedOffset, segmentEnd);
    totalCovered += segment.addressSize;
  }

  if (expectedOffset < allocationEnd) {
    collisions.push(
      sumSegmentCoverageDrift(
        record,
        `${messagePrefix} because segment sidecars leave a trailing coverage gap [${expectedOffset}, ${allocationEnd})`,
      ),
    );
  }
  if (totalCovered !== allocation.addressSize) {
    collisions.push(
      sumSegmentCoverageDrift(
        record,
        `${messagePrefix} because segment sidecar sizes total ${totalCovered}, expected ${allocation.addressSize}`,
      ),
    );
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
    readonly postSyncChecks?: OntologyIndexMetaPostSyncChecks;
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
    postSyncChecks: input.postSyncChecks ?? emptyPostSyncChecks(),
  };
}

function emptyPostSyncChecks(): OntologyIndexMetaPostSyncChecks {
  return { targetRecords: [] };
}

async function collectPostSyncChecks(
  deps: OntologyIndexMetaSyncAdapterDeps,
  bundle: OntologyIndexMetaSyncBundle,
  targets: readonly OntologyIndexMetaPreflightTarget[],
  deferredSemantics: readonly OntologyIndexMetaSyncDeferredSemantics[],
): Promise<OntologyIndexMetaPostSyncChecks> {
  const targetRecords = await Promise.all(
    targets.map((target) => collectTargetPostSyncCheck(deps, target)),
  );

  if (bundle.allocation.addressModel === "product") {
    return {
      targetRecords,
      productAllocation: await collectProductAllocationPostSyncCheck(
        deps.prefixRegistry,
        bundle,
      ),
    };
  }

  return {
    targetRecords,
    sumAllocation: collectSumAllocationPostSyncCheck(bundle, deferredSemantics),
  };
}

async function collectTargetPostSyncCheck(
  deps: OntologyIndexMetaSyncAdapterDeps,
  target: OntologyIndexMetaPreflightTarget,
): Promise<OntologyIndexMetaTargetPostSyncCheck> {
  const [prefixRecord, schemaVersionRecord] = await Promise.all([
    deps.prefixRegistry.getRecord(
      target.prefixRecord.prefix,
      target.prefixRecord.versionId,
    ),
    deps.schemaVersionStore.getSchemaVersion(
      target.schemaVersionRecord.prefix,
      target.schemaVersionRecord.versionId,
    ),
  ]);

  return {
    role: target.role,
    prefix: target.prefixRecord.prefix,
    versionId: target.prefixRecord.versionId,
    expectedCapacity: target.prefixRecord.capacity,
    prefixRegistryRecordExists: Boolean(prefixRecord),
    prefixRegistryRecordMatchesIntended:
      Boolean(prefixRecord) &&
      prefixRecord?.capacity === target.prefixRecord.capacity &&
      sameRefs(prefixRecord?.refs, target.prefixRecord.refs),
    prefixRegistryCapacityMatches:
      prefixRecord?.capacity === target.prefixRecord.capacity,
    prefixRegistryRefsMatch:
      Boolean(prefixRecord) &&
      sameRefs(prefixRecord?.refs, target.prefixRecord.refs),
    schemaVersionCapacityExists: Boolean(schemaVersionRecord),
    schemaVersionCapacityMatches:
      schemaVersionRecord?.capacity === target.schemaVersionRecord.capacity,
    ...(target.axisId ? { axisId: target.axisId } : {}),
    ...(prefixRecord ? { prefixRegistryCapacity: prefixRecord.capacity } : {}),
    ...(schemaVersionRecord
      ? { schemaVersionCapacity: schemaVersionRecord.capacity }
      : {}),
  };
}

async function collectProductAllocationPostSyncCheck(
  prefixRegistry: PrefixRegistry,
  bundle: OntologyIndexMetaSyncBundle,
): Promise<OntologyIndexMetaProductAllocationPostSyncCheck> {
  const expectedShape = orderedAxisCapacities(bundle);
  const actualShape = await prefixRegistry.getShape(
    bundle.allocation.prefix,
    bundle.allocation.versionId,
  );
  const lastValidAddress = await resolvePostSyncAddress(
    prefixRegistry,
    bundle.allocation.prefix,
    bundle.allocation.versionId,
    bundle.allocation.capacity - 1,
  );
  const capacityAddress = await resolvePostSyncAddress(
    prefixRegistry,
    bundle.allocation.prefix,
    bundle.allocation.versionId,
    bundle.allocation.capacity,
  );

  return {
    prefix: bundle.allocation.prefix,
    versionId: bundle.allocation.versionId,
    expectedShape,
    actualShape,
    shapeMatchesOrderedAxisCapacities: sameNumbers(actualShape, expectedShape),
    resolverChecks: {
      lastValidAddress,
      capacityAddress,
      lastValidAddressInRange:
        lastValidAddress.resolved && lastValidAddress.valid,
      capacityAddressOutOfRange:
        capacityAddress.resolved && !capacityAddress.valid,
    },
  };
}

async function resolvePostSyncAddress(
  prefixRegistry: PrefixRegistry,
  prefix: string,
  versionId: string,
  index: number,
): Promise<OntologyIndexMetaAddressPostSyncCheck> {
  const serialized = `${prefix}:${versionId}:${index}`;
  const resolved = await prefixRegistry.resolveAddress(serialized);
  return {
    serialized,
    index,
    resolved: Boolean(resolved),
    valid: resolved?.valid ?? false,
  };
}

function collectSumAllocationPostSyncCheck(
  bundle: OntologyIndexMetaSyncBundle,
  deferredSemantics: readonly OntologyIndexMetaSyncDeferredSemantics[],
): OntologyIndexMetaSumAllocationPostSyncCheck {
  const allocationStart = bundle.allocation.addressOffset;
  const allocationEnd = allocationStart + bundle.allocation.addressSize;
  const exactRangeSidecar = deferredSemantics.find(
    (semantics) => semantics.coveragePolicy === "exact-allocation-range",
  );
  const segments = exactRangeSidecar?.segments ?? [];
  const coverage = evaluateExactAllocationRangeCoverage(
    bundle.allocation,
    segments,
  );

  return {
    prefix: bundle.allocation.prefix,
    versionId: bundle.allocation.versionId,
    coveragePolicy: exactRangeSidecar?.coveragePolicy ?? null,
    segmentSidecarCoversAllocation:
      Boolean(exactRangeSidecar) && coverage.coversAllocation,
    allocationStart,
    allocationEnd,
    coveredSize: coverage.coveredSize,
    segments,
  };
}

function evaluateExactAllocationRangeCoverage(
  allocation: OntologyActiveAddressAllocationRecord,
  segments: readonly OntologyIndexMetaSyncSegmentSidecar[],
): {
  readonly coversAllocation: boolean;
  readonly coveredSize: number;
} {
  const allocationStart = allocation.addressOffset;
  const allocationEnd = allocationStart + allocation.addressSize;
  const orderedSegments = [...segments].toSorted((left, right) => {
    const offsetDelta = left.addressOffset - right.addressOffset;
    return offsetDelta !== 0
      ? offsetDelta
      : left.segmentId.localeCompare(right.segmentId);
  });
  let expectedOffset = allocationStart;
  let coveredSize = 0;

  if (
    !Number.isInteger(allocation.capacity) ||
    !Number.isInteger(allocation.addressOffset) ||
    !Number.isInteger(allocation.addressSize) ||
    allocation.capacity !== allocation.addressSize ||
    allocation.addressSize <= 0 ||
    orderedSegments.length === 0
  ) {
    return { coversAllocation: false, coveredSize };
  }

  for (const segment of orderedSegments) {
    const segmentEnd = segment.addressOffset + segment.addressSize;
    if (
      segment.consumes.length === 0 ||
      !Number.isInteger(segment.addressOffset) ||
      !Number.isInteger(segment.addressSize) ||
      segment.addressOffset !== expectedOffset ||
      segment.addressSize <= 0 ||
      segmentEnd > allocationEnd
    ) {
      return { coversAllocation: false, coveredSize };
    }

    expectedOffset = segmentEnd;
    coveredSize += segment.addressSize;
  }

  return {
    coversAllocation:
      expectedOffset === allocationEnd && coveredSize === allocation.addressSize,
    coveredSize,
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

function buildSumSegmentDeferredSemantics(
  bundle: OntologyIndexMetaSyncBundle,
): OntologyIndexMetaSyncDeferredSemantics {
  return {
    code: "sum-segment-prefix-ref-unsupported",
    message: `Sum allocation "${bundle.allocation.allocationId}" is materialized as a leaf prefix; segment ranges are report sidecars until index-meta owns a segment model`,
    coveragePolicy: "exact-allocation-range",
    segments: bundle.segments.map(toSegmentSidecar),
  };
}

function toSegmentSidecar(
  segment: OntologyAddressSegmentRecord,
): OntologyIndexMetaSyncSegmentSidecar {
  return {
    segmentId: segment.segmentId,
    consumes: [...segment.consumes],
    addressOffset: segment.addressOffset,
    addressSize: segment.addressSize,
  };
}

function toSegmentSidecarSyncRecord(
  bundle: OntologyIndexMetaSyncBundle,
  segment: OntologyAddressSegmentRecord,
): OntologyIndexMetaSyncRecord {
  return {
    kind: "segment-sidecar",
    role: "sum-segment-sidecar",
    prefix: bundle.allocation.prefix,
    versionId: bundle.allocation.versionId,
    capacity: segment.addressSize,
    segmentId: segment.segmentId,
    consumes: [...segment.consumes],
    addressOffset: segment.addressOffset,
    addressSize: segment.addressSize,
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

function sumSegmentCoverageDrift(
  record: OntologyIndexMetaSyncRecord,
  message: string,
): OntologyIndexMetaSyncCollision {
  return {
    code: "sum-segment-coverage-drift",
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

function orderedAxisCapacities(
  bundle: OntologyIndexMetaSyncBundle,
): readonly number[] {
  const axesById = new Map(bundle.axes.map((axis) => [axis.axisId, axis]));
  return bundle.taxonomy.axisIds
    .map((axisId) => axesById.get(axisId))
    .filter((axis): axis is OntologyAxisRecord => Boolean(axis))
    .map((axis) => axis.capacity);
}

function sameNumbers(
  left: readonly number[] | null,
  right: readonly number[],
): boolean {
  return (
    left !== null &&
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
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
