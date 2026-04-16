import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import type { DefDataSource, DefDoc, DefIncomingLink, DefOutgoingLink } from "definition-catalog";
import { createDataSource, type DataSourceOptions } from "definition-data-source";
import type { InMemoryOperationalOntologyStore } from "operational-ontology/persistence";
import { persistImplementationGovernanceRun } from "operational-ontology/governance";
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
  appendQualityStatusEvidenceToPromptArtifactExtraction,
  createProgrammingArtifactRegistryRecord,
} from "operational-ontology/programming-artifacts";
import {
  createOntologyPackScaffoldPlanFromCliArgs,
  hasOntologyPackScaffoldErrors,
  type OntologyPackScaffoldPlan,
} from "../lib/ontology-pack-scaffold-plan.js";
import {
  writeOntologyPackScaffoldPlan,
  type OntologyPackScaffoldWriteSummary,
} from "../lib/ontology-pack-scaffold-write.js";
import { appendProgrammingArtifactRegistryRecords } from "../lib/programming-artifact-registry.js";
import { cmdRegistryActivatePack } from "./ontology/activation.js";
import {
  cmdArtifactRegistryAppend,
  cmdArtifactRegistryList,
  cmdArtifactRegistryValidate,
} from "./ontology/artifact-registry.js";
import {
  cmdEventIngest,
  cmdPipeIngest,
  cmdSnapshotIngest,
} from "./ontology/ingest.js";
import {
  cmdCheckpointDiff,
  cmdCheckpointDiffLatest,
  cmdCheckpointList,
  cmdCheckpointShow,
  cmdCorridorDiff,
  cmdCorridorDiffLatest,
  cmdCorridorList,
  cmdCorridorShow,
  cmdCorridorShowLatest,
  cmdJunctionDiff,
  cmdJunctionDiffLatest,
  cmdJunctionList,
  cmdJunctionShow,
  cmdRouteDiff,
  cmdRouteDiffLatest,
  cmdRouteList,
  cmdRouteShow,
  cmdTraversalDiff,
  cmdTraversalDiffLatest,
  cmdTraversalList,
  cmdTraversalShow,
} from "./ontology/navigation-diff.js";
import {
  qualityStatusRecords,
} from "./ontology/quality-status-evidence.js";
import {
  appendQualityStatusSnapshotGovernanceEvidence,
  promptQualityStatusEvidenceFromArtifactExtraction,
} from "./ontology/quality-ledger-evidence.js";
import {
  cmdPromptExtractArtifact,
  expandQualityTopologyTargetRefs,
  loadRelatedQualityStatusEvidenceFromFlags,
  parseArtifactExtractionSource,
  withQualityStatusRecordsSummary,
  workAreaQualityTargetRefs,
} from "./ontology/prompt-extract-artifact.js";
import {
  getStorePath,
  loadStore,
  parseFlags,
  printJson,
  saveStore,
} from "./ontology/support.js";
import {
  cmdSnapshotDiff,
  cmdSnapshotDiffLatest,
  cmdSnapshotList,
  cmdSnapshotShow,
  cmdStatus,
} from "./ontology/status.js";

interface PromptArtifactMaterialization {
  artifactId: string;
  kind: PromptArtifactKind;
  outputPath: string;
}

const PACK_SCAFFOLD_USAGE =
  "Usage: qa-sdk ontology pack scaffold <pack-id> [--implementation-package <name>] [--package-root <path>] [--docs-dir <path>] [--test <path>] [--include-docs <rule,cases,test|all>] [--dry-run] [--write] [--json]";

const PACK_VALIDATE_USAGE =
  "Usage: qa-sdk ontology pack validate <pack-ref> [--json]";

function printPackAuthoringContract(): void {
  console.log(
    [
      PACK_SCAFFOLD_USAGE,
      PACK_VALIDATE_USAGE,
      "",
      "Pack authoring contract:",
      "- OperationalOntologyPack is the canonical pack contract.",
      "- Scaffold is dry-run by default; file writes require explicit --write.",
      "- Write mode creates parent directories and refuses to overwrite existing files.",
      "- Scaffold preserves architecture-neutral identity/data/system separation; ECS can be modeled but is not required.",
      "- Required definition docs are spec/todo/plan; optional rule/cases/test docs require --include-docs.",
      "- Source-map candidates report generated implementation/test paths with def find-by-file guidance; no source comments are added by default.",
      "- Known-pack registration is reported as a candidate and is not applied automatically.",
      "- Registry activation is out of scope for scaffold; use qa-sdk ontology registry activate-pack separately.",
    ].join("\n"),
  );
}

function printPlannedPackCommand(usage: string): void {
  console.error(usage);
  console.error(
    "Pack authoring implementation is deferred beyond the US-001 command contract story.",
  );
  process.exitCode = 1;
}

function printPackScaffoldPlanSummary(
  plan: OntologyPackScaffoldPlan,
  writeSummary?: OntologyPackScaffoldWriteSummary,
): void {
  const diagnostics = writeSummary?.diagnostics ?? plan.diagnostics;
  if (diagnostics.length > 0) {
    console.error(`diagnostics: ${diagnostics.length}`);
    for (const diagnostic of diagnostics) {
      const path = diagnostic.path ? ` ${diagnostic.path}` : "";
      console.error(`  - ${diagnostic.severity} ${diagnostic.code}:${path} ${diagnostic.message}`);
    }
  }

  console.log(`pack: ${plan.identity.packId || "(missing)"}`);
  console.log(`mode: ${plan.mode}`);
  console.log(`implementation package: ${plan.identity.package.implementationPackage}`);
  console.log(`package root: ${plan.identity.package.packageRoot}`);
  console.log(`component schema files: ${plan.componentSchemaFiles.length}`);
  for (const file of plan.componentSchemaFiles) {
    console.log(`  - ${file.path}`);
  }
  console.log(`system binding files: ${plan.systemBindingFiles.length}`);
  for (const file of plan.systemBindingFiles) {
    console.log(`  - ${file.path}`);
  }
  console.log(`test files: ${plan.testFiles.length}`);
  for (const file of plan.testFiles) {
    console.log(`  - ${file.path}`);
  }
  console.log(`docs family: ${plan.docs.familyId}`);
  console.log(`definition doc files: ${plan.definitionDocFiles.length}`);
  for (const file of plan.definitionDocFiles) {
    const required = file.required ? "required" : "optional";
    console.log(`  - ${file.path} (${required})`);
  }
  console.log(`source-map candidates: ${plan.sourceMapCandidates.length}`);
  for (const candidate of plan.sourceMapCandidates) {
    console.log(
      `  - ${candidate.sourcePath} -> ${candidate.docPath} (${candidate.sourceRole}; ${candidate.sourceFileKind}; ${candidate.candidateKind}; ${candidate.applyMode})`,
    );
  }
  console.log(`source-map frontmatter candidates: ${plan.sourceMapFrontmatterCandidates.length}`);
  for (const candidate of plan.sourceMapFrontmatterCandidates) {
    console.log(
      `  - ${candidate.docPath} (${candidate.targetKind}; ${candidate.candidateKind}; ${candidate.applyMode})`,
    );
  }
  console.log("def find-by-file guidance:");
  console.log(`  ${plan.sourceMapGuidance.summary}`);
  for (const command of plan.sourceMapGuidance.findByFileCommands) {
    console.log(`  - ${command}`);
  }
  console.log("docs graph guidance:");
  for (const command of plan.sourceMapGuidance.docsGraphCommands) {
    console.log(`  - ${command}`);
  }
  console.log(`known-pack candidate: ${plan.knownPackCandidate.targetPath} (candidate only; not written)`);
  if (writeSummary) {
    console.log(`write status: ${writeSummary.status}`);
    console.log(`files written: ${writeSummary.writtenCount}`);
    if (writeSummary.blockedFiles.length > 0) {
      console.log("blocked existing files:");
      for (const file of writeSummary.blockedFiles) {
        console.log(`  - ${file.path}`);
      }
    }
  } else {
    console.log("files written: 0");
  }
}

function toPackScaffoldJsonOutput(
  plan: OntologyPackScaffoldPlan,
  writeSummary?: OntologyPackScaffoldWriteSummary,
): unknown {
  if (!writeSummary) return plan;
  return {
    ...plan,
    preview: {
      ...plan.preview,
      writesApplied: writeSummary.writesApplied,
    },
    writeSummary,
    diagnostics: writeSummary.diagnostics.length > 0
      ? writeSummary.diagnostics
      : plan.diagnostics,
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

async function loadQualityStatusDescriptorSource(
  flags: Record<string, string>,
): Promise<Pick<DefDataSource, "get" | "getChildren"> | undefined> {
  try {
    return await createDataSource(toDefinitionDataSourceOptions(flags));
  } catch {
    return undefined;
  }
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
  const qualityStatusTargetRefs = await expandQualityTopologyTargetRefs(source, [
    docId,
    ...workAreaQualityTargetRefs(extraction.workArea),
  ]);
  const qualityStatusEvidence = await loadRelatedQualityStatusEvidenceFromFlags(
    flags,
    qualityStatusTargetRefs,
    source,
  );
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
  const promptQualityStatusEvidenceFromExtraction =
    promptQualityStatusEvidenceFromArtifactExtraction(qualityStatusEvidence);
  const artifactSource = withQualityStatusRecordsSummary(
    parseArtifactExtractionSource(flags),
    qualityStatusEvidence.matches,
    qualityStatusEvidence.snapshotEvidence,
    promptQualityStatusEvidenceFromExtraction,
  );
  const promptQualityStatusEvidence = artifactSource
    ? promptQualityStatusEvidenceFromExtraction
    : undefined;
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
      qualityStatusEvidence: promptQualityStatusEvidence,
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
  const qualityStatusTargetRefs = await expandQualityTopologyTargetRefs(source, [
    filePath,
    mapping.codePath,
    mapping.anchor.docId,
    docId,
    ...workAreaQualityTargetRefs(extraction.workArea),
  ]);
  const qualityStatusEvidence = await loadRelatedQualityStatusEvidenceFromFlags(
    flags,
    qualityStatusTargetRefs,
    source,
  );
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
  const promptQualityStatusEvidenceFromExtraction =
    promptQualityStatusEvidenceFromArtifactExtraction(qualityStatusEvidence);
  const artifactSource = withQualityStatusRecordsSummary(
    parseArtifactExtractionSource(flags),
    qualityStatusEvidence.matches,
    qualityStatusEvidence.snapshotEvidence,
    promptQualityStatusEvidenceFromExtraction,
  );
  const promptQualityStatusEvidence = artifactSource
    ? promptQualityStatusEvidenceFromExtraction
    : undefined;
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
      qualityStatusEvidence: promptQualityStatusEvidence,
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

export async function cliOntology(args: string[]): Promise<void> {
  const [cmd, ...rest] = args;

  switch (cmd) {
    case "help":
      console.log(
        [
          "qa-sdk ontology",
          "",
          "  qa-sdk ontology status [--scope <scope> | --snapshot <id>] [--store <file>] [--json] [--table]",
          "  qa-sdk ontology pack scaffold <pack-id> [--implementation-package <name>] [--package-root <path>] [--docs-dir <path>] [--test <path>] [--include-docs <rule,cases,test|all>] [--dry-run] [--write] [--json]",
          "  qa-sdk ontology pack validate <pack-ref> [--json]",
          "",
          "Pack authoring contract:",
          "  OperationalOntologyPack remains the canonical pack contract.",
          "  Scaffold is dry-run by default; file writes require explicit --write.",
          "  Known-pack registration is reported as a candidate, not applied automatically.",
          "  Registry activation is out of scope for scaffold.",
          "  Identity ids, component data, and system transforms stay architecture-neutral; ECS is one model, not a limit.",
          "",
          "  qa-sdk ontology registry activate-pack <pack-id> [--store <path>] [--ontology-id <id>] [--namespace <namespace>] [--owner <owner>] [--version <versionId>] [--address-model product|sum] [--prefix <taxonomyId>=<prefix>] [--output <file>] [--artifact-registry <file>] [--json]",
          "  qa-sdk ontology prompt extract <doc-id> [--kind self_reflection|code_editing_rules|all] [--use-case <usecase>] [--persist-governance] [--output <file|dir>] [--json]",
          "  qa-sdk ontology prompt extract-file <code-path[:symbol]> [--kind self_reflection|code_editing_rules|all] [--use-case <usecase>] [--persist-governance] [--output <file|dir>] [--json]",
          "  qa-sdk ontology prompt extract-permission <permission-ref> [--kind self_reflection|code_editing_rules|all] [--use-case <usecase>] [--persist-governance] [--output <file|dir>] [--json]",
          "  qa-sdk ontology prompt extract-artifact <artifact-ref> [--artifact-type <type>] [--artifact-registry <file>] [--quality-ledger <path>] [--quality-status-max-age-days <n>] [--kind self_reflection|code_editing_rules|all] [--use-case <usecase>] [--persist-governance] [--output <file|dir>] [--json]",
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
    case "pack.scaffold":
      if (rest.includes("--help") || rest.includes("-h")) {
        printPackAuthoringContract();
        return;
      }
      {
        const plan = createOntologyPackScaffoldPlanFromCliArgs(rest);
        const writeSummary = plan.mode === "write"
          ? await writeOntologyPackScaffoldPlan(plan)
          : undefined;
        if (plan.cli.json) {
          printJson(toPackScaffoldJsonOutput(plan, writeSummary));
        } else {
          printPackScaffoldPlanSummary(plan, writeSummary);
        }
        const diagnostics = writeSummary?.diagnostics ?? plan.diagnostics;
        if (hasOntologyPackScaffoldErrors(diagnostics)) {
          process.exitCode = 1;
        }
      }
      return;
    case "pack.validate":
      if (rest.includes("--help") || rest.includes("-h")) {
        printPackAuthoringContract();
        return;
      }
      printPlannedPackCommand(PACK_VALIDATE_USAGE);
      return;
    case "registry.activate-pack":
      await cmdRegistryActivatePack(rest);
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
      await cmdPromptExtractArtifact(rest, {
        parseFlags,
        parsePromptArtifactKind,
        parsePromptArtifactUseCase,
        toDefinitionDataSourceOptions,
        loadQualityStatusDescriptorSource,
        defDocWithBody,
        maybePersistGovernanceEvidence,
        materializePromptArtifacts,
        cmdPromptExtract,
        cmdPromptExtractFile,
        printJson,
      });
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
