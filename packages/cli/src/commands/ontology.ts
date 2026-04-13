import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";

import type { DefDoc, DefIncomingLink, DefOutgoingLink } from "definition-catalog";
import { createDataSource, type DataSourceOptions } from "definition-data-source";
import {
  diffOperationalOntologyCheckpoint,
  diffOperationalOntologyCorridor,
  diffOperationalOntologyJunction,
  diffOperationalOntologyRouteDecision,
  diffOperationalOntologySnapshots,
  diffOperationalOntologyTraversal,
  diffLatestOperationalOntologyCheckpointByScope,
  diffLatestOperationalOntologyCorridorByScope,
  diffLatestOperationalOntologyJunctionByScope,
  diffLatestOperationalOntologyRouteDecisionByScope,
  diffLatestOperationalOntologySnapshotsByScope,
  diffLatestOperationalOntologyTraversalByScope,
  ingestEventRecordProjection,
  ingestOperationalOntologyProjection,
  ingestPipeGraphProjection,
  InMemoryOperationalOntologyStore,
  listOperationalOntologyCheckpointLatticesByScope,
  listOperationalOntologyCorridorsByScope,
  listOperationalOntologyJunctionsByScope,
  listOperationalOntologyRouteDecisionsByScope,
  listOperationalOntologyTraversalBundlesByScope,
  loadLatestOperationalOntologyCorridorViewByScope,
  loadLatestOperationalOntologyCheckpointLatticeByScope,
  loadLatestOperationalOntologyJunctionViewByScope,
  loadLatestOperationalOntologyRouteDecisionByScope,
  loadLatestOperationalOntologyTraversalBundleByScope,
  loadOperationalOntologyCheckpointLattice,
  loadOperationalOntologyCheckpointLattices,
  loadOperationalOntologyCorridorView,
  loadOperationalOntologyCorridors,
  loadOperationalOntologyJunctions,
  loadOperationalOntologyJunctionView,
  loadOperationalOntologyRouteDecision,
  loadOperationalOntologyRouteDecisions,
  loadOperationalOntologyTraversalBundle,
  loadOperationalOntologyTraversalBundles,
  listOperationalOntologySnapshotProjections,
  loadLatestOperationalOntologySnapshotViewByScope,
  loadOperationalOntologySnapshotView,
  type IngestOperationalOntologyProjectionOptions,
  type OperationalOntologyObjectRecord,
  type OperationalOntologyFacetRecord,
  type OperationalOntologyObservationRecord,
  type OperationalOntologyProjectionRecord,
} from "operational-ontology/persistence";
import {
  persistImplementationGovernanceRun,
  type AdjustmentSuggestion,
  type ConsistencyVerdict,
  type GovernanceRun,
} from "operational-ontology/governance";
import type {
  EventRecordObservationInput,
  PipeGraphProjectionInput,
} from "operational-ontology/projectors";
import {
  extractPromptArtifactSourcesFromDefinitionContext,
  generatePromptArtifact,
  generatePromptArtifacts,
  evaluatePromptArtifactQuality,
  type PromptArtifact,
  type PromptArtifactKind,
  type PromptArtifactUseCase,
  PROMPT_ARTIFACT_KINDS,
  PROMPT_ARTIFACT_USE_CASES,
} from "operational-ontology/prompt-artifacts";
import {
  ArtifactRegistryPromptArtifactContextProvider,
  InMemoryProgrammingArtifactRegistryStore,
  PROGRAMMING_ARTIFACT_KINDS,
  PROGRAMMING_ARTIFACT_RELATION_KINDS,
  appendQualityStatusEvidenceToPromptArtifactExtraction,
  createProgrammingArtifactRegistryRecord,
  findRelatedQualityStatusRegistryRecords,
  type ProgrammingArtifactRegistryRecord,
  type RelatedQualityStatusRegistryRecordMatch,
  type RelatedQualityStatusRegistryRecordSummary,
} from "operational-ontology/programming-artifacts";
import { getQaSdkDir } from "../lib/qa-dir.js";
import {
  appendProgrammingArtifactRegistryRecord,
  appendProgrammingArtifactRegistryRecords,
} from "../lib/programming-artifact-registry.js";

interface PersistedOntologyStoreFile {
  objects: OperationalOntologyObjectRecord[];
  facets: OperationalOntologyFacetRecord[];
  observations: OperationalOntologyObservationRecord[];
  projections: OperationalOntologyProjectionRecord[];
}

interface ProgrammingArtifactRegistryFile {
  artifacts?: ProgrammingArtifactRegistryRecord[];
}

type ArtifactExtractionSourceKind =
  | "artifact-registry-hit"
  | "artifact-registry-miss"
  | "artifact-file-fallback"
  | "artifact-definition-fallback"
  | "artifact-search-fallback";

interface ArtifactExtractionSource {
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
  qualitySignal: {
    code: ArtifactExtractionSourceKind;
    grade: "ready" | "usable" | "degraded";
    warning?: string;
    recommendedManagementActions: readonly string[];
  };
}

interface QualityStatusSnapshotBundleEvidence {
  bundleId: string;
  bundleState?: string;
  verifiedGates?: number;
  totalGates?: number;
  claimCount?: number;
  verifiedClaimCount?: number;
}

interface QualityStatusExportSnapshotEvidence {
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

interface QualityStatusSnapshotWarning {
  code:
    | "quality-status-snapshot-missing"
    | "quality-status-snapshot-invalid-json"
    | "quality-status-snapshot-invalid-shape"
    | "quality-status-snapshot-read-failed";
  artifactId: string;
  artifactRef: string;
  outputPath?: string;
  resolvedPath?: string;
  message: string;
  cause?: string;
}

type QualityStatusRecordSourceSummary = RelatedQualityStatusRegistryRecordSummary & {
  qualityExportSnapshot?: QualityStatusExportSnapshotEvidence;
  qualityExportWarning?: QualityStatusSnapshotWarning;
};

interface QualityStatusSnapshotEvidence {
  recordSummaries: ReadonlyMap<string, QualityStatusRecordSourceSummary>;
  warnings: readonly QualityStatusSnapshotWarning[];
  governanceRuns: readonly GovernanceRun[];
}

interface RelatedQualityStatusEvidence {
  matches: readonly RelatedQualityStatusRegistryRecordMatch[];
  snapshotEvidence: QualityStatusSnapshotEvidence;
}

interface LoadedArtifactRegistryProvider {
  provider: ArtifactRegistryPromptArtifactContextProvider;
  store: InMemoryProgrammingArtifactRegistryStore;
  records: readonly ProgrammingArtifactRegistryRecord[];
  registryPath: string;
  recordCount: number;
}

interface PromptArtifactMaterialization {
  artifactId: string;
  kind: PromptArtifactKind;
  outputPath: string;
}

const DEFAULT_STORE_FILE = join(getQaSdkDir(), "operational-ontology-store.json");

function parseFlags(args: string[]): { positional: string[]; flags: Record<string, string> } {
  const positional: string[] = [];
  const flags: Record<string, string> = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]!;
    if (!arg.startsWith("--")) {
      positional.push(arg);
      continue;
    }

    const [key, inline] = arg.slice(2).split("=", 2);
    const next = args[index + 1];
    if (inline !== undefined) {
      flags[key] = inline;
    } else if (next && !next.startsWith("--")) {
      flags[key] = next;
      index += 1;
    } else {
      flags[key] = "true";
    }
  }

  return { positional, flags };
}

function getStorePath(flags: Record<string, string>): string {
  return resolve(flags["store"] ?? DEFAULT_STORE_FILE);
}

async function loadJsonFile<T>(filePath: string): Promise<T> {
  const content = await readFile(filePath, "utf8");
  return JSON.parse(content) as T;
}

async function loadStore(storePath: string): Promise<InMemoryOperationalOntologyStore> {
  const store = new InMemoryOperationalOntologyStore();
  if (!existsSync(storePath)) {
    return store;
  }

  const payload = await loadJsonFile<PersistedOntologyStoreFile>(storePath);
  for (const object of payload.objects ?? []) {
    await store.upsertObject(object);
  }
  for (const facet of payload.facets ?? []) {
    await store.putFacet(facet);
  }
  for (const observation of payload.observations ?? []) {
    await store.appendObservation(observation);
  }
  for (const projection of payload.projections ?? []) {
    await store.putProjection(projection);
  }
  return store;
}

async function loadArtifactRegistryProvider(
  flags: Record<string, string>,
): Promise<LoadedArtifactRegistryProvider | undefined> {
  const registryPath = flags["artifact-registry"] ?? flags["artifact-registry-file"];
  if (!registryPath) return undefined;

  const records = await loadProgrammingArtifactRegistryRecords(registryPath);
  const store = new InMemoryProgrammingArtifactRegistryStore(records);
  return {
    provider: new ArtifactRegistryPromptArtifactContextProvider(store),
    store,
    records,
    registryPath: resolve(registryPath),
    recordCount: records.length,
  };
}

async function loadProgrammingArtifactRegistryRecords(
  registryPath: string,
): Promise<ProgrammingArtifactRegistryRecord[]> {
  const resolvedPath = resolve(registryPath);
  const payload = existsSync(resolvedPath)
    ? await loadJsonFile<
        ProgrammingArtifactRegistryRecord[] | ProgrammingArtifactRegistryFile
      >(resolvedPath)
    : { artifacts: [] };
  return Array.isArray(payload) ? payload : payload.artifacts ?? [];
}

async function saveStore(
  store: InMemoryOperationalOntologyStore,
  storePath: string,
): Promise<void> {
  const objects = await store.listObjects();
  const facets = (
    await Promise.all(objects.map((object) => store.listFacets(object.objectId)))
  ).flat();
  const observations = await store.listObservations();
  const projections = await store.listProjections();

  await mkdir(dirname(storePath), { recursive: true });
  await writeFile(
    storePath,
    JSON.stringify(
      {
        objects,
        facets,
        observations,
        projections,
      } satisfies PersistedOntologyStoreFile,
      null,
      2,
    ),
    "utf8",
  );
}

function printJson(data: unknown): void {
  console.log(JSON.stringify(data, null, 2));
}

function printTable(headers: string[], row: string[]): void {
  const widths = headers.map((header, index) =>
    Math.max(header.length, row[index]?.length ?? 0),
  );
  console.log(
    headers.map((header, index) => header.padEnd(widths[index]!)).join("  "),
  );
  console.log(widths.map((width) => "-".repeat(width)).join("  "));
  console.log(row.map((value, index) => value.padEnd(widths[index]!)).join("  "));
}

function toIngestOptions(flags: Record<string, string>): IngestOperationalOntologyProjectionOptions {
  return {
    snapshotId: flags["snapshot-id"],
    targetScope: flags["scope"],
    builtAt: flags["built-at"],
  };
}

function toDefinitionDataSourceOptions(flags: Record<string, string>): DataSourceOptions {
  return {
    mode: flags["local"] === "true"
      ? "local"
      : flags["server"] === "true"
        ? "server"
        : flags["scan"] === "true"
          ? "scan"
          : undefined,
    dbPath: flags["db"],
    serverUrl: flags["server-url"],
  };
}

function parsePromptArtifactKind(value: string | undefined): PromptArtifactKind | "all" {
  if (!value || value === "all") return "all";
  if ((PROMPT_ARTIFACT_KINDS as readonly string[]).includes(value)) {
    return value as PromptArtifactKind;
  }
  throw new Error(`Unknown prompt artifact kind "${value}"`);
}

function parsePromptArtifactUseCase(value: string | undefined): PromptArtifactUseCase {
  const useCase = value ?? "feature_modification";
  if ((PROMPT_ARTIFACT_USE_CASES as readonly string[]).includes(useCase)) {
    return useCase as PromptArtifactUseCase;
  }
  throw new Error(`Unknown prompt artifact use case "${useCase}"`);
}

function uniqueCliValues(values: readonly string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))];
}

function inferArtifactType(artifactRef: string): string | undefined {
  if (artifactRef.endsWith(".json")) return "json";
  if (artifactRef.endsWith(".ts")) return "typescript";
  if (artifactRef.includes("quality")) return "quality-status";
  if (artifactRef.includes("build")) return "build";
  if (artifactRef.includes("schema")) return "schema";
  return undefined;
}

function parseArtifactExtractionSource(
  flags: Record<string, string>,
): ArtifactExtractionSource | undefined {
  const value = flags["artifact-source"];
  if (!value) return undefined;
  return JSON.parse(value) as ArtifactExtractionSource;
}

function qualityStatusRecordsSummary(
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

function withQualityStatusRecordsSummary(
  source: ArtifactExtractionSource | undefined,
  matches: readonly RelatedQualityStatusRegistryRecordMatch[],
  snapshotEvidence: QualityStatusSnapshotEvidence = emptyQualityStatusSnapshotEvidence(),
): ArtifactExtractionSource | undefined {
  if (!source) return undefined;
  const warningCodes = qualityStatusSnapshotWarningCodes(snapshotEvidence);
  return {
    ...source,
    warnings: uniqueCliValues([...source.warnings, ...warningCodes]),
    qualityStatusRecords: qualityStatusRecordsSummary(matches, snapshotEvidence),
  };
}

function artifactRegistryHitSource(
  loadedRegistry: LoadedArtifactRegistryProvider,
  qualityStatusMatches: readonly RelatedQualityStatusRegistryRecordMatch[],
  snapshotEvidence: QualityStatusSnapshotEvidence = emptyQualityStatusSnapshotEvidence(),
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
    qualitySignal: {
      code: "artifact-registry-hit",
      grade: "ready",
      recommendedManagementActions: [],
    },
  };
}

function artifactFallbackSource(input: {
  kind: Exclude<ArtifactExtractionSourceKind, "artifact-registry-hit" | "artifact-registry-miss">;
  fallbackKind: "file" | "definition" | "search";
  target: string;
  loadedRegistry?: LoadedArtifactRegistryProvider;
  matchedDocs?: readonly string[];
  qualityStatusMatches?: readonly RelatedQualityStatusRegistryRecordMatch[];
  qualityStatusSnapshotEvidence?: QualityStatusSnapshotEvidence;
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

function withArtifactSourceFlag(
  args: readonly string[],
  source: ArtifactExtractionSource,
): string[] {
  return [...args, "--artifact-source", JSON.stringify(source)];
}

async function loadRelatedQualityStatusEvidenceFromFlags(
  flags: Record<string, string>,
  targetRefs: readonly (string | undefined)[],
): Promise<RelatedQualityStatusEvidence> {
  const loadedRegistry = await loadArtifactRegistryProvider(flags);
  if (!loadedRegistry) {
    return {
      matches: [],
      snapshotEvidence: emptyQualityStatusSnapshotEvidence(),
    };
  }
  return loadRelatedQualityStatusEvidence(loadedRegistry, targetRefs);
}

async function loadRelatedQualityStatusEvidence(
  loadedRegistry: LoadedArtifactRegistryProvider | undefined,
  targetRefs: readonly (string | undefined)[],
): Promise<RelatedQualityStatusEvidence> {
  const matches = findRelatedQualityStatusMatches(loadedRegistry, targetRefs);
  return {
    matches,
    snapshotEvidence: await loadQualityStatusSnapshotEvidence(loadedRegistry, matches),
  };
}

function findRelatedQualityStatusMatches(
  loadedRegistry: LoadedArtifactRegistryProvider | undefined,
  targetRefs: readonly (string | undefined)[],
): RelatedQualityStatusRegistryRecordMatch[] {
  if (!loadedRegistry) return [];
  return findRelatedQualityStatusRegistryRecords({
    records: loadedRegistry.records,
    targetRefs: expandQualityStatusTargetRefs(targetRefs),
  });
}

function qualityStatusRecords(
  matches: readonly RelatedQualityStatusRegistryRecordMatch[],
): ProgrammingArtifactRegistryRecord[] {
  return matches.map((match) => match.record);
}

function emptyQualityStatusSnapshotEvidence(): QualityStatusSnapshotEvidence {
  return {
    recordSummaries: new Map(),
    warnings: [],
    governanceRuns: [],
  };
}

function qualityStatusRecordKey(record: Pick<ProgrammingArtifactRegistryRecord, "artifactId" | "artifactRef">): string {
  return `${record.artifactId}\n${record.artifactRef}`;
}

function qualityStatusSnapshotWarningCodes(
  evidence: QualityStatusSnapshotEvidence,
): string[] {
  return uniqueCliValues(evidence.warnings.map((warning) => warning.code));
}

async function loadQualityStatusSnapshotEvidence(
  loadedRegistry: LoadedArtifactRegistryProvider | undefined,
  matches: readonly RelatedQualityStatusRegistryRecordMatch[],
): Promise<QualityStatusSnapshotEvidence> {
  if (!loadedRegistry || matches.length === 0) {
    return emptyQualityStatusSnapshotEvidence();
  }

  const recordSummaries = new Map<string, QualityStatusRecordSourceSummary>();
  const warnings: QualityStatusSnapshotWarning[] = [];
  const governanceRuns: GovernanceRun[] = [];

  for (const match of matches) {
    if (!match.record.outputPath) continue;
    const loaded = await loadQualityStatusSnapshotForRecord(
      loadedRegistry,
      match.record,
    );
    if (loaded.warning) {
      warnings.push(loaded.warning);
      recordSummaries.set(qualityStatusRecordKey(match.record), {
        ...match.summary,
        qualityExportWarning: loaded.warning,
      });
      continue;
    }
    if (!loaded.snapshot) continue;
    recordSummaries.set(qualityStatusRecordKey(match.record), {
      ...match.summary,
      qualityExportSnapshot: loaded.snapshot,
    });
    governanceRuns.push(
      qualityStatusSnapshotGovernanceRun(match.record, loaded.snapshot),
    );
  }

  return {
    recordSummaries,
    warnings,
    governanceRuns,
  };
}

async function loadQualityStatusSnapshotForRecord(
  loadedRegistry: LoadedArtifactRegistryProvider,
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
          snapshot: summarizeQualityStatusExportSnapshot(payload, path, record),
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

function qualityStatusSnapshotCandidatePaths(
  outputPath: string | undefined,
  registryPath: string,
): string[] {
  if (!outputPath) return [];
  if (isAbsolute(outputPath)) return [outputPath];
  return uniqueCliValues([
    resolve(outputPath),
    resolve(dirname(registryPath), outputPath),
  ]);
}

function summarizeQualityStatusExportSnapshot(
  payload: unknown,
  sourcePath: string,
  record: ProgrammingArtifactRegistryRecord,
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

function qualityStatusSnapshotGovernanceRun(
  record: ProgrammingArtifactRegistryRecord,
  snapshot: QualityStatusExportSnapshotEvidence,
): GovernanceRun {
  const implementationRefs = uniqueCliValues([
    record.artifactRef,
    record.outputPath,
    snapshot.sourcePath,
    snapshot.rootId,
    ...snapshot.bundleIds,
  ].filter((value): value is string => Boolean(value)));
  const verificationRefs = uniqueCliValues([
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
    refs: uniqueCliValues([
      record.artifactRef,
      record.outputPath,
      snapshot.sourcePath,
      snapshot.rootId,
      bundle.bundleId,
    ].filter((value): value is string => Boolean(value))),
  };
}

function qualityStatusSnapshotWarning(
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

function appendQualityStatusSnapshotGovernanceEvidence(
  extraction: ReturnType<typeof extractPromptArtifactSourcesFromDefinitionContext>,
  evidence: QualityStatusSnapshotEvidence,
): ReturnType<typeof extractPromptArtifactSourcesFromDefinitionContext> {
  if (evidence.governanceRuns.length === 0) return extraction;
  return {
    workArea: {
      ...extraction.workArea,
      paths: uniqueCliValues([
        ...(extraction.workArea.paths ?? []),
        ...evidence.governanceRuns.flatMap((run) => run.implementationRefs),
      ]),
      constraints: uniqueCliValues([
        ...(extraction.workArea.constraints ?? []),
        ...evidence.governanceRuns.flatMap((run) =>
          run.constraintVerdicts.map((verdict) => `quality-export:${verdict.code}`),
        ),
      ]),
      localInstructions: uniqueCliValues([
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

function uniqueGovernanceRuns(runs: readonly GovernanceRun[]): GovernanceRun[] {
  const byRunId = new Map<string, GovernanceRun>();
  for (const run of runs) {
    byRunId.set(run.runId, run);
  }
  return [...byRunId.values()];
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

function expandQualityStatusTargetRefs(
  refs: readonly (string | undefined)[],
): string[] {
  return uniqueCliValues(
    refs.flatMap((ref) => {
      if (!ref) return [];
      const strippedWorkArea = ref.startsWith("work-area:")
        ? ref.slice("work-area:".length)
        : undefined;
      const strippedArtifact = ref.startsWith("artifact:")
        ? ref.slice("artifact:".length)
        : undefined;
      const baseRefs = uniqueCliValues([
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

function workAreaQualityTargetRefs(
  workArea: ReturnType<typeof extractPromptArtifactSourcesFromDefinitionContext>["workArea"],
): string[] {
  return uniqueCliValues([
    workArea.workAreaId,
    workArea.rootRef,
    ...(workArea.paths ?? []),
  ].filter((value): value is string => Boolean(value)));
}

function registryRecordQualityTargetRefs(
  record: ProgrammingArtifactRegistryRecord | undefined,
): string[] {
  if (!record) return [];
  return uniqueCliValues([
    record.outputPath,
    ...(record.verifiesRefs ?? []),
    ...(record.materializesOutputRefs ?? []),
    ...(record.sourceRefs ?? []),
    ...(record.relations ?? []).flatMap((relation) => [relation.fromRef, relation.toRef]),
  ].filter((value): value is string => Boolean(value)));
}

async function materializePromptArtifacts(input: {
  flags: Record<string, string>;
  artifacts: readonly PromptArtifact[];
  producedByRef: string;
  ownerDefinitionId?: string;
  materializesOutputRefs?: readonly string[];
}): Promise<PromptArtifactMaterialization[]> {
  const output = input.flags["output"];
  if (!output) return [];

  const outputs = resolvePromptArtifactOutputs(output, input.artifacts);
  await Promise.all(outputs.map(async ({ artifact, outputPath }) => {
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, artifact.content + "\n", "utf8");
  }));

  const registryPath = input.flags["artifact-registry"] ?? input.flags["artifact-registry-file"];
  if (registryPath) {
    await appendProgrammingArtifactRegistryRecords(
      registryPath,
      outputs.map(({ artifact, outputPath }) =>
        createProgrammingArtifactRegistryRecord({
          artifactId: `prompt-artifact-${slugCliRef(artifact.artifactId)}`,
          artifactRef: outputPath,
          kind: "prompt-artifact",
          producedByRef: input.producedByRef,
          derivedFromRefs: artifact.sourceRefs,
          verifiesRefs: artifact.validation.valid ? [artifact.workAreaId] : [],
          ownerDefinitionId: input.ownerDefinitionId,
          materializesOutputRefs: [
            artifact.artifactId,
            `work-area:${artifact.workAreaId}`,
            ...(input.materializesOutputRefs ?? []),
          ],
          sourceRefs: artifact.sourceRefs,
          outputPath,
          verificationRefs: artifact.validation.valid ? [artifact.artifactId] : [],
          createdAt: new Date().toISOString(),
          metadata: {
            promptArtifactKind: artifact.kind,
            useCase: artifact.useCase,
            workAreaId: artifact.workAreaId,
            validation: artifact.validation,
          },
        }),
      ),
    );
  }

  return outputs.map(({ artifact, outputPath }) => ({
    artifactId: artifact.artifactId,
    kind: artifact.kind,
    outputPath,
  }));
}

function resolvePromptArtifactOutputs(
  output: string,
  artifacts: readonly PromptArtifact[],
): Array<{ artifact: PromptArtifact; outputPath: string }> {
  const resolvedOutput = resolve(output);
  const outputIsDirectory = artifacts.length > 1 || output.endsWith("/");
  return artifacts.map((artifact) => ({
    artifact,
    outputPath: outputIsDirectory
      ? join(resolvedOutput, `${artifact.kind}.prompt.md`)
      : resolvedOutput,
  }));
}

function slugCliRef(ref: string): string {
  const slug = ref
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "unknown";
}

interface ArtifactRegistryValidationIssue {
  level: "error" | "warning";
  code: string;
  artifactRef?: string;
  message: string;
}

function validateProgrammingArtifactRegistryRecords(
  records: readonly ProgrammingArtifactRegistryRecord[],
): ArtifactRegistryValidationIssue[] {
  const issues: ArtifactRegistryValidationIssue[] = [];
  const seenRefs = new Set<string>();
  const knownKinds = new Set<string>(PROGRAMMING_ARTIFACT_KINDS);
  const knownRelationKinds = new Set<string>(PROGRAMMING_ARTIFACT_RELATION_KINDS);

  for (const [index, record] of records.entries()) {
    const label = record.artifactRef || record.artifactId || `index:${index}`;
    if (!record.artifactId?.trim()) {
      issues.push({
        level: "error",
        code: "artifact-id-missing",
        artifactRef: label,
        message: "artifactId is required",
      });
    }
    if (!record.artifactRef?.trim()) {
      issues.push({
        level: "error",
        code: "artifact-ref-missing",
        artifactRef: label,
        message: "artifactRef is required",
      });
    } else if (seenRefs.has(record.artifactRef)) {
      issues.push({
        level: "warning",
        code: "artifact-ref-duplicate",
        artifactRef: record.artifactRef,
        message: "artifactRef appears more than once",
      });
    } else {
      seenRefs.add(record.artifactRef);
    }
    if (!knownKinds.has(record.kind)) {
      issues.push({
        level: "error",
        code: "artifact-kind-unknown",
        artifactRef: label,
        message: `Unknown artifact kind "${record.kind}"`,
      });
    }
    for (const relation of record.relations ?? []) {
      if (!knownRelationKinds.has(relation.kind)) {
        issues.push({
          level: "error",
          code: "artifact-relation-kind-unknown",
          artifactRef: label,
          message: `Unknown relation kind "${relation.kind}"`,
        });
      }
      if (!relation.fromRef?.trim() || !relation.toRef?.trim()) {
        issues.push({
          level: "error",
          code: "artifact-relation-endpoint-missing",
          artifactRef: label,
          message: `Relation "${relation.kind}" must have fromRef and toRef`,
        });
      }
    }
  }

  return issues;
}

function commaValues(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseOptionalMetadata(value: string | undefined): Record<string, unknown> | undefined {
  if (!value) return undefined;
  const parsed = JSON.parse(value) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("--metadata must be a JSON object");
  }
  return parsed as Record<string, unknown>;
}

function createRegistryRecordFromFlags(
  flags: Record<string, string>,
): ProgrammingArtifactRegistryRecord {
  const kind = flags["kind"];
  if (!kind) throw new Error("--kind is required");
  return createProgrammingArtifactRegistryRecord({
    artifactId: flags["artifact-id"],
    artifactRef: flags["artifact-ref"] ?? flags["ref"] ?? flags["output-path"],
    kind,
    producedByRef: flags["produced-by"],
    derivedFromRefs: commaValues(flags["derived-from"]),
    verifiesRefs: commaValues(flags["verifies"]),
    ownerDefinitionId: flags["owner-definition"],
    materializesOutputRefs: commaValues(flags["materializes-output"]),
    sourceRefs: commaValues(flags["source-ref"] ?? flags["source-refs"]),
    outputPath: flags["output-path"],
    verificationRefs: commaValues(flags["verification-ref"] ?? flags["verification-refs"]),
    createdAt: flags["created-at"] ?? new Date().toISOString(),
    metadata: parseOptionalMetadata(flags["metadata"]),
  });
}

async function cmdArtifactRegistryValidate(rest: string[]): Promise<void> {
  const { flags } = parseFlags(rest);
  const input = flags["input"];
  if (!input) {
    console.error("Usage: qa-sdk ontology artifact registry validate --input <file> [--json]");
    return;
  }

  const records = await loadProgrammingArtifactRegistryRecords(input);
  const issues = validateProgrammingArtifactRegistryRecords(records);
  const errors = issues.filter((issue) => issue.level === "error");
  const warnings = issues.filter((issue) => issue.level === "warning");
  const result = {
    input: resolve(input),
    valid: errors.length === 0,
    artifactCount: records.length,
    errors,
    warnings,
  };

  if (flags["json"] === "true") {
    printJson(result);
    return;
  }

  console.log(`${result.valid ? "valid" : "invalid"}: ${result.input}`);
  console.log(`artifacts: ${records.length}`);
  console.log(`errors: ${errors.length}`);
  console.log(`warnings: ${warnings.length}`);
  for (const issue of issues) {
    console.log(`  [${issue.level}] ${issue.code}${issue.artifactRef ? ` ${issue.artifactRef}` : ""}: ${issue.message}`);
  }
}

async function cmdArtifactRegistryList(rest: string[]): Promise<void> {
  const { flags } = parseFlags(rest);
  const input = flags["input"];
  if (!input) {
    console.error("Usage: qa-sdk ontology artifact registry list --input <file> [--kind <kind>] [--json]");
    return;
  }

  const kind = flags["kind"];
  const records = (await loadProgrammingArtifactRegistryRecords(input))
    .filter((record) => !kind || record.kind === kind);
  if (flags["json"] === "true") {
    printJson({ input: resolve(input), kind, artifacts: records });
    return;
  }

  console.log(`artifacts: ${records.length}`);
  for (const record of records) {
    console.log(`${record.kind}  ${record.artifactRef}  ${record.artifactId}`);
  }
}

async function cmdArtifactRegistryAppend(rest: string[]): Promise<void> {
  const { flags } = parseFlags(rest);
  const output = flags["output"] ?? flags["artifact-registry"];
  if (!output) {
    console.error(
      "Usage: qa-sdk ontology artifact registry append --output <registry.json> (--input <record.json> | --kind <kind> --artifact-ref <ref>) [--json]",
    );
    return;
  }

  const input = flags["input"];
  const record = input
    ? await loadJsonFile<ProgrammingArtifactRegistryRecord>(resolve(input))
    : createRegistryRecordFromFlags(flags);
  const result = await appendProgrammingArtifactRegistryRecord(output, record);

  if (flags["json"] === "true") {
    printJson(result);
    return;
  }

  console.log(`artifact registry: ${record.artifactId} -> ${result.registryPath}`);
  console.log(`artifacts: ${result.recordCount}`);
}

async function defDocWithBody(source: Awaited<ReturnType<typeof createDataSource>>, doc: DefDoc) {
  const body = await source.getBody(doc.docId);
  const sourcePath = doc.sourcePath ?? body?.sourcePath;
  const rawBody = sourcePath && existsSync(sourcePath)
    ? await readFile(sourcePath, "utf8")
    : body?.body;
  return {
    docId: doc.docId,
    title: doc.title,
    scope: doc.scope,
    aspect: doc.aspect,
    depth: doc.depth,
    lifecycle: doc.lifecycle,
    layer: doc.layer,
    tags: doc.tags,
    purpose: doc.purpose,
    sourcePath,
    body: rawBody,
  };
}

const AUTHORIZATION_PERMISSION_CONTEXT_DOC_IDS = [
  "authorization-ontology-permission-engine-bridge",
  "authorization-management-usecases",
  "authorization-management-usage-rule",
  "authorization-ontology-decision-observation",
  "authorization-ontology-audit-layer",
] as const;

function outgoingLinkToPromptLink(root: DefDoc, link: DefOutgoingLink) {
  return {
    source: root.docId,
    target: link.target,
    type: link.type,
  };
}

function incomingLinkToPromptLink(root: DefDoc, link: DefIncomingLink) {
  return {
    source: link.source,
    target: root.docId,
    type: link.type,
  };
}

async function markPersistedGovernanceEvidence(
  store: InMemoryOperationalOntologyStore,
  extraction: ReturnType<typeof extractPromptArtifactSourcesFromDefinitionContext>,
): Promise<void> {
  const runs = extraction.sources.governanceRuns ?? [];
  if (runs.length === 0) return;

  const persistedObjects = await Promise.all(
    runs.map((run) => store.findObjectById(run.runId)),
  );
  if (persistedObjects.some(Boolean)) {
    extraction.sources.governanceRuns = runs.map((run, index) =>
      persistedObjects[index] ? { ...run, runId: `${run.runId}:persisted` } : run,
    );
  }
}

async function maybePersistGovernanceEvidence(
  flags: Record<string, string>,
  extraction: ReturnType<typeof extractPromptArtifactSourcesFromDefinitionContext>,
): Promise<void> {
  const store = await loadStore(getStorePath(flags));
  if (flags["persist-governance"] === "true") {
    for (const run of extraction.sources.governanceRuns ?? []) {
      await persistImplementationGovernanceRun(store, run, {
        now: flags["built-at"] ?? new Date().toISOString(),
      });
    }
    await saveStore(store, getStorePath(flags));
  }
  await markPersistedGovernanceEvidence(store, extraction);
}

async function cmdPromptExtract(rest: string[]): Promise<void> {
  const { positional, flags } = parseFlags(rest);
  const docId = positional[0];
  if (!docId) {
    console.error(
      "Usage: qa-sdk ontology prompt extract <doc-id> [--kind self_reflection|code_editing_rules|all] [--use-case <usecase>] [--persist-governance] [--store <file>] [--output <file|dir>] [--json] [--local|--server|--scan] [--db <path>]",
    );
    return;
  }

  const kind = parsePromptArtifactKind(flags["kind"]);
  const useCase = parsePromptArtifactUseCase(flags["use-case"]);
  const source = await createDataSource(toDefinitionDataSourceOptions(flags));
  const root = await source.get(docId);
  if (!root) {
    console.error(`Definition document not found: ${docId}`);
    process.exitCode = 1;
    return;
  }

  const [children, outgoingLinks, incomingLinks] = await Promise.all([
    source.getChildren(docId),
    source.getOutgoingLinks(docId),
    source.getIncomingLinks(docId),
  ]);
  const [rootDoc, childDocs] = await Promise.all([
    defDocWithBody(source, root),
    Promise.all(children.map((child) => defDocWithBody(source, child))),
  ]);
  const extraction = extractPromptArtifactSourcesFromDefinitionContext({
    root: rootDoc,
    children: childDocs,
    outgoingLinks: outgoingLinks.map((link) => outgoingLinkToPromptLink(root, link)),
    incomingLinks: incomingLinks.map((link) => incomingLinkToPromptLink(root, link)),
    useCase,
    now: new Date().toISOString(),
  });
  const qualityStatusEvidence = await loadRelatedQualityStatusEvidenceFromFlags(flags, [
    docId,
    ...workAreaQualityTargetRefs(extraction.workArea),
  ]);
  const extractionWithQuality = appendQualityStatusSnapshotGovernanceEvidence(
    appendQualityStatusEvidenceToPromptArtifactExtraction(
      extraction,
      qualityStatusRecords(qualityStatusEvidence.matches),
      {
        useCase,
        now: new Date().toISOString(),
      },
    ),
    qualityStatusEvidence.snapshotEvidence,
  );
  const artifactSource = withQualityStatusRecordsSummary(
    parseArtifactExtractionSource(flags),
    qualityStatusEvidence.matches,
    qualityStatusEvidence.snapshotEvidence,
  );
  await maybePersistGovernanceEvidence(flags, extractionWithQuality);
  const artifacts = kind === "all"
    ? generatePromptArtifacts({ ...extractionWithQuality, useCase })
    : [generatePromptArtifact({ ...extractionWithQuality, kind, useCase })];
  const evaluations = artifacts.map((artifact) => ({
    artifact,
    quality: evaluatePromptArtifactQuality({
      artifact,
      workArea: extractionWithQuality.workArea,
      sources: extractionWithQuality.sources,
    }),
  }));
  const outputs = await materializePromptArtifacts({
    flags,
    artifacts,
    producedByRef: `qa-sdk ontology prompt extract ${docId}`,
    ownerDefinitionId: docId,
    materializesOutputRefs: [docId],
  });

  if (flags["json"] === "true") {
    printJson({
      docId,
      useCase,
      source: artifactSource,
      outputs,
      workArea: extractionWithQuality.workArea,
      sourceSummary: {
        corridors: extractionWithQuality.sources.corridors?.length ?? 0,
        checkpointLattices: extractionWithQuality.sources.checkpointLattices?.length ?? 0,
        traversals: extractionWithQuality.sources.traversals?.length ?? 0,
        blueprints: extractionWithQuality.sources.blueprints?.length ?? 0,
        governanceRuns: extractionWithQuality.sources.governanceRuns?.length ?? 0,
      },
      artifacts: evaluations,
    });
    return;
  }

  for (const output of outputs) {
    console.log(`output: ${output.outputPath}`);
  }
  for (const { artifact, quality } of evaluations) {
    console.log(`--- ${artifact.kind} ---`);
    console.log(`artifactId: ${artifact.artifactId}`);
    console.log(`useCase: ${artifact.useCase ?? "(none)"}`);
    console.log(`quality: ${quality.grade} (${quality.score})`);
    console.log(`ontologyManagementRequired: ${quality.ontologyManagementRequired}`);
    if (quality.recommendedManagementActions.length > 0) {
      console.log(
        `actions: ${quality.recommendedManagementActions.map((action) => action.kind).join(", ")}`,
      );
    }
    if (flags["quality-only"] !== "true") {
      console.log(artifact.content);
    }
  }
}

async function cmdPromptExtractFile(rest: string[]): Promise<void> {
  const { positional, flags } = parseFlags(rest);
  const filePath = positional[0];
  if (!filePath) {
    console.error(
      "Usage: qa-sdk ontology prompt extract-file <code-path[:symbol]> [--kind self_reflection|code_editing_rules|all] [--use-case <usecase>] [--persist-governance] [--store <file>] [--output <file|dir>] [--json] [--local|--server] [--db <path>]",
    );
    return;
  }

  const kind = parsePromptArtifactKind(flags["kind"]);
  const useCase = parsePromptArtifactUseCase(flags["use-case"]);
  const source = await createDataSource(toDefinitionDataSourceOptions(flags));
  if (source.mode === "scan") {
    console.error("extract-file requires DB-owned code references. Run `qa-sdk def sync` and use local/server datasource.");
    process.exitCode = 1;
    return;
  }

  const mapping = await source.resolveByFile(filePath);
  if (mapping.kind === "none") {
    console.error(`No definition boundary mapping for file: ${filePath}`);
    process.exitCode = 1;
    return;
  }
  if (mapping.kind === "ambiguous") {
    console.error(`Ambiguous definition boundary mapping for file: ${filePath}`);
    for (const candidate of mapping.candidates) {
      console.error(`  candidate: ${candidate.anchor.docId}`);
    }
    process.exitCode = 1;
    return;
  }

  const specificDoc =
    mapping.supportingDocs.length === 1 ? mapping.supportingDocs[0]! : mapping.anchor;
  const docId = specificDoc.docId;
  const [children, outgoingLinks, incomingLinks] = await Promise.all([
    source.getChildren(docId),
    source.getOutgoingLinks(docId),
    source.getIncomingLinks(docId),
  ]);
  const supportingDocIds = new Set(mapping.supportingDocs.map((doc) => doc.docId));
  const childCandidates = [
    ...mapping.supportingDocs.filter((doc) => doc.docId !== docId),
    ...children.filter((doc) => !supportingDocIds.has(doc.docId)),
  ];
  const [rootDoc, childDocs] = await Promise.all([
    defDocWithBody(source, specificDoc),
    Promise.all(childCandidates.map((child) => defDocWithBody(source, child))),
  ]);
  const extraction = extractPromptArtifactSourcesFromDefinitionContext({
    root: {
      ...rootDoc,
      sourcePath: rootDoc.sourcePath ?? mapping.codePath,
    },
    children: childDocs,
    outgoingLinks: outgoingLinks.map((link) => outgoingLinkToPromptLink(specificDoc, link)),
    incomingLinks: incomingLinks.map((link) => incomingLinkToPromptLink(specificDoc, link)),
    useCase,
    verificationRefs: mapping.references
      .filter((ref) => ref.codePath.endsWith(".test.ts"))
      .map((ref) => ref.codePath),
    now: new Date().toISOString(),
  });
  const qualityStatusEvidence = await loadRelatedQualityStatusEvidenceFromFlags(flags, [
    filePath,
    mapping.codePath,
    mapping.anchor.docId,
    docId,
    ...workAreaQualityTargetRefs(extraction.workArea),
  ]);
  const extractionWithQuality = appendQualityStatusSnapshotGovernanceEvidence(
    appendQualityStatusEvidenceToPromptArtifactExtraction(
      extraction,
      qualityStatusRecords(qualityStatusEvidence.matches),
      {
        useCase,
        now: new Date().toISOString(),
      },
    ),
    qualityStatusEvidence.snapshotEvidence,
  );
  const artifactSource = withQualityStatusRecordsSummary(
    parseArtifactExtractionSource(flags),
    qualityStatusEvidence.matches,
    qualityStatusEvidence.snapshotEvidence,
  );
  await maybePersistGovernanceEvidence(flags, extractionWithQuality);
  const workArea = {
    ...extractionWithQuality.workArea,
    paths: uniqueCliValues([mapping.codePath, ...(extractionWithQuality.workArea.paths ?? [])]),
    constraints: uniqueCliValues([
      `file:${mapping.codePath}`,
      ...(extractionWithQuality.workArea.constraints ?? []),
    ]),
  };
  const artifacts = kind === "all"
    ? generatePromptArtifacts({ workArea, sources: extractionWithQuality.sources, useCase })
    : [generatePromptArtifact({ workArea, sources: extractionWithQuality.sources, kind, useCase })];
  const evaluations = artifacts.map((artifact) => ({
    artifact,
    quality: evaluatePromptArtifactQuality({
      artifact,
      workArea,
      sources: extractionWithQuality.sources,
    }),
  }));
  const outputs = await materializePromptArtifacts({
    flags,
    artifacts,
    producedByRef: `qa-sdk ontology prompt extract-file ${filePath}`,
    ownerDefinitionId: docId,
    materializesOutputRefs: [docId, mapping.codePath],
  });

  if (flags["json"] === "true") {
    printJson({
      filePath,
      boundaryDocId: mapping.anchor.docId,
      contextDocId: docId,
      useCase,
      source: artifactSource,
      outputs,
      workArea,
      artifacts: evaluations,
    });
    return;
  }

  console.log(`file: ${filePath}`);
  console.log(`boundary: ${mapping.anchor.docId}`);
  if (docId !== mapping.anchor.docId) {
    console.log(`context: ${docId}`);
  }
  for (const output of outputs) {
    console.log(`output: ${output.outputPath}`);
  }
  for (const { artifact, quality } of evaluations) {
    console.log(`--- ${artifact.kind} ---`);
    console.log(`artifactId: ${artifact.artifactId}`);
    console.log(`useCase: ${artifact.useCase ?? "(none)"}`);
    console.log(`quality: ${quality.grade} (${quality.score})`);
    console.log(`ontologyManagementRequired: ${quality.ontologyManagementRequired}`);
    if (quality.recommendedManagementActions.length > 0) {
      console.log(
        `actions: ${quality.recommendedManagementActions.map((action) => action.kind).join(", ")}`,
      );
    }
    if (flags["quality-only"] !== "true") {
      console.log(artifact.content);
    }
  }
}

async function cmdPromptExtractPermission(rest: string[]): Promise<void> {
  const { positional, flags } = parseFlags(rest);
  const permissionRef = positional[0];
  if (!permissionRef) {
    console.error(
      "Usage: qa-sdk ontology prompt extract-permission <permission-ref> [--kind self_reflection|code_editing_rules|all] [--use-case <usecase>] [--persist-governance] [--store <file>] [--output <file|dir>] [--json] [--local|--server|--scan] [--db <path>]",
    );
    return;
  }

  const kind = parsePromptArtifactKind(flags["kind"]);
  const useCase = parsePromptArtifactUseCase(flags["use-case"] ?? "schema_governance_review");
  const source = await createDataSource(toDefinitionDataSourceOptions(flags));
  const root = await source.get("authorization-ontology-system");
  if (!root) {
    console.error("Definition document not found: authorization-ontology-system");
    process.exitCode = 1;
    return;
  }

  const contextDocs = (
    await Promise.all(
      AUTHORIZATION_PERMISSION_CONTEXT_DOC_IDS.map((docId) => source.get(docId)),
    )
  ).filter((doc): doc is DefDoc => Boolean(doc));
  const rootDoc = await defDocWithBody(source, root);
  const childDocs = await Promise.all(contextDocs.map((doc) => defDocWithBody(source, doc)));
  const outgoingLinks = (await source.getOutgoingLinks(root.docId))
    .filter((link) =>
      AUTHORIZATION_PERMISSION_CONTEXT_DOC_IDS.includes(link.target as never) ||
      link.target === "permission-system",
    )
    .map((link) => outgoingLinkToPromptLink(root, link));
  const extraction = extractPromptArtifactSourcesFromDefinitionContext({
    root: {
      ...rootDoc,
      purpose: `${rootDoc.purpose ?? root.docId} Permission query: ${permissionRef}`,
    },
    children: childDocs,
    outgoingLinks,
    useCase,
    verificationRefs: [
      "packages/authorization-ontology/src/index.test.ts",
      "packages/authorization-ontology/src/permission-engine-bridge.test.ts",
    ],
    now: new Date().toISOString(),
  });
  const workArea = {
    ...extraction.workArea,
    workAreaId: `permission:${permissionRef}`,
    displayName: `Permission context: ${permissionRef}`,
    constraints: uniqueCliValues([
      `permission:${permissionRef}`,
      ...(extraction.workArea.constraints ?? []),
    ]),
    localInstructions: [
      "Resolve permission refs through permission_feature, grants_feature, denies_feature, materializes_permission, and decision_* relations.",
      "Treat this extraction as authorization-context evidence until a graph-store permission query is available.",
    ],
  };
  await maybePersistGovernanceEvidence(flags, extraction);
  const artifacts = kind === "all"
    ? generatePromptArtifacts({ workArea, sources: extraction.sources, useCase })
    : [generatePromptArtifact({ workArea, sources: extraction.sources, kind, useCase })];
  const evaluations = artifacts.map((artifact) => ({
    artifact,
    quality: evaluatePromptArtifactQuality({
      artifact,
      workArea,
      sources: extraction.sources,
    }),
  }));
  const outputs = await materializePromptArtifacts({
    flags,
    artifacts,
    producedByRef: `qa-sdk ontology prompt extract-permission ${permissionRef}`,
    ownerDefinitionId: "authorization-ontology-system",
    materializesOutputRefs: ["authorization-ontology-system", permissionRef],
  });

  if (flags["json"] === "true") {
    printJson({
      permissionRef,
      useCase,
      outputs,
      workArea,
      artifacts: evaluations,
    });
    return;
  }

  console.log(`permission: ${permissionRef}`);
  for (const output of outputs) {
    console.log(`output: ${output.outputPath}`);
  }
  for (const { artifact, quality } of evaluations) {
    console.log(`--- ${artifact.kind} ---`);
    console.log(`artifactId: ${artifact.artifactId}`);
    console.log(`useCase: ${artifact.useCase ?? "(none)"}`);
    console.log(`quality: ${quality.grade} (${quality.score})`);
    console.log(`ontologyManagementRequired: ${quality.ontologyManagementRequired}`);
    if (quality.recommendedManagementActions.length > 0) {
      console.log(
        `actions: ${quality.recommendedManagementActions.map((action) => action.kind).join(", ")}`,
      );
    }
    if (flags["quality-only"] !== "true") {
      console.log(artifact.content);
    }
  }
}

async function cmdPromptExtractArtifact(rest: string[]): Promise<void> {
  const { positional, flags } = parseFlags(rest);
  const artifactRef = positional[0];
  if (!artifactRef) {
    console.error(
      "Usage: qa-sdk ontology prompt extract-artifact <artifact-ref> [--artifact-type <type>] [--artifact-registry <file>] [--kind self_reflection|code_editing_rules|all] [--use-case <usecase>] [--persist-governance] [--store <file>] [--output <file|dir>] [--json] [--local|--server|--scan] [--db <path>]",
    );
    return;
  }

  const kind = parsePromptArtifactKind(flags["kind"]);
  const useCase = parsePromptArtifactUseCase(flags["use-case"] ?? "release_verification");
  const artifactType = flags["artifact-type"] ?? inferArtifactType(artifactRef);
  const loadedRegistry = await loadArtifactRegistryProvider(flags);
  const registryExtraction = loadedRegistry?.provider.resolve({
    targetKind: "artifact",
    targetRef: artifactRef,
    useCase,
    now: new Date().toISOString(),
    metadata: artifactType ? { artifactType } : undefined,
  });
  if (loadedRegistry && registryExtraction) {
    const directRegistryRecord = loadedRegistry.store.getArtifactByRef(artifactRef);
    const qualityStatusEvidence = await loadRelatedQualityStatusEvidence(loadedRegistry, [
      artifactRef,
      ...registryRecordQualityTargetRefs(directRegistryRecord),
      ...workAreaQualityTargetRefs(registryExtraction.workArea),
    ]);
    const extractionWithQuality = appendQualityStatusSnapshotGovernanceEvidence(
      appendQualityStatusEvidenceToPromptArtifactExtraction(
        registryExtraction,
        qualityStatusRecords(qualityStatusEvidence.matches),
        {
          useCase,
          now: new Date().toISOString(),
        },
      ),
      qualityStatusEvidence.snapshotEvidence,
    );
    await maybePersistGovernanceEvidence(flags, extractionWithQuality);
    const artifacts = kind === "all"
      ? generatePromptArtifacts({ ...extractionWithQuality, useCase })
      : [generatePromptArtifact({ ...extractionWithQuality, kind, useCase })];
    const evaluations = artifacts.map((artifact) => ({
      artifact,
      quality: evaluatePromptArtifactQuality({
        artifact,
        workArea: extractionWithQuality.workArea,
        sources: extractionWithQuality.sources,
      }),
    }));
    const outputs = await materializePromptArtifacts({
      flags,
      artifacts,
      producedByRef: `qa-sdk ontology prompt extract-artifact ${artifactRef}`,
      materializesOutputRefs: [artifactRef],
    });

    if (flags["json"] === "true") {
      printJson({
        artifactRef,
        artifactType,
        providerId: loadedRegistry.provider.providerId,
        source: artifactRegistryHitSource(
          loadedRegistry,
          qualityStatusEvidence.matches,
          qualityStatusEvidence.snapshotEvidence,
        ),
        useCase,
        outputs,
        workArea: extractionWithQuality.workArea,
        artifacts: evaluations,
      });
      return;
    }

    console.log(`artifact: ${artifactRef}`);
    if (artifactType) console.log(`artifactType: ${artifactType}`);
    console.log(`provider: ${loadedRegistry.provider.providerId}`);
    for (const output of outputs) {
      console.log(`output: ${output.outputPath}`);
    }
    for (const { artifact, quality } of evaluations) {
      console.log(`--- ${artifact.kind} ---`);
      console.log(`artifactId: ${artifact.artifactId}`);
      console.log(`useCase: ${artifact.useCase ?? "(none)"}`);
      console.log(`quality: ${quality.grade} (${quality.score})`);
      console.log(`ontologyManagementRequired: ${quality.ontologyManagementRequired}`);
      if (quality.recommendedManagementActions.length > 0) {
        console.log(
          `actions: ${quality.recommendedManagementActions.map((action) => action.kind).join(", ")}`,
        );
      }
      if (flags["quality-only"] !== "true") {
        console.log(artifact.content);
      }
    }
    return;
  }

  if (artifactRef.startsWith("packages/") || artifactRef.startsWith("docs/")) {
    await cmdPromptExtractFile(withArtifactSourceFlag(
      rest,
      artifactFallbackSource({
        kind: "artifact-file-fallback",
        fallbackKind: "file",
        target: artifactRef,
        loadedRegistry,
      }),
    ));
    return;
  }

  const source = await createDataSource(toDefinitionDataSourceOptions(flags));
  const directDoc = await source.get(artifactRef);
  if (directDoc) {
    await cmdPromptExtract(withArtifactSourceFlag(
      [artifactRef, ...rest.slice(1)],
      artifactFallbackSource({
        kind: "artifact-definition-fallback",
        fallbackKind: "definition",
        target: artifactRef,
        loadedRegistry,
      }),
    ));
    return;
  }

  const query = flags["q"] ?? artifactRef.split(/[/:#]/).filter(Boolean).at(-1) ?? artifactRef;
  const candidates = await source.list({ q: query, limit: 8 });
  const rootDoc = {
    docId: `artifact:${artifactRef}`,
    title: `Artifact context: ${artifactRef}`,
    purpose: `Manage context for artifact ${artifactRef}${artifactType ? ` (${artifactType})` : ""}.`,
    tags: ["artifact", ...(artifactType ? [`artifact-type:${artifactType}`] : [])],
    sourcePath: artifactRef.startsWith("artifacts/") ? artifactRef : undefined,
    lifecycle: "draft",
  };
  const childDocs = await Promise.all(candidates.map((doc) => defDocWithBody(source, doc)));
  const extraction = extractPromptArtifactSourcesFromDefinitionContext({
    root: rootDoc,
    children: childDocs,
    useCase,
    verificationRefs: candidates
      .filter((doc) => doc.tags.some((tag) => tag.startsWith("quality-gate") || tag === "testing"))
      .map((doc) => doc.docId),
    now: new Date().toISOString(),
  });
  const qualityStatusEvidence = await loadRelatedQualityStatusEvidence(loadedRegistry, [
    artifactRef,
    query,
    ...candidates.map((doc) => doc.docId),
    ...workAreaQualityTargetRefs(extraction.workArea),
  ]);
  const extractionWithQuality = appendQualityStatusSnapshotGovernanceEvidence(
    appendQualityStatusEvidenceToPromptArtifactExtraction(
      extraction,
      qualityStatusRecords(qualityStatusEvidence.matches),
      {
        useCase,
        now: new Date().toISOString(),
      },
    ),
    qualityStatusEvidence.snapshotEvidence,
  );
  const workArea = {
    ...extractionWithQuality.workArea,
    workAreaId: `artifact:${artifactRef}`,
    displayName: `Artifact context: ${artifactRef}`,
    constraints: uniqueCliValues([
      `artifact:${artifactRef}`,
      ...(artifactType ? [`artifact-type:${artifactType}`] : []),
      ...(extractionWithQuality.workArea.constraints ?? []),
    ]),
    localInstructions: [
      "Treat artifact refs as deliverable evidence, not as source code ownership by themselves.",
      "Resolve artifact context through matching definition docs, quality gates, and source maps before editing.",
      ...(extractionWithQuality.workArea.localInstructions ?? []),
    ],
  };
  await maybePersistGovernanceEvidence(flags, extractionWithQuality);
  const artifacts = kind === "all"
    ? generatePromptArtifacts({ workArea, sources: extractionWithQuality.sources, useCase })
    : [generatePromptArtifact({ workArea, sources: extractionWithQuality.sources, kind, useCase })];
  const evaluations = artifacts.map((artifact) => ({
    artifact,
    quality: evaluatePromptArtifactQuality({
      artifact,
      workArea,
      sources: extractionWithQuality.sources,
    }),
  }));
  const fallbackSource = artifactFallbackSource({
    kind: "artifact-search-fallback",
    fallbackKind: "search",
    target: query,
    loadedRegistry,
    matchedDocs: candidates.map((doc) => doc.docId),
    qualityStatusMatches: qualityStatusEvidence.matches,
    qualityStatusSnapshotEvidence: qualityStatusEvidence.snapshotEvidence,
  });
  const outputs = await materializePromptArtifacts({
    flags,
    artifacts,
    producedByRef: `qa-sdk ontology prompt extract-artifact ${artifactRef}`,
    materializesOutputRefs: [artifactRef],
  });

  if (flags["json"] === "true") {
    printJson({
      artifactRef,
      artifactType,
      source: fallbackSource,
      matchedDocs: candidates.map((doc) => doc.docId),
      useCase,
      outputs,
      workArea,
      artifacts: evaluations,
    });
    return;
  }

  console.log(`artifact: ${artifactRef}`);
  if (artifactType) console.log(`artifactType: ${artifactType}`);
  if (candidates.length > 0) {
    console.log(`matchedDocs: ${candidates.map((doc) => doc.docId).join(", ")}`);
  }
  if (fallbackSource.qualitySignal.warning) {
    console.log(`warning: ${fallbackSource.qualitySignal.code} (${fallbackSource.qualitySignal.grade})`);
    console.log(`action: ${fallbackSource.qualitySignal.recommendedManagementActions.join(", ")}`);
  }
  for (const output of outputs) {
    console.log(`output: ${output.outputPath}`);
  }
  for (const { artifact, quality } of evaluations) {
    console.log(`--- ${artifact.kind} ---`);
    console.log(`artifactId: ${artifact.artifactId}`);
    console.log(`useCase: ${artifact.useCase ?? "(none)"}`);
    console.log(`quality: ${quality.grade} (${quality.score})`);
    console.log(`ontologyManagementRequired: ${quality.ontologyManagementRequired}`);
    if (quality.recommendedManagementActions.length > 0) {
      console.log(
        `actions: ${quality.recommendedManagementActions.map((action) => action.kind).join(", ")}`,
      );
    }
    if (flags["quality-only"] !== "true") {
      console.log(artifact.content);
    }
  }
}

async function cmdSnapshotIngest(rest: string[]): Promise<void> {
  const { flags } = parseFlags(rest);
  const inputPath = flags["input"];
  if (!inputPath) {
    console.error(
      "Usage: qa-sdk ontology snapshot ingest --input <file> [--store <file>] [--snapshot-id <id>] [--scope <scope>] [--json]",
    );
    return;
  }

  const storePath = getStorePath(flags);
  const store = await loadStore(storePath);
  const input = await loadJsonFile<Record<string, unknown>>(resolve(inputPath));
  const result = await ingestOperationalOntologyProjection(
    store,
    input as never,
    toIngestOptions(flags),
  );
  await saveStore(store, storePath);

  if (flags["json"] === "true") {
    printJson(result);
    return;
  }

  console.log(`Snapshot ingested: ${result.persisted.snapshotProjection.projectionId}`);
  console.log(`  store: ${storePath}`);
  console.log(`  corridors: ${result.snapshot.corridors.length}`);
  console.log(`  checkpoints: ${result.snapshot.checkpoints.length}`);
  console.log(`  traversals: ${result.snapshot.traversals.length}`);
}

async function cmdEventIngest(rest: string[]): Promise<void> {
  const { flags } = parseFlags(rest);
  const inputPath = flags["input"];
  if (!inputPath) {
    console.error(
      "Usage: qa-sdk ontology event ingest --input <file> [--store <file>] [--snapshot-id <id>] [--scope <scope>] [--json]",
    );
    return;
  }

  const storePath = getStorePath(flags);
  const store = await loadStore(storePath);
  const input = await loadJsonFile<EventRecordObservationInput>(resolve(inputPath));
  const result = await ingestEventRecordProjection(store, input, toIngestOptions(flags));
  await saveStore(store, storePath);

  if (flags["json"] === "true") {
    printJson(result);
    return;
  }

  console.log(`Event snapshot ingested: ${result.persisted.snapshotProjection.projectionId}`);
  console.log(`  store: ${storePath}`);
  console.log(`  corridors: ${result.snapshot.corridors.length}`);
}

async function cmdPipeIngest(rest: string[]): Promise<void> {
  const { flags } = parseFlags(rest);
  const inputPath = flags["input"];
  if (!inputPath) {
    console.error(
      "Usage: qa-sdk ontology pipe ingest --input <file> [--store <file>] [--snapshot-id <id>] [--scope <scope>] [--json]",
    );
    return;
  }

  const storePath = getStorePath(flags);
  const store = await loadStore(storePath);
  const input = await loadJsonFile<PipeGraphProjectionInput>(resolve(inputPath));
  const result = await ingestPipeGraphProjection(store, input, toIngestOptions(flags));
  await saveStore(store, storePath);

  if (flags["json"] === "true") {
    printJson(result);
    return;
  }

  console.log(`Pipe snapshot ingested: ${result.persisted.snapshotProjection.projectionId}`);
  console.log(`  store: ${storePath}`);
  console.log(`  corridors: ${result.snapshot.corridors.length}`);
}

async function cmdSnapshotList(rest: string[]): Promise<void> {
  const { flags } = parseFlags(rest);
  const store = await loadStore(getStorePath(flags));
  const projections = await listOperationalOntologySnapshotProjections(
    store,
    flags["scope"],
  );

  if (flags["json"] === "true") {
    printJson(projections);
    return;
  }

  if (projections.length === 0) {
    console.log("Snapshot 없음");
    return;
  }

  for (const projection of projections) {
    console.log(`${projection.projectionId}  ${projection.targetScope}  ${projection.builtAt}`);
  }
}

async function cmdStatus(rest: string[]): Promise<void> {
  const { flags } = parseFlags(rest);
  const scope = flags["scope"];
  const snapshotId = flags["snapshot"];
  if (!scope && !snapshotId) {
    console.error(
      "Usage: qa-sdk ontology status [--scope <scope> | --snapshot <id>] [--store <file>] [--json] [--table]",
    );
    return;
  }

  const store = await loadStore(getStorePath(flags));
  const view = snapshotId
    ? await loadOperationalOntologySnapshotView(store, snapshotId)
    : await loadLatestOperationalOntologySnapshotViewByScope(store, scope!);

  if (!view) {
    console.error(`Ontology status 없음: ${snapshotId ?? scope}`);
    process.exitCode = 1;
    return;
  }

  const resolvedScope = scope ?? view.snapshotProjection.targetScope;
  const [latestDiff, projections] = resolvedScope
    ? await Promise.all([
        snapshotId
          ? Promise.resolve(null)
          : diffLatestOperationalOntologySnapshotsByScope(store, resolvedScope),
        listOperationalOntologySnapshotProjections(store, resolvedScope),
      ])
    : [null, []];

  const status = {
    scope: resolvedScope ?? null,
    snapshotId: view.snapshotProjection.projectionId,
    builtAt: view.snapshotProjection.builtAt,
    snapshotCount: projections.length,
    topologyValid: view.snapshot.topologyValidation?.valid ?? null,
    corridors: view.corridors.length,
    controlFlows: view.controlFlows.length,
    checkpointLattices: view.checkpointLattices.length,
    junctions: view.junctions.length,
    routeDecisions: view.routeDecisions.length,
    traversals: view.traversalBundles.length,
    latestDiff: latestDiff
      ? {
          fromSnapshotId: latestDiff.fromSnapshotId,
          toSnapshotId: latestDiff.toSnapshotId,
          summary: latestDiff.summary,
        }
      : null,
  };

  if (flags["json"] === "true") {
    printJson(status);
    return;
  }

  if (flags["table"] === "true") {
    printTable(
      [
        "scope",
        "snapshot",
        "builtAt",
        "snapshots",
        "topology",
        "corridors",
        "flows",
        "checkpoints",
        "junctions",
        "routes",
        "traversals",
      ],
      [
        status.scope ?? "-",
        status.snapshotId,
        status.builtAt,
        String(status.snapshotCount),
        String(status.topologyValid),
        String(status.corridors),
        String(status.controlFlows),
        String(status.checkpointLattices),
        String(status.junctions),
        String(status.routeDecisions),
        String(status.traversals),
      ],
    );

    if (status.latestDiff) {
      console.log("");
      printTable(
        ["diff_from", "diff_to", "added", "removed", "changed", "unchanged"],
        [
          status.latestDiff.fromSnapshotId,
          status.latestDiff.toSnapshotId,
          String(status.latestDiff.summary.added),
          String(status.latestDiff.summary.removed),
          String(status.latestDiff.summary.changed),
          String(status.latestDiff.summary.unchanged),
        ],
      );
    }
    return;
  }

  console.log(`Ontology status: ${status.scope ?? status.snapshotId}`);
  console.log(`  snapshot: ${status.snapshotId}`);
  console.log(`  builtAt: ${status.builtAt}`);
  console.log(`  snapshots: ${status.snapshotCount}`);
  console.log(`  topology valid: ${status.topologyValid}`);
  console.log(
    `  corridors=${status.corridors} controlFlows=${status.controlFlows} checkpointLattices=${status.checkpointLattices}`,
  );
  console.log(
    `  junctions=${status.junctions} routeDecisions=${status.routeDecisions} traversals=${status.traversals}`,
  );
  if (status.latestDiff) {
    console.log(
      `  latest diff: ${status.latestDiff.fromSnapshotId} -> ${status.latestDiff.toSnapshotId}`,
    );
    console.log(
      `    added=${status.latestDiff.summary.added} removed=${status.latestDiff.summary.removed} changed=${status.latestDiff.summary.changed} unchanged=${status.latestDiff.summary.unchanged}`,
    );
  }
}

async function cmdSnapshotShow(rest: string[]): Promise<void> {
  const { positional, flags } = parseFlags(rest);
  const snapshotId = positional[0];
  if (!snapshotId) {
    console.error("Usage: qa-sdk ontology snapshot show <snapshot-id> [--store <file>] [--json]");
    return;
  }

  const store = await loadStore(getStorePath(flags));
  const view = await loadOperationalOntologySnapshotView(store, snapshotId);
  if (!view) {
    console.error(`Snapshot 없음: ${snapshotId}`);
    process.exitCode = 1;
    return;
  }

  if (flags["json"] === "true") {
    printJson(view);
    return;
  }

  console.log(`Snapshot: ${view.snapshotProjection.projectionId}`);
  console.log(`  scope: ${view.snapshotProjection.targetScope}`);
  console.log(`  corridors: ${view.corridors.length}`);
  console.log(`  checkpoint lattices: ${view.checkpointLattices.length}`);
  console.log(`  traversals: ${view.traversalBundles.length}`);
}

async function cmdCorridorShow(rest: string[]): Promise<void> {
  const { positional, flags } = parseFlags(rest);
  const corridorId = positional[0];
  const snapshotId = flags["snapshot"];
  if (!corridorId || !snapshotId) {
    console.error(
      "Usage: qa-sdk ontology corridor show <corridor-id> --snapshot <snapshot-id> [--store <file>] [--json]",
    );
    return;
  }

  const store = await loadStore(getStorePath(flags));
  const view = await loadOperationalOntologyCorridorView(store, snapshotId, corridorId);
  if (!view) {
    console.error(`Corridor view 없음: ${corridorId} @ ${snapshotId}`);
    process.exitCode = 1;
    return;
  }

  if (flags["json"] === "true") {
    printJson(view);
    return;
  }

  console.log(`Corridor: ${view.corridor.flowId}`);
  console.log(`  snapshot: ${view.snapshotProjection.projectionId}`);
  console.log(`  controlFlow: ${view.controlFlow?.graphId ?? "-"}`);
  console.log(`  checkpoint lattices: ${view.checkpointLattices.length}`);
  console.log(`  route decisions: ${view.routeDecisions.length}`);
  console.log(`  traversal bundles: ${view.traversalBundles.length}`);
}

async function cmdCorridorList(rest: string[]): Promise<void> {
  const { flags } = parseFlags(rest);
  const snapshotId = flags["snapshot"];
  const scope = flags["scope"];
  if (!snapshotId && !scope) {
    console.error(
      "Usage: qa-sdk ontology corridor list [--snapshot <id> | --scope <scope>] [--store <file>] [--json]",
    );
    return;
  }

  const store = await loadStore(getStorePath(flags));
  const corridors = snapshotId
    ? await loadOperationalOntologyCorridors(store, snapshotId)
    : await listOperationalOntologyCorridorsByScope(store, scope!);

  if (flags["json"] === "true") {
    printJson(corridors);
    return;
  }

  if (corridors.length === 0) {
    console.log("Corridor 없음");
    return;
  }

  for (const corridor of corridors) {
    console.log(
      `${corridor.flowId}  template=${corridor.templateKind}  entry=${corridor.entryNodeId}`,
    );
  }
}

async function cmdCorridorShowLatest(rest: string[]): Promise<void> {
  const { positional, flags } = parseFlags(rest);
  const corridorId = positional[0];
  const scope = flags["scope"];
  if (!corridorId || !scope) {
    console.error(
      "Usage: qa-sdk ontology corridor show-latest <corridor-id> --scope <scope> [--store <file>] [--json]",
    );
    return;
  }

  const store = await loadStore(getStorePath(flags));
  const view = await loadLatestOperationalOntologyCorridorViewByScope(
    store,
    scope,
    corridorId,
  );
  if (!view) {
    console.error(`최신 corridor view 없음: ${corridorId} @ ${scope}`);
    process.exitCode = 1;
    return;
  }

  if (flags["json"] === "true") {
    printJson(view);
    return;
  }

  console.log(`Corridor: ${view.corridor.flowId}`);
  console.log(`  snapshot: ${view.snapshotProjection.projectionId}`);
  console.log(`  checkpoint lattices: ${view.checkpointLattices.length}`);
  console.log(`  route decisions: ${view.routeDecisions.length}`);
}

async function cmdCheckpointList(rest: string[]): Promise<void> {
  const { flags } = parseFlags(rest);
  const snapshotId = flags["snapshot"];
  const scope = flags["scope"];
  if (!snapshotId && !scope) {
    console.error(
      "Usage: qa-sdk ontology checkpoint list [--snapshot <id> | --scope <scope>] [--store <file>] [--json]",
    );
    return;
  }

  const store = await loadStore(getStorePath(flags));
  const lattices = snapshotId
    ? await loadOperationalOntologyCheckpointLattices(store, snapshotId)
    : await listOperationalOntologyCheckpointLatticesByScope(store, scope!);

  if (flags["json"] === "true") {
    printJson(lattices);
    return;
  }

  if (lattices.length === 0) {
    console.log("Checkpoint lattice 없음");
    return;
  }

  for (const lattice of lattices) {
    console.log(
      `${lattice.rootCheckpointId}  corridor=${lattice.corridorId}  checkpoints=${lattice.observations.length}`,
    );
  }
}

async function cmdCheckpointShow(rest: string[]): Promise<void> {
  const { positional, flags } = parseFlags(rest);
  const rootCheckpointId = positional[0];
  const snapshotId = flags["snapshot"];
  const scope = flags["scope"];
  if (!rootCheckpointId || (!snapshotId && !scope)) {
    console.error(
      "Usage: qa-sdk ontology checkpoint show <root-checkpoint-id> [--snapshot <id> | --scope <scope>] [--store <file>] [--json]",
    );
    return;
  }

  const store = await loadStore(getStorePath(flags));
  const lattice = snapshotId
    ? await loadOperationalOntologyCheckpointLattice(
        store,
        snapshotId,
        rootCheckpointId,
      )
    : await loadLatestOperationalOntologyCheckpointLatticeByScope(
        store,
        scope!,
        rootCheckpointId,
      );

  if (!lattice) {
    console.error(`Checkpoint lattice 없음: ${rootCheckpointId}`);
    process.exitCode = 1;
    return;
  }

  if (flags["json"] === "true") {
    printJson(lattice);
    return;
  }

  console.log(`Checkpoint lattice: ${lattice.rootCheckpointId}`);
  console.log(`  corridor: ${lattice.corridorId}`);
  console.log(`  definitions: ${lattice.definitions.length}`);
  console.log(`  observations: ${lattice.observations.length}`);
  console.log(`  links: ${lattice.links.length}`);
}

async function cmdRouteList(rest: string[]): Promise<void> {
  const { flags } = parseFlags(rest);
  const snapshotId = flags["snapshot"];
  const scope = flags["scope"];
  if (!snapshotId && !scope) {
    console.error(
      "Usage: qa-sdk ontology route list [--snapshot <id> | --scope <scope>] [--store <file>] [--json]",
    );
    return;
  }

  const store = await loadStore(getStorePath(flags));
  const routes = snapshotId
    ? await loadOperationalOntologyRouteDecisions(store, snapshotId)
    : await listOperationalOntologyRouteDecisionsByScope(store, scope!);

  if (flags["json"] === "true") {
    printJson(routes);
    return;
  }

  if (routes.length === 0) {
    console.log("Route decision 없음");
    return;
  }

  for (const route of routes) {
    console.log(
      `${route.branchNodeId}  mode=${route.mode}  selected=${route.selectedPathIds.join(",") || "-"}`,
    );
  }
}

async function cmdRouteShow(rest: string[]): Promise<void> {
  const { positional, flags } = parseFlags(rest);
  const branchNodeId = positional[0];
  const snapshotId = flags["snapshot"];
  const scope = flags["scope"];
  if (!branchNodeId || (!snapshotId && !scope)) {
    console.error(
      "Usage: qa-sdk ontology route show <branch-node-id> [--snapshot <id> | --scope <scope>] [--store <file>] [--json]",
    );
    return;
  }

  const store = await loadStore(getStorePath(flags));
  const route = snapshotId
    ? await loadOperationalOntologyRouteDecision(store, snapshotId, branchNodeId)
    : await loadLatestOperationalOntologyRouteDecisionByScope(
        store,
        scope!,
        branchNodeId,
      );

  if (!route) {
    console.error(`Route decision 없음: ${branchNodeId}`);
    process.exitCode = 1;
    return;
  }

  if (flags["json"] === "true") {
    printJson(route);
    return;
  }

  console.log(`Route decision: ${route.branchNodeId}`);
  console.log(`  mode: ${route.mode}`);
  console.log(`  selected: ${route.selectedPathIds.join(",") || "-"}`);
  console.log(`  skipped: ${route.skippedPathIds.join(",") || "-"}`);
}

async function cmdTraversalList(rest: string[]): Promise<void> {
  const { flags } = parseFlags(rest);
  const snapshotId = flags["snapshot"];
  const scope = flags["scope"];
  if (!snapshotId && !scope) {
    console.error(
      "Usage: qa-sdk ontology traversal list [--snapshot <id> | --scope <scope>] [--store <file>] [--json]",
    );
    return;
  }

  const store = await loadStore(getStorePath(flags));
  const bundles = snapshotId
    ? await loadOperationalOntologyTraversalBundles(store, snapshotId)
    : await listOperationalOntologyTraversalBundlesByScope(store, scope!);

  if (flags["json"] === "true") {
    printJson(bundles);
    return;
  }

  if (bundles.length === 0) {
    console.log("Traversal bundle 없음");
    return;
  }

  for (const bundle of bundles) {
    console.log(
      `${bundle.object.canonicalKey}  lifecycle=${bundle.object.lifecycle}  observations=${bundle.observations.length}`,
    );
  }
}

async function cmdTraversalShow(rest: string[]): Promise<void> {
  const { positional, flags } = parseFlags(rest);
  const traversalKey = positional[0];
  const snapshotId = flags["snapshot"];
  const scope = flags["scope"];
  if (!traversalKey || (!snapshotId && !scope)) {
    console.error(
      "Usage: qa-sdk ontology traversal show <traversal-key> [--snapshot <id> | --scope <scope>] [--store <file>] [--json]",
    );
    return;
  }

  const store = await loadStore(getStorePath(flags));
  const bundle = snapshotId
    ? await loadOperationalOntologyTraversalBundle(store, snapshotId, traversalKey)
    : await loadLatestOperationalOntologyTraversalBundleByScope(
        store,
        scope!,
        traversalKey,
      );

  if (!bundle) {
    console.error(`Traversal bundle 없음: ${traversalKey}`);
    process.exitCode = 1;
    return;
  }

  if (flags["json"] === "true") {
    printJson(bundle);
    return;
  }

  console.log(`Traversal: ${bundle.object.canonicalKey}`);
  console.log(`  lifecycle: ${bundle.object.lifecycle}`);
  console.log(`  facets: ${bundle.facets.length}`);
  console.log(`  observations: ${bundle.observations.length}`);
}

async function cmdRouteDiff(rest: string[]): Promise<void> {
  const { positional, flags } = parseFlags(rest);
  const branchNodeId = positional[0];
  const fromSnapshotId = flags["from"];
  const toSnapshotId = flags["to"];
  if (!branchNodeId || !fromSnapshotId || !toSnapshotId) {
    console.error(
      "Usage: qa-sdk ontology route diff <branch-node-id> --from <snapshot-id> --to <snapshot-id> [--store <file>] [--json]",
    );
    return;
  }

  const store = await loadStore(getStorePath(flags));
  const diff = await diffOperationalOntologyRouteDecision(
    store,
    branchNodeId,
    fromSnapshotId,
    toSnapshotId,
  );
  if (!diff) {
    console.error(`Route diff 없음: ${branchNodeId}`);
    process.exitCode = 1;
    return;
  }

  if (flags["json"] === "true") {
    printJson(diff);
    return;
  }

  console.log(`Route diff: ${branchNodeId}`);
  console.log(`  status: ${diff.status}`);
  console.log(
    `  selected Δ=${diff.selectedPathCountDelta}  skipped Δ=${diff.skippedPathCountDelta}`,
  );
}

async function cmdRouteDiffLatest(rest: string[]): Promise<void> {
  const { positional, flags } = parseFlags(rest);
  const branchNodeId = positional[0];
  const scope = flags["scope"];
  if (!branchNodeId || !scope) {
    console.error(
      "Usage: qa-sdk ontology route diff-latest <branch-node-id> --scope <scope> [--store <file>] [--json]",
    );
    return;
  }

  const store = await loadStore(getStorePath(flags));
  const diff = await diffLatestOperationalOntologyRouteDecisionByScope(
    store,
    scope,
    branchNodeId,
  );
  if (!diff) {
    console.error(`Route diff-latest 없음: ${branchNodeId} @ ${scope}`);
    process.exitCode = 1;
    return;
  }

  if (flags["json"] === "true") {
    printJson(diff);
    return;
  }

  console.log(`Route diff-latest: ${branchNodeId}`);
  console.log(`  status: ${diff.status}`);
  console.log(
    `  selected Δ=${diff.selectedPathCountDelta}  skipped Δ=${diff.skippedPathCountDelta}`,
  );
}

async function cmdTraversalDiff(rest: string[]): Promise<void> {
  const { positional, flags } = parseFlags(rest);
  const traversalKey = positional[0];
  const fromSnapshotId = flags["from"];
  const toSnapshotId = flags["to"];
  if (!traversalKey || !fromSnapshotId || !toSnapshotId) {
    console.error(
      "Usage: qa-sdk ontology traversal diff <traversal-key> --from <snapshot-id> --to <snapshot-id> [--store <file>] [--json]",
    );
    return;
  }

  const store = await loadStore(getStorePath(flags));
  const diff = await diffOperationalOntologyTraversal(
    store,
    traversalKey,
    fromSnapshotId,
    toSnapshotId,
  );
  if (!diff) {
    console.error(`Traversal diff 없음: ${traversalKey}`);
    process.exitCode = 1;
    return;
  }

  if (flags["json"] === "true") {
    printJson(diff);
    return;
  }

  console.log(`Traversal diff: ${traversalKey}`);
  console.log(`  status: ${diff.status}`);
  console.log(
    `  facets Δ=${diff.facetCountDelta}  observations Δ=${diff.observationCountDelta}`,
  );
}

async function cmdTraversalDiffLatest(rest: string[]): Promise<void> {
  const { positional, flags } = parseFlags(rest);
  const traversalKey = positional[0];
  const scope = flags["scope"];
  if (!traversalKey || !scope) {
    console.error(
      "Usage: qa-sdk ontology traversal diff-latest <traversal-key> --scope <scope> [--store <file>] [--json]",
    );
    return;
  }

  const store = await loadStore(getStorePath(flags));
  const diff = await diffLatestOperationalOntologyTraversalByScope(
    store,
    scope,
    traversalKey,
  );
  if (!diff) {
    console.error(`Traversal diff-latest 없음: ${traversalKey} @ ${scope}`);
    process.exitCode = 1;
    return;
  }

  if (flags["json"] === "true") {
    printJson(diff);
    return;
  }

  console.log(`Traversal diff-latest: ${traversalKey}`);
  console.log(`  status: ${diff.status}`);
  console.log(
    `  facets Δ=${diff.facetCountDelta}  observations Δ=${diff.observationCountDelta}`,
  );
}

async function cmdSnapshotDiff(rest: string[]): Promise<void> {
  const { positional, flags } = parseFlags(rest);
  const fromSnapshotId = positional[0];
  const toSnapshotId = positional[1];
  if (!fromSnapshotId || !toSnapshotId) {
    console.error(
      "Usage: qa-sdk ontology snapshot diff <from-snapshot-id> <to-snapshot-id> [--store <file>] [--json]",
    );
    return;
  }

  const store = await loadStore(getStorePath(flags));
  const diff = await diffOperationalOntologySnapshots(
    store,
    fromSnapshotId,
    toSnapshotId,
  );
  if (!diff) {
    console.error(`Snapshot diff 실패: ${fromSnapshotId} -> ${toSnapshotId}`);
    process.exitCode = 1;
    return;
  }

  if (flags["json"] === "true") {
    printJson(diff);
    return;
  }

  console.log(`Snapshot diff: ${fromSnapshotId} -> ${toSnapshotId}`);
  console.log(
    `  added=${diff.summary.added} removed=${diff.summary.removed} changed=${diff.summary.changed} unchanged=${diff.summary.unchanged}`,
  );
  console.log(
    `  checkpoint lattices Δ=${diff.checkpointLatticeCountDelta}  route decisions Δ=${diff.routeDecisionCountDelta}  traversal bundles Δ=${diff.traversalBundleCountDelta}`,
  );
}

async function cmdSnapshotDiffLatest(rest: string[]): Promise<void> {
  const { flags } = parseFlags(rest);
  const scope = flags["scope"];
  if (!scope) {
    console.error(
      "Usage: qa-sdk ontology snapshot diff-latest --scope <scope> [--store <file>] [--json]",
    );
    return;
  }

  const store = await loadStore(getStorePath(flags));
  const diff = await diffLatestOperationalOntologySnapshotsByScope(store, scope);
  if (!diff) {
    console.error(`Snapshot diff-latest 실패: ${scope}`);
    process.exitCode = 1;
    return;
  }

  if (flags["json"] === "true") {
    printJson(diff);
    return;
  }

  console.log(`Snapshot diff-latest: ${scope}`);
  console.log(
    `  ${diff.fromSnapshotId} -> ${diff.toSnapshotId}`,
  );
  console.log(
    `  added=${diff.summary.added} removed=${diff.summary.removed} changed=${diff.summary.changed} unchanged=${diff.summary.unchanged}`,
  );
}

async function cmdCorridorDiff(rest: string[]): Promise<void> {
  const { positional, flags } = parseFlags(rest);
  const corridorId = positional[0];
  const fromSnapshotId = flags["from"];
  const toSnapshotId = flags["to"];
  if (!corridorId || !fromSnapshotId || !toSnapshotId) {
    console.error(
      "Usage: qa-sdk ontology corridor diff <corridor-id> --from <snapshot-id> --to <snapshot-id> [--store <file>] [--json]",
    );
    return;
  }

  const store = await loadStore(getStorePath(flags));
  const diff = await diffOperationalOntologyCorridor(
    store,
    corridorId,
    fromSnapshotId,
    toSnapshotId,
  );
  if (!diff) {
    console.error(`Corridor diff 없음: ${corridorId}`);
    process.exitCode = 1;
    return;
  }

  if (flags["json"] === "true") {
    printJson(diff);
    return;
  }

  console.log(`Corridor diff: ${corridorId}`);
  console.log(`  status: ${diff.status}`);
  console.log(
    `  endpoint Δ=${diff.endpointCountDelta}  contract Δ=${diff.contractCountDelta}  link Δ=${diff.linkCountDelta}`,
  );
  console.log(
    `  checkpoint lattice Δ=${diff.checkpointLatticeCountDelta}  route decision Δ=${diff.routeDecisionCountDelta}  traversal bundle Δ=${diff.traversalBundleCountDelta}`,
  );
}

async function cmdCorridorDiffLatest(rest: string[]): Promise<void> {
  const { positional, flags } = parseFlags(rest);
  const corridorId = positional[0];
  const scope = flags["scope"];
  if (!corridorId || !scope) {
    console.error(
      "Usage: qa-sdk ontology corridor diff-latest <corridor-id> --scope <scope> [--store <file>] [--json]",
    );
    return;
  }

  const store = await loadStore(getStorePath(flags));
  const diff = await diffLatestOperationalOntologyCorridorByScope(
    store,
    scope,
    corridorId,
  );
  if (!diff) {
    console.error(`Corridor diff-latest 없음: ${corridorId} @ ${scope}`);
    process.exitCode = 1;
    return;
  }

  if (flags["json"] === "true") {
    printJson(diff);
    return;
  }

  console.log(`Corridor diff-latest: ${corridorId}`);
  console.log(`  status: ${diff.status}`);
  console.log(
    `  endpoint Δ=${diff.endpointCountDelta}  contract Δ=${diff.contractCountDelta}  link Δ=${diff.linkCountDelta}`,
  );
}

async function cmdCheckpointDiff(rest: string[]): Promise<void> {
  const { positional, flags } = parseFlags(rest);
  const rootCheckpointId = positional[0];
  const fromSnapshotId = flags["from"];
  const toSnapshotId = flags["to"];
  if (!rootCheckpointId || !fromSnapshotId || !toSnapshotId) {
    console.error(
      "Usage: qa-sdk ontology checkpoint diff <root-checkpoint-id> --from <snapshot-id> --to <snapshot-id> [--store <file>] [--json]",
    );
    return;
  }

  const store = await loadStore(getStorePath(flags));
  const diff = await diffOperationalOntologyCheckpoint(
    store,
    rootCheckpointId,
    fromSnapshotId,
    toSnapshotId,
  );
  if (!diff) {
    console.error(`Checkpoint diff 없음: ${rootCheckpointId}`);
    process.exitCode = 1;
    return;
  }

  if (flags["json"] === "true") {
    printJson(diff);
    return;
  }

  console.log(`Checkpoint diff: ${rootCheckpointId}`);
  console.log(`  status: ${diff.status}`);
  console.log(
    `  definitions Δ=${diff.definitionCountDelta}  observations Δ=${diff.observationCountDelta}  links Δ=${diff.linkCountDelta}`,
  );
}

async function cmdCheckpointDiffLatest(rest: string[]): Promise<void> {
  const { positional, flags } = parseFlags(rest);
  const rootCheckpointId = positional[0];
  const scope = flags["scope"];
  if (!rootCheckpointId || !scope) {
    console.error(
      "Usage: qa-sdk ontology checkpoint diff-latest <root-checkpoint-id> --scope <scope> [--store <file>] [--json]",
    );
    return;
  }

  const store = await loadStore(getStorePath(flags));
  const diff = await diffLatestOperationalOntologyCheckpointByScope(
    store,
    scope,
    rootCheckpointId,
  );
  if (!diff) {
    console.error(`Checkpoint diff-latest 없음: ${rootCheckpointId} @ ${scope}`);
    process.exitCode = 1;
    return;
  }

  if (flags["json"] === "true") {
    printJson(diff);
    return;
  }

  console.log(`Checkpoint diff-latest: ${rootCheckpointId}`);
  console.log(`  status: ${diff.status}`);
  console.log(
    `  definitions Δ=${diff.definitionCountDelta}  observations Δ=${diff.observationCountDelta}  links Δ=${diff.linkCountDelta}`,
  );
}

async function cmdJunctionList(rest: string[]): Promise<void> {
  const { flags } = parseFlags(rest);
  const snapshotId = flags["snapshot"];
  const scope = flags["scope"];
  if (!snapshotId && !scope) {
    console.error(
      "Usage: qa-sdk ontology junction list [--snapshot <id> | --scope <scope>] [--store <file>] [--json]",
    );
    return;
  }

  const store = await loadStore(getStorePath(flags));
  const junctions = snapshotId
    ? await loadOperationalOntologyJunctions(store, snapshotId)
    : await listOperationalOntologyJunctionsByScope(store, scope!);

  if (flags["json"] === "true") {
    printJson(junctions);
    return;
  }

  if (junctions.length === 0) {
    console.log("Junction 없음");
    return;
  }

  for (const junction of junctions) {
    console.log(
      `${junction.branchNodeId}  mode=${junction.mode}  paths=${junction.paths.length}`,
    );
  }
}

async function cmdJunctionShow(rest: string[]): Promise<void> {
  const { positional, flags } = parseFlags(rest);
  const junctionId = positional[0];
  const snapshotId = flags["snapshot"];
  const scope = flags["scope"];
  if (!junctionId || (!snapshotId && !scope)) {
    console.error(
      "Usage: qa-sdk ontology junction show <junction-id> [--snapshot <id> | --scope <scope>] [--store <file>] [--json]",
    );
    return;
  }

  const store = await loadStore(getStorePath(flags));
  const view = snapshotId
    ? await loadOperationalOntologyJunctionView(store, snapshotId, junctionId)
    : await loadLatestOperationalOntologyJunctionViewByScope(
        store,
        scope!,
        junctionId,
      );

  if (!view) {
    console.error(`Junction view 없음: ${junctionId}`);
    process.exitCode = 1;
    return;
  }

  if (flags["json"] === "true") {
    printJson(view);
    return;
  }

  console.log(`Junction: ${view.junction.branchNodeId}`);
  console.log(`  snapshot: ${view.snapshotProjection.projectionId}`);
  console.log(`  mode: ${view.junction.mode}`);
  console.log(`  paths: ${view.junction.paths.length}`);
  console.log(`  route decisions: ${view.routeDecisions.length}`);
  console.log(`  corridors: ${view.corridors.map((corridor) => corridor.flowId).join(",") || "-"}`);
}

async function cmdJunctionDiff(rest: string[]): Promise<void> {
  const { positional, flags } = parseFlags(rest);
  const junctionId = positional[0];
  const fromSnapshotId = flags["from"];
  const toSnapshotId = flags["to"];
  if (!junctionId || !fromSnapshotId || !toSnapshotId) {
    console.error(
      "Usage: qa-sdk ontology junction diff <junction-id> --from <snapshot-id> --to <snapshot-id> [--store <file>] [--json]",
    );
    return;
  }

  const store = await loadStore(getStorePath(flags));
  const diff = await diffOperationalOntologyJunction(
    store,
    junctionId,
    fromSnapshotId,
    toSnapshotId,
  );
  if (!diff) {
    console.error(`Junction diff 없음: ${junctionId}`);
    process.exitCode = 1;
    return;
  }

  if (flags["json"] === "true") {
    printJson(diff);
    return;
  }

  console.log(`Junction diff: ${junctionId}`);
  console.log(`  status: ${diff.status}`);
  console.log(
    `  path Δ=${diff.pathCountDelta}  route decision Δ=${diff.routeDecisionCountDelta}`,
  );
}

async function cmdJunctionDiffLatest(rest: string[]): Promise<void> {
  const { positional, flags } = parseFlags(rest);
  const junctionId = positional[0];
  const scope = flags["scope"];
  if (!junctionId || !scope) {
    console.error(
      "Usage: qa-sdk ontology junction diff-latest <junction-id> --scope <scope> [--store <file>] [--json]",
    );
    return;
  }

  const store = await loadStore(getStorePath(flags));
  const diff = await diffLatestOperationalOntologyJunctionByScope(
    store,
    scope,
    junctionId,
  );
  if (!diff) {
    console.error(`Junction diff-latest 없음: ${junctionId} @ ${scope}`);
    process.exitCode = 1;
    return;
  }

  if (flags["json"] === "true") {
    printJson(diff);
    return;
  }

  console.log(`Junction diff-latest: ${junctionId}`);
  console.log(`  status: ${diff.status}`);
  console.log(
    `  path Δ=${diff.pathCountDelta}  route decision Δ=${diff.routeDecisionCountDelta}`,
  );
}

export async function cliOntology(args: string[]): Promise<void> {
  const [cmd, ...rest] = args;

  switch (cmd) {
    case "help":
      console.log(
        [
          "qa-sdk ontology",
          "",
          "  qa-sdk ontology status [--scope <scope> | --snapshot <id>] [--store <file>] [--json] [--table]",
          "  qa-sdk ontology prompt extract <doc-id> [--kind self_reflection|code_editing_rules|all] [--use-case <usecase>] [--persist-governance] [--output <file|dir>] [--json]",
          "  qa-sdk ontology prompt extract-file <code-path[:symbol]> [--kind self_reflection|code_editing_rules|all] [--use-case <usecase>] [--persist-governance] [--output <file|dir>] [--json]",
          "  qa-sdk ontology prompt extract-permission <permission-ref> [--kind self_reflection|code_editing_rules|all] [--use-case <usecase>] [--persist-governance] [--output <file|dir>] [--json]",
          "  qa-sdk ontology prompt extract-artifact <artifact-ref> [--artifact-type <type>] [--artifact-registry <file>] [--kind self_reflection|code_editing_rules|all] [--use-case <usecase>] [--persist-governance] [--output <file|dir>] [--json]",
          "  qa-sdk ontology artifact registry validate --input <file> [--json]",
          "  qa-sdk ontology artifact registry list --input <file> [--kind <kind>] [--json]",
          "  qa-sdk ontology artifact registry append --output <file> (--input <record.json> | --kind <kind> --artifact-ref <ref>) [--json]",
          "  qa-sdk ontology snapshot ingest --input <file> [--store <file>] [--snapshot-id <id>] [--scope <scope>] [--json]",
          "  qa-sdk ontology snapshot list [--store <file>] [--scope <scope>] [--json]",
          "  qa-sdk ontology snapshot show <snapshot-id> [--store <file>] [--json]",
          "  qa-sdk ontology snapshot diff <from-snapshot-id> <to-snapshot-id> [--store <file>] [--json]",
          "  qa-sdk ontology snapshot diff-latest --scope <scope> [--store <file>] [--json]",
          "  qa-sdk ontology corridor list [--snapshot <id> | --scope <scope>] [--store <file>] [--json]",
          "  qa-sdk ontology corridor show <corridor-id> --snapshot <snapshot-id> [--store <file>] [--json]",
          "  qa-sdk ontology corridor show-latest <corridor-id> --scope <scope> [--store <file>] [--json]",
          "  qa-sdk ontology corridor diff <corridor-id> --from <snapshot-id> --to <snapshot-id> [--store <file>] [--json]",
          "  qa-sdk ontology corridor diff-latest <corridor-id> --scope <scope> [--store <file>] [--json]",
          "  qa-sdk ontology checkpoint list [--snapshot <id> | --scope <scope>] [--store <file>] [--json]",
          "  qa-sdk ontology checkpoint show <root-checkpoint-id> [--snapshot <id> | --scope <scope>] [--store <file>] [--json]",
          "  qa-sdk ontology checkpoint diff <root-checkpoint-id> --from <snapshot-id> --to <snapshot-id> [--store <file>] [--json]",
          "  qa-sdk ontology checkpoint diff-latest <root-checkpoint-id> --scope <scope> [--store <file>] [--json]",
          "  qa-sdk ontology junction list [--snapshot <id> | --scope <scope>] [--store <file>] [--json]",
          "  qa-sdk ontology junction show <junction-id> [--snapshot <id> | --scope <scope>] [--store <file>] [--json]",
          "  qa-sdk ontology junction diff <junction-id> --from <snapshot-id> --to <snapshot-id> [--store <file>] [--json]",
          "  qa-sdk ontology junction diff-latest <junction-id> --scope <scope> [--store <file>] [--json]",
          "  qa-sdk ontology route list [--snapshot <id> | --scope <scope>] [--store <file>] [--json]",
          "  qa-sdk ontology route show <branch-node-id> [--snapshot <id> | --scope <scope>] [--store <file>] [--json]",
          "  qa-sdk ontology route diff <branch-node-id> --from <snapshot-id> --to <snapshot-id> [--store <file>] [--json]",
          "  qa-sdk ontology route diff-latest <branch-node-id> --scope <scope> [--store <file>] [--json]",
          "  qa-sdk ontology traversal list [--snapshot <id> | --scope <scope>] [--store <file>] [--json]",
          "  qa-sdk ontology traversal show <traversal-key> [--snapshot <id> | --scope <scope>] [--store <file>] [--json]",
          "  qa-sdk ontology traversal diff <traversal-key> --from <snapshot-id> --to <snapshot-id> [--store <file>] [--json]",
          "  qa-sdk ontology traversal diff-latest <traversal-key> --scope <scope> [--store <file>] [--json]",
          "  qa-sdk ontology event ingest --input <file> [--store <file>] [--snapshot-id <id>] [--scope <scope>] [--json]",
          "  qa-sdk ontology pipe ingest --input <file> [--store <file>] [--snapshot-id <id>] [--scope <scope>] [--json]",
        ].join("\n"),
      );
      return;
    case "status":
      await cmdStatus(rest);
      return;
    case "prompt.extract":
      await cmdPromptExtract(rest);
      return;
    case "prompt.extract-file":
      await cmdPromptExtractFile(rest);
      return;
    case "prompt.extract-permission":
      await cmdPromptExtractPermission(rest);
      return;
    case "prompt.extract-artifact":
      await cmdPromptExtractArtifact(rest);
      return;
    case "artifact.registry.validate":
      await cmdArtifactRegistryValidate(rest);
      return;
    case "artifact.registry.list":
      await cmdArtifactRegistryList(rest);
      return;
    case "artifact.registry.append":
      await cmdArtifactRegistryAppend(rest);
      return;
    case "snapshot.ingest":
      await cmdSnapshotIngest(rest);
      return;
    case "snapshot.list":
      await cmdSnapshotList(rest);
      return;
    case "snapshot.show":
      await cmdSnapshotShow(rest);
      return;
    case "snapshot.diff":
      await cmdSnapshotDiff(rest);
      return;
    case "snapshot.diff-latest":
      await cmdSnapshotDiffLatest(rest);
      return;
    case "corridor.show":
      await cmdCorridorShow(rest);
      return;
    case "corridor.list":
      await cmdCorridorList(rest);
      return;
    case "corridor.show-latest":
      await cmdCorridorShowLatest(rest);
      return;
    case "corridor.diff":
      await cmdCorridorDiff(rest);
      return;
    case "corridor.diff-latest":
      await cmdCorridorDiffLatest(rest);
      return;
    case "checkpoint.list":
      await cmdCheckpointList(rest);
      return;
    case "checkpoint.show":
      await cmdCheckpointShow(rest);
      return;
    case "checkpoint.diff":
      await cmdCheckpointDiff(rest);
      return;
    case "checkpoint.diff-latest":
      await cmdCheckpointDiffLatest(rest);
      return;
    case "junction.list":
      await cmdJunctionList(rest);
      return;
    case "junction.show":
      await cmdJunctionShow(rest);
      return;
    case "junction.diff":
      await cmdJunctionDiff(rest);
      return;
    case "junction.diff-latest":
      await cmdJunctionDiffLatest(rest);
      return;
    case "route.list":
      await cmdRouteList(rest);
      return;
    case "route.show":
      await cmdRouteShow(rest);
      return;
    case "route.diff":
      await cmdRouteDiff(rest);
      return;
    case "route.diff-latest":
      await cmdRouteDiffLatest(rest);
      return;
    case "traversal.list":
      await cmdTraversalList(rest);
      return;
    case "traversal.show":
      await cmdTraversalShow(rest);
      return;
    case "traversal.diff":
      await cmdTraversalDiff(rest);
      return;
    case "traversal.diff-latest":
      await cmdTraversalDiffLatest(rest);
      return;
    case "event.ingest":
      await cmdEventIngest(rest);
      return;
    case "pipe.ingest":
      await cmdPipeIngest(rest);
      return;
    default:
      console.error(`알 수 없는 ontology 명령: ${cmd ?? "(none)"}`);
      process.exitCode = 1;
  }
}
