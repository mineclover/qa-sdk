// @def.boundary docs-control-plane
// @def.doc docs-control-plane

import {
  createProgrammingArtifactRegistryRecord,
  type ProgrammingArtifactRegistryRecord,
} from "operational-ontology/programming-artifacts";

const ACTIVATION_EVIDENCE_OWNER_DEFINITION_ID =
  "operational-ontology-registry-activation-cli";
const ACTIVATION_REGISTRY_ALLOCATION_DEFINITION_ID =
  "operational-ontology-registry-allocation";

export interface ActivationEvidenceRegistryCommandContext {
  readonly packId: string;
  readonly knownPackImportRef?: string;
}

export interface ActivationEvidenceRegistryActivationResult {
  readonly status: string;
  readonly packId: string;
  readonly ontologyId: string;
  readonly namespaceSummary?: {
    readonly namespace?: string;
  } | null;
  readonly allocationSummaries?: readonly ActivationEvidenceAllocationSummary[];
  readonly activationStatuses?: readonly ActivationEvidenceActivationStatus[];
  readonly syncSummariesByAllocationId?: Readonly<
    Record<string, ActivationEvidenceSyncSummary>
  >;
  readonly smokeCheckSummary?: ActivationEvidenceSmokeCheckSummary;
  readonly warnings?: readonly unknown[];
  readonly errors?: readonly unknown[];
}

export interface ActivationEvidenceAllocationSummary {
  readonly activationStatus?: string;
  readonly syncStatus?: string;
}

export interface ActivationEvidenceActivationStatus {
  readonly activationStatus?: string;
  readonly syncStatus?: string;
}

export interface ActivationEvidenceSyncSummary {
  readonly syncStatus?: string;
}

export interface ActivationEvidenceSmokeCheckSummary {
  readonly allocationCount: number;
  readonly passedAllocationCount: number;
  readonly failedAllocationCount: number;
  readonly checkCount: number;
  readonly passedCheckCount: number;
  readonly failedCheckCount: number;
  readonly byAllocationId?: Readonly<Record<string, unknown>>;
}

export interface BuildActivationEvidenceRegistryRecordInput {
  readonly activationResult: ActivationEvidenceRegistryActivationResult;
  readonly resolvedOutputPath?: string;
  readonly commandContext: ActivationEvidenceRegistryCommandContext;
  readonly generatedAt?: string;
}

export function buildActivationEvidenceRegistryRecord(
  input: BuildActivationEvidenceRegistryRecordInput,
): ProgrammingArtifactRegistryRecord {
  const outputPath = input.resolvedOutputPath?.trim();
  if (!outputPath) {
    throw new Error(
      "Activation evidence registry record requires resolved output path",
    );
  }

  const { activationResult, commandContext } = input;
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const activationResultRef = `activation-result:${activationResult.packId}:${activationResult.ontologyId}`;

  return createProgrammingArtifactRegistryRecord({
    artifactId: [
      "activation-evidence",
      slugRegistryIdSegment(activationResult.packId),
      slugRegistryIdSegment(activationResult.ontologyId),
    ].join("-"),
    artifactRef: outputPath,
    outputPath,
    kind: "activation-evidence",
    producedByRef: `qa-sdk ontology registry activate-pack ${commandContext.packId}`,
    derivedFromRefs: [
      activationResult.packId,
      commandContext.knownPackImportRef,
    ],
    verifiesRefs: [
      activationResult.packId,
      activationResult.ontologyId,
      ACTIVATION_REGISTRY_ALLOCATION_DEFINITION_ID,
    ],
    ownerDefinitionId: ACTIVATION_EVIDENCE_OWNER_DEFINITION_ID,
    materializesOutputRefs: [outputPath, activationResultRef],
    createdAt: generatedAt,
    metadata: buildActivationEvidenceRegistryMetadata({
      activationResult,
      generatedAt,
    }),
  });
}

function buildActivationEvidenceRegistryMetadata(input: {
  readonly activationResult: ActivationEvidenceRegistryActivationResult;
  readonly generatedAt: string;
}): Record<string, unknown> {
  const { activationResult } = input;
  const allocationSummaries = activationResult.allocationSummaries ?? [];

  return {
    status: activationResult.status,
    packId: activationResult.packId,
    ontologyId: activationResult.ontologyId,
    namespace: activationResult.namespaceSummary?.namespace ?? null,
    allocationCount: allocationSummaries.length,
    activationStatusCounts: countStatusValues(
      allocationSummaries.map((summary) => summary.activationStatus ?? "none"),
    ),
    syncStatusCounts: buildSyncStatusCounts(activationResult),
    smokeCheckSummary: cloneSmokeCheckSummary(
      activationResult.smokeCheckSummary,
    ),
    warningCount: activationResult.warnings?.length ?? 0,
    errorCount: activationResult.errors?.length ?? 0,
    generatedAt: input.generatedAt,
  };
}

function buildSyncStatusCounts(
  activationResult: ActivationEvidenceRegistryActivationResult,
): Record<string, number> {
  const allocationStatuses = activationResult.allocationSummaries?.map(
    (summary) => summary.syncStatus ?? "none",
  );
  if (allocationStatuses && allocationStatuses.length > 0) {
    return countStatusValues(allocationStatuses);
  }

  const activationStatuses = activationResult.activationStatuses?.map(
    (status) => status.syncStatus ?? "none",
  );
  if (activationStatuses && activationStatuses.length > 0) {
    return countStatusValues(activationStatuses);
  }

  return countStatusValues(
    Object.values(activationResult.syncSummariesByAllocationId ?? {}).map(
      (summary) => summary.syncStatus ?? "none",
    ),
  );
}

function cloneSmokeCheckSummary(
  summary: ActivationEvidenceSmokeCheckSummary | undefined,
): ActivationEvidenceSmokeCheckSummary {
  return {
    allocationCount: summary?.allocationCount ?? 0,
    passedAllocationCount: summary?.passedAllocationCount ?? 0,
    failedAllocationCount: summary?.failedAllocationCount ?? 0,
    checkCount: summary?.checkCount ?? 0,
    passedCheckCount: summary?.passedCheckCount ?? 0,
    failedCheckCount: summary?.failedCheckCount ?? 0,
    byAllocationId: { ...summary?.byAllocationId },
  };
}

function countStatusValues(values: readonly string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const value of values) {
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return counts;
}

function slugRegistryIdSegment(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "unknown";
}
