// @def.boundary registry-system
// @def.doc registry-system

import type { OntologyAddressModel } from 'operational-ontology/allocation';
import type { OperationalOntologyPack } from 'operational-ontology/pack';
import type {
  OntologyAddressAllocationRecord,
  OntologyNamespaceRecord,
} from '../../stores/ontology-registry-store.js';
import type {
  OntologyIndexMetaSyncDeferredReport,
  OntologyIndexMetaSyncMaterializationReport,
  OntologyIndexMetaSyncReport,
} from './index-meta-sync.adapter.js';
import {
  OntologyRegistryServiceError,
  type ActivateAllocationResult,
  type RegisterOntologyPackOptions,
  type RegisterOntologyPackResult,
  type SyncToPrefixRegistryResult,
} from './ontology-registry.service.js';

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

export type OntologyPackActivationPhase = 'register' | 'activate' | 'sync' | 'smoke';

export type OntologyPackActivationResultStatus = 'succeeded' | 'failed';

export type OntologyAllocationActivationState =
  | 'active'
  | 'sync-blocked'
  | 'sync-deferred'
  | 'failed'
  | 'skipped';

export interface OntologyAllocationActivationStatus {
  readonly allocationId: string;
  readonly taxonomyId: string;
  readonly prefix: string;
  readonly versionId: string;
  readonly status: OntologyAddressAllocationRecord['status'];
  readonly activationStatus: OntologyAllocationActivationState;
  readonly syncStatus?: OntologyIndexMetaSyncReport['syncStatus'] | 'skipped';
}

export interface OntologyNamespaceActivationSummary {
  readonly ontologyId: string;
  readonly namespace: string;
  readonly owner?: string;
  readonly lifecycle: OntologyNamespaceRecord['lifecycle'];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface OntologyAllocationRecordActivationSummary {
  readonly allocationId: string;
  readonly ontologyId: string;
  readonly taxonomyId: string;
  readonly prefix: string;
  readonly versionId: string;
  readonly addressModel: OntologyAddressAllocationRecord['addressModel'];
  readonly capacity: number;
  readonly addressOffset: number;
  readonly addressSize: number;
  readonly status: OntologyAddressAllocationRecord['status'];
  readonly activationStatus?: OntologyAllocationActivationState;
  readonly syncStatus?: OntologyIndexMetaSyncReport['syncStatus'] | 'skipped';
}

export interface OntologyAllocationSyncSummary {
  readonly allocationId: string;
  readonly taxonomyId: string;
  readonly prefix: string;
  readonly versionId: string;
  readonly syncStatus: OntologyIndexMetaSyncReport['syncStatus'];
  readonly materializedRecordCount: number;
  readonly idempotentRecordCount: number;
  readonly repairedRecordCount: number;
  readonly collisionCount: number;
  readonly deferredSemanticCount: number;
  readonly targetRecordCount: number;
  readonly deferredReason?: OntologyIndexMetaSyncDeferredReport['deferredReason'];
}

export type OntologyActivationSmokeCheckName =
  | 'source-allocation-active'
  | 'product-prefix-record-matches'
  | 'sum-prefix-leaf-record-exists'
  | 'schema-version-capacity-matches-prefix-registry'
  | 'schema-version-capacity-matches-sum-allocation'
  | 'product-shape-matches-ordered-axis-capacities'
  | 'last-valid-address-in-range'
  | 'capacity-address-out-of-range'
  | 'sum-segment-sidecar-covers-allocation-range';

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
  readonly addressModel: OntologyAddressAllocationRecord['addressModel'];
  readonly kind: 'product' | 'sum';
  readonly syncStatus: OntologyIndexMetaSyncReport['syncStatus'];
  readonly passed: boolean;
  readonly checks: readonly OntologyActivationSmokeCheckAssertion[];
}

export interface OntologyAllocationSmokeCheckSummary {
  readonly allocationId: string;
  readonly taxonomyId: string;
  readonly prefix: string;
  readonly versionId: string;
  readonly addressModel: OntologyAddressAllocationRecord['addressModel'];
  readonly kind: OntologyAllocationActivationSmokeChecks['kind'];
  readonly syncStatus: OntologyIndexMetaSyncReport['syncStatus'];
  readonly passed: boolean;
  readonly checkCount: number;
  readonly passedCheckCount: number;
  readonly failedCheckCount: number;
}

export interface OntologyActivationSmokeCheckSummary {
  readonly allocationCount: number;
  readonly passedAllocationCount: number;
  readonly failedAllocationCount: number;
  readonly checkCount: number;
  readonly passedCheckCount: number;
  readonly failedCheckCount: number;
  readonly byAllocationId: Readonly<Record<string, OntologyAllocationSmokeCheckSummary>>;
}

export interface OntologyPackActivationIssue {
  readonly level: 'warning' | 'error';
  readonly phase: OntologyPackActivationPhase;
  readonly message: string;
  readonly code?: string;
  readonly allocationId?: string;
  readonly taxonomyId?: string;
  readonly prefix?: string;
  readonly versionId?: string;
  readonly details?: unknown;
}

export interface OntologyPackActivationResult {
  readonly status: OntologyPackActivationResultStatus;
  readonly packId: string;
  readonly ontologyId: string;
  readonly namespaceRecord: OntologyNamespaceRecord | null;
  readonly namespaceSummary: OntologyNamespaceActivationSummary | null;
  readonly allocations: readonly OntologyAddressAllocationRecord[];
  readonly allocationSummaries: readonly OntologyAllocationRecordActivationSummary[];
  readonly activationStatuses: readonly OntologyAllocationActivationStatus[];
  readonly syncReports: readonly SyncToPrefixRegistryResult[];
  readonly syncSummariesByAllocationId: Readonly<Record<string, OntologyAllocationSyncSummary>>;
  readonly smokeChecks: readonly OntologyAllocationActivationSmokeChecks[];
  readonly smokeCheckSummary: OntologyActivationSmokeCheckSummary;
  readonly warnings: readonly OntologyPackActivationIssue[];
  readonly errors: readonly OntologyPackActivationIssue[];
}

export interface OntologyPackActivationRegistryServicePort {
  registerOntologyPack(input: {
    readonly pack: OperationalOntologyPack;
    readonly options?: RegisterOntologyPackOptions;
  }): Promise<RegisterOntologyPackResult>;
  activateAllocation(input: { readonly allocationId: string }): Promise<ActivateAllocationResult>;
  syncToPrefixRegistry(input: {
    readonly allocationId: string;
  }): Promise<SyncToPrefixRegistryResult>;
}

export class OntologyPackActivationHelper {
  constructor(private readonly registryService: OntologyPackActivationRegistryServicePort) {}

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
    errors.push(toActivationErrorIssue(error, 'register'));
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
      errors.push(toActivationErrorIssue(error, 'activate', allocation));
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
      errors.push(toActivationErrorIssue(error, 'sync', activated.allocation));
      activationStatuses.push(toFailedSyncStatus(activated.allocation));
      continue;
    }

    if (syncReport.syncStatus === 'blocked') {
      errors.push(toBlockedSyncIssue(syncReport));
      activationStatuses.push(toBlockedSyncStatus(activated.allocation));
      continue;
    }

    if (syncReport.syncStatus === 'deferred') {
      warnings.push(toDeferredSyncWarning(syncReport));
      activationStatuses.push(toDeferredSyncStatus(activated.allocation));
      continue;
    }

    const activationSmokeChecks =
      toProductActivationSmokeChecks(activated.allocation, syncReport) ??
      toSumActivationSmokeChecks(activated.allocation, syncReport);
    if (activationSmokeChecks) {
      smokeChecks.push(activationSmokeChecks);
      if (!activationSmokeChecks.passed) {
        errors.push(toSmokeCheckFailureIssue(activationSmokeChecks));
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

function toRegisterOptions(options: OntologyPackActivationOptions): RegisterOntologyPackOptions {
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
  if (options.timestamp && options.now && options.timestamp !== options.now) {
    return [
      {
        level: 'warning',
        phase: 'register',
        code: 'timestamp-overrides-now',
        message:
          'Both timestamp and now were provided; timestamp was used for ontology allocation records.',
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
      (allocation) => input.allocationById.get(allocation.allocationId) ?? allocation,
    ) ?? [];

  return {
    status: input.errors.length === 0 ? 'succeeded' : 'failed',
    packId: input.registration?.packId ?? input.pack.packId,
    ontologyId: input.registration?.ontologyId ?? input.options.ontologyId ?? input.pack.packId,
    namespaceRecord: input.registration?.plan.namespace ?? null,
    namespaceSummary: toNamespaceSummary(input.registration?.plan.namespace ?? null),
    allocations,
    allocationSummaries: allocations.map((allocation) =>
      toAllocationSummary(allocation, input.activationStatuses),
    ),
    activationStatuses: input.activationStatuses,
    syncReports: input.syncReports,
    syncSummariesByAllocationId: toSyncSummariesByAllocationId(input.syncReports),
    smokeChecks: input.smokeChecks,
    smokeCheckSummary: toSmokeCheckSummary(input.smokeChecks),
    warnings: input.warnings,
    errors: input.errors,
  };
}

function toNamespaceSummary(
  namespaceRecord: OntologyNamespaceRecord | null,
): OntologyNamespaceActivationSummary | null {
  if (!namespaceRecord) {
    return null;
  }

  return {
    ontologyId: namespaceRecord.ontologyId,
    namespace: namespaceRecord.namespace,
    owner: namespaceRecord.owner,
    lifecycle: namespaceRecord.lifecycle,
    createdAt: namespaceRecord.createdAt,
    updatedAt: namespaceRecord.updatedAt,
  };
}

function toAllocationSummary(
  allocation: OntologyAddressAllocationRecord,
  activationStatuses: readonly OntologyAllocationActivationStatus[],
): OntologyAllocationRecordActivationSummary {
  const activationStatus = activationStatuses.find(
    (status) => status.allocationId === allocation.allocationId,
  );

  return withoutUndefined({
    allocationId: allocation.allocationId,
    ontologyId: allocation.ontologyId,
    taxonomyId: allocation.taxonomyId,
    prefix: allocation.prefix,
    versionId: allocation.versionId,
    addressModel: allocation.addressModel,
    capacity: allocation.capacity,
    addressOffset: allocation.addressOffset,
    addressSize: allocation.addressSize,
    status: allocation.status,
    activationStatus: activationStatus?.activationStatus,
    syncStatus: activationStatus?.syncStatus,
  });
}

function toSyncSummariesByAllocationId(
  syncReports: readonly SyncToPrefixRegistryResult[],
): Readonly<Record<string, OntologyAllocationSyncSummary>> {
  return Object.fromEntries(
    syncReports.map((report) => [report.allocationId, toSyncSummary(report)]),
  );
}

function toSyncSummary(report: SyncToPrefixRegistryResult): OntologyAllocationSyncSummary {
  if (isMaterializationReport(report)) {
    return {
      allocationId: report.allocationId,
      taxonomyId: report.taxonomyId,
      prefix: report.prefix,
      versionId: report.versionId,
      syncStatus: report.syncStatus,
      materializedRecordCount: report.materializedRecords.length,
      idempotentRecordCount: report.idempotentRecords.length,
      repairedRecordCount: report.repairedRecords.length,
      collisionCount: report.collisions.length,
      deferredSemanticCount: report.deferredSemantics.length,
      targetRecordCount: report.postSyncChecks.targetRecords.length,
    };
  }

  return {
    allocationId: report.allocationId,
    taxonomyId: report.taxonomyId,
    prefix: report.prefix,
    versionId: report.versionId,
    syncStatus: report.syncStatus,
    materializedRecordCount: 0,
    idempotentRecordCount: 0,
    repairedRecordCount: 0,
    collisionCount: 0,
    deferredSemanticCount: 0,
    targetRecordCount: 0,
    deferredReason: report.deferredReason,
  };
}

function toSmokeCheckSummary(
  smokeChecks: readonly OntologyAllocationActivationSmokeChecks[],
): OntologyActivationSmokeCheckSummary {
  const byAllocationId = Object.fromEntries(
    smokeChecks.map((smokeCheck) => [
      smokeCheck.allocationId,
      toAllocationSmokeCheckSummary(smokeCheck),
    ]),
  );
  const checkCount = smokeChecks.reduce(
    (total, smokeCheck) => total + smokeCheck.checks.length,
    0,
  );
  const passedCheckCount = smokeChecks.reduce(
    (total, smokeCheck) =>
      total + smokeCheck.checks.filter((check) => check.passed).length,
    0,
  );

  return {
    allocationCount: smokeChecks.length,
    passedAllocationCount: smokeChecks.filter((smokeCheck) => smokeCheck.passed).length,
    failedAllocationCount: smokeChecks.filter((smokeCheck) => !smokeCheck.passed).length,
    checkCount,
    passedCheckCount,
    failedCheckCount: checkCount - passedCheckCount,
    byAllocationId,
  };
}

function toAllocationSmokeCheckSummary(
  smokeCheck: OntologyAllocationActivationSmokeChecks,
): OntologyAllocationSmokeCheckSummary {
  const passedCheckCount = smokeCheck.checks.filter((check) => check.passed).length;

  return {
    allocationId: smokeCheck.allocationId,
    taxonomyId: smokeCheck.taxonomyId,
    prefix: smokeCheck.prefix,
    versionId: smokeCheck.versionId,
    addressModel: smokeCheck.addressModel,
    kind: smokeCheck.kind,
    syncStatus: smokeCheck.syncStatus,
    passed: smokeCheck.passed,
    checkCount: smokeCheck.checks.length,
    passedCheckCount,
    failedCheckCount: smokeCheck.checks.length - passedCheckCount,
  };
}

function toProductActivationSmokeChecks(
  allocation: OntologyAddressAllocationRecord,
  report: SyncToPrefixRegistryResult,
): OntologyAllocationActivationSmokeChecks | null {
  if (allocation.addressModel !== 'product') {
    return null;
  }

  const materializedReport = isMaterializationReport(report) ? report : null;
  const allocationTarget = materializedReport
    ? findAllocationTargetCheck(materializedReport, allocation)
    : undefined;
  const productAllocation = materializedReport?.postSyncChecks.productAllocation;
  const schemaVersionCapacityMatchesPrefixRegistry =
    allocationTarget?.prefixRegistryRecordExists === true &&
    allocationTarget.schemaVersionCapacityExists === true &&
    allocationTarget.prefixRegistryCapacity === allocationTarget.schemaVersionCapacity &&
    allocationTarget.prefixRegistryCapacityMatches &&
    allocationTarget.schemaVersionCapacityMatches;

  const checks: OntologyActivationSmokeCheckAssertion[] = [
    {
      name: 'source-allocation-active',
      passed: allocation.status === 'active',
      message: `Source allocation "${allocation.allocationId}" is active before smoke checks run.`,
      details: { status: allocation.status },
    },
    {
      name: 'product-prefix-record-matches',
      passed: allocationTarget?.prefixRegistryRecordMatchesIntended === true,
      message: `PrefixRegistry.getRecord("${allocation.prefix}", "${allocation.versionId}") returns the intended product allocation prefix record.`,
      details: {
        prefix: allocation.prefix,
        versionId: allocation.versionId,
        prefixRegistryRecordExists: allocationTarget?.prefixRegistryRecordExists ?? false,
        prefixRegistryRecordMatchesIntended:
          allocationTarget?.prefixRegistryRecordMatchesIntended ?? false,
        prefixRegistryRefsMatch: allocationTarget?.prefixRegistryRefsMatch ?? false,
      },
    },
    {
      name: 'schema-version-capacity-matches-prefix-registry',
      passed: schemaVersionCapacityMatchesPrefixRegistry,
      message: `Schema version capacity matches PrefixRegistry capacity for "${allocation.prefix}/${allocation.versionId}".`,
      details: {
        prefixRegistryCapacity: allocationTarget?.prefixRegistryCapacity,
        schemaVersionCapacity: allocationTarget?.schemaVersionCapacity,
        prefixRegistryCapacityMatches: allocationTarget?.prefixRegistryCapacityMatches ?? false,
        schemaVersionCapacityMatches: allocationTarget?.schemaVersionCapacityMatches ?? false,
      },
    },
    {
      name: 'product-shape-matches-ordered-axis-capacities',
      passed: productAllocation?.shapeMatchesOrderedAxisCapacities === true,
      message: `PrefixRegistry.getShape("${allocation.prefix}", "${allocation.versionId}") equals ordered axis capacities.`,
      details: {
        expectedShape: productAllocation?.expectedShape,
        actualShape: productAllocation?.actualShape,
      },
    },
    {
      name: 'last-valid-address-in-range',
      passed: productAllocation?.resolverChecks.lastValidAddressInRange === true,
      message: `Last valid address index resolves in range for "${allocation.prefix}/${allocation.versionId}".`,
      details: productAllocation?.resolverChecks.lastValidAddress,
    },
    {
      name: 'capacity-address-out-of-range',
      passed: productAllocation?.resolverChecks.capacityAddressOutOfRange === true,
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
    kind: 'product',
    syncStatus: report.syncStatus,
    passed: checks.every((check) => check.passed),
    checks,
  };
}

function toSumActivationSmokeChecks(
  allocation: OntologyAddressAllocationRecord,
  report: SyncToPrefixRegistryResult,
): OntologyAllocationActivationSmokeChecks | null {
  if (allocation.addressModel !== 'sum') {
    return null;
  }

  const materializedReport = isMaterializationReport(report) ? report : null;
  const allocationTarget = materializedReport
    ? findAllocationTargetCheck(materializedReport, allocation)
    : undefined;
  const sumAllocation = materializedReport?.postSyncChecks.sumAllocation;
  const prefixRegistryLeafRecordExists =
    allocationTarget?.prefixRegistryRecordExists === true &&
    allocationTarget.prefixRegistryRecordMatchesIntended &&
    allocationTarget.prefixRegistryRefsMatch;
  const schemaVersionCapacityMatchesSumAllocation =
    allocationTarget?.schemaVersionCapacityExists === true &&
    allocationTarget.schemaVersionCapacity === allocation.capacity &&
    allocationTarget.schemaVersionCapacityMatches;
  const segmentSidecarCoversAllocationRange =
    sumAllocation?.coveragePolicy === 'exact-allocation-range' &&
    sumAllocation.segmentSidecarCoversAllocation &&
    sumAllocation.allocationStart === allocation.addressOffset &&
    sumAllocation.allocationEnd === allocation.addressOffset + allocation.addressSize &&
    sumAllocation.coveredSize === allocation.addressSize;

  const checks: OntologyActivationSmokeCheckAssertion[] = [
    {
      name: 'source-allocation-active',
      passed: allocation.status === 'active',
      message: `Source allocation "${allocation.allocationId}" is active before smoke checks run.`,
      details: { status: allocation.status },
    },
    {
      name: 'sum-prefix-leaf-record-exists',
      passed: prefixRegistryLeafRecordExists,
      message: `PrefixRegistry.getRecord("${allocation.prefix}", "${allocation.versionId}") returns the intended sum allocation leaf record.`,
      details: {
        prefix: allocation.prefix,
        versionId: allocation.versionId,
        expectedCapacity: allocation.capacity,
        prefixRegistryRecordExists: allocationTarget?.prefixRegistryRecordExists ?? false,
        prefixRegistryRecordMatchesIntended:
          allocationTarget?.prefixRegistryRecordMatchesIntended ?? false,
        prefixRegistryCapacityMatches: allocationTarget?.prefixRegistryCapacityMatches ?? false,
        prefixRegistryRefsMatch: allocationTarget?.prefixRegistryRefsMatch ?? false,
      },
    },
    {
      name: 'schema-version-capacity-matches-sum-allocation',
      passed: schemaVersionCapacityMatchesSumAllocation,
      message: `Schema version capacity matches sum allocation capacity for "${allocation.prefix}/${allocation.versionId}".`,
      details: {
        allocationCapacity: allocation.capacity,
        schemaVersionCapacity: allocationTarget?.schemaVersionCapacity,
        schemaVersionCapacityExists: allocationTarget?.schemaVersionCapacityExists ?? false,
        schemaVersionCapacityMatches: allocationTarget?.schemaVersionCapacityMatches ?? false,
      },
    },
    {
      name: 'sum-segment-sidecar-covers-allocation-range',
      passed: segmentSidecarCoversAllocationRange,
      message: `Sum segment sidecar metadata covers allocation range [${allocation.addressOffset}, ${allocation.addressOffset + allocation.addressSize}) with exact-allocation-range policy.`,
      details: {
        coveragePolicy: sumAllocation?.coveragePolicy,
        allocationStart: sumAllocation?.allocationStart,
        allocationEnd: sumAllocation?.allocationEnd,
        coveredSize: sumAllocation?.coveredSize,
        segmentSidecarCoversAllocation: sumAllocation?.segmentSidecarCoversAllocation ?? false,
        segments: sumAllocation?.segments ?? [],
      },
    },
  ];

  return {
    allocationId: allocation.allocationId,
    taxonomyId: allocation.taxonomyId,
    prefix: allocation.prefix,
    versionId: allocation.versionId,
    addressModel: allocation.addressModel,
    kind: 'sum',
    syncStatus: report.syncStatus,
    passed: checks.every((check) => check.passed),
    checks,
  };
}

function isMaterializationReport(
  report: SyncToPrefixRegistryResult,
): report is OntologyIndexMetaSyncMaterializationReport {
  return 'postSyncChecks' in report;
}

function findAllocationTargetCheck(
  report: OntologyIndexMetaSyncMaterializationReport,
  allocation: OntologyAddressAllocationRecord,
) {
  return report.postSyncChecks.targetRecords.find(
    (target) =>
      target.role === 'allocation-prefix' &&
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
    activationStatus: 'active',
    syncStatus: 'synced',
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
    activationStatus: 'sync-blocked',
    syncStatus: 'blocked',
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
    activationStatus: 'sync-deferred',
    syncStatus: 'deferred',
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
    activationStatus: 'failed',
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
    activationStatus: 'failed',
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
    activationStatus: 'skipped',
    syncStatus: 'skipped',
  };
}

function toActivationErrorIssue(
  error: unknown,
  phase: OntologyPackActivationPhase,
  allocation?: Pick<
    OntologyAddressAllocationRecord,
    'allocationId' | 'taxonomyId' | 'prefix' | 'versionId'
  >,
): OntologyPackActivationIssue {
  const allocationContext = allocation
    ? {
        allocationId: allocation.allocationId,
        taxonomyId: allocation.taxonomyId,
        prefix: allocation.prefix,
        versionId: allocation.versionId,
      }
    : {};

  if (error instanceof OntologyRegistryServiceError) {
    return {
      level: 'error',
      phase,
      code: error.conflict.code,
      message: error.message,
      ...allocationContext,
      details: error.conflict,
    };
  }

  if (error instanceof Error) {
    return {
      level: 'error',
      phase,
      code: 'unexpected-error',
      message: `Unexpected ontology activation error during ${phase} phase.`,
      ...allocationContext,
      details: { errorName: error.name },
    };
  }

  return {
    level: 'error',
    phase,
    code: 'unexpected-error',
    message: 'Unexpected ontology activation error',
    ...allocationContext,
  };
}

function toBlockedSyncIssue(report: SyncToPrefixRegistryResult): OntologyPackActivationIssue {
  return {
    level: 'error',
    phase: 'sync',
    code: 'sync-blocked',
    message: `Index-meta sync was blocked for ontology allocation "${report.allocationId}".`,
    allocationId: report.allocationId,
    taxonomyId: report.taxonomyId,
    prefix: report.prefix,
    versionId: report.versionId,
    details:
      'collisions' in report
        ? { collisions: report.collisions }
        : { syncStatus: report.syncStatus },
  };
}

function toDeferredSyncWarning(
  report: OntologyIndexMetaSyncDeferredReport,
): OntologyPackActivationIssue {
  return {
    level: 'warning',
    phase: 'sync',
    code: report.deferredReason,
    message: `Index-meta sync was deferred for ontology allocation "${report.allocationId}".`,
    allocationId: report.allocationId,
    taxonomyId: report.taxonomyId,
    prefix: report.prefix,
    versionId: report.versionId,
  };
}

function toSmokeCheckFailureIssue(
  smokeChecks: OntologyAllocationActivationSmokeChecks,
): OntologyPackActivationIssue {
  return {
    level: 'error',
    phase: 'smoke',
    code: 'activation-smoke-check-failed',
    message: `Activation smoke checks failed for ontology allocation "${smokeChecks.allocationId}".`,
    allocationId: smokeChecks.allocationId,
    taxonomyId: smokeChecks.taxonomyId,
    prefix: smokeChecks.prefix,
    versionId: smokeChecks.versionId,
    details: {
      failedChecks: smokeChecks.checks.filter((check) => !check.passed),
    },
  };
}

function withoutUndefined<T extends Record<string, unknown>>(input: T): T {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)) as T;
}
