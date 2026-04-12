import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

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
import { persistImplementationGovernanceRun } from "operational-ontology/governance";
import type {
  EventRecordObservationInput,
  PipeGraphProjectionInput,
} from "operational-ontology/projectors";
import {
  extractPromptArtifactSourcesFromDefinitionContext,
  generatePromptArtifact,
  generatePromptArtifacts,
  evaluatePromptArtifactQuality,
  type PromptArtifactKind,
  type PromptArtifactUseCase,
  PROMPT_ARTIFACT_KINDS,
  PROMPT_ARTIFACT_USE_CASES,
} from "operational-ontology/prompt-artifacts";
import { getQaSdkDir } from "../lib/qa-dir.js";

interface PersistedOntologyStoreFile {
  objects: OperationalOntologyObjectRecord[];
  facets: OperationalOntologyFacetRecord[];
  observations: OperationalOntologyObservationRecord[];
  projections: OperationalOntologyProjectionRecord[];
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
      "Usage: qa-sdk ontology prompt extract <doc-id> [--kind self_reflection|code_editing_rules|all] [--use-case <usecase>] [--persist-governance] [--store <file>] [--json] [--local|--server|--scan] [--db <path>]",
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
  await maybePersistGovernanceEvidence(flags, extraction);
  const artifacts = kind === "all"
    ? generatePromptArtifacts({ ...extraction, useCase })
    : [generatePromptArtifact({ ...extraction, kind, useCase })];
  const evaluations = artifacts.map((artifact) => ({
    artifact,
    quality: evaluatePromptArtifactQuality({
      artifact,
      workArea: extraction.workArea,
      sources: extraction.sources,
    }),
  }));

  if (flags["json"] === "true") {
    printJson({
      docId,
      useCase,
      workArea: extraction.workArea,
      sourceSummary: {
        corridors: extraction.sources.corridors?.length ?? 0,
        checkpointLattices: extraction.sources.checkpointLattices?.length ?? 0,
        traversals: extraction.sources.traversals?.length ?? 0,
        blueprints: extraction.sources.blueprints?.length ?? 0,
        governanceRuns: extraction.sources.governanceRuns?.length ?? 0,
      },
      artifacts: evaluations,
    });
    return;
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
      "Usage: qa-sdk ontology prompt extract-file <code-path[:symbol]> [--kind self_reflection|code_editing_rules|all] [--use-case <usecase>] [--persist-governance] [--store <file>] [--json] [--local|--server] [--db <path>]",
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
  await maybePersistGovernanceEvidence(flags, extraction);
  const workArea = {
    ...extraction.workArea,
    paths: uniqueCliValues([mapping.codePath, ...(extraction.workArea.paths ?? [])]),
    constraints: uniqueCliValues([
      `file:${mapping.codePath}`,
      ...(extraction.workArea.constraints ?? []),
    ]),
  };
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

  if (flags["json"] === "true") {
    printJson({
      filePath,
      boundaryDocId: mapping.anchor.docId,
      contextDocId: docId,
      useCase,
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
      "Usage: qa-sdk ontology prompt extract-permission <permission-ref> [--kind self_reflection|code_editing_rules|all] [--use-case <usecase>] [--persist-governance] [--store <file>] [--json] [--local|--server|--scan] [--db <path>]",
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

  if (flags["json"] === "true") {
    printJson({
      permissionRef,
      useCase,
      workArea,
      artifacts: evaluations,
    });
    return;
  }

  console.log(`permission: ${permissionRef}`);
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
      "Usage: qa-sdk ontology prompt extract-artifact <artifact-ref> [--artifact-type <type>] [--kind self_reflection|code_editing_rules|all] [--use-case <usecase>] [--persist-governance] [--store <file>] [--json] [--local|--server|--scan] [--db <path>]",
    );
    return;
  }

  if (artifactRef.startsWith("packages/") || artifactRef.startsWith("docs/")) {
    await cmdPromptExtractFile(rest);
    return;
  }

  const kind = parsePromptArtifactKind(flags["kind"]);
  const useCase = parsePromptArtifactUseCase(flags["use-case"] ?? "release_verification");
  const source = await createDataSource(toDefinitionDataSourceOptions(flags));
  const directDoc = await source.get(artifactRef);
  if (directDoc) {
    await cmdPromptExtract([artifactRef, ...rest.slice(1)]);
    return;
  }

  const artifactType = flags["artifact-type"] ?? inferArtifactType(artifactRef);
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
  const workArea = {
    ...extraction.workArea,
    workAreaId: `artifact:${artifactRef}`,
    displayName: `Artifact context: ${artifactRef}`,
    constraints: uniqueCliValues([
      `artifact:${artifactRef}`,
      ...(artifactType ? [`artifact-type:${artifactType}`] : []),
      ...(extraction.workArea.constraints ?? []),
    ]),
    localInstructions: [
      "Treat artifact refs as deliverable evidence, not as source code ownership by themselves.",
      "Resolve artifact context through matching definition docs, quality gates, and source maps before editing.",
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

  if (flags["json"] === "true") {
    printJson({
      artifactRef,
      artifactType,
      matchedDocs: candidates.map((doc) => doc.docId),
      useCase,
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
          "  qa-sdk ontology prompt extract <doc-id> [--kind self_reflection|code_editing_rules|all] [--use-case <usecase>] [--persist-governance] [--json]",
          "  qa-sdk ontology prompt extract-file <code-path[:symbol]> [--kind self_reflection|code_editing_rules|all] [--use-case <usecase>] [--persist-governance] [--json]",
          "  qa-sdk ontology prompt extract-permission <permission-ref> [--kind self_reflection|code_editing_rules|all] [--use-case <usecase>] [--persist-governance] [--json]",
          "  qa-sdk ontology prompt extract-artifact <artifact-ref> [--artifact-type <type>] [--kind self_reflection|code_editing_rules|all] [--use-case <usecase>] [--persist-governance] [--json]",
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
