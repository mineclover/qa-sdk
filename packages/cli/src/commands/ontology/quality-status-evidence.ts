import { readFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";

import type { DefDataSource } from "definition-catalog";
import type { GovernanceRun } from "operational-ontology/governance";
import type {
  PromptArtifactManagementAction,
  PromptArtifactQualityStatusEvidence,
} from "operational-ontology/prompt-artifacts";
import {
  findRelatedQualityStatusRegistryRecords,
  type ProgrammingArtifactRelation,
  type ProgrammingArtifactRegistryRecord,
  type RelatedQualityStatusRegistryRecordMatch,
  type RelatedQualityStatusRegistryRecordSummary,
} from "operational-ontology/programming-artifacts";
import type { GateDescriptor, GateStatus } from "quality-ledger";

import {
  resolveQualityGateDescriptorsFromDataSource,
  type QualityGateDescriptorResolutionRef,
} from "../../lib/quality-gate-topology.js";

export type ArtifactExtractionSourceKind =
  | "artifact-registry-hit"
  | "artifact-registry-miss"
  | "artifact-file-fallback"
  | "artifact-definition-fallback"
  | "artifact-search-fallback";

type GovernanceClosureQualityStatusStatus =
  | "quality-status-found"
  | "quality-status-missing"
  | "quality-status-invalid"
  | "quality-status-incomplete";

interface GovernanceClosureWarning {
  code:
    | "prompt-quality-status-evidence-missing"
    | "prompt-quality-status-evidence-target-missing"
    | "prompt-quality-status-evidence-failed"
    | "prompt-quality-status-evidence-stale"
    | "prompt-quality-status-evidence-invalid"
    | "prompt-quality-status-evidence-incomplete";
  message: string;
  sourceRefs: readonly string[];
}

interface GovernanceClosureSummary {
  status: GovernanceClosureQualityStatusStatus;
  source: "quality-status";
  matchedQualityStatusArtifactRefs: readonly string[];
  matchedQualityStatusArtifactIds: readonly string[];
  warning?: GovernanceClosureWarning;
  recommendedManagementActions: readonly PromptArtifactManagementAction[];
}

export interface ArtifactExtractionSource {
  kind: ArtifactExtractionSourceKind;
  registry: {
    status: "hit" | "miss" | "not-provided";
    path?: string;
    providerId?: string;
    recordCount?: number;
  };
  fallback?: {
    kind: "file" | "definition" | "search";
    target: string;
    matchedDocs?: readonly string[];
  };
  warnings: readonly string[];
  recommendedManagementActions: readonly string[];
  qualityStatusRecords: {
    total: number;
    records: readonly QualityStatusRecordSourceSummary[];
    warnings: readonly QualityStatusSnapshotWarning[];
  };
  governanceClosure: GovernanceClosureSummary;
  qualitySignal: {
    code: ArtifactExtractionSourceKind;
    grade: "ready" | "usable" | "degraded";
    warning?: string;
    recommendedManagementActions: readonly string[];
  };
}

export interface QualityStatusSnapshotBundleEvidence {
  bundleId: string;
  bundleState?: string;
  verifiedGates?: number;
  totalGates?: number;
  claimCount?: number;
  verifiedClaimCount?: number;
}

export interface QualityStatusExportSnapshotEvidence {
  rootId: string;
  bundleIds: readonly string[];
  bundles: readonly QualityStatusSnapshotBundleEvidence[];
  totals: {
    verifiedGates: number;
    totalGates: number;
    claimCount: number;
    verifiedClaimCount: number;
  };
  generatedAt?: string;
  sourcePath: string;
}

export interface QualityStatusFreshnessPolicy {
  maxAgeDays: number;
  now: string;
}

export interface QualityStatusFreshnessEvidence {
  status: "fresh" | "stale" | "incomplete";
  source: "snapshot-generated-at" | "ledger-verified-gate-executed-at";
  checkedAt: string;
  maxAgeDays: number;
  thresholdAt: string;
  message: string;
  generatedAt?: string;
  oldestVerifiedGateExecutedAt?: string;
  staleGateRefs?: readonly string[];
  missingTimestampGateRefs?: readonly string[];
}

export interface QualityStatusLedgerGateStatusEvidence {
  gateDocId: string;
  currentVersion: number;
  status: GateStatus["status"];
  latestRunAt?: string;
  latestRunId?: number;
  latestRunDocVersion?: number;
  latestRunOutcome?: "pass" | "fail";
}

export interface QualityStatusLedgerEvidence {
  sourcePath: string;
  ledgerPath: string;
  bundleId: string | null;
  bundleIds: readonly string[];
  bundleRefs: readonly string[];
  totalGates: number;
  totalGateCount: number;
  verifiedGates: number;
  verifiedGateCount: number;
  verified: boolean;
  gateRefs: readonly string[];
  verifiedGateRefs: readonly string[];
  blockingGates: readonly QualityStatusLedgerGateStatusEvidence[];
  blockingGateStatuses: readonly QualityStatusLedgerGateStatusEvidence[];
  latestRunTimestamps: readonly string[];
  latestRunAt?: string;
  oldestVerifiedGateExecutedAt?: string;
  freshness?: QualityStatusFreshnessEvidence;
  timestampSummary: {
    latestRunAt?: string;
    oldestVerifiedGateExecutedAt?: string;
    latestRunTimestamps: readonly string[];
    latestRunCount: number;
    gatesWithRuns: number;
    gatesWithoutRuns: number;
  };
}

export interface QualityStatusSnapshotWarning {
  code:
    | "quality-status-snapshot-missing"
    | "quality-status-snapshot-invalid-json"
    | "quality-status-snapshot-invalid-shape"
    | "quality-status-snapshot-read-failed"
    | "quality-status-ledger-missing"
    | "quality-status-ledger-read-failed"
    | "quality-status-ledger-no-gate-descriptors"
    | "quality-status-ledger-incomplete"
    | "quality-status-ledger-conflict"
    | "quality-status-generated-at-stale";
  artifactId: string;
  artifactRef: string;
  outputPath?: string;
  resolvedPath?: string;
  message: string;
  cause?: string;
}

export type QualityStatusRecordSourceSummary =
  RelatedQualityStatusRegistryRecordSummary & {
    gateDescriptors?: readonly GateDescriptor[];
    qualityExportSnapshot?: QualityStatusExportSnapshotEvidence;
    qualityExportWarning?: QualityStatusSnapshotWarning;
    qualityFreshness?: QualityStatusFreshnessEvidence;
    qualityFreshnessWarning?: QualityStatusSnapshotWarning;
    qualityLedgerEvidence?: QualityStatusLedgerEvidence;
    qualityLedgerWarning?: QualityStatusSnapshotWarning;
    qualityLedgerIncompleteWarning?: QualityStatusSnapshotWarning;
    qualityLedgerConflictWarning?: QualityStatusSnapshotWarning;
    qualityGateDescriptorWarning?: QualityStatusSnapshotWarning;
  };

export interface QualityStatusSnapshotEvidence {
  recordSummaries: ReadonlyMap<string, QualityStatusRecordSourceSummary>;
  warnings: readonly QualityStatusSnapshotWarning[];
  governanceRuns: readonly GovernanceRun[];
}

export interface RelatedQualityStatusEvidence {
  matches: readonly RelatedQualityStatusRegistryRecordMatch[];
  snapshotEvidence: QualityStatusSnapshotEvidence;
}

export interface LoadedQualityStatusRegistryProvider {
  provider: { providerId: string };
  records: readonly ProgrammingArtifactRegistryRecord[];
  registryPath: string;
  recordCount: number;
}

export function qualityStatusRecordsSummary(
  matches: readonly RelatedQualityStatusRegistryRecordMatch[],
  snapshotEvidence: QualityStatusSnapshotEvidence = emptyQualityStatusSnapshotEvidence(),
): ArtifactExtractionSource["qualityStatusRecords"] {
  return {
    total: matches.length,
    records: matches.map((match) =>
      snapshotEvidence.recordSummaries.get(qualityStatusRecordKey(match.record)) ?? match.summary,
    ),
    warnings: snapshotEvidence.warnings,
  };
}

export function governanceClosureSummary(
  matches: readonly RelatedQualityStatusRegistryRecordMatch[],
  promptEvidence: readonly PromptArtifactQualityStatusEvidence[],
  targetRefs: readonly string[] = [],
): GovernanceClosureSummary {
  const matchedQualityStatusArtifactRefs = uniqueQualityStatusValues(
    matches.map((match) => match.record.artifactRef),
  );
  const matchedQualityStatusArtifactIds = uniqueQualityStatusValues(
    matches.map((match) => match.record.artifactId),
  );

  if (matches.length === 0) {
    return incompleteGovernanceClosure({
      status: "quality-status-missing",
      matchedQualityStatusArtifactRefs,
      matchedQualityStatusArtifactIds,
      warning: {
        code: "prompt-quality-status-evidence-missing",
        message:
          "Artifact extraction did not include quality-status evidence, so governance closure confidence is capped.",
        sourceRefs: uniqueQualityStatusValues(targetRefs),
      },
    });
  }

  const targetEvidence = promptEvidence.filter((item) => item.verifiesTarget);
  if (targetEvidence.length === 0) {
    return incompleteGovernanceClosure({
      status: "quality-status-incomplete",
      matchedQualityStatusArtifactRefs,
      matchedQualityStatusArtifactIds,
      warning: {
        code: "prompt-quality-status-evidence-target-missing",
        message:
          "Quality-status evidence did not verify the prompt target, so it cannot close governance.",
        sourceRefs: uniqueQualityStatusValues([
          ...targetRefs,
          ...promptEvidence.flatMap(qualityStatusPromptEvidenceSourceRefs),
        ]),
      },
    });
  }

  const invalidEvidence = targetEvidence.find((item) =>
    item.outcome === "failed" ||
    item.outcome === "stale" ||
    item.outcome === "invalid",
  );
  if (invalidEvidence) {
    return incompleteGovernanceClosure({
      status: "quality-status-invalid",
      matchedQualityStatusArtifactRefs,
      matchedQualityStatusArtifactIds,
      warning: qualityStatusGovernanceWarning(invalidEvidence),
    });
  }

  const incompleteEvidence = targetEvidence.find(
    (item) => !hasVerifiedQualityStatusClosureEvidence(item),
  );
  if (incompleteEvidence) {
    return incompleteGovernanceClosure({
      status: "quality-status-incomplete",
      matchedQualityStatusArtifactRefs,
      matchedQualityStatusArtifactIds,
      warning: qualityStatusGovernanceWarning(incompleteEvidence),
    });
  }

  return {
    status: "quality-status-found",
    source: "quality-status",
    matchedQualityStatusArtifactRefs,
    matchedQualityStatusArtifactIds,
    recommendedManagementActions: [],
  };
}

export function withQualityStatusRecordsSummary(
  source: ArtifactExtractionSource | undefined,
  matches: readonly RelatedQualityStatusRegistryRecordMatch[],
  snapshotEvidence: QualityStatusSnapshotEvidence = emptyQualityStatusSnapshotEvidence(),
  promptEvidence: readonly PromptArtifactQualityStatusEvidence[] = [],
): ArtifactExtractionSource | undefined {
  if (!source) return undefined;
  const warningCodes = qualityStatusSnapshotWarningCodes(snapshotEvidence);
  return {
    ...source,
    warnings: uniqueQualityStatusValues([...source.warnings, ...warningCodes]),
    qualityStatusRecords: qualityStatusRecordsSummary(matches, snapshotEvidence),
    governanceClosure: governanceClosureSummary(
      matches,
      promptEvidence,
      artifactExtractionSourceTargetRefs(source),
    ),
  };
}

export function artifactRegistryHitSource(
  loadedRegistry: LoadedQualityStatusRegistryProvider,
  qualityStatusMatches: readonly RelatedQualityStatusRegistryRecordMatch[],
  snapshotEvidence: QualityStatusSnapshotEvidence = emptyQualityStatusSnapshotEvidence(),
  targetRefs: readonly string[] = [],
  promptEvidence: readonly PromptArtifactQualityStatusEvidence[] = [],
): ArtifactExtractionSource {
  return {
    kind: "artifact-registry-hit",
    registry: {
      status: "hit",
      path: loadedRegistry.registryPath,
      providerId: loadedRegistry.provider.providerId,
      recordCount: loadedRegistry.recordCount,
    },
    warnings: qualityStatusSnapshotWarningCodes(snapshotEvidence),
    recommendedManagementActions: [],
    qualityStatusRecords: qualityStatusRecordsSummary(qualityStatusMatches, snapshotEvidence),
    governanceClosure: governanceClosureSummary(
      qualityStatusMatches,
      promptEvidence,
      targetRefs,
    ),
    qualitySignal: {
      code: "artifact-registry-hit",
      grade: "ready",
      recommendedManagementActions: [],
    },
  };
}

export function artifactFallbackSource(input: {
  kind: Exclude<ArtifactExtractionSourceKind, "artifact-registry-hit" | "artifact-registry-miss">;
  fallbackKind: "file" | "definition" | "search";
  target: string;
  loadedRegistry?: LoadedQualityStatusRegistryProvider;
  matchedDocs?: readonly string[];
  qualityStatusMatches?: readonly RelatedQualityStatusRegistryRecordMatch[];
  qualityStatusSnapshotEvidence?: QualityStatusSnapshotEvidence;
  qualityStatusPromptEvidence?: readonly PromptArtifactQualityStatusEvidence[];
}): ArtifactExtractionSource {
  const snapshotEvidence =
    input.qualityStatusSnapshotEvidence ?? emptyQualityStatusSnapshotEvidence();
  const registryStatus = input.loadedRegistry
    ? {
        status: "miss" as const,
        path: input.loadedRegistry.registryPath,
        providerId: input.loadedRegistry.provider.providerId,
        recordCount: input.loadedRegistry.recordCount,
      }
    : { status: "not-provided" as const };
  const warnings = [
    ...(input.loadedRegistry ? ["artifact-registry-miss"] : []),
    ...(input.kind === "artifact-search-fallback" ? ["artifact-search-fallback"] : []),
    ...qualityStatusSnapshotWarningCodes(snapshotEvidence),
  ];
  const recommendedManagementActions = input.kind === "artifact-search-fallback"
    ? ["create_programming_artifact_registry_record"]
    : [];
  return {
    kind: input.kind,
    registry: registryStatus,
    fallback: {
      kind: input.fallbackKind,
      target: input.target,
      ...(input.matchedDocs ? { matchedDocs: input.matchedDocs } : {}),
    },
    warnings,
    recommendedManagementActions,
    qualityStatusRecords: qualityStatusRecordsSummary(
      input.qualityStatusMatches ?? [],
      snapshotEvidence,
    ),
    governanceClosure: governanceClosureSummary(
      input.qualityStatusMatches ?? [],
      input.qualityStatusPromptEvidence ?? [],
      [input.target],
    ),
    qualitySignal: {
      code: input.kind,
      grade: input.kind === "artifact-search-fallback" ? "degraded" : "usable",
      warning: input.kind === "artifact-search-fallback"
        ? "Artifact context was synthesized from free-string search instead of a managed registry record."
        : undefined,
      recommendedManagementActions,
    },
  };
}

export function findRelatedQualityStatusMatches(
  loadedRegistry: LoadedQualityStatusRegistryProvider | undefined,
  targetRefs: readonly (string | undefined)[],
): RelatedQualityStatusRegistryRecordMatch[] {
  if (!loadedRegistry) return [];
  return findRelatedQualityStatusRegistryRecords({
    records: loadedRegistry.records,
    targetRefs: expandQualityStatusTargetRefs(targetRefs),
  });
}

export function qualityStatusRecords(
  matches: readonly RelatedQualityStatusRegistryRecordMatch[],
): ProgrammingArtifactRegistryRecord[] {
  return matches.map((match) => match.record);
}

export function emptyQualityStatusSnapshotEvidence(): QualityStatusSnapshotEvidence {
  return {
    recordSummaries: new Map(),
    warnings: [],
    governanceRuns: [],
  };
}

export function qualityStatusRecordKey(
  record: Pick<ProgrammingArtifactRegistryRecord, "artifactId" | "artifactRef">,
): string {
  return `${record.artifactId}\n${record.artifactRef}`;
}

export function qualityStatusSnapshotWarningCodes(
  evidence: QualityStatusSnapshotEvidence,
): string[] {
  return uniqueQualityStatusValues(evidence.warnings.map((warning) => warning.code));
}

export function qualityStatusSnapshotStructuralPromptEvidenceOutcome(
  summary: QualityStatusRecordSourceSummary,
): PromptArtifactQualityStatusEvidence["outcome"] {
  if (summary.qualityExportWarning) {
    return summary.qualityExportWarning.code === "quality-status-snapshot-missing"
      ? "incomplete"
      : "invalid";
  }
  const snapshot = summary.qualityExportSnapshot;
  if (!snapshot || snapshot.bundles.length === 0) return "incomplete";
  if (snapshot.bundles.some((bundle) => bundle.bundleState === "stale")) return "stale";
  if (snapshot.bundles.some((bundle) => bundle.bundleState === "invalid")) return "invalid";
  if (snapshot.bundles.some((bundle) => qualityStatusBundleFailed(bundle))) return "failed";
  if (snapshot.bundles.every((bundle) => qualityStatusBundleVerified(bundle))) {
    return "verified";
  }
  return "incomplete";
}

export function qualityStatusBundleVerified(
  bundle: QualityStatusSnapshotBundleEvidence,
): boolean {
  const verifiedGates = bundle.verifiedGates ?? 0;
  const totalGates = bundle.totalGates ?? 0;
  return bundle.bundleState === "verified" || (totalGates > 0 && verifiedGates >= totalGates);
}

export function qualityStatusMatchVerifiesTarget(
  match: RelatedQualityStatusRegistryRecordMatch,
): boolean {
  return match.summary.matchReasons.some(
    (reason) =>
      reason.field === "verifiesRefs" ||
      (reason.field === "relations" && reason.relationKind === "verifies"),
  );
}

export function qualityStatusSnapshotHasVerifiedSurface(
  snapshot: QualityStatusExportSnapshotEvidence,
): boolean {
  return (
    snapshot.bundles.some((bundle) => qualityStatusBundleVerified(bundle)) ||
    snapshot.totals.verifiedGates > 0
  );
}

export async function resolveQualityStatusRecordGateDescriptors(
  source: Pick<DefDataSource, "get" | "getChildren">,
  record: ProgrammingArtifactRegistryRecord,
  snapshot: QualityStatusExportSnapshotEvidence | undefined,
): Promise<GateDescriptor[]> {
  return resolveQualityGateDescriptorsFromDataSource(
    source,
    qualityStatusGateDescriptorRefs(record, snapshot),
  );
}

export async function loadQualityStatusSnapshotForRecord(
  loadedRegistry: LoadedQualityStatusRegistryProvider,
  record: ProgrammingArtifactRegistryRecord,
): Promise<{
  snapshot?: QualityStatusExportSnapshotEvidence;
  warning?: QualityStatusSnapshotWarning;
}> {
  const paths = qualityStatusSnapshotCandidatePaths(
    record.outputPath,
    loadedRegistry.registryPath,
  );
  let lastMissingPath: string | undefined;

  for (const path of paths) {
    try {
      const content = await readFile(path, "utf8");
      try {
        const payload = JSON.parse(content) as unknown;
        return {
          snapshot: summarizeQualityStatusExportSnapshot(payload, path),
        };
      } catch (error) {
        if (error instanceof SyntaxError) {
          return {
            warning: qualityStatusSnapshotWarning(record, {
              code: "quality-status-snapshot-invalid-json",
              resolvedPath: path,
              message: `Quality-status outputPath is not valid JSON: ${record.outputPath}`,
              cause: error.message,
            }),
          };
        }
        const message = error instanceof Error ? error.message : String(error);
        return {
          warning: qualityStatusSnapshotWarning(record, {
            code: "quality-status-snapshot-invalid-shape",
            resolvedPath: path,
            message: `Quality-status outputPath does not match quality export snapshot shape: ${record.outputPath}`,
            cause: message,
          }),
        };
      }
    } catch (error) {
      const code = nodeErrorCode(error);
      if (code === "ENOENT") {
        lastMissingPath = path;
        continue;
      }
      const message = error instanceof Error ? error.message : String(error);
      return {
        warning: qualityStatusSnapshotWarning(record, {
          code: "quality-status-snapshot-read-failed",
          resolvedPath: path,
          message: `Quality-status outputPath could not be read: ${record.outputPath}`,
          cause: message,
        }),
      };
    }
  }

  return {
    warning: qualityStatusSnapshotWarning(record, {
      code: "quality-status-snapshot-missing",
      resolvedPath: lastMissingPath,
      message: `Quality-status outputPath does not exist: ${record.outputPath}`,
    }),
  };
}

export function qualityStatusSnapshotCandidatePaths(
  outputPath: string | undefined,
  registryPath: string,
): string[] {
  if (!outputPath) return [];
  if (isAbsolute(outputPath)) return [outputPath];
  return uniqueQualityStatusValues([
    resolve(outputPath),
    resolve(dirname(registryPath), outputPath),
  ]);
}

export function summarizeQualityStatusExportSnapshot(
  payload: unknown,
  sourcePath: string,
): QualityStatusExportSnapshotEvidence {
  if (!isObjectRecord(payload)) {
    throw new Error("snapshot must be a JSON object");
  }
  const rootId = stringProperty(payload, "rootId");
  if (!rootId) {
    throw new Error("snapshot.rootId must be a non-empty string");
  }
  if (!Array.isArray(payload["bundles"])) {
    throw new Error("snapshot.bundles must be an array");
  }

  const bundles = payload["bundles"].flatMap((bundle): QualityStatusSnapshotBundleEvidence[] => {
    if (!isObjectRecord(bundle)) return [];
    const bundleId = stringProperty(bundle, "bundleId");
    if (!bundleId) return [];
    return [{
      bundleId,
      ...optionalStringProperty(bundle, "bundleState"),
      ...optionalNumberProperty(bundle, "verifiedGates"),
      ...optionalNumberProperty(bundle, "totalGates"),
      ...optionalNumberProperty(bundle, "claimCount"),
      ...optionalNumberProperty(bundle, "verifiedClaimCount"),
    }];
  });
  if (bundles.length !== payload["bundles"].length) {
    throw new Error("snapshot.bundles entries must include bundleId");
  }

  return {
    rootId,
    bundleIds: bundles.map((bundle) => bundle.bundleId),
    bundles,
    totals: {
      verifiedGates: sumNumbers(bundles.map((bundle) => bundle.verifiedGates)),
      totalGates: sumNumbers(bundles.map((bundle) => bundle.totalGates)),
      claimCount: sumNumbers(bundles.map((bundle) => bundle.claimCount)),
      verifiedClaimCount: sumNumbers(bundles.map((bundle) => bundle.verifiedClaimCount)),
    },
    ...optionalStringProperty(payload, "generatedAt"),
    sourcePath,
  };
}

export function qualityStatusSnapshotWarning(
  record: ProgrammingArtifactRegistryRecord,
  input: Omit<QualityStatusSnapshotWarning, "artifactId" | "artifactRef" | "outputPath">,
): QualityStatusSnapshotWarning {
  return {
    artifactId: record.artifactId,
    artifactRef: record.artifactRef,
    ...(record.outputPath ? { outputPath: record.outputPath } : {}),
    ...input,
  };
}

export function qualityStatusNoGateDescriptorsWarning(
  record: ProgrammingArtifactRegistryRecord,
): QualityStatusSnapshotWarning {
  return qualityStatusSnapshotWarning(record, {
    code: "quality-status-ledger-no-gate-descriptors",
    message:
      "Quality-status record did not resolve to any quality gate descriptors for ledger verification.",
  });
}

export function qualityStatusGeneratedAtStaleWarning(
  record: ProgrammingArtifactRegistryRecord,
  freshness: QualityStatusFreshnessEvidence,
): QualityStatusSnapshotWarning {
  return qualityStatusSnapshotWarning(record, {
    code: "quality-status-generated-at-stale",
    message: freshness.message,
  });
}

export function expandQualityStatusTargetRefs(
  refs: readonly (string | undefined)[],
): string[] {
  return uniqueQualityStatusValues(
    refs.flatMap((ref) => {
      if (!ref) return [];
      const strippedWorkArea = ref.startsWith("work-area:")
        ? ref.slice("work-area:".length)
        : undefined;
      const strippedArtifact = ref.startsWith("artifact:")
        ? ref.slice("artifact:".length)
        : undefined;
      const baseRefs = uniqueQualityStatusValues([
        ref,
        strippedWorkArea,
        strippedArtifact,
      ].filter((value): value is string => Boolean(value)));
      return baseRefs.flatMap((value) => [
        value,
        value.startsWith("artifact:") ? undefined : `artifact:${value}`,
        value.startsWith("work-area:") ? undefined : `work-area:${value}`,
      ]).filter((value): value is string => Boolean(value));
    }),
  );
}

function incompleteGovernanceClosure(input: {
  status: Exclude<GovernanceClosureQualityStatusStatus, "quality-status-found">;
  matchedQualityStatusArtifactRefs: readonly string[];
  matchedQualityStatusArtifactIds: readonly string[];
  warning: GovernanceClosureWarning;
}): GovernanceClosureSummary {
  return {
    status: input.status,
    source: "quality-status",
    matchedQualityStatusArtifactRefs: input.matchedQualityStatusArtifactRefs,
    matchedQualityStatusArtifactIds: input.matchedQualityStatusArtifactIds,
    warning: input.warning,
    recommendedManagementActions: [
      {
        kind: "close_governance_evidence",
        plane: "governance",
        priority: "required",
        reason: input.warning.message,
        targetRefs: input.warning.sourceRefs,
      },
    ],
  };
}

function hasVerifiedQualityStatusClosureEvidence(
  evidence: PromptArtifactQualityStatusEvidence,
): boolean {
  return evidence.outcome === "verified" &&
    hasCompleteVerifiedQualityStatusSurfaceEvidence(evidence);
}

function hasCompleteVerifiedQualityStatusSurfaceEvidence(
  evidence: PromptArtifactQualityStatusEvidence,
): boolean {
  const bundleRefs = evidence.bundleRefs ?? [];
  const verifiedBundleRefs = evidence.verifiedBundleRefs ?? [];
  const hasCompleteBundleSurface =
    verifiedBundleRefs.length > 0 &&
    (bundleRefs.length === 0 || bundleRefs.every((ref) => verifiedBundleRefs.includes(ref)));
  const gateRefs = evidence.gateRefs ?? [];
  const verifiedGateRefs = evidence.verifiedGateRefs ?? [];
  const hasCompleteGateRefSurface =
    verifiedGateRefs.length > 0 &&
    (gateRefs.length === 0 || gateRefs.every((ref) => verifiedGateRefs.includes(ref)));
  const verifiedGateCount = evidence.verifiedGateCount ?? 0;
  const hasCompleteGateCountSurface =
    evidence.totalGateCount === undefined
      ? verifiedGateCount > 0
      : evidence.totalGateCount > 0 && verifiedGateCount >= evidence.totalGateCount;

  return hasCompleteBundleSurface ||
    hasCompleteGateRefSurface ||
    hasCompleteGateCountSurface;
}

function qualityStatusGovernanceWarning(
  evidence: PromptArtifactQualityStatusEvidence,
): GovernanceClosureWarning {
  const code: GovernanceClosureWarning["code"] = evidence.outcome === "verified"
    ? "prompt-quality-status-evidence-incomplete"
    : `prompt-quality-status-evidence-${evidence.outcome}`;
  return {
    code,
    message:
      evidence.message ??
      (evidence.outcome === "verified"
        ? "Quality-status evidence verified the target but did not report a complete verified bundle or gate surface."
        : `Quality-status evidence reported ${evidence.outcome} verification for the target.`),
    sourceRefs: qualityStatusPromptEvidenceSourceRefs(evidence),
  };
}

function qualityStatusPromptEvidenceSourceRefs(
  evidence: PromptArtifactQualityStatusEvidence,
): string[] {
  return uniqueQualityStatusValues([
    evidence.evidenceId,
    ...evidence.targetRefs,
    ...(evidence.sourceRefs ?? []),
    ...(evidence.bundleRefs ?? []),
    ...(evidence.verifiedBundleRefs ?? []),
    ...(evidence.gateRefs ?? []),
    ...(evidence.verifiedGateRefs ?? []),
  ]);
}

function artifactExtractionSourceTargetRefs(source: ArtifactExtractionSource): string[] {
  return uniqueQualityStatusValues([
    source.fallback?.target,
  ].filter((value): value is string => Boolean(value)));
}

function qualityStatusBundleFailed(
  bundle: QualityStatusSnapshotBundleEvidence,
): boolean {
  return bundle.bundleState === "failed";
}

function qualityStatusGateDescriptorRefs(
  record: ProgrammingArtifactRegistryRecord,
  snapshot: QualityStatusExportSnapshotEvidence | undefined,
): QualityGateDescriptorResolutionRef[] {
  return [
    ...qualityStatusSnapshotDescriptorRefs(snapshot),
    ...qualityStatusMetadataDescriptorRefs(record.metadata),
    ...qualityStatusRegularDescriptorRefs(record.verifiesRefs),
    ...qualityStatusRegularDescriptorRefs(record.materializesOutputRefs),
    ...qualityStatusDirectGateDescriptorRefs(record.verificationRefs),
    ...qualityStatusRelationDescriptorRefs(record.relations),
  ];
}

function qualityStatusSnapshotDescriptorRefs(
  snapshot: QualityStatusExportSnapshotEvidence | undefined,
): QualityGateDescriptorResolutionRef[] {
  if (!snapshot) return [];
  return qualityStatusRootAndBundleDescriptorRefs(snapshot.rootId, snapshot.bundleIds);
}

function qualityStatusMetadataDescriptorRefs(
  metadata: Record<string, unknown> | undefined,
): QualityGateDescriptorResolutionRef[] {
  if (!metadata) return [];
  const rootId = stringProperty(metadata, "rootId");
  const bundleIds = qualityStatusMetadataBundleIds(metadata);
  return qualityStatusRootAndBundleDescriptorRefs(rootId, bundleIds);
}

function qualityStatusRootAndBundleDescriptorRefs(
  rootId: string | undefined,
  bundleIds: readonly string[],
): QualityGateDescriptorResolutionRef[] {
  return [
    ...(rootId ? [{ ref: rootId, directChildGatesOnly: bundleIds.length > 0 }] : []),
    ...qualityStatusRegularDescriptorRefs(bundleIds),
  ];
}

function qualityStatusMetadataBundleIds(
  metadata: Record<string, unknown>,
): string[] {
  const bundles = metadata["bundles"];
  if (!Array.isArray(bundles)) return [];
  return uniqueQualityStatusValues(
    bundles.flatMap((bundle) =>
      isObjectRecord(bundle) ? [stringProperty(bundle, "bundleId")] : [],
    ).filter((value): value is string => Boolean(value)),
  );
}

function qualityStatusRegularDescriptorRefs(
  refs: readonly string[] | undefined,
): QualityGateDescriptorResolutionRef[] {
  return (refs ?? []).map((ref) => ({ ref }));
}

function qualityStatusDirectGateDescriptorRefs(
  refs: readonly string[] | undefined,
): QualityGateDescriptorResolutionRef[] {
  return (refs ?? []).map((ref) => ({ ref, directGateOnly: true }));
}

function qualityStatusRelationDescriptorRefs(
  relations: readonly ProgrammingArtifactRelation[] | undefined,
): QualityGateDescriptorResolutionRef[] {
  return (relations ?? [])
    .filter(
      (relation) =>
        relation.kind === "verifies" || relation.kind === "materializes_output",
    )
    .map((relation) => ({ ref: relation.toRef }));
}

function nodeErrorCode(error: unknown): string | undefined {
  return isObjectRecord(error) && typeof error["code"] === "string"
    ? error["code"]
    : undefined;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringProperty(
  value: Record<string, unknown>,
  key: string,
): string | undefined {
  const item = value[key];
  return typeof item === "string" && item.trim().length > 0 ? item : undefined;
}

function optionalStringProperty<T extends string>(
  value: Record<string, unknown>,
  key: T,
): Partial<Record<T, string>> {
  const item = stringProperty(value, key);
  return item ? { [key]: item } as Partial<Record<T, string>> : {};
}

function optionalNumberProperty<T extends string>(
  value: Record<string, unknown>,
  key: T,
): Partial<Record<T, number>> {
  const item = value[key];
  return typeof item === "number" && Number.isFinite(item)
    ? { [key]: item } as Partial<Record<T, number>>
    : {};
}

function sumNumbers(values: readonly (number | undefined)[]): number {
  let sum = 0;
  for (const value of values) {
    sum += value ?? 0;
  }
  return sum;
}

function uniqueQualityStatusValues(values: readonly string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))];
}
