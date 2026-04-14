import {
  operationalOntologyAllocationPlane,
  type OntologyAddressAllocationIssue,
  type OntologyAddressAllocationPlan,
  type OntologyAddressAllocationPolicy,
  type OntologyAddressAllocationValidationResult,
} from "operational-ontology/allocation";
import {
  operationalOntologyPackPlane,
  type OperationalOntologyPack,
  type OperationalOntologyPackValidationIssue,
  type OperationalOntologyPackValidationResult,
} from "operational-ontology/pack";
import type { OperationalOntologySchema } from "operational-ontology/schema";
import {
  OntologyRegistryStoreError,
  type OntologyAddressAllocationRecord,
  type OntologyAddressAllocationRecordKey,
  type OntologyAllocationPlanWriteSet,
  type OntologyRegistryStore,
  type OntologyRegistryStoreConflict,
} from "../../stores/ontology-registry-store.js";
import {
  buildDeferredOntologyIndexMetaSyncReport,
  type OntologyIndexMetaSyncAdapter,
  type OntologyIndexMetaSyncBundle,
  type OntologyIndexMetaSyncDeferredReport,
  type OntologyIndexMetaSyncReport,
} from "./index-meta-sync.adapter.js";

export interface OntologyRegistryServiceDeps {
  readonly store: OntologyRegistryStore;
  readonly syncAdapter?: OntologyIndexMetaSyncAdapter;
}

export interface RegisterOntologyPackInput {
  readonly pack: OperationalOntologyPack;
  readonly options?: RegisterOntologyPackOptions;
  readonly policy?: RegisterOntologyPackOptions;
}

export type RegisterOntologyPackOptions = Omit<
  OntologyAddressAllocationPolicy,
  "ontologyId"
> & {
  readonly ontologyId?: string;
};

export interface ProjectedOntologyAllocationPlan
  extends OntologyAddressAllocationPlan {
  readonly validation: OntologyAddressAllocationValidationResult;
}

export interface RegisterOntologyPackResult {
  readonly packId: string;
  readonly ontologyId: string;
  readonly validation: OperationalOntologyPackValidationResult;
  readonly allocationValidation: OntologyAddressAllocationValidationResult;
  readonly plan: ProjectedOntologyAllocationPlan;
  readonly allocations: readonly OntologyAddressAllocationRecord[];
}

export type ReserveAddressSpaceInput =
  | ReserveAddressSpaceFromPackInput
  | ReserveAddressSpaceFromSchemaInput;

export interface ReserveAddressSpaceFromPackInput {
  readonly pack: OperationalOntologyPack;
  readonly policy?: RegisterOntologyPackOptions;
}

export interface ReserveAddressSpaceFromSchemaInput {
  readonly schema: OperationalOntologySchema;
  readonly policy: OntologyAddressAllocationPolicy;
  readonly packId?: string;
}

export interface ReserveAddressSpaceResult {
  readonly packId: string;
  readonly ontologyId: string;
  readonly plan: ProjectedOntologyAllocationPlan;
  readonly allocations: readonly OntologyAddressAllocationRecord[];
}

export interface ActivateAllocationInput {
  readonly allocationId: string;
}

export interface ActivateAllocationResult {
  readonly allocation: OntologyAddressAllocationRecord;
}

export interface SyncToPrefixRegistryInput {
  readonly allocationId: string;
}

export type SyncToPrefixRegistryResult = OntologyIndexMetaSyncReport;

export type OntologyRegistryServiceErrorCode =
  | "invalid-pack"
  | "invalid-allocation-plan"
  | "duplicate-allocation"
  | "invalid-transition"
  | "missing-allocation"
  | "sync-precondition-failure";

export type OntologyRegistryServiceConflict =
  | InvalidOntologyPackConflict
  | InvalidOntologyAllocationPlanConflict
  | DuplicateOntologyAllocationConflict
  | InvalidOntologyAllocationTransitionConflict
  | MissingOntologyAllocationConflict
  | OntologyPrefixSyncPreconditionFailureConflict;

export interface OntologyRegistryServiceConflictBase {
  readonly code: OntologyRegistryServiceErrorCode;
  readonly message: string;
}

export interface InvalidOntologyPackConflict
  extends OntologyRegistryServiceConflictBase {
  readonly code: "invalid-pack";
  readonly packId: string;
  readonly validation: OperationalOntologyPackValidationResult;
  readonly issues: readonly OperationalOntologyPackValidationIssue[];
}

export interface InvalidOntologyAllocationPlanConflict
  extends OntologyRegistryServiceConflictBase {
  readonly code: "invalid-allocation-plan";
  readonly packId: string;
  readonly validation: OntologyAddressAllocationValidationResult;
  readonly issues: readonly OntologyAddressAllocationIssue[];
  readonly storeConflicts?: readonly OntologyRegistryStoreConflict[];
}

export interface DuplicateOntologyAllocationConflict
  extends OntologyRegistryServiceConflictBase {
  readonly code: "duplicate-allocation";
  readonly packId?: string;
  readonly allocationIds: readonly string[];
  readonly allocationKeys: readonly OntologyAddressAllocationRecordKey[];
  readonly storeConflicts: readonly OntologyRegistryStoreConflict[];
}

export interface InvalidOntologyAllocationTransitionConflict
  extends OntologyRegistryServiceConflictBase {
  readonly code: "invalid-transition";
  readonly allocationId: string;
  readonly from: OntologyAddressAllocationRecord["status"];
  readonly to: OntologyAddressAllocationRecord["status"];
}

export interface MissingOntologyAllocationConflict
  extends OntologyRegistryServiceConflictBase {
  readonly code: "missing-allocation";
  readonly allocationId: string;
}

export interface OntologyPrefixSyncPreconditionFailureConflict
  extends OntologyRegistryServiceConflictBase {
  readonly code: "sync-precondition-failure";
  readonly allocationId: string;
  readonly reason:
    | "allocation-not-active"
    | "missing-namespace"
    | "missing-taxonomy"
    | "missing-axis"
    | "missing-segment"
    | "prefix-registry-conflict";
  readonly missingRecordKind?: "namespace" | "taxonomy" | "axis" | "segment";
  readonly ontologyId?: string;
  readonly taxonomyId?: string;
  readonly axisId?: string;
  readonly axisIds?: readonly string[];
  readonly prefix?: string;
  readonly versionId?: string;
  readonly status?: OntologyAddressAllocationRecord["status"];
}

export class OntologyRegistryServiceError extends Error {
  readonly conflict: OntologyRegistryServiceConflict;

  constructor(conflict: OntologyRegistryServiceConflict) {
    super(conflict.message);
    this.name = "OntologyRegistryServiceError";
    this.conflict = conflict;
  }
}

const deferredOntologyIndexMetaSyncAdapter: OntologyIndexMetaSyncAdapter<
  OntologyIndexMetaSyncDeferredReport
> = {
  async sync(bundle) {
    return buildDeferredOntologyIndexMetaSyncReport(bundle);
  },
};

export class OntologyRegistryService {
  private readonly store: OntologyRegistryStore;
  private readonly syncAdapter: OntologyIndexMetaSyncAdapter;

  constructor(deps: OntologyRegistryServiceDeps) {
    this.store = deps.store;
    this.syncAdapter = deps.syncAdapter ?? deferredOntologyIndexMetaSyncAdapter;
  }

  async registerOntologyPack(
    input: RegisterOntologyPackInput,
    options?: RegisterOntologyPackOptions,
  ): Promise<RegisterOntologyPackResult>;
  async registerOntologyPack(
    pack: OperationalOntologyPack,
    options?: RegisterOntologyPackOptions,
  ): Promise<RegisterOntologyPackResult>;
  async registerOntologyPack(
    inputOrPack: RegisterOntologyPackInput | OperationalOntologyPack,
    options?: RegisterOntologyPackOptions,
  ): Promise<RegisterOntologyPackResult> {
    const input = normalizeRegisterOntologyPackInput(inputOrPack, options);
    const validation = operationalOntologyPackPlane.validateOperationalOntologyPack(
      input.pack,
    );
    if (!validation.valid) {
      throw new OntologyRegistryServiceError({
        code: "invalid-pack",
        message: `Invalid operational ontology pack "${input.pack.packId}"`,
        packId: input.pack.packId,
        validation,
        issues: validation.issues,
      });
    }

    const policy = toReservedAllocationPolicy({
      ...(input.options ?? {}),
      ontologyId: input.options?.ontologyId ?? input.pack.packId,
    });
    const reservation = await this.projectAndWriteReservation({
      packId: input.pack.packId,
      schema: input.pack.schema,
      policy,
    });

    return {
      packId: input.pack.packId,
      ontologyId: policy.ontologyId,
      validation,
      allocationValidation: reservation.plan.validation,
      plan: reservation.plan,
      allocations: reservation.allocations,
    };
  }

  async reserveAddressSpace(
    input: ReserveAddressSpaceInput,
  ): Promise<ReserveAddressSpaceResult>;
  async reserveAddressSpace(
    schema: OperationalOntologySchema,
    policy: OntologyAddressAllocationPolicy,
  ): Promise<ReserveAddressSpaceResult>;
  async reserveAddressSpace(
    inputOrSchema: ReserveAddressSpaceInput | OperationalOntologySchema,
    policy?: OntologyAddressAllocationPolicy,
  ): Promise<ReserveAddressSpaceResult> {
    const input = normalizeReserveAddressSpaceInput(inputOrSchema, policy);
    if ("pack" in input) {
      const registration = await this.registerOntologyPack(input.pack, input.policy);

      return {
        packId: registration.packId,
        ontologyId: registration.ontologyId,
        plan: registration.plan,
        allocations: registration.allocations,
      };
    }

    const reservationPolicy = toReservedAllocationPolicy(input.policy);
    const reservation = await this.projectAndWriteReservation({
      packId: input.packId ?? reservationPolicy.ontologyId,
      schema: input.schema,
      policy: reservationPolicy,
    });

    return {
      packId: input.packId ?? reservationPolicy.ontologyId,
      ontologyId: reservationPolicy.ontologyId,
      plan: reservation.plan,
      allocations: reservation.allocations,
    };
  }

  async activateAllocation(
    input: ActivateAllocationInput,
  ): Promise<ActivateAllocationResult>;
  async activateAllocation(allocationId: string): Promise<ActivateAllocationResult>;
  async activateAllocation(
    inputOrAllocationId: ActivateAllocationInput | string,
  ): Promise<ActivateAllocationResult> {
    const allocationId =
      typeof inputOrAllocationId === "string"
        ? inputOrAllocationId
        : inputOrAllocationId.allocationId;
    const allocation = await this.requireAllocation(allocationId);
    if (allocation.status !== "reserved") {
      throw new OntologyRegistryServiceError({
        code: "invalid-transition",
        message: `Cannot activate ontology allocation "${allocation.allocationId}" from status "${allocation.status}"`,
        allocationId: allocation.allocationId,
        from: allocation.status,
        to: "active",
      });
    }

    const activeConflict = await this.findActiveAllocationConflict(allocation);
    if (activeConflict) {
      throw duplicateActiveAllocation(allocation, activeConflict);
    }

    const updated = await this.store.updateAllocationStatus(
      allocation.allocationId,
      "active",
    );
    if (!updated) {
      throw missingAllocation(allocation.allocationId);
    }

    return { allocation: updated };
  }

  async syncToPrefixRegistry(
    input: SyncToPrefixRegistryInput,
  ): Promise<SyncToPrefixRegistryResult>;
  async syncToPrefixRegistry(
    allocationId: string,
  ): Promise<SyncToPrefixRegistryResult>;
  async syncToPrefixRegistry(
    inputOrAllocationId: SyncToPrefixRegistryInput | string,
  ): Promise<SyncToPrefixRegistryResult> {
    const allocationId =
      typeof inputOrAllocationId === "string"
        ? inputOrAllocationId
        : inputOrAllocationId.allocationId;
    const bundle = await this.collectActiveAllocationSyncBundle(allocationId);

    return this.syncAdapter.sync(bundle);
  }

  private async collectActiveAllocationSyncBundle(
    allocationId: string,
  ): Promise<OntologyIndexMetaSyncBundle> {
    const allocation = await this.requireAllocation(allocationId);
    if (allocation.status !== "active") {
      throw allocationNotActiveSyncPrecondition(allocation);
    }

    const activeAllocation = {
      ...allocation,
      status: "active",
    } as const;
    const [namespace, taxonomies, axes, segments] = await Promise.all([
      this.store.getNamespace(activeAllocation.ontologyId),
      this.store.listTaxonomies(
        activeAllocation.ontologyId,
        activeAllocation.versionId,
      ),
      this.store.listAxes(activeAllocation.ontologyId, activeAllocation.versionId),
      this.store.listSegments(activeAllocation.allocationId),
    ]);

    if (!namespace) {
      throw missingSyncBundleRecord({
        allocation: activeAllocation,
        missingRecordKind: "namespace",
        reason: "missing-namespace",
        message: `Cannot sync ontology allocation "${activeAllocation.allocationId}" because namespace "${activeAllocation.ontologyId}" is missing`,
      });
    }

    const taxonomy =
      taxonomies.find(
        (candidate) =>
          candidate.ontologyId === activeAllocation.ontologyId &&
          candidate.taxonomyId === activeAllocation.taxonomyId &&
          candidate.versionId === activeAllocation.versionId,
      ) ?? null;
    if (!taxonomy) {
      throw missingSyncBundleRecord({
        allocation: activeAllocation,
        missingRecordKind: "taxonomy",
        reason: "missing-taxonomy",
        taxonomyId: activeAllocation.taxonomyId,
        message: `Cannot sync ontology allocation "${activeAllocation.allocationId}" because taxonomy "${activeAllocation.taxonomyId}" version "${activeAllocation.versionId}" is missing`,
      });
    }

    const axesById = new Map(axes.map((axis) => [axis.axisId, axis]));
    const missingAxisIds = taxonomy.axisIds.filter(
      (axisId) => !axesById.has(axisId),
    );
    if (missingAxisIds.length > 0) {
      throw missingSyncBundleRecord({
        allocation: activeAllocation,
        missingRecordKind: "axis",
        reason: "missing-axis",
        axisId: missingAxisIds[0],
        axisIds: missingAxisIds,
        taxonomyId: taxonomy.taxonomyId,
        message: `Cannot sync ontology allocation "${activeAllocation.allocationId}" because taxonomy "${taxonomy.taxonomyId}" references missing axis "${missingAxisIds[0]}"`,
      });
    }

    if (segments.length === 0) {
      throw missingSyncBundleRecord({
        allocation: activeAllocation,
        missingRecordKind: "segment",
        reason: "missing-segment",
        taxonomyId: taxonomy.taxonomyId,
        message: `Cannot sync ontology allocation "${activeAllocation.allocationId}" because no allocation segments were found`,
      });
    }

    return {
      allocation: activeAllocation,
      namespace,
      taxonomy,
      axes: taxonomy.axisIds.map((axisId) => axesById.get(axisId)!),
      segments,
    };
  }

  private async requireAllocation(
    allocationId: string,
  ): Promise<OntologyAddressAllocationRecord> {
    const allocation = await this.store.getAllocation(allocationId);
    if (!allocation) {
      throw missingAllocation(allocationId);
    }
    return allocation;
  }

  private async findActiveAllocationConflict(
    allocation: OntologyAddressAllocationRecord,
  ): Promise<OntologyAddressAllocationRecord | null> {
    const activeAllocations = await this.store.listActiveAllocations();
    return (
      activeAllocations.find(
        (activeAllocation) =>
          activeAllocation.allocationId !== allocation.allocationId &&
          activeAllocation.prefix === allocation.prefix &&
          activeAllocation.versionId === allocation.versionId,
      ) ?? null
    );
  }

  private async projectAndWriteReservation(input: {
    readonly packId: string;
    readonly schema: OperationalOntologySchema;
    readonly policy: OntologyAddressAllocationPolicy;
  }): Promise<{
    readonly plan: ProjectedOntologyAllocationPlan;
    readonly allocations: readonly OntologyAddressAllocationRecord[];
  }> {
    const plan = operationalOntologyAllocationPlane.allocateOntologyAddressSpace(
      input.schema,
      input.policy,
    );
    const allocationValidation =
      operationalOntologyAllocationPlane.validateOntologyAddressAllocationPlan({
        namespace: plan.namespace,
        axes: plan.axes,
        taxonomies: plan.taxonomies,
        allocations: plan.allocations,
        segments: plan.segments,
        schema: input.schema,
      });
    const validatedPlan: ProjectedOntologyAllocationPlan = {
      ...plan,
      validation: allocationValidation,
    };

    if (!allocationValidation.valid) {
      throw new OntologyRegistryServiceError({
        code: "invalid-allocation-plan",
        message: `Invalid ontology allocation plan for pack "${input.packId}"`,
        packId: input.packId,
        validation: allocationValidation,
        issues: allocationValidation.issues,
      });
    }

    const writeSet = toWriteSet(validatedPlan);
    try {
      await this.store.writeAllocationPlan(writeSet);
    } catch (error) {
      throw mapStoreReservationError(error, input.packId, validatedPlan);
    }

    return {
      plan: validatedPlan,
      allocations: [...writeSet.allocations],
    };
  }
}

function normalizeRegisterOntologyPackInput(
  inputOrPack: RegisterOntologyPackInput | OperationalOntologyPack,
  options?: RegisterOntologyPackOptions,
): Required<Pick<RegisterOntologyPackInput, "pack">> &
  Pick<RegisterOntologyPackInput, "options"> {
  if ("pack" in inputOrPack) {
    return {
      pack: inputOrPack.pack,
      options: options ?? inputOrPack.options ?? inputOrPack.policy,
    };
  }

  return {
    pack: inputOrPack,
    options,
  };
}

function normalizeReserveAddressSpaceInput(
  inputOrSchema: ReserveAddressSpaceInput | OperationalOntologySchema,
  policy?: OntologyAddressAllocationPolicy,
): ReserveAddressSpaceInput {
  if ("axes" in inputOrSchema) {
    if (!policy) {
      throw new TypeError(
        "reserveAddressSpace(schema, policy) requires an allocation policy",
      );
    }
    return {
      schema: inputOrSchema,
      policy,
      packId: policy.ontologyId,
    };
  }

  return inputOrSchema;
}

function toReservedAllocationPolicy(
  policy: OntologyAddressAllocationPolicy,
): OntologyAddressAllocationPolicy {
  return {
    ...policy,
    status: "reserved",
  };
}

function toWriteSet(
  plan: OntologyAddressAllocationPlan,
): OntologyAllocationPlanWriteSet {
  return {
    namespace: plan.namespace,
    axes: plan.axes,
    taxonomies: plan.taxonomies,
    allocations: plan.allocations,
    segments: plan.segments,
  };
}

function mapStoreReservationError(
  error: unknown,
  packId: string,
  plan: OntologyAddressAllocationPlan,
): OntologyRegistryServiceError {
  if (!(error instanceof OntologyRegistryStoreError)) {
    throw error;
  }

  const storeConflicts = collectStoreConflicts(error.conflict);
  if (storeConflicts.some(isDuplicateAllocationConflict)) {
    return new OntologyRegistryServiceError({
      code: "duplicate-allocation",
      message: `Ontology allocation plan for pack "${packId}" conflicts with existing registry rows`,
      packId,
      allocationIds: plan.allocations.map((allocation) => allocation.allocationId),
      allocationKeys: buildAllocationConflictKeys(plan.allocations, storeConflicts),
      storeConflicts,
    });
  }

  return new OntologyRegistryServiceError({
    code: "invalid-allocation-plan",
    message: `Ontology allocation plan for pack "${packId}" was rejected by registry persistence validation`,
    packId,
    validation: plan.validation,
    issues: plan.validation.issues,
    storeConflicts,
  });
}

function collectStoreConflicts(
  conflict: OntologyRegistryStoreConflict,
): readonly OntologyRegistryStoreConflict[] {
  if (conflict.code !== "partial-write-rejected") {
    return [conflict];
  }
  return [...conflict.conflicts];
}

function isDuplicateAllocationConflict(
  conflict: OntologyRegistryStoreConflict,
): boolean {
  if (conflict.code === "duplicate-key" || conflict.code === "drift") {
    return conflict.key.recordKind === "allocation";
  }
  if (conflict.code !== "partial-write-rejected") {
    return false;
  }
  return conflict.conflicts.some(isDuplicateAllocationConflict);
}

function buildAllocationConflictKeys(
  allocations: readonly OntologyAddressAllocationRecord[],
  storeConflicts: readonly OntologyRegistryStoreConflict[],
): OntologyAddressAllocationRecordKey[] {
  const keys = new Map<string, OntologyAddressAllocationRecordKey>();
  const addKey = (key: OntologyAddressAllocationRecordKey) => {
    keys.set(JSON.stringify(key), key);
  };
  const addAllocationKeys = (allocation: OntologyAddressAllocationRecord) => {
    addKey({
      recordKind: "allocation",
      allocationId: allocation.allocationId,
    });
    addKey({
      recordKind: "allocation",
      prefix: allocation.prefix,
      versionId: allocation.versionId,
    });
    addKey({
      recordKind: "allocation",
      ontologyId: allocation.ontologyId,
      taxonomyId: allocation.taxonomyId,
      versionId: allocation.versionId,
    });
  };

  for (const conflict of storeConflicts) {
    if (
      (conflict.code === "duplicate-key" || conflict.code === "drift") &&
      conflict.key.recordKind === "allocation"
    ) {
      addKey(conflict.key);
      for (const allocation of allocations) {
        if (allocationMatchesKey(allocation, conflict.key)) {
          addAllocationKeys(allocation);
        }
      }
    }
  }

  return [...keys.values()];
}

function allocationMatchesKey(
  allocation: OntologyAddressAllocationRecord,
  key: OntologyAddressAllocationRecordKey,
): boolean {
  return (
    (key.allocationId === undefined || key.allocationId === allocation.allocationId) &&
    (key.ontologyId === undefined || key.ontologyId === allocation.ontologyId) &&
    (key.taxonomyId === undefined || key.taxonomyId === allocation.taxonomyId) &&
    (key.prefix === undefined || key.prefix === allocation.prefix) &&
    (key.versionId === undefined || key.versionId === allocation.versionId)
  );
}

function missingAllocation(allocationId: string): OntologyRegistryServiceError {
  return new OntologyRegistryServiceError({
    code: "missing-allocation",
    message: `Missing ontology allocation "${allocationId}"`,
    allocationId,
  });
}

function allocationNotActiveSyncPrecondition(
  allocation: OntologyAddressAllocationRecord,
): OntologyRegistryServiceError {
  return new OntologyRegistryServiceError({
    code: "sync-precondition-failure",
    message: `Cannot sync ontology allocation "${allocation.allocationId}" while status is "${allocation.status}"`,
    allocationId: allocation.allocationId,
    reason: "allocation-not-active",
    ontologyId: allocation.ontologyId,
    taxonomyId: allocation.taxonomyId,
    prefix: allocation.prefix,
    versionId: allocation.versionId,
    status: allocation.status,
  });
}

function missingSyncBundleRecord(input: {
  readonly allocation: OntologyIndexMetaSyncBundle["allocation"];
  readonly missingRecordKind: "namespace" | "taxonomy" | "axis" | "segment";
  readonly reason:
    | "missing-namespace"
    | "missing-taxonomy"
    | "missing-axis"
    | "missing-segment";
  readonly message: string;
  readonly taxonomyId?: string;
  readonly axisId?: string;
  readonly axisIds?: readonly string[];
}): OntologyRegistryServiceError {
  return new OntologyRegistryServiceError({
    code: "sync-precondition-failure",
    message: input.message,
    allocationId: input.allocation.allocationId,
    reason: input.reason,
    missingRecordKind: input.missingRecordKind,
    ontologyId: input.allocation.ontologyId,
    taxonomyId: input.taxonomyId ?? input.allocation.taxonomyId,
    axisId: input.axisId,
    axisIds: input.axisIds,
    prefix: input.allocation.prefix,
    versionId: input.allocation.versionId,
    status: input.allocation.status,
  });
}

function duplicateActiveAllocation(
  allocation: OntologyAddressAllocationRecord,
  activeAllocation: OntologyAddressAllocationRecord,
): OntologyRegistryServiceError {
  const prefixVersionKey: OntologyAddressAllocationRecordKey = {
    recordKind: "allocation",
    prefix: allocation.prefix,
    versionId: allocation.versionId,
  };

  return new OntologyRegistryServiceError({
    code: "duplicate-allocation",
    message: `Cannot activate ontology allocation "${allocation.allocationId}" because active allocation "${activeAllocation.allocationId}" already uses prefix "${allocation.prefix}" version "${allocation.versionId}"`,
    allocationIds: [allocation.allocationId, activeAllocation.allocationId],
    allocationKeys: [
      {
        recordKind: "allocation",
        allocationId: allocation.allocationId,
      },
      {
        recordKind: "allocation",
        allocationId: activeAllocation.allocationId,
      },
      prefixVersionKey,
    ],
    storeConflicts: [
      {
        code: "duplicate-key",
        message: `Active allocation "${activeAllocation.allocationId}" already uses prefix "${allocation.prefix}" version "${allocation.versionId}"`,
        key: prefixVersionKey,
      },
    ],
  });
}
