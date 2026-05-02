// @def.boundary docs-control-plane
// @def.doc docs-control-plane

import { readFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";

import type { DefDataSource } from "definition-catalog";
import type { GovernanceRun } from "operational-ontology/governance";
import type { PromptArtifactQualityStatusEvidence } from "operational-ontology/prompt-artifacts";
import {
  findRelatedQualityStatusRegistryRecords,
  type ProgrammingArtifactRelation,
  type ProgrammingArtifactRegistryRecord,
  type RelatedQualityStatusRegistryRecordMatch,
  type RelatedQualityStatusRegistryRecordSummary,
} from "operational-ontology/programming-artifacts";
import type { GateDescriptor } from "quality-ledger";

import {
  resolveQualityGateDescriptorsFromDataSource,
  type QualityGateDescriptorResolutionRef,
} from "../../lib/quality-gate-topology.js";
import type {
  QualityStatusFreshnessEvidence,
  QualityStatusLedgerEvidence,
} from "./quality-ledger-evidence.js";

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
