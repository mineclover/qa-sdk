import type { OntologyAddressModel } from "operational-ontology/allocation";
import type { OperationalOntologyPack } from "operational-ontology/pack";
import type {
  OntologyAddressAllocationRecord,
  OntologyNamespaceRecord,
} from "../../stores/ontology-registry-store.js";
import type {
  OntologyIndexMetaSyncDeferredReport,
  OntologyIndexMetaSyncMaterializationReport,
  OntologyIndexMetaSyncReport,
} from "./index-meta-sync.adapter.js";
import {
  OntologyRegistryServiceError,
  type ActivateAllocationResult,
  type RegisterOntologyPackOptions,
  type RegisterOntologyPackResult,
  type SyncToPrefixRegistryResult,
} from "./ontology-registry.service.js";

export interface OntologyPackActivationOptions {
  readonly ontologyId?: string;
  readonly namespace?: string;
  readonly owner?: string;
  readonly versionId?: string;
  readonly addressModel?: OntologyAddressModel;
  readonly capacityByAxisId?: Readonly<Record<string, number>>;
  readonly capacityByTaxonomyId?: Readonly<Record<string, number>>;
  readonly prefixByTaxonomyId?: Readonly<Record<string, string>>;
  readonly timestamp?: string;
  readonly now?: string;
}

export type OntologyPackActivationPhase =
  | "register"
  | "activate"
  | "sync"
  | "smoke";

export type OntologyPackActivationResultStatus = "succeeded" | "failed";

export type OntologyAllocationActivationState =
  | "active"
  | "sync-blocked"
  | "sync-deferred"
  | "failed"
  | "skipped";

export interface OntologyAllocationActivationStatus {
  readonly allocationId: string;
  readonly taxonomyId: string;
  readonly prefix: string;
  readonly versionId: string;
  readonly status: OntologyAddressAllocationRecord["status"];
  readonly activationStatus: OntologyAllocationActivationState;
  readonly syncStatus?: OntologyIndexMetaSyncReport["syncStatus"] | "skipped";
}

export type OntologyActivationSmokeCheckName =
  | "source-allocation-active"
  | "product-prefix-record-matches"
  | "schema-version-capacity-matches-prefix-registry"
  | "product-shape-matches-ordered-axis-capacities"
  | "last-valid-address-in-range"
  | "capacity-address-out-of-range";

export interface OntologyActivationSmokeCheckAssertion {
  readonly name: OntologyActivationSmokeCheckName;
  readonly passed: boolean;
  readonly message: string;
  readonly details?: unknown;
}

export interface OntologyAllocationActivationSmokeChecks {
  readonly allocationId: string;
  readonly taxonomyId: string;
  readonly prefix: string;
  readonly versionId: string;
  readonly addressModel: OntologyAddressAllocationRecord["addressModel"];
  readonly kind: "product";
  readonly syncStatus: OntologyIndexMetaSyncReport["syncStatus"];
  readonly passed: boolean;
  readonly checks: readonly OntologyActivationSmokeCheckAssertion[];
}

export interface OntologyPackActivationIssue {
  readonly level: "warning" | "error";
  readonly phase: OntologyPackActivationPhase;
  readonly message: string;
  readonly code?: string;
  readonly allocationId?: string;
  readonly details?: unknown;
}

export interface OntologyPackActivationResult {
  readonly status: OntologyPackActivationResultStatus;
  readonly packId: string;
  readonly ontologyId: string;
  readonly namespaceRecord: OntologyNamespaceRecord | null;
  readonly allocations: readonly OntologyAddressAllocationRecord[];
  readonly activationStatuses: readonly OntologyAllocationActivationStatus[];
  readonly syncReports: readonly SyncToPrefixRegistryResult[];
  readonly smokeChecks: readonly OntologyAllocationActivationSmokeChecks[];
  readonly warnings: readonly OntologyPackActivationIssue[];
  readonly errors: readonly OntologyPackActivationIssue[];
}

export interface OntologyPackActivationRegistryServicePort {
  registerOntologyPack(input: {
    readonly pack: OperationalOntologyPack;
    readonly options?: RegisterOntologyPackOptions;
  }): Promise<RegisterOntologyPackResult>;
  activateAllocation(input: {
    readonly allocationId: string;
  }): Promise<ActivateAllocationResult>;
  syncToPrefixRegistry(input: {
    readonly allocationId: string;
  }): Promise<SyncToPrefixRegistryResult>;
}

export class OntologyPackActivationHelper {
  constructor(
    private readonly registryService: OntologyPackActivationRegistryServicePort,
  ) {}

  activateOntologyPack(
    pack: OperationalOntologyPack,
    options: OntologyPackActivationOptions = {},
  ): Promise<OntologyPackActivationResult> {
    return activateOntologyPack(this.registryService, pack, options);
  }
}

export async function activateOntologyPack(
  registryService: OntologyPackActivationRegistryServicePort,
  pack: OperationalOntologyPack,
  options: OntologyPackActivationOptions = {},
): Promise<OntologyPackActivationResult> {
  const warnings = collectOptionWarnings(options);
  const errors: OntologyPackActivationIssue[] = [];
  const syncReports: SyncToPrefixRegistryResult[] = [];
  const activationStatuses: OntologyAllocationActivationStatus[] = [];
  const smokeChecks: OntologyAllocationActivationSmokeChecks[] = [];
  const allocationById = new Map<string, OntologyAddressAllocationRecord>();
  let registration: RegisterOntologyPackResult | null = null;

  try {
    registration = await registryService.registerOntologyPack({
      pack,
      options: toRegisterOptions(options),
    });
  } catch (error) {
    errors.push(toActivationErrorIssue(error, "register"));
    return buildResult({
      pack,
      options,
      registration,
      allocationById,
      activationStatuses,
      syncReports,
      smokeChecks,
      warnings,
      errors,
    });
  }

  for (const allocation of registration.allocations) {
    allocationById.set(allocation.allocationId, allocation);

    if (errors.length > 0) {
      activationStatuses.push(toSkippedActivationStatus(allocation));
      continue;
    }

    let activated: ActivateAllocationResult;
    try {
      activated = await registryService.activateAllocation({
        allocationId: allocation.allocationId,
      });
      allocationById.set(allocation.allocationId, activated.allocation);
    } catch (error) {
      errors.push(
        toActivationErrorIssue(error, "activate", allocation.allocationId),
      );
      activationStatuses.push(toFailedActivationStatus(allocation));
      continue;
    }

    let syncReport: SyncToPrefixRegistryResult;
    try {
      syncReport = await registryService.syncToPrefixRegistry({
        allocationId: activated.allocation.allocationId,
      });
      syncReports.push(syncReport);
    } catch (error) {
      errors.push(
        toActivationErrorIssue(
          error,
          "sync",
          activated.allocation.allocationId,
        ),
      );
      activationStatuses.push(toFailedSyncStatus(activated.allocation));
      continue;
    }

    if (syncReport.syncStatus === "blocked") {
      errors.push(toBlockedSyncIssue(syncReport));
      activationStatuses.push(toBlockedSyncStatus(activated.allocation));
      continue;
    }

    if (syncReport.syncStatus === "deferred") {
      warnings.push(toDeferredSyncWarning(syncReport));
      activationStatuses.push(toDeferredSyncStatus(activated.allocation));
      continue;
    }

    const productSmokeChecks = toProductActivationSmokeChecks(
      activated.allocation,
      syncReport,
    );
    if (productSmokeChecks) {
      smokeChecks.push(productSmokeChecks);
      if (!productSmokeChecks.passed) {
        errors.push(toSmokeCheckFailureIssue(productSmokeChecks));
      }
    }

    activationStatuses.push(toActiveSyncStatus(activated.allocation));
  }

  return buildResult({
    pack,
    options,
    registration,
    allocationById,
    activationStatuses,
    syncReports,
    smokeChecks,
    warnings,
    errors,
  });
}

function toRegisterOptions(
  options: OntologyPackActivationOptions,
): RegisterOntologyPackOptions {
  const now = options.timestamp ?? options.now;
  return withoutUndefined({
    ontologyId: options.ontologyId,
    namespace: options.namespace,
    owner: options.owner,
    versionId: options.versionId,
    now,
    addressModel: options.addressModel,
    capacityByAxisId: options.capacityByAxisId,
    capacityByTaxonomyId: options.capacityByTaxonomyId,
    prefixByTaxonomyId: options.prefixByTaxonomyId,
  });
}

function collectOptionWarnings(
  options: OntologyPackActivationOptions,
): OntologyPackActivationIssue[] {
  if (
    options.timestamp &&
    options.now &&
    options.timestamp !== options.now
  ) {
    return [
      {
        level: "warning",
        phase: "register",
        code: "timestamp-overrides-now",
        message:
          "Both timestamp and now were provided; timestamp was used for ontology allocation records.",
      },
    ];
  }

  return [];
}

function buildResult(input: {
  readonly pack: OperationalOntologyPack;
  readonly options: OntologyPackActivationOptions;
  readonly registration: RegisterOntologyPackResult | null;
  readonly allocationById: ReadonlyMap<string, OntologyAddressAllocationRecord>;
  readonly activationStatuses: readonly OntologyAllocationActivationStatus[];
  readonly syncReports: readonly SyncToPrefixRegistryResult[];
  readonly smokeChecks: readonly OntologyAllocationActivationSmokeChecks[];
  readonly warnings: readonly OntologyPackActivationIssue[];
  readonly errors: readonly OntologyPackActivationIssue[];
}): OntologyPackActivationResult {
  const allocations =
    input.registration?.allocations.map(
      (allocation) =>
        input.allocationById.get(allocation.allocationId) ?? allocation,
    ) ?? [];

  return {
    status: input.errors.length === 0 ? "succeeded" : "failed",
    packId: input.registration?.packId ?? input.pack.packId,
    ontologyId:
      input.registration?.ontologyId ??
      input.options.ontologyId ??
      input.pack.packId,
    namespaceRecord: input.registration?.plan.namespace ?? null,
    allocations,
    activationStatuses: input.activationStatuses,
    syncReports: input.syncReports,
    smokeChecks: input.smokeChecks,
    warnings: input.warnings,
    errors: input.errors,
  };
}

function toProductActivationSmokeChecks(
  allocation: OntologyAddressAllocationRecord,
  report: SyncToPrefixRegistryResult,
): OntologyAllocationActivationSmokeChecks | null {
  if (allocation.addressModel !== "product") {
    return null;
  }

  const materializedReport = isMaterializationReport(report) ? report : null;
  const allocationTarget = materializedReport
    ? findAllocationTargetCheck(materializedReport, allocation)
    : undefined;
  const productAllocation =
    materializedReport?.postSyncChecks.productAllocation;
  const schemaVersionCapacityMatchesPrefixRegistry =
    allocationTarget?.prefixRegistryRecordExists === true &&
    allocationTarget.schemaVersionCapacityExists === true &&
    allocationTarget.prefixRegistryCapacity ===
      allocationTarget.schemaVersionCapacity &&
    allocationTarget.prefixRegistryCapacityMatches &&
    allocationTarget.schemaVersionCapacityMatches;

  const checks: OntologyActivationSmokeCheckAssertion[] = [
    {
      name: "source-allocation-active",
      passed: allocation.status === "active",
      message: `Source allocation "${allocation.allocationId}" is active before smoke checks run.`,
      details: { status: allocation.status },
    },
    {
      name: "product-prefix-record-matches",
      passed: allocationTarget?.prefixRegistryRecordMatchesIntended === true,
      message: `PrefixRegistry.getRecord("${allocation.prefix}", "${allocation.versionId}") returns the intended product allocation prefix record.`,
      details: {
        prefix: allocation.prefix,
        versionId: allocation.versionId,
        prefixRegistryRecordExists:
          allocationTarget?.prefixRegistryRecordExists ?? false,
        prefixRegistryRecordMatchesIntended:
          allocationTarget?.prefixRegistryRecordMatchesIntended ?? false,
        prefixRegistryRefsMatch:
          allocationTarget?.prefixRegistryRefsMatch ?? false,
      },
    },
    {
      name: "schema-version-capacity-matches-prefix-registry",
      passed: schemaVersionCapacityMatchesPrefixRegistry,
      message: `Schema version capacity matches PrefixRegistry capacity for "${allocation.prefix}/${allocation.versionId}".`,
      details: {
        prefixRegistryCapacity: allocationTarget?.prefixRegistryCapacity,
        schemaVersionCapacity: allocationTarget?.schemaVersionCapacity,
        prefixRegistryCapacityMatches:
          allocationTarget?.prefixRegistryCapacityMatches ?? false,
        schemaVersionCapacityMatches:
          allocationTarget?.schemaVersionCapacityMatches ?? false,
      },
    },
    {
      name: "product-shape-matches-ordered-axis-capacities",
      passed:
        productAllocation?.shapeMatchesOrderedAxisCapacities === true,
      message: `PrefixRegistry.getShape("${allocation.prefix}", "${allocation.versionId}") equals ordered axis capacities.`,
      details: {
        expectedShape: productAllocation?.expectedShape,
        actualShape: productAllocation?.actualShape,
      },
    },
    {
      name: "last-valid-address-in-range",
      passed:
        productAllocation?.resolverChecks.lastValidAddressInRange === true,
      message: `Last valid address index resolves in range for "${allocation.prefix}/${allocation.versionId}".`,
      details: productAllocation?.resolverChecks.lastValidAddress,
    },
    {
      name: "capacity-address-out-of-range",
      passed:
        productAllocation?.resolverChecks.capacityAddressOutOfRange === true,
      message: `Capacity address index resolves as out of range for "${allocation.prefix}/${allocation.versionId}".`,
      details: productAllocation?.resolverChecks.capacityAddress,
    },
  ];

  return {
    allocationId: allocation.allocationId,
    taxonomyId: allocation.taxonomyId,
    prefix: allocation.prefix,
    versionId: allocation.versionId,
    addressModel: allocation.addressModel,
    kind: "product",
    syncStatus: report.syncStatus,
    passed: checks.every((check) => check.passed),
    checks,
  };
}

function isMaterializationReport(
  report: SyncToPrefixRegistryResult,
): report is OntologyIndexMetaSyncMaterializationReport {
  return "postSyncChecks" in report;
}

function findAllocationTargetCheck(
  report: OntologyIndexMetaSyncMaterializationReport,
  allocation: OntologyAddressAllocationRecord,
) {
  return report.postSyncChecks.targetRecords.find(
    (target) =>
      target.role === "allocation-prefix" &&
      target.prefix === allocation.prefix &&
      target.versionId === allocation.versionId,
  );
}

function toActiveSyncStatus(
  allocation: OntologyAddressAllocationRecord,
): OntologyAllocationActivationStatus {
  return {
    allocationId: allocation.allocationId,
    taxonomyId: allocation.taxonomyId,
    prefix: allocation.prefix,
    versionId: allocation.versionId,
    status: allocation.status,
    activationStatus: "active",
    syncStatus: "synced",
  };
}

function toBlockedSyncStatus(
  allocation: OntologyAddressAllocationRecord,
): OntologyAllocationActivationStatus {
  return {
    allocationId: allocation.allocationId,
    taxonomyId: allocation.taxonomyId,
    prefix: allocation.prefix,
    versionId: allocation.versionId,
    status: allocation.status,
    activationStatus: "sync-blocked",
    syncStatus: "blocked",
  };
}

function toDeferredSyncStatus(
  allocation: OntologyAddressAllocationRecord,
): OntologyAllocationActivationStatus {
  return {
    allocationId: allocation.allocationId,
    taxonomyId: allocation.taxonomyId,
    prefix: allocation.prefix,
    versionId: allocation.versionId,
    status: allocation.status,
    activationStatus: "sync-deferred",
    syncStatus: "deferred",
  };
}

function toFailedSyncStatus(
  allocation: OntologyAddressAllocationRecord,
): OntologyAllocationActivationStatus {
  return {
    allocationId: allocation.allocationId,
    taxonomyId: allocation.taxonomyId,
    prefix: allocation.prefix,
    versionId: allocation.versionId,
    status: allocation.status,
    activationStatus: "failed",
  };
}

function toFailedActivationStatus(
  allocation: OntologyAddressAllocationRecord,
): OntologyAllocationActivationStatus {
  return {
    allocationId: allocation.allocationId,
    taxonomyId: allocation.taxonomyId,
    prefix: allocation.prefix,
    versionId: allocation.versionId,
    status: allocation.status,
    activationStatus: "failed",
  };
}

function toSkippedActivationStatus(
  allocation: OntologyAddressAllocationRecord,
): OntologyAllocationActivationStatus {
  return {
    allocationId: allocation.allocationId,
    taxonomyId: allocation.taxonomyId,
    prefix: allocation.prefix,
    versionId: allocation.versionId,
    status: allocation.status,
    activationStatus: "skipped",
    syncStatus: "skipped",
  };
}

function toActivationErrorIssue(
  error: unknown,
  phase: OntologyPackActivationPhase,
  allocationId?: string,
): OntologyPackActivationIssue {
  if (error instanceof OntologyRegistryServiceError) {
    return {
      level: "error",
      phase,
      code: error.conflict.code,
      message: error.message,
      allocationId,
      details: error.conflict,
    };
  }

  if (error instanceof Error) {
    return {
      level: "error",
      phase,
      code: "unexpected-error",
      message: error.message,
      allocationId,
    };
  }

  return {
    level: "error",
    phase,
    code: "unexpected-error",
    message: "Unexpected ontology activation error",
    allocationId,
  };
}

function toBlockedSyncIssue(
  report: SyncToPrefixRegistryResult,
): OntologyPackActivationIssue {
  return {
    level: "error",
    phase: "sync",
    code: "sync-blocked",
    message: `Index-meta sync was blocked for ontology allocation "${report.allocationId}".`,
    allocationId: report.allocationId,
    details:
      "collisions" in report
        ? { collisions: report.collisions }
        : { syncStatus: report.syncStatus },
  };
}

function toDeferredSyncWarning(
  report: OntologyIndexMetaSyncDeferredReport,
): OntologyPackActivationIssue {
  return {
    level: "warning",
    phase: "sync",
    code: report.deferredReason,
    message: `Index-meta sync was deferred for ontology allocation "${report.allocationId}".`,
    allocationId: report.allocationId,
  };
}

function toSmokeCheckFailureIssue(
  smokeChecks: OntologyAllocationActivationSmokeChecks,
): OntologyPackActivationIssue {
  return {
    level: "error",
    phase: "smoke",
    code: "activation-smoke-check-failed",
    message: `Activation smoke checks failed for ontology allocation "${smokeChecks.allocationId}".`,
    allocationId: smokeChecks.allocationId,
    details: {
      failedChecks: smokeChecks.checks.filter((check) => !check.passed),
    },
  };
}

function withoutUndefined<T extends Record<string, unknown>>(input: T): T {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined),
  ) as T;
}
