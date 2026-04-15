import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { compareTimestamps } from "@qa-sdk/core";
import type { DefDataSource } from "definition-catalog";
import type {
  AdjustmentSuggestion,
  ConsistencyVerdict,
  GovernanceRun,
} from "operational-ontology/governance";
import type {
  extractPromptArtifactSourcesFromDefinitionContext,
  PromptArtifactQualityStatusEvidence,
} from "operational-ontology/prompt-artifacts";
import type {
  ProgrammingArtifactRegistryRecord,
  RelatedQualityStatusRegistryRecordMatch,
} from "operational-ontology/programming-artifacts";
import {
  QualityLedger,
  SqliteQualityStore,
  type BundleVerification,
  type GateDescriptor,
  type GateStatus,
} from "quality-ledger";

import {
  emptyQualityStatusSnapshotEvidence,
  loadQualityStatusSnapshotForRecord,
  qualityStatusBundleVerified,
  qualityStatusGeneratedAtStaleWarning,
  qualityStatusMatchVerifiesTarget,
  qualityStatusNoGateDescriptorsWarning,
  qualityStatusRecordKey,
  qualityStatusSnapshotHasVerifiedSurface,
  qualityStatusSnapshotStructuralPromptEvidenceOutcome,
  qualityStatusSnapshotWarning,
  resolveQualityStatusRecordGateDescriptors,
  type LoadedQualityStatusRegistryProvider,
  type QualityStatusExportSnapshotEvidence,
  type QualityStatusRecordSourceSummary,
  type QualityStatusSnapshotBundleEvidence,
  type QualityStatusSnapshotEvidence,
  type QualityStatusSnapshotWarning,
  type RelatedQualityStatusEvidence,
} from "./quality-status-evidence.js";

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

interface QualityStatusLedgerWarningTemplate {
  code: "quality-status-ledger-missing" | "quality-status-ledger-read-failed";
  resolvedPath: string;
  message: string;
  cause?: string;
}

interface LoadedQualityStatusLedger {
  path: string;
  ledger?: QualityLedger;
  warning?: QualityStatusLedgerWarningTemplate;
}

const QUALITY_STATUS_FRESHNESS_DAY_MS = 24 * 60 * 60 * 1000;

export function parseQualityStatusFreshnessPolicy(
  flags: Record<string, string>,
): { policy?: QualityStatusFreshnessPolicy; error?: string } {
  const rawValue = flags["quality-status-max-age-days"];
  if (rawValue === undefined) return {};

  const value = rawValue.trim();
  const maxAgeDays = Number(value);
  if (
    value.length === 0 ||
    !Number.isSafeInteger(maxAgeDays) ||
    maxAgeDays <= 0
  ) {
    return {
      error:
        `Invalid --quality-status-max-age-days value "${rawValue}". Expected a positive integer number of days.`,
    };
  }

  return {
    policy: {
      maxAgeDays,
      now: new Date().toISOString(),
    },
  };
}

export async function loadQualityStatusSnapshotEvidence(
  loadedRegistry: LoadedQualityStatusRegistryProvider | undefined,
  matches: readonly RelatedQualityStatusRegistryRecordMatch[],
  source?: Pick<DefDataSource, "get" | "getChildren">,
  qualityLedgerPath?: string,
  freshnessPolicy?: QualityStatusFreshnessPolicy,
): Promise<QualityStatusSnapshotEvidence> {
  if (!loadedRegistry || matches.length === 0) {
    return emptyQualityStatusSnapshotEvidence();
  }

  const loadedLedger = loadQualityStatusLedger(qualityLedgerPath);
  const recordSummaries = new Map<string, QualityStatusRecordSourceSummary>();
  const warnings: QualityStatusSnapshotWarning[] = [];
  const governanceRuns: GovernanceRun[] = [];

  try {
    for (const match of matches) {
      let summary: QualityStatusRecordSourceSummary = match.summary;
      let snapshot: QualityStatusExportSnapshotEvidence | undefined;
      if (match.record.outputPath) {
        const loaded = await loadQualityStatusSnapshotForRecord(
          loadedRegistry,
          match.record,
        );
        if (loaded.warning) {
          warnings.push(loaded.warning);
          summary = {
            ...summary,
            qualityExportWarning: loaded.warning,
          };
        } else if (loaded.snapshot) {
          snapshot = loaded.snapshot;
          summary = {
            ...summary,
            qualityExportSnapshot: loaded.snapshot,
          };
          const freshness = qualityStatusSnapshotFreshness(
            loaded.snapshot,
            freshnessPolicy,
          );
          if (freshness) {
            summary = {
              ...summary,
              qualityFreshness: freshness,
            };
            if (
              freshness.status === "stale" &&
              qualityStatusSnapshotStructuralPromptEvidenceOutcome(summary) === "verified"
            ) {
              const warning = qualityStatusGeneratedAtStaleWarning(
                match.record,
                freshness,
              );
              warnings.push(warning);
              summary = {
                ...summary,
                qualityFreshnessWarning: warning,
              };
            }
          }
          governanceRuns.push(
            qualityStatusSnapshotGovernanceRun(match.record, loaded.snapshot),
          );
        }
      }

      const gateDescriptors = source
        ? await resolveQualityStatusRecordGateDescriptors(source, match.record, snapshot)
        : [];
      if (gateDescriptors.length > 0) {
        summary = {
          ...summary,
          gateDescriptors,
        };
      } else {
        const warning = qualityStatusNoGateDescriptorsWarning(match.record);
        warnings.push(warning);
        summary = {
          ...summary,
          qualityGateDescriptorWarning: warning,
        };
      }

      const ledgerWarning = qualityStatusLedgerWarning(match.record, loadedLedger);
      if (ledgerWarning) {
        warnings.push(ledgerWarning);
        summary = {
          ...summary,
          qualityLedgerWarning: ledgerWarning,
        };
      }

      if (
        loadedLedger?.ledger &&
        gateDescriptors.length > 0 &&
        shouldAttemptQualityLedgerFallback(summary)
      ) {
        const ledgerEvidence = qualityStatusLedgerEvidence(
          loadedLedger.ledger,
          loadedLedger.path,
          gateDescriptors,
          freshnessPolicy,
        );
        summary = {
          ...summary,
          qualityLedgerEvidence: ledgerEvidence,
        };
        if (
          ledgerEvidence.freshness?.status === "stale" &&
          qualityStatusLedgerStructuralEvidenceOutcome(ledgerEvidence) === "verified"
        ) {
          const freshnessWarning = qualityStatusGeneratedAtStaleWarning(
            match.record,
            ledgerEvidence.freshness,
          );
          warnings.push(freshnessWarning);
          summary = {
            ...summary,
            qualityFreshnessWarning: freshnessWarning,
          };
        }
        if (!ledgerEvidence.verified) {
          const incompleteWarning = qualityStatusLedgerIncompleteWarning(
            match.record,
            ledgerEvidence,
          );
          warnings.push(incompleteWarning);
          summary = {
            ...summary,
            qualityLedgerIncompleteWarning: incompleteWarning,
          };
        }
        const conflictWarning = qualityStatusLedgerConflictWarning(
          match.record,
          summary,
        );
        if (conflictWarning) {
          warnings.push(conflictWarning);
          summary = {
            ...summary,
            qualityLedgerConflictWarning: conflictWarning,
          };
        }
      }

      recordSummaries.set(qualityStatusRecordKey(match.record), summary);
    }
  } finally {
    closeQualityStatusLedger(loadedLedger);
  }

  return {
    recordSummaries,
    warnings,
    governanceRuns,
  };
}

export function promptQualityStatusEvidenceFromArtifactExtraction(
  evidence: RelatedQualityStatusEvidence,
): PromptArtifactQualityStatusEvidence[] {
  return evidence.matches.map((match) => {
    const summary: QualityStatusRecordSourceSummary =
      evidence.snapshotEvidence.recordSummaries.get(qualityStatusRecordKey(match.record)) ??
      match.summary;
    const snapshot = summary.qualityExportSnapshot;
    const warning = summary.qualityExportWarning;
    const gateDescriptors = summary.gateDescriptors ?? [];
    const ledgerEvidence = qualityStatusAuthoritativeLedgerEvidence(summary);
    const outcome = qualityStatusPromptEvidenceOutcome(summary);
    const verifiedBundleRefs = ledgerEvidence
      ? ledgerEvidence.verified
        ? ledgerEvidence.bundleRefs
        : []
      : snapshot
        ? snapshot.bundles
          .filter((bundle) => qualityStatusBundleVerified(bundle))
          .map((bundle) => bundle.bundleId)
        : [];
    const gateRefs = ledgerEvidence?.gateRefs ??
      gateDescriptors.map((descriptor) => descriptor.gateDocId);
    const verifiedGateRefs = ledgerEvidence
      ? ledgerEvidence.verifiedGateRefs
      : outcome === "verified"
        ? gateDescriptors
          .filter((descriptor) =>
            !descriptor.bundleId || verifiedBundleRefs.includes(descriptor.bundleId),
          )
          .map((descriptor) => descriptor.gateDocId)
        : [];
    const bundleRefs = ledgerEvidence?.bundleRefs ??
      uniqueQualityStatusValues([
        ...(snapshot?.bundleIds ?? []),
        ...gateDescriptors
          .map((descriptor) => descriptor.bundleId)
          .filter((bundleId): bundleId is string => Boolean(bundleId)),
      ]);
    return {
      evidenceId: `quality-status:${match.record.artifactId}`,
      outcome,
      verifiesTarget: qualityStatusMatchVerifiesTarget(match),
      targetRefs: uniqueQualityStatusValues([
        ...summary.matchRefs,
        ...summary.verifiesRefs,
        ...summary.materializesOutputRefs,
      ]),
      sourceRefs: uniqueQualityStatusValues([
        match.record.artifactRef,
        match.record.outputPath,
        snapshot?.sourcePath,
        ledgerEvidence?.sourcePath,
        warning?.resolvedPath,
      ].filter((value): value is string => Boolean(value))),
      bundleRefs,
      verifiedBundleRefs,
      gateRefs,
      verifiedGateRefs,
      verifiedGateCount: ledgerEvidence?.verifiedGates ?? snapshot?.totals.verifiedGates,
      totalGateCount: ledgerEvidence?.totalGates ?? snapshot?.totals.totalGates ?? gateDescriptors.length,
      generatedAt: ledgerEvidence?.latestRunAt ?? snapshot?.generatedAt,
      message: qualityStatusPromptEvidenceMessage(summary, outcome),
    };
  });
}

export function appendQualityStatusSnapshotGovernanceEvidence(
  extraction: ReturnType<typeof extractPromptArtifactSourcesFromDefinitionContext>,
  evidence: QualityStatusSnapshotEvidence,
): ReturnType<typeof extractPromptArtifactSourcesFromDefinitionContext> {
  if (evidence.governanceRuns.length === 0) return extraction;
  return {
    workArea: {
      ...extraction.workArea,
      paths: uniqueQualityStatusValues([
        ...(extraction.workArea.paths ?? []),
        ...evidence.governanceRuns.flatMap((run) => run.implementationRefs),
      ]),
      constraints: uniqueQualityStatusValues([
        ...(extraction.workArea.constraints ?? []),
        ...evidence.governanceRuns.flatMap((run) =>
          run.constraintVerdicts.map((verdict) => `quality-export:${verdict.code}`),
        ),
      ]),
      localInstructions: uniqueQualityStatusValues([
        ...(extraction.workArea.localInstructions ?? []),
        "Treat loaded quality export snapshots as concrete governance closure evidence.",
      ]),
    },
    sources: {
      ...extraction.sources,
      governanceRuns: uniqueGovernanceRuns([
        ...(extraction.sources.governanceRuns ?? []),
        ...evidence.governanceRuns,
      ]),
    },
  };
}

function loadQualityStatusLedger(ledgerPath: string | undefined): LoadedQualityStatusLedger | undefined {
  if (!ledgerPath) return undefined;
  const resolvedPath = resolve(ledgerPath);
  if (!existsSync(resolvedPath)) {
    return {
      path: resolvedPath,
      warning: {
        code: "quality-status-ledger-missing",
        resolvedPath,
        message: `Quality ledger path does not exist: ${ledgerPath}`,
      },
    };
  }

  try {
    const store = new SqliteQualityStore(resolvedPath);
    return {
      path: resolvedPath,
      ledger: new QualityLedger(store),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      path: resolvedPath,
      warning: {
        code: "quality-status-ledger-read-failed",
        resolvedPath,
        message: `Quality ledger path could not be read: ${ledgerPath}`,
        cause: message,
      },
    };
  }
}

function closeQualityStatusLedger(loadedLedger: LoadedQualityStatusLedger | undefined): void {
  if (!loadedLedger?.ledger) return;
  try {
    loadedLedger.ledger.store.close();
  } catch {
    // Ledger cleanup is auxiliary; extraction stays fail-open.
  }
}

function qualityStatusPromptEvidenceOutcome(
  summary: QualityStatusRecordSourceSummary,
): PromptArtifactQualityStatusEvidence["outcome"] {
  const ledgerEvidence = qualityStatusAuthoritativeLedgerEvidence(summary);
  if (ledgerEvidence) return qualityStatusLedgerEvidenceOutcome(ledgerEvidence);
  return qualityStatusSnapshotPromptEvidenceOutcome(summary);
}

function qualityStatusSnapshotPromptEvidenceOutcome(
  summary: QualityStatusRecordSourceSummary,
): PromptArtifactQualityStatusEvidence["outcome"] {
  const structuralOutcome = qualityStatusSnapshotStructuralPromptEvidenceOutcome(summary);
  if (structuralOutcome !== "verified") return structuralOutcome;
  return qualityStatusFreshnessPromptEvidenceOutcome(summary.qualityFreshness, structuralOutcome);
}

function qualityStatusPromptEvidenceMessage(
  summary: QualityStatusRecordSourceSummary,
  outcome: PromptArtifactQualityStatusEvidence["outcome"],
): string | undefined {
  const ledgerEvidence = qualityStatusAuthoritativeLedgerEvidence(summary);
  if (ledgerEvidence) {
    if (
      ledgerEvidence.freshness &&
      (outcome === "stale" || outcome === "incomplete") &&
      qualityStatusLedgerStructuralEvidenceOutcome(ledgerEvidence) === "verified"
    ) {
      return ledgerEvidence.freshness.message;
    }
    if (outcome === "verified") return undefined;
    const bundleRef = ledgerEvidence.bundleId ?? ledgerEvidence.bundleRefs[0] ?? "resolved gate surface";
    return outcome === "stale"
      ? `Quality ledger fallback ${bundleRef} reported stale gate docVersion verification.`
      : `Quality ledger fallback ${bundleRef} reported ${outcome} verification.`;
  }
  if (
    summary.qualityFreshness &&
    (outcome === "stale" || outcome === "incomplete") &&
    qualityStatusSnapshotStructuralPromptEvidenceOutcome(summary) === "verified"
  ) {
    return summary.qualityFreshness.message;
  }
  if (summary.qualityExportWarning) return summary.qualityExportWarning.message;
  const snapshot = summary.qualityExportSnapshot;
  if (!snapshot) return "Quality-status record did not load a quality export snapshot.";
  if (outcome === "verified") return undefined;
  return outcome === "stale"
    ? `Quality-status snapshot ${snapshot.rootId} reported stale verification state from the snapshot payload, not generatedAt freshness.`
    : `Quality-status snapshot ${snapshot.rootId} reported ${outcome} verification.`;
}

function qualityStatusAuthoritativeLedgerEvidence(
  summary: QualityStatusRecordSourceSummary,
): QualityStatusLedgerEvidence | undefined {
  if (!summary.qualityLedgerEvidence) return undefined;
  if (summary.qualityLedgerConflictWarning) return undefined;
  if (!shouldAttemptQualityLedgerFallback(summary)) return undefined;
  if (summary.qualityExportWarning || !summary.qualityExportSnapshot) {
    return summary.qualityLedgerEvidence;
  }
  return qualityStatusSnapshotStructuralPromptEvidenceOutcome(summary) === "incomplete"
    ? summary.qualityLedgerEvidence
    : undefined;
}

function shouldAttemptQualityLedgerFallback(
  summary: QualityStatusRecordSourceSummary,
): boolean {
  if (summary.qualityExportWarning) return true;
  const snapshot = summary.qualityExportSnapshot;
  if (!snapshot) return true;
  const outcome = qualityStatusSnapshotStructuralPromptEvidenceOutcome(summary);
  if (outcome !== "verified") return true;
  return !qualityStatusSnapshotHasVerifiedSurface(snapshot);
}

function qualityStatusLedgerEvidenceOutcome(
  evidence: QualityStatusLedgerEvidence,
): PromptArtifactQualityStatusEvidence["outcome"] {
  const structuralOutcome = qualityStatusLedgerStructuralEvidenceOutcome(evidence);
  if (structuralOutcome !== "verified") return structuralOutcome;
  return qualityStatusFreshnessPromptEvidenceOutcome(evidence.freshness, structuralOutcome);
}

function qualityStatusLedgerStructuralEvidenceOutcome(
  evidence: QualityStatusLedgerEvidence,
): PromptArtifactQualityStatusEvidence["outcome"] {
  if (evidence.verified) return "verified";
  if (evidence.blockingGateStatuses.some((status) => status.status === "failed")) {
    return "failed";
  }
  if (evidence.blockingGateStatuses.some((status) => status.status === "stale")) {
    return "stale";
  }
  return "incomplete";
}

function qualityStatusFreshnessPromptEvidenceOutcome(
  freshness: QualityStatusFreshnessEvidence | undefined,
  fallback: PromptArtifactQualityStatusEvidence["outcome"],
): PromptArtifactQualityStatusEvidence["outcome"] {
  if (!freshness || freshness.status === "fresh") return fallback;
  return freshness.status === "stale" ? "stale" : "incomplete";
}

function qualityStatusSnapshotGovernanceRun(
  record: ProgrammingArtifactRegistryRecord,
  snapshot: QualityStatusExportSnapshotEvidence,
): GovernanceRun {
  const implementationRefs = uniqueQualityStatusValues([
    record.artifactRef,
    record.outputPath,
    snapshot.sourcePath,
    snapshot.rootId,
    ...snapshot.bundleIds,
  ].filter((value): value is string => Boolean(value)));
  const verificationRefs = uniqueQualityStatusValues([
    record.outputPath,
    snapshot.sourcePath,
    ...snapshot.bundleIds,
    ...(record.verificationRefs ?? []),
  ].filter((value): value is string => Boolean(value)));
  const constraintVerdicts = snapshot.bundles.map((bundle) =>
    qualityStatusBundleVerdict(record, snapshot, bundle),
  );
  const adjustmentRecords = constraintVerdicts
    .filter((verdict) => !verdict.valid)
    .map((verdict): AdjustmentSuggestion => ({
      action: "defer",
      constraintKind: "validation_surface",
      reason: verdict.message,
      refs: verdict.refs,
    }));

  return {
    runId: `governance:${record.artifactId}:quality-export-snapshot`,
    blueprintId: `quality-status:${record.artifactId}`,
    implementationRefs,
    verificationRefs,
    familyKey: `governance:quality-status:${snapshot.rootId}`,
    constraintVerdicts,
    adjustmentRecords,
  };
}

function qualityStatusBundleVerdict(
  record: ProgrammingArtifactRegistryRecord,
  snapshot: QualityStatusExportSnapshotEvidence,
  bundle: QualityStatusSnapshotBundleEvidence,
): ConsistencyVerdict {
  const verifiedGates = bundle.verifiedGates ?? 0;
  const totalGates = bundle.totalGates ?? 0;
  const gatesVerified = totalGates > 0 && verifiedGates >= totalGates;
  const gateText = `${verifiedGates}/${totalGates}`;
  return {
    valid: gatesVerified,
    level: gatesVerified ? "warning" : "error",
    code: gatesVerified
      ? "quality-status-bundle-verified"
      : "quality-status-bundle-unverified",
    message: `Quality export bundle ${bundle.bundleId} has state=${bundle.bundleState ?? "unknown"}, gates=${gateText}, claims=${bundle.verifiedClaimCount ?? 0}/${bundle.claimCount ?? 0}.`,
    constraintKind: "validation_surface",
    refs: uniqueQualityStatusValues([
      record.artifactRef,
      record.outputPath,
      snapshot.sourcePath,
      snapshot.rootId,
      bundle.bundleId,
    ].filter((value): value is string => Boolean(value))),
  };
}

function qualityStatusLedgerEvidence(
  ledger: QualityLedger,
  sourcePath: string,
  gateDescriptors: readonly GateDescriptor[],
  freshnessPolicy?: QualityStatusFreshnessPolicy,
): QualityStatusLedgerEvidence {
  const verification = ledger.resolveBundleVerification(
    gateDescriptors.map((descriptor) => ({ ...descriptor })),
  );
  return summarizeQualityStatusLedgerEvidence(
    sourcePath,
    gateDescriptors,
    verification,
    freshnessPolicy,
  );
}

function summarizeQualityStatusLedgerEvidence(
  sourcePath: string,
  gateDescriptors: readonly GateDescriptor[],
  verification: BundleVerification,
  freshnessPolicy?: QualityStatusFreshnessPolicy,
): QualityStatusLedgerEvidence {
  const statuses = [...verification.gateStatuses.values()];
  const latestRunTimestamps = uniqueQualityStatusValues(
    statuses
      .map((status) => status.lastRun?.executedAt)
      .filter((value): value is string => Boolean(value)),
  );
  const latestRunAt = latestQualityStatusTimestamp(latestRunTimestamps);
  const freshness = qualityStatusLedgerFreshness(statuses, freshnessPolicy);
  const oldestVerifiedGateExecutedAt =
    freshness?.oldestVerifiedGateExecutedAt ??
    oldestQualityStatusTimestamp(
      statuses
        .filter((status) => status.status === "verified")
        .map((status) => status.lastRun?.executedAt)
        .filter((value): value is string => Boolean(value)),
    );
  const verifiedGateRefs = statuses
    .filter((status) => status.status === "verified")
    .map((status) => status.gateDocId);
  const bundleIds = uniqueQualityStatusValues(
    gateDescriptors
      .map((descriptor) => descriptor.bundleId)
      .filter((bundleId): bundleId is string => Boolean(bundleId)),
  );
  const blockingGates = verification.blockingGateStatuses.map(
    qualityStatusLedgerGateStatusEvidence,
  );
  const gatesWithRuns = statuses.filter((status) => status.lastRun).length;
  const timestampSummary = {
    ...(latestRunAt ? { latestRunAt } : {}),
    ...(oldestVerifiedGateExecutedAt ? { oldestVerifiedGateExecutedAt } : {}),
    latestRunTimestamps,
    latestRunCount: latestRunTimestamps.length,
    gatesWithRuns,
    gatesWithoutRuns: Math.max(0, verification.totalGates - gatesWithRuns),
  };

  return {
    sourcePath,
    ledgerPath: sourcePath,
    bundleId: verification.bundleId,
    bundleIds,
    bundleRefs: bundleIds,
    totalGates: verification.totalGates,
    totalGateCount: verification.totalGates,
    verifiedGates: verification.verifiedGates,
    verifiedGateCount: verification.verifiedGates,
    verified: verification.verified,
    gateRefs: gateDescriptors.map((descriptor) => descriptor.gateDocId),
    verifiedGateRefs,
    blockingGates,
    blockingGateStatuses: blockingGates,
    latestRunTimestamps,
    ...(latestRunAt ? { latestRunAt } : {}),
    ...(oldestVerifiedGateExecutedAt ? { oldestVerifiedGateExecutedAt } : {}),
    ...(freshness ? { freshness } : {}),
    timestampSummary,
  };
}

function qualityStatusLedgerGateStatusEvidence(
  status: GateStatus,
): QualityStatusLedgerGateStatusEvidence {
  return {
    gateDocId: status.gateDocId,
    currentVersion: status.currentVersion,
    status: status.status,
    ...(status.lastRun
      ? {
          latestRunAt: status.lastRun.executedAt,
          latestRunId: status.lastRun.id,
          latestRunDocVersion: status.lastRun.docVersion,
          latestRunOutcome: status.lastRun.outcome,
        }
      : {}),
  };
}

function latestQualityStatusTimestamp(
  timestamps: readonly string[],
): string | undefined {
  return timestamps.reduce<string | undefined>((latest, timestamp) => {
    if (!latest) return timestamp;
    return compareTimestamps(timestamp, latest) > 0 ? timestamp : latest;
  }, undefined);
}

function oldestQualityStatusTimestamp(
  timestamps: readonly string[],
): string | undefined {
  return timestamps.reduce<string | undefined>((oldest, timestamp) => {
    if (!oldest) return timestamp;
    return compareTimestamps(timestamp, oldest) < 0 ? timestamp : oldest;
  }, undefined);
}

function qualityStatusSnapshotFreshness(
  snapshot: QualityStatusExportSnapshotEvidence,
  policy: QualityStatusFreshnessPolicy | undefined,
): QualityStatusFreshnessEvidence | undefined {
  if (!policy) return undefined;
  return qualityStatusTimestampFreshness({
    source: "snapshot-generated-at",
    timestamp: snapshot.generatedAt,
    policy,
    freshMessage:
      `Quality-status snapshot ${snapshot.rootId} generatedAt is within --quality-status-max-age-days=${policy.maxAgeDays}.`,
    staleMessage:
      `Quality-status snapshot ${snapshot.rootId} generatedAt is older than --quality-status-max-age-days=${policy.maxAgeDays}; this is generatedAt freshness stale, not gate docVersion stale.`,
    incompleteMessage:
      `Quality-status snapshot ${snapshot.rootId} has no usable generatedAt for --quality-status-max-age-days=${policy.maxAgeDays}; freshness is incomplete, not stale.`,
  });
}

function qualityStatusLedgerFreshness(
  statuses: readonly GateStatus[],
  policy: QualityStatusFreshnessPolicy | undefined,
): QualityStatusFreshnessEvidence | undefined {
  if (!policy) return undefined;
  const verifiedStatuses = statuses.filter((status) => status.status === "verified");
  const missingTimestampGateRefs = verifiedStatuses
    .filter((status) => !isUsableQualityStatusTimestamp(status.lastRun?.executedAt))
    .map((status) => status.gateDocId);
  const oldestVerifiedGateExecutedAt = oldestQualityStatusTimestamp(
    verifiedStatuses
      .map((status) => status.lastRun?.executedAt)
      .filter((value): value is string => isUsableQualityStatusTimestamp(value)),
  );
  const base = qualityStatusFreshnessBase(policy);

  if (missingTimestampGateRefs.length > 0 || !oldestVerifiedGateExecutedAt) {
    return {
      ...base,
      status: "incomplete",
      source: "ledger-verified-gate-executed-at",
      ...(oldestVerifiedGateExecutedAt ? { oldestVerifiedGateExecutedAt } : {}),
      missingTimestampGateRefs,
      message:
        `Quality ledger fallback has verified gates without usable lastRun.executedAt for --quality-status-max-age-days=${policy.maxAgeDays}; freshness is incomplete, not stale.`,
    };
  }

  if (qualityStatusTimestampIsOlderThanThreshold(oldestVerifiedGateExecutedAt, base.thresholdAt)) {
    return {
      ...base,
      status: "stale",
      source: "ledger-verified-gate-executed-at",
      oldestVerifiedGateExecutedAt,
      staleGateRefs: verifiedStatuses
        .filter((status) =>
          qualityStatusTimestampIsOlderThanThreshold(status.lastRun?.executedAt, base.thresholdAt),
        )
        .map((status) => status.gateDocId),
      message:
        `Quality ledger fallback oldest verified gate lastRun.executedAt is older than --quality-status-max-age-days=${policy.maxAgeDays}; this is generatedAt freshness stale, not gate docVersion stale.`,
    };
  }

  return {
    ...base,
    status: "fresh",
    source: "ledger-verified-gate-executed-at",
    oldestVerifiedGateExecutedAt,
    message:
      `Quality ledger fallback oldest verified gate lastRun.executedAt is within --quality-status-max-age-days=${policy.maxAgeDays}.`,
  };
}

function qualityStatusTimestampFreshness(input: {
  source: QualityStatusFreshnessEvidence["source"];
  timestamp: string | undefined;
  policy: QualityStatusFreshnessPolicy;
  freshMessage: string;
  staleMessage: string;
  incompleteMessage: string;
}): QualityStatusFreshnessEvidence {
  const base = qualityStatusFreshnessBase(input.policy);
  if (!isUsableQualityStatusTimestamp(input.timestamp)) {
    return {
      ...base,
      status: "incomplete",
      source: input.source,
      message: input.incompleteMessage,
    };
  }
  if (qualityStatusTimestampIsOlderThanThreshold(input.timestamp, base.thresholdAt)) {
    return {
      ...base,
      status: "stale",
      source: input.source,
      generatedAt: input.timestamp,
      message: input.staleMessage,
    };
  }
  return {
    ...base,
    status: "fresh",
    source: input.source,
    generatedAt: input.timestamp,
    message: input.freshMessage,
  };
}

function qualityStatusFreshnessBase(
  policy: QualityStatusFreshnessPolicy,
): Pick<QualityStatusFreshnessEvidence, "checkedAt" | "maxAgeDays" | "thresholdAt"> {
  return {
    checkedAt: policy.now,
    maxAgeDays: policy.maxAgeDays,
    thresholdAt: new Date(
      new Date(policy.now).getTime() -
        policy.maxAgeDays * QUALITY_STATUS_FRESHNESS_DAY_MS,
    ).toISOString(),
  };
}

function isUsableQualityStatusTimestamp(timestamp: string | undefined): timestamp is string {
  return typeof timestamp === "string" && Number.isFinite(new Date(timestamp).getTime());
}

function qualityStatusTimestampIsOlderThanThreshold(
  timestamp: string | undefined,
  thresholdAt: string,
): boolean {
  return isUsableQualityStatusTimestamp(timestamp) &&
    compareTimestamps(timestamp, thresholdAt) < 0;
}

function qualityStatusLedgerIncompleteWarning(
  record: ProgrammingArtifactRegistryRecord,
  evidence: QualityStatusLedgerEvidence,
): QualityStatusSnapshotWarning {
  const blockingGateRefs = evidence.blockingGates.map((gate) => gate.gateDocId);
  const blockingGateText = blockingGateRefs.length > 0
    ? ` Blocking gates: ${blockingGateRefs.join(", ")}.`
    : "";
  return qualityStatusSnapshotWarning(record, {
    code: "quality-status-ledger-incomplete",
    resolvedPath: evidence.ledgerPath,
    message:
      `Quality ledger fallback verified ${evidence.verifiedGateCount}/${evidence.totalGateCount} resolved gates.${blockingGateText}`,
  });
}

function qualityStatusLedgerConflictWarning(
  record: ProgrammingArtifactRegistryRecord,
  summary: QualityStatusRecordSourceSummary,
): QualityStatusSnapshotWarning | undefined {
  const snapshot = summary.qualityExportSnapshot;
  const ledgerEvidence = summary.qualityLedgerEvidence;
  if (!snapshot || !ledgerEvidence) return undefined;
  if (!qualityStatusSnapshotAndLedgerSurfaceMatch(snapshot, ledgerEvidence)) {
    return undefined;
  }

  const snapshotState = determinateQualityStatusState(
    qualityStatusSnapshotStructuralPromptEvidenceOutcome(summary),
  );
  const ledgerState = determinateQualityStatusState(
    qualityStatusLedgerStructuralEvidenceOutcome(ledgerEvidence),
  );
  if (!snapshotState || !ledgerState || snapshotState === ledgerState) {
    return undefined;
  }

  return qualityStatusSnapshotWarning(record, {
    code: "quality-status-ledger-conflict",
    resolvedPath: ledgerEvidence.sourcePath,
    message:
      `Quality-status snapshot and quality ledger disagree for the same gate surface: snapshot=${snapshotState}, ledger=${ledgerState}.`,
  });
}

function qualityStatusSnapshotAndLedgerSurfaceMatch(
  snapshot: QualityStatusExportSnapshotEvidence,
  ledgerEvidence: QualityStatusLedgerEvidence,
): boolean {
  const snapshotBundleIds = new Set(snapshot.bundleIds);
  return ledgerEvidence.bundleRefs.some((bundleId) => snapshotBundleIds.has(bundleId)) ||
    (ledgerEvidence.bundleId ? snapshotBundleIds.has(ledgerEvidence.bundleId) : false);
}

function determinateQualityStatusState(
  outcome: PromptArtifactQualityStatusEvidence["outcome"],
): "verified" | "failed" | "stale" | "invalid" | undefined {
  if (
    outcome === "verified" ||
    outcome === "failed" ||
    outcome === "stale" ||
    outcome === "invalid"
  ) {
    return outcome;
  }
  return undefined;
}

function qualityStatusLedgerWarning(
  record: ProgrammingArtifactRegistryRecord,
  loadedLedger: LoadedQualityStatusLedger | undefined,
): QualityStatusSnapshotWarning | undefined {
  if (!loadedLedger?.warning) return undefined;
  return qualityStatusSnapshotWarning(record, loadedLedger.warning);
}

function uniqueGovernanceRuns(runs: readonly GovernanceRun[]): GovernanceRun[] {
  const byRunId = new Map<string, GovernanceRun>();
  for (const run of runs) {
    byRunId.set(run.runId, run);
  }
  return [...byRunId.values()];
}

function uniqueQualityStatusValues(values: readonly string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))];
}
