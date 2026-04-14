import type {
  PrefixRegistry,
  PrefixRegistryRecord,
} from "index-meta";
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
import {
  OntologyRegistryStoreError,
  type OntologyAddressAllocationRecord,
  type OntologyAllocationPlanWriteSet,
  type OntologyRegistryStore,
  type OntologyRegistryStoreConflict,
} from "../../stores/ontology-registry-store.js";

export interface OntologyRegistryServiceDeps {
  readonly store: OntologyRegistryStore;
}

export interface RegisterOntologyPackInput {
  readonly pack: OperationalOntologyPack;
}

export interface RegisterOntologyPackResult {
  readonly packId: string;
  readonly validation: OperationalOntologyPackValidationResult;
}

export interface ReserveAddressSpaceInput {
  readonly pack: OperationalOntologyPack;
  readonly policy?: Omit<OntologyAddressAllocationPolicy, "ontologyId"> & {
    readonly ontologyId?: string;
  };
}

export interface ReserveAddressSpaceResult {
  readonly packId: string;
  readonly plan: OntologyAddressAllocationPlan;
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
  readonly prefixRegistry: Pick<PrefixRegistry, "getRecord" | "register">;
}

export interface SyncToPrefixRegistryResult {
  readonly allocation: OntologyAddressAllocationRecord;
  readonly prefixRecord: PrefixRegistryRecord;
  readonly synced: boolean;
  readonly reason?: "already-synced";
}

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
  readonly reason: "allocation-not-active" | "prefix-registry-conflict";
  readonly prefix?: string;
  readonly versionId?: string;
  readonly existing?: PrefixRegistryRecord;
  readonly attempted?: PrefixRegistryRecord;
}

export class OntologyRegistryServiceError extends Error {
  readonly conflict: OntologyRegistryServiceConflict;

  constructor(conflict: OntologyRegistryServiceConflict) {
    super(conflict.message);
    this.name = "OntologyRegistryServiceError";
    this.conflict = conflict;
  }
}

export class OntologyRegistryService {
  private readonly store: OntologyRegistryStore;

  constructor(deps: OntologyRegistryServiceDeps) {
    this.store = deps.store;
  }

  async registerOntologyPack(
    input: RegisterOntologyPackInput,
  ): Promise<RegisterOntologyPackResult> {
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

    return {
      packId: input.pack.packId,
      validation,
    };
  }

  async reserveAddressSpace(
    input: ReserveAddressSpaceInput,
  ): Promise<ReserveAddressSpaceResult> {
    const registration = await this.registerOntologyPack({ pack: input.pack });
    const policy: OntologyAddressAllocationPolicy = {
      ...(input.policy ?? {}),
      ontologyId: input.policy?.ontologyId ?? input.pack.packId,
    };
    const plan = operationalOntologyAllocationPlane.allocateOntologyAddressSpace(
      input.pack.schema,
      policy,
    );

    if (!plan.validation.valid) {
      throw new OntologyRegistryServiceError({
        code: "invalid-allocation-plan",
        message: `Invalid ontology allocation plan for pack "${input.pack.packId}"`,
        packId: input.pack.packId,
        validation: plan.validation,
        issues: plan.validation.issues,
      });
    }

    const writeSet = toWriteSet(plan);
    try {
      await this.store.writeAllocationPlan(writeSet);
    } catch (error) {
      throw mapStoreReservationError(error, input.pack.packId, plan);
    }

    return {
      packId: registration.packId,
      plan,
      allocations: [...writeSet.allocations],
    };
  }

  async activateAllocation(
    input: ActivateAllocationInput,
  ): Promise<ActivateAllocationResult> {
    const allocation = await this.requireAllocation(input.allocationId);
    if (allocation.status !== "reserved") {
      throw new OntologyRegistryServiceError({
        code: "invalid-transition",
        message: `Cannot activate ontology allocation "${allocation.allocationId}" from status "${allocation.status}"`,
        allocationId: allocation.allocationId,
        from: allocation.status,
        to: "active",
      });
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
  ): Promise<SyncToPrefixRegistryResult> {
    const allocation = await this.requireAllocation(input.allocationId);
    const prefixRecord = toPrefixRegistryRecord(allocation);
    if (allocation.status !== "active") {
      throw new OntologyRegistryServiceError({
        code: "sync-precondition-failure",
        message: `Cannot sync ontology allocation "${allocation.allocationId}" while status is "${allocation.status}"`,
        allocationId: allocation.allocationId,
        reason: "allocation-not-active",
        prefix: allocation.prefix,
        versionId: allocation.versionId,
        attempted: prefixRecord,
      });
    }

    const existing = await input.prefixRegistry.getRecord(
      allocation.prefix,
      allocation.versionId,
    );
    if (existing) {
      if (samePrefixRegistryRecord(existing, prefixRecord)) {
        return {
          allocation,
          prefixRecord: existing,
          synced: false,
          reason: "already-synced",
        };
      }

      throw new OntologyRegistryServiceError({
        code: "sync-precondition-failure",
        message: `Prefix registry already has a conflicting record for "${allocation.prefix}/${allocation.versionId}"`,
        allocationId: allocation.allocationId,
        reason: "prefix-registry-conflict",
        prefix: allocation.prefix,
        versionId: allocation.versionId,
        existing,
        attempted: prefixRecord,
      });
    }

    try {
      await input.prefixRegistry.register(prefixRecord);
    } catch (error) {
      throw new OntologyRegistryServiceError({
        code: "sync-precondition-failure",
        message: `Prefix registry sync failed for "${allocation.prefix}/${allocation.versionId}": ${formatUnknownError(error)}`,
        allocationId: allocation.allocationId,
        reason: "prefix-registry-conflict",
        prefix: allocation.prefix,
        versionId: allocation.versionId,
        attempted: prefixRecord,
      });
    }

    return {
      allocation,
      prefixRecord,
      synced: true,
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

function toPrefixRegistryRecord(
  allocation: OntologyAddressAllocationRecord,
): PrefixRegistryRecord {
  return {
    prefix: allocation.prefix,
    versionId: allocation.versionId,
    capacity: allocation.capacity,
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
    return true;
  }
  if (conflict.code !== "partial-write-rejected") {
    return false;
  }
  return conflict.conflicts.some(isDuplicateAllocationConflict);
}

function samePrefixRegistryRecord(
  left: PrefixRegistryRecord,
  right: PrefixRegistryRecord,
): boolean {
  return (
    left.prefix === right.prefix &&
    left.versionId === right.versionId &&
    left.capacity === right.capacity &&
    (left.refs?.length ?? 0) === 0 &&
    (right.refs?.length ?? 0) === 0
  );
}

function missingAllocation(allocationId: string): OntologyRegistryServiceError {
  return new OntologyRegistryServiceError({
    code: "missing-allocation",
    message: `Missing ontology allocation "${allocationId}"`,
    allocationId,
  });
}

function formatUnknownError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
