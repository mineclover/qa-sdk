/**
 * qa-sdk docs - cross-document control-plane CLI.
 *
 * `qa-sdk def` remains the definition-catalog primitive surface. This command
 * reads compatible document systems through neutral adapters so maintainers can
 * inspect family state, collect related facts, and search across sources.
 */

import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";

import {
  createArtifactEvidenceAdapter,
  buildDocumentRoleMatrix,
  buildDocumentGraphIndex,
  BROAD_DOCUMENT_GRAPH_TRAVERSAL_WARNING,
  CANONICAL_TRAVERSAL_AXES,
  collectDocumentFamilyOnlyScope,
  collectDocumentGraphTraversalDocuments,
  createDefinitionMarkdownAdapter,
  createPrdMarkdownAdapter,
  createRalphPrdJsonAdapter,
  createRalphSessionAdapter,
  detectCompletedRecords,
  filterDocumentGraphRanking,
  findNextFollowUps,
  normalizeDocumentGraphViewFilters,
  type DocumentAdapter,
  type DocumentDiagnostic,
  type DocumentEnvelope,
  type DocumentEvidence,
  type DocumentLink,
  type DocumentMetadata,
  type DocumentRawSourcePointer,
  type DocumentSource,
  type DocumentTask,
  formatDocumentGraphTraversalRoleGroups,
  type FollowUpState,
  isTraversalAxis,
  isTraversalDirection,
  isTraversalPresetId,
  previewPrdCompletionSync,
  rankDocumentGraphTraversal,
  summarizeDocumentGraphResult,
  TRAVERSAL_DIRECTIONS,
  TRAVERSAL_PRESET_IDS,
  traverseDocumentGraph,
  type DocumentGraphTraversalInput,
  type DocumentGraphTraversalResult,
  type DocumentGraphFilterResult,
  type DocumentGraphViewFilterInput,
  type DocumentGraphRankingResult,
  type DocumentGraphResultSummary,
  type NormalizedDocumentGraphViewFilters,
  type DocumentRoleMatrix,
  type CompletedRecordState,
  DEFAULT_DOCUMENT_GRAPH_TRAVERSAL_DEPTH,
  DEFAULT_DOCUMENT_GRAPH_TRAVERSAL_LIMIT,
  type PrdCompletionSyncPreview,
  MAX_DOCUMENT_GRAPH_TRAVERSAL_DEPTH,
  MAX_DOCUMENT_GRAPH_TRAVERSAL_LIMIT,
  type TraversalAxis,
  type TraversalDirection,
  type TraversalPresetId,
} from "../lib/docs-control-plane/index.js";
import {
  loadMetadataTransformRule,
  previewMetadataTransform,
  unsupportedMetadataTransformApplyError,
  type MetadataTransformPreview,
  type StructuredDocsError,
} from "../lib/docs-control-plane/metadata-transform.js";
import {
  detectDocumentDrift,
  type DocumentDriftIssue,
  type DocumentDriftResult,
  type DocumentDriftSeverity,
} from "../lib/docs-control-plane/drift.js";
import {
  previewPrdToRalphJson,
  type PrdToRalphJsonPreview,
} from "../lib/docs-control-plane/prd-to-ralph-json.js";
import { formatHelpSections, type CommandHelpSectionSpec } from "../command-spec.js";

type DocsCommand = "help" | "status" | "collect" | "search" | "drift" | "transform" | "prd" | "graph";

interface ParsedDocsArgs {
  readonly command: DocsCommand;
  readonly positional: readonly string[];
  readonly flags: Readonly<Record<string, readonly string[]>>;
}

interface DocsRuntimeOptions {
  readonly rootDir: string;
  readonly docsDirs: readonly string[];
  readonly prdDirs: readonly string[];
  readonly artifactRegistryPaths: readonly string[];
  readonly sessionPath?: string;
  readonly prdJsonPath?: string;
  readonly prdPath?: string;
}

interface ResolvedDocument {
  readonly document: DocumentEnvelope;
  readonly matchedTask?: DocumentTask;
}

interface DocumentSummary {
  readonly adapterId: string;
  readonly kind: string;
  readonly stableId: string;
  readonly familyId?: string;
  readonly path: string;
  readonly title?: string;
  readonly metadata: DocumentMetadata;
}

interface StatusResult {
  readonly target?: string;
  readonly document?: DocumentSummary;
  readonly sourceTarget?: {
    readonly path: string;
    readonly matches: readonly {
      readonly document: DocumentSummary;
      readonly source: DocumentSource;
    }[];
    readonly limitation: string;
  };
  readonly matchedTask?: {
    readonly id: string;
    readonly title: string;
    readonly state: string;
  };
  readonly familyId?: string;
  readonly counts: {
    readonly documents: number;
    readonly familyMembers: number;
    readonly links: number;
    readonly sources: number;
    readonly tasks: number;
    readonly evidence: number;
    readonly diagnostics: number;
  };
  readonly nextFollowUp: FollowUpState | null;
  readonly nextFollowUps: readonly FollowUpState[];
  readonly completedRecords: readonly CompletedRecordState[];
  readonly diagnostics: readonly DocumentDiagnostic[];
  readonly roleCoverage?: DocumentRoleMatrix;
}

interface CollectResult extends StatusResult {
  readonly familyMembers: readonly DocumentSummary[];
  readonly metadata: readonly {
    readonly stableId: string;
    readonly metadata: DocumentMetadata;
  }[];
  readonly links: readonly DocumentLink[];
  readonly sources: readonly DocumentSource[];
  readonly tasks: readonly DocumentTask[];
  readonly evidence: readonly DocumentEvidence[];
  readonly graph?: DocsGraphCliResult;
}

interface SearchResult {
  readonly query: string;
  readonly filters: {
    readonly kinds: readonly string[];
    readonly metadata: DocumentMetadata;
  };
  readonly results: readonly DocumentSummary[];
}

interface DocsGraphCliResult {
  readonly input: DocumentGraphTraversalResult["input"];
  readonly targetResolution: DocumentGraphTraversalResult["targetResolution"];
  readonly targetNodeId?: string;
  readonly nodes: DocumentGraphTraversalResult["nodes"];
  readonly edges: DocumentGraphTraversalResult["edges"];
  readonly paths: DocumentGraphTraversalResult["paths"];
  readonly roleGroups: DocumentGraphTraversalResult["roleGroups"];
  readonly missingRoles: DocumentGraphTraversalResult["missingRoles"];
  readonly filters: DocumentGraphFilterResult["filters"];
  readonly filtering: DocumentGraphFilterResult;
  readonly ranking: DocumentGraphRankingResult;
  readonly summary: DocumentGraphResultSummary;
  readonly rankedNodes: DocumentGraphRankingResult["rankedNodes"];
  readonly filteredNodes: DocumentGraphRankingResult["rankedNodes"];
  readonly counts: {
    readonly nodes: number;
    readonly edges: number;
    readonly paths: number;
    readonly diagnostics: number;
    readonly roleGroups: number;
    readonly missingRoles: number;
  };
  readonly truncated: boolean;
  readonly omittedCounts: DocumentGraphTraversalResult["omittedCounts"];
  readonly omittedCount: number;
  readonly diagnostics: readonly string[];
}

interface GraphDocumentScope {
  readonly traversal: DocumentGraphTraversalResult;
  readonly documents: readonly DocumentEnvelope[];
  readonly reasonByDocumentKey: ReadonlyMap<string, string>;
}

interface DocumentCommandScopeOptions {
  readonly familyOnly?: boolean;
  readonly includeSession?: boolean;
}

interface PrdContextSource {
  readonly kind: string;
  readonly stableId: string;
  readonly path: string;
  readonly title?: string;
  readonly reason: string;
  readonly ranking?: PrdContextSourceRanking;
}

interface PrdContextSourceRanking {
  readonly rank: number;
  readonly score: number;
  readonly strength: DocumentGraphRankingResult["rankedNodes"][number]["strength"];
  readonly reasons: readonly string[];
}

interface PrdContextDocumentSummary extends DocumentSummary {
  readonly summary?: string;
}

interface PrdOpenTodo {
  readonly documentId: string;
  readonly path: string;
  readonly pointer: string;
  readonly text: string;
}

interface PrdJsonCompletionState {
  readonly documentId: string;
  readonly path: string;
  readonly name?: string;
  readonly storyCount: number;
  readonly passedStoryCount: number;
  readonly allStoriesPassing: boolean;
  readonly tasks: readonly {
    readonly id: string;
    readonly title: string;
    readonly passes: boolean;
    readonly state: string;
  }[];
}

interface RalphSessionContextState {
  readonly documentId: string;
  readonly path: string;
  readonly id?: string;
  readonly status?: string;
  readonly prdPath?: string;
  readonly totalTasks?: number;
  readonly tasksCompleted?: number;
  readonly diagnostics: readonly DocumentDiagnostic[];
}

interface ScenarioMatrixRow {
  readonly documentId: string;
  readonly path: string;
  readonly rowIndex: number;
  readonly cells: Readonly<Record<string, string>>;
  readonly evidenceIds: readonly string[];
}

interface PrdContextDocumentSource {
  readonly documentId: string;
  readonly documentKind: string;
  readonly documentPath: string;
  readonly sourceId: string;
  readonly path?: string;
  readonly label?: string;
  readonly metadata: DocumentMetadata;
}

interface PrdContextEvidence {
  readonly documentId: string;
  readonly documentKind: string;
  readonly documentPath: string;
  readonly id: string;
  readonly kind?: string;
  readonly summary?: string;
  readonly metadata: DocumentMetadata;
}

interface PrdAuthoringContext {
  readonly target: string;
  readonly resolvedTarget?: DocumentSummary;
  readonly topicTokens: readonly string[];
  readonly counts: {
    readonly contextSources: number;
    readonly relatedSpecs: number;
    readonly openTodos: number;
    readonly plans: number;
    readonly priorPrds: number;
    readonly prdJsonCompletion: number;
    readonly ralphSessions: number;
    readonly scenarioMatrixRows: number;
    readonly sources: number;
    readonly evidence: number;
    readonly diagnostics: number;
  };
  readonly contextSources: readonly PrdContextSource[];
  readonly relatedSpecs: readonly PrdContextDocumentSummary[];
  readonly openTodos: readonly PrdOpenTodo[];
  readonly plans: readonly PrdContextDocumentSummary[];
  readonly priorPrds: readonly PrdContextDocumentSummary[];
  readonly prdJsonCompletion: readonly PrdJsonCompletionState[];
  readonly ralphSessionState: readonly RalphSessionContextState[];
  readonly scenarioMatrixRows: readonly ScenarioMatrixRow[];
  readonly sources: readonly PrdContextDocumentSource[];
  readonly evidence: readonly PrdContextEvidence[];
  readonly diagnostics: readonly DocumentDiagnostic[];
}

interface PrdScaffoldResult {
  readonly target: string;
  readonly output: string;
  readonly bytes: number;
  readonly context: PrdAuthoringContext;
}

const HELP_SECTIONS: readonly CommandHelpSectionSpec[] = [
  {
    title: "Usage",
    lines: [
      "qa-sdk docs status [doc-id|path] [--family-only] [--include-session] [--json]",
      "qa-sdk docs collect <doc-id|path> [--graph] [--family-only] [--include-session] [--axis <csv>] [--filter-axis <csv>] [--kind <csv>] [--role <csv>] [--follow-up-category <csv>] [--include-archive] [--direction out|in|both] [--depth <n>] [--limit <n>] [--preset <name>] [--json]",
      "qa-sdk docs graph <target> [--axis <csv>] [--filter-axis <csv>] [--kind <csv>] [--role <csv>] [--follow-up-category <csv>] [--include-archive] [--direction out|in|both] [--depth <n>] [--limit <n>] [--preset <name>] [--json]",
      "qa-sdk docs search <query> [--kind <kind>] [--metadata key=value] [--json]",
      "qa-sdk docs drift [--prd <file>] [--include-session] [--json]",
      "qa-sdk docs prd context <topic|doc-id> [--family-only] [--include-session] [--kind <csv>] [--role <csv>] [--filter-axis <csv>] [--follow-up-category <csv>] [--include-archive] [--json]",
      "qa-sdk docs prd scaffold <topic|doc-id> --output <file> [--json]",
      "qa-sdk docs prd to-ralph-json <prd.md> --output <prd.json> [--json]",
      "qa-sdk docs prd sync-completion --prd <prd.json> --dry-run [--family-only] [--include-session] [--json]",
      "qa-sdk docs transform metadata --rule <json-file|inline-json> [--dry-run] [--json]",
    ],
  },
  {
    title: "Options",
    lines: [
      "--root <dir>                 repository root override",
      "--docs-dir <dir>             definition markdown directory (repeatable)",
      "--prd-dir <dir>              PRD markdown/JSON directory (repeatable)",
      "--session <file>             ralph session metadata path",
      "--prd-json <file>            PRD JSON path for session comparison",
      "--prd <file>                 scope drift checks to a PRD markdown/JSON family",
      "--family-only                limit inventory commands to same-family role docs and direct module children",
      "--include-session            include transient .ralph-tui session state in family/drift/completion checks",
      "--axis <csv>                 graph traversal axes: composition, refinement, dependency, constraint, trace, source, evidence, role, context",
      "--filter-axis <csv>          filter post-traversal ranked/filtered views by traversal axis; does not change traversal",
      "--kind <csv>                 filter post-traversal graph views by document/node kind",
      "--role <csv>                 filter post-traversal graph views by document role metadata",
      "--follow-up-category <csv>   filter post-traversal graph views by follow-up category metadata",
      "--include-archive            include archived documents in post-traversal graph views",
      "--direction out|in|both      graph traversal direction",
      `--depth <n>                  graph traversal depth (default ${DEFAULT_DOCUMENT_GRAPH_TRAVERSAL_DEPTH}, max ${MAX_DOCUMENT_GRAPH_TRAVERSAL_DEPTH})`,
      `--limit <n>                  maximum graph nodes to return (default ${DEFAULT_DOCUMENT_GRAPH_TRAVERSAL_LIMIT}, max ${MAX_DOCUMENT_GRAPH_TRAVERSAL_LIMIT})`,
      "--preset <name>              graph traversal preset: family, implementation, review, impact, prd-completion",
      "--graph                      use graph traversal for docs collect; defaults to the family preset",
      "--output <file>              PRD markdown scaffold or PRD JSON conversion output path",
      "--rule <json-file|inline-json> metadata transform rule for dry-run preview",
      "--dry-run                    preview only; this is the default",
      "--apply                      unsupported in this PRD; returns a structured error",
      "--artifact-registry <file>   artifact evidence registry path (repeatable)",
      "--json                       emit structured JSON",
    ],
  },
];

const DEFAULT_DOCS_DIRS = ["docs"];
const DEFAULT_PRD_DIRS = ["tasks"];
const DEFAULT_ARTIFACT_REGISTRY_PATHS = ["artifacts/programming-artifacts.json"];
const GENERIC_TOPIC_TOKENS = new Set([
  "doc",
  "docs",
  "document",
  "documents",
  "json",
  "markdown",
  "memo",
  "plan",
  "prd",
  "rule",
  "spec",
  "task",
  "tasks",
  "test",
  "todo",
]);
const RESOLUTION_KIND_PRIORITY: Readonly<Record<string, number>> = {
  spec: 0,
  prd: 1,
  rule: 2,
  test: 3,
  memo: 4,
  plan: 5,
  todo: 6,
  "ralph-prd-json": 7,
  "ralph-session": 8,
  "activation-evidence": 9,
};
const COLLECT_GRAPH_FLAG_NAMES = new Set([
  "axis",
  "filter-axis",
  "kind",
  "role",
  "follow-up-category",
  "include-archive",
  "direction",
  "depth",
  "limit",
  "preset",
]);
const STATUS_TRAVERSAL_AXES = ["role", "composition"] as const satisfies readonly TraversalAxis[];
const PRD_CONTEXT_TRAVERSAL_AXES = [
  "role",
  "dependency",
  "source",
  "evidence",
] as const satisfies readonly TraversalAxis[];

export async function cliDocs(args: string[]): Promise<void> {
  const parsed = parseDocsArgs(args);
  if (parsed.command === "help") {
    printDocsHelp();
    return;
  }

  const options = runtimeOptions(parsed.flags);
  const documents = await collectAllDocuments(createDocsAdapters(options));

  if (parsed.command === "status") {
    await cmdStatus(documents, options, parsed.positional[0], parsed.flags);
    return;
  }

  if (parsed.command === "collect") {
    await cmdCollect(documents, options, parsed.positional[0], parsed.flags);
    return;
  }

  if (parsed.command === "graph") {
    await cmdGraph(documents, options, parsed.positional[0], parsed.flags);
    return;
  }

  if (parsed.command === "drift") {
    await cmdDrift(documents, options, parsed.flags);
    return;
  }

  if (parsed.command === "transform") {
    await cmdTransform(documents, options, parsed.positional, parsed.flags);
    return;
  }

  if (parsed.command === "prd") {
    await cmdPrd(documents, options, parsed.positional, parsed.flags);
    return;
  }

  await cmdSearch(documents, parsed.positional, parsed.flags, hasFlag(parsed.flags, "json"));
}

function parseDocsArgs(args: readonly string[]): ParsedDocsArgs {
  const command = normalizeCommand(args[0]);
  const rawRest = command === "help" && args[0] !== "help" ? args : args.slice(1);
  const positional: string[] = [];
  const flags: Record<string, string[]> = {};

  for (let index = 0; index < rawRest.length; index += 1) {
    const arg = rawRest[index]!;
    if (!arg.startsWith("--")) {
      positional.push(arg);
      continue;
    }

    const rawFlag = arg.slice(2);
    const separator = rawFlag.indexOf("=");
    const name = separator >= 0 ? rawFlag.slice(0, separator) : rawFlag;
    const inlineValue = separator >= 0 ? rawFlag.slice(separator + 1) : undefined;
    if (!name) continue;

    if (inlineValue !== undefined) {
      addFlag(flags, name, inlineValue);
      continue;
    }

    const next = rawRest[index + 1];
    if (next && !next.startsWith("--")) {
      addFlag(flags, name, next);
      index += 1;
      continue;
    }

    addFlag(flags, name, "true");
  }

  return { command, positional, flags };
}

function normalizeCommand(value: string | undefined): DocsCommand {
  if (
    value === "status"
    || value === "collect"
    || value === "search"
    || value === "help"
    || value === "drift"
    || value === "transform"
    || value === "prd"
    || value === "graph"
  ) {
    return value;
  }
  return "help";
}

function addFlag(flags: Record<string, string[]>, name: string, value: string): void {
  const values = flags[name] ?? [];
  values.push(value);
  flags[name] = values;
}

function runtimeOptions(flags: Readonly<Record<string, readonly string[]>>): DocsRuntimeOptions {
  const rootDir = resolve(pickLast(flags, "root") ?? getRootDir());
  return {
    rootDir,
    docsDirs: pickAll(flags, "docs-dir", DEFAULT_DOCS_DIRS),
    prdDirs: pickAll(flags, "prd-dir", DEFAULT_PRD_DIRS),
    artifactRegistryPaths: pickAll(
      flags,
      "artifact-registry",
      DEFAULT_ARTIFACT_REGISTRY_PATHS,
    ),
    sessionPath: pickLast(flags, "session"),
    prdJsonPath: pickLast(flags, "prd-json"),
    prdPath: pickLast(flags, "prd"),
  };
}

function createDocsAdapters(options: DocsRuntimeOptions): readonly DocumentAdapter[] {
  return [
    createDefinitionMarkdownAdapter({
      rootDir: options.rootDir,
      docsDirs: options.docsDirs,
    }),
    createPrdMarkdownAdapter({
      rootDir: options.rootDir,
      dirs: options.prdDirs,
    }),
    createRalphPrdJsonAdapter({
      rootDir: options.rootDir,
      dirs: options.prdDirs,
    }),
    createRalphSessionAdapter({
      rootDir: options.rootDir,
      ...(options.sessionPath ? { path: options.sessionPath } : {}),
      ...(options.prdJsonPath || options.prdPath?.endsWith(".json")
        ? { prdJsonPath: options.prdJsonPath ?? options.prdPath }
        : {}),
    }),
    createArtifactEvidenceAdapter({
      rootDir: options.rootDir,
      registryPaths: options.artifactRegistryPaths,
    }),
  ];
}

async function collectAllDocuments(
  adapters: readonly DocumentAdapter[],
): Promise<readonly DocumentEnvelope[]> {
  const groups = await Promise.all(adapters.map((adapter) => adapter.listDocuments()));
  return groups.flat().toSorted(compareDocuments);
}

async function cmdStatus(
  documents: readonly DocumentEnvelope[],
  options: DocsRuntimeOptions,
  target: string | undefined,
  flags: Readonly<Record<string, readonly string[]>>,
): Promise<void> {
  const json = hasFlag(flags, "json");
  const result = await buildStatusResult(documents, options.rootDir, target, scopeOptionsFromFlags(flags));
  if (json) {
    printJson(result);
    return;
  }
  printStatus(result);
}

async function cmdCollect(
  documents: readonly DocumentEnvelope[],
  options: DocsRuntimeOptions,
  target: string | undefined,
  flags: Readonly<Record<string, readonly string[]>>,
): Promise<void> {
  const json = hasFlag(flags, "json");
  if (!target) {
    console.error("docs collect requires <doc-id|path>");
    process.exitCode = 1;
    return;
  }

  const graphInput = parseDocsCollectGraphInput(target, flags);
  if (graphInput && isStructuredDocsError(graphInput)) {
    printStructuredError(graphInput, json);
    process.exitCode = 1;
    return;
  }
  const graphFilters = graphInput ? parseDocsGraphViewFilters(flags, "docs.collect") : {};
  if (isStructuredDocsError(graphFilters)) {
    printStructuredError(graphFilters, json);
    process.exitCode = 1;
    return;
  }

  const result = await buildCollectResult(
    documents,
    options.rootDir,
    target,
    graphInput,
    graphFilters,
    scopeOptionsFromFlags(flags),
  );
  if (json) {
    printJson(result);
    return;
  }
  printCollect(result);
}

async function cmdSearch(
  documents: readonly DocumentEnvelope[],
  positional: readonly string[],
  flags: Readonly<Record<string, readonly string[]>>,
  json: boolean,
): Promise<void> {
  const query = positional.join(" ").trim();
  if (!query) {
    console.error("docs search requires <query>");
    process.exitCode = 1;
    return;
  }

  const metadataFilter = parseMetadataFilters(pickAll(flags, "metadata", []));
  const kinds = pickAll(flags, "kind", []).flatMap(splitCsv);
  const result: SearchResult = {
    query,
    filters: {
      kinds,
      metadata: metadataFilter,
    },
    results: documents
      .filter((document) => matchesSearch(document, query, kinds, metadataFilter))
      .map(summarizeDocument),
  };

  if (json) {
    printJson(result);
    return;
  }
  printSearch(result);
}

async function cmdGraph(
  documents: readonly DocumentEnvelope[],
  options: DocsRuntimeOptions,
  target: string | undefined,
  flags: Readonly<Record<string, readonly string[]>>,
): Promise<void> {
  const json = hasFlag(flags, "json");
  const parsed = parseDocsGraphInput(target, flags);
  if ("error" in parsed) {
    printStructuredError(parsed, json);
    process.exitCode = 1;
    return;
  }

  const index = buildDocumentGraphIndex(documents, {
    rootDir: options.rootDir,
    includeContext: parsed.includeContext,
  });
  const traversal = traverseDocumentGraph(index, parsed);
  const filters = parseDocsGraphViewFilters(flags, "docs.graph");
  if (isStructuredDocsError(filters)) {
    printStructuredError(filters, json);
    process.exitCode = 1;
    return;
  }
  const result = toDocsGraphCliResult(traversal, filters);

  if (json) {
    printJson(result);
    return;
  }
  printGraph(result);
}

function parseDocsGraphInput(
  target: string | undefined,
  flags: Readonly<Record<string, readonly string[]>>,
  operation = "docs.graph",
): DocumentGraphTraversalInput | StructuredDocsError {
  if (!target) {
    return docsGraphError(
      operation,
      "missing-required-argument",
      `${operation} requires <target>.`,
      "Pass a document id, family id, task id, evidence id, graph node id, or source path.",
    );
  }

  const axes = pickAll(flags, "axis", []);
  const parsedAxes: TraversalAxis[] = [];
  for (const axis of axes) {
    if (!isTraversalAxis(axis)) {
      return docsGraphError(
        operation,
        "unknown-docs-graph-axis",
        `Unknown docs graph axis: ${axis}.`,
        `Use one of: ${CANONICAL_TRAVERSAL_AXES.join(", ")}.`,
      );
    }
    parsedAxes.push(axis);
  }

  const rawDirection = pickLast(flags, "direction");
  let direction: TraversalDirection | undefined;
  if (rawDirection) {
    if (!isTraversalDirection(rawDirection)) {
      return docsGraphError(
        operation,
        "unknown-docs-graph-direction",
        `Unknown docs graph direction: ${rawDirection}.`,
        `Use one of: ${TRAVERSAL_DIRECTIONS.join(", ")}.`,
      );
    }
    direction = rawDirection;
  }

  const rawPreset = pickLast(flags, "preset");
  let preset: TraversalPresetId | undefined;
  if (rawPreset) {
    if (!isTraversalPresetId(rawPreset)) {
      return docsGraphError(
        operation,
        "unknown-docs-graph-preset",
        `Unknown docs graph preset: ${rawPreset}.`,
        `Use one of: ${TRAVERSAL_PRESET_IDS.join(", ")}.`,
      );
    }
    preset = rawPreset;
  }

  const depth = parseDocsGraphIntegerFlag(flags, "depth", operation);
  if (isStructuredDocsError(depth)) return depth;

  const limit = parseDocsGraphIntegerFlag(flags, "limit", operation);
  if (isStructuredDocsError(limit)) return limit;

  return {
    target,
    ...(parsedAxes.length > 0 ? { axes: parsedAxes } : {}),
    ...(direction ? { direction } : {}),
    ...(depth !== undefined ? { depth } : {}),
    ...(limit !== undefined ? { limit } : {}),
    ...(preset ? { preset } : {}),
    includeContext: parsedAxes.includes("context"),
  };
}

function parseDocsGraphIntegerFlag(
  flags: Readonly<Record<string, readonly string[]>>,
  name: "depth" | "limit",
  operation = "docs.graph",
): number | StructuredDocsError | undefined {
  const raw = pickLast(flags, name);
  if (!raw) return undefined;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0) {
    return docsGraphError(
      operation,
      `invalid-docs-graph-${name}`,
      `${operation} --${name} expects a non-negative integer.`,
      `Pass --${name} 0 or a positive integer value.`,
    );
  }
  return value;
}

function parseDocsGraphViewFilters(
  flags: Readonly<Record<string, readonly string[]>>,
  operation = "docs.graph",
): DocumentGraphViewFilterInput | StructuredDocsError {
  const filterAxes: TraversalAxis[] = [];
  for (const axis of pickAll(flags, "filter-axis", [])) {
    if (!isTraversalAxis(axis)) {
      return docsGraphError(
        operation,
        "unknown-docs-graph-filter-axis",
        `Unknown docs graph filter axis: ${axis}.`,
        `Use one of: ${CANONICAL_TRAVERSAL_AXES.join(", ")}. --axis selects traversal axes; --filter-axis filters the post-traversal result view.`,
      );
    }
    filterAxes.push(axis);
  }

  return {
    kinds: pickAll(flags, "kind", []),
    roles: pickAll(flags, "role", []),
    axes: filterAxes,
    followUpCategories: pickAll(flags, "follow-up-category", []),
    includeArchive: hasFlag(flags, "include-archive"),
  };
}

function docsGraphError(
  operation: string,
  code: string,
  message: string,
  remediation: string,
): StructuredDocsError {
  return {
    error: {
      code,
      operation,
      message,
      remediation,
    },
  };
}

function parseDocsCollectGraphInput(
  target: string,
  flags: Readonly<Record<string, readonly string[]>>,
): DocumentGraphTraversalInput | StructuredDocsError | undefined {
  if (!hasFlag(flags, "graph") && !hasDocsGraphTraversalFlags(flags)) return undefined;

  const parsed = parseDocsGraphInput(target, flags, "docs.collect");
  if (isStructuredDocsError(parsed)) return parsed;
  if (!parsed.preset && !parsed.axes) {
    return {
      ...parsed,
      preset: "family",
    };
  }
  return parsed;
}

function hasDocsGraphTraversalFlags(
  flags: Readonly<Record<string, readonly string[]>>,
): boolean {
  return [...COLLECT_GRAPH_FLAG_NAMES].some((name) => (flags[name]?.length ?? 0) > 0);
}

function scopeOptionsFromFlags(
  flags: Readonly<Record<string, readonly string[]>>,
): DocumentCommandScopeOptions {
  return {
    familyOnly: hasFlag(flags, "family-only"),
    includeSession: hasFlag(flags, "include-session"),
  };
}

function isStructuredDocsError(value: unknown): value is StructuredDocsError {
  return Boolean(
    value &&
    typeof value === "object" &&
    "error" in value,
  );
}

function toDocsGraphCliResult(
  result: DocumentGraphTraversalResult,
  filters: DocumentGraphViewFilterInput = {},
): DocsGraphCliResult {
  const ranked = rankDocumentGraphTraversal(result);
  const { ranking, filtering } = filterDocumentGraphRanking(ranked, filters);
  const summary = summarizeDocumentGraphResult(result, filtering);
  return {
    input: result.input,
    targetResolution: result.targetResolution,
    ...(result.targetNodeId ? { targetNodeId: result.targetNodeId } : {}),
    nodes: result.nodes,
    edges: result.edges,
    paths: result.paths,
    roleGroups: result.roleGroups,
    missingRoles: result.missingRoles,
    filters: filtering.filters,
    filtering,
    ranking,
    summary,
    rankedNodes: ranking.rankedNodes,
    filteredNodes: filtering.filteredNodes,
    counts: {
      nodes: result.nodeCount,
      edges: result.edgeCount,
      paths: result.paths.length,
      diagnostics: result.diagnostics.length,
      roleGroups: result.roleGroups.length,
      missingRoles: result.missingRoles.length,
    },
    truncated: result.truncated,
    omittedCounts: result.omittedCounts,
    omittedCount: result.omittedCount,
    diagnostics: result.diagnostics,
  };
}

async function cmdDrift(
  documents: readonly DocumentEnvelope[],
  options: DocsRuntimeOptions,
  flags: Readonly<Record<string, readonly string[]>>,
): Promise<void> {
  const result = await detectDocumentDrift(documents, {
    rootDir: options.rootDir,
    ...(options.prdPath ? { prdPath: options.prdPath } : {}),
    includeSession: hasFlag(flags, "include-session"),
  });

  const json = hasFlag(flags, "json");
  if (json) {
    printJson(result);
    return;
  }
  printDrift(result);
}

async function cmdTransform(
  documents: readonly DocumentEnvelope[],
  options: DocsRuntimeOptions,
  positional: readonly string[],
  flags: Readonly<Record<string, readonly string[]>>,
): Promise<void> {
  const json = hasFlag(flags, "json");
  if (positional[0] !== "metadata") {
    console.error("Usage: qa-sdk docs transform metadata --rule <json-file|inline-json> [--dry-run] [--json]");
    process.exitCode = 1;
    return;
  }

  if (hasFlag(flags, "apply")) {
    printStructuredError(unsupportedMetadataTransformApplyError(), json);
    process.exitCode = 1;
    return;
  }

  const rawRule = pickLast(flags, "rule");
  if (!rawRule) {
    printStructuredError({
      error: {
        code: "missing-required-option",
        operation: "docs.transform.metadata",
        message: "docs transform metadata requires --rule <json-file|inline-json>",
        remediation: "Pass a JSON rule file path or quoted inline JSON object with --rule.",
      },
    }, json);
    process.exitCode = 1;
    return;
  }

  let loadedRule;
  try {
    loadedRule = await loadMetadataTransformRule(options.rootDir, rawRule);
  } catch (error) {
    printStructuredError({
      error: {
        code: "invalid-transform-rule",
        operation: "docs.transform.metadata",
        message: error instanceof Error ? error.message : String(error),
        remediation: "Pass a valid JSON object as inline JSON or a path to a JSON rule file.",
      },
    }, json);
    process.exitCode = 1;
    return;
  }

  const result = await previewMetadataTransform({
    rootDir: options.rootDir,
    documents,
    rule: loadedRule.rule,
    ruleSource: loadedRule.source,
    dryRunDefaulted: !hasFlag(flags, "dry-run"),
  });

  if (result.diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
    process.exitCode = 1;
  }

  if (json) {
    printJson(result);
    return;
  }
  printMetadataTransformPreview(result);
}

async function cmdPrd(
  documents: readonly DocumentEnvelope[],
  options: DocsRuntimeOptions,
  positional: readonly string[],
  flags: Readonly<Record<string, readonly string[]>>,
): Promise<void> {
  const json = hasFlag(flags, "json");
  const action = positional[0];
  const target = positional.slice(1).join(" ").trim();

  if (action !== "context" && action !== "scaffold" && action !== "to-ralph-json" && action !== "sync-completion") {
    console.error("Usage: qa-sdk docs prd context <topic|doc-id> [--family-only] [--include-session] [--kind <csv>] [--role <csv>] [--filter-axis <csv>] [--follow-up-category <csv>] [--include-archive] [--json]");
    console.error("Usage: qa-sdk docs prd scaffold <topic|doc-id> --output <file> [--json]");
    console.error("Usage: qa-sdk docs prd to-ralph-json <prd.md> --output <prd.json> [--json]");
    console.error("Usage: qa-sdk docs prd sync-completion --prd <prd.json> --dry-run [--family-only] [--include-session] [--json]");
    process.exitCode = 1;
    return;
  }

  if (action !== "sync-completion" && !target) {
    console.error(`docs prd ${action} requires <topic|doc-id>`);
    process.exitCode = 1;
    return;
  }

  if (action === "sync-completion") {
    if (hasFlag(flags, "apply")) {
      printStructuredError({
        error: {
          code: "unsupported-operation",
          operation: "docs.prd.sync-completion.apply",
          message: "docs prd sync-completion is dry-run only in this PRD.",
          remediation: "Run with --dry-run and review the proposed docs update plan.",
        },
      }, json);
      process.exitCode = 1;
      return;
    }

    const prdPath = pickLast(flags, "prd");
    if (!prdPath) {
      printStructuredError({
        error: {
          code: "missing-required-option",
          operation: "docs.prd.sync-completion",
          message: "docs prd sync-completion requires --prd <prd.json>.",
          remediation: "Pass the completed ralph PRD JSON path with --prd tasks/example.json.",
        },
      }, json);
      process.exitCode = 1;
      return;
    }
    if (!prdPath.toLowerCase().endsWith(".json")) {
      printStructuredError({
        error: {
          code: "unsupported-input-format",
          operation: "docs.prd.sync-completion",
          message: "docs prd sync-completion reads completed ralph PRD JSON.",
          remediation: "Use --prd with a .json file produced for ralph execution.",
        },
      }, json);
      process.exitCode = 1;
      return;
    }

    const result = await previewPrdCompletionSync({
      rootDir: options.rootDir,
      documents,
      prdPath,
      dryRunDefaulted: !hasFlag(flags, "dry-run"),
      familyOnly: hasFlag(flags, "family-only"),
      includeSession: hasFlag(flags, "include-session"),
    });
    if (hasErrorDiagnostic(result.diagnostics)) {
      process.exitCode = 1;
    }
    if (json) {
      printJson(result);
      return;
    }
    printPrdCompletionSyncPreview(result);
    return;
  }

  if (action === "to-ralph-json") {
    const output = pickLast(flags, "output");
    if (!output) {
      printStructuredError({
        error: {
          code: "missing-required-option",
          operation: "docs.prd.to-ralph-json",
          message: "docs prd to-ralph-json requires --output <prd.json>.",
          remediation: "Pass a repository-relative JSON output path such as --output tasks/prd.json.",
        },
      }, json);
      process.exitCode = 1;
      return;
    }

    if (!output.toLowerCase().endsWith(".json")) {
      printStructuredError({
        error: {
          code: "unsupported-output-format",
          operation: "docs.prd.to-ralph-json",
          message: "docs prd to-ralph-json writes ralph-compatible JSON.",
          remediation: "Use a .json output path.",
        },
      }, json);
      process.exitCode = 1;
      return;
    }

    const outputPath = resolveOutputPath(options.rootDir, output);
    const result = await previewPrdToRalphJson({
      rootDir: options.rootDir,
      inputPath: target,
      outputPath,
    });
    if (hasErrorDiagnostic(result.diagnostics)) {
      process.exitCode = 1;
      if (json) {
        printJson(toPrdToRalphJsonOutput(result));
        return;
      }
      printPrdToRalphJsonResult(result, false);
      return;
    }

    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, result.content, "utf8");
    if (json) {
      printJson(toPrdToRalphJsonOutput(result));
      return;
    }
    printPrdToRalphJsonResult(result, true);
    return;
  }

  const graphFilters = parseDocsGraphViewFilters(flags, `docs.prd.${action}`);
  if (isStructuredDocsError(graphFilters)) {
    printStructuredError(graphFilters, json);
    process.exitCode = 1;
    return;
  }

  const context = await buildPrdAuthoringContext(
    documents,
    options.rootDir,
    target,
    graphFilters,
    scopeOptionsFromFlags(flags),
  );

  if (action === "context") {
    if (json) {
      printJson(context);
      return;
    }
    printPrdAuthoringContext(context);
    return;
  }

  const output = pickLast(flags, "output");
  if (!output) {
    printStructuredError({
      error: {
        code: "missing-required-option",
        operation: "docs.prd.scaffold",
        message: "docs prd scaffold requires --output <file>.",
        remediation: "Pass a repository-relative markdown output path such as --output tasks/new-prd.md.",
      },
    }, json);
    process.exitCode = 1;
    return;
  }

  if (output.toLowerCase().endsWith(".json")) {
    printStructuredError({
      error: {
        code: "unsupported-output-format",
        operation: "docs.prd.scaffold",
        message: "docs prd scaffold writes markdown only and must not create ralph PRD JSON.",
        remediation: "Use a .md output path. PRD JSON creation belongs to an explicit adapter command.",
      },
    }, json);
    process.exitCode = 1;
    return;
  }

  const markdown = buildPrdScaffoldMarkdown(context);
  const outputPath = resolveOutputPath(options.rootDir, output);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, markdown, "utf8");

  const result: PrdScaffoldResult = {
    target,
    output: formatMaterializedOutputPath(options.rootDir, outputPath),
    bytes: Buffer.byteLength(markdown, "utf8"),
    context,
  };

  if (json) {
    printJson(result);
    return;
  }
  printPrdScaffoldResult(result);
}

async function buildStatusResult(
  documents: readonly DocumentEnvelope[],
  rootDir: string,
  target: string | undefined,
  scopeOptions: DocumentCommandScopeOptions = {},
): Promise<StatusResult> {
  const resolved = target ? resolveDocument(documents, target) : undefined;
  const resolvedSource = !resolved && target && isPathLikeTarget(target)
    ? resolveSourceTarget(documents, target)
    : undefined;
  const familyOnlyScope = resolved && scopeOptions.familyOnly === true
    ? collectFamilyOnlyScope(documents, resolved, scopeOptions)
    : undefined;
  const graphScope = resolved && !familyOnlyScope
    ? collectGraphScopedDocuments(documents, rootDir, {
      target: statusTraversalTarget(target ?? resolved.document.stableId, resolved),
      axes: STATUS_TRAVERSAL_AXES,
      direction: "both",
      depth: 1,
      includeContext: false,
    })
    : undefined;
  const scopedDocuments = familyOnlyScope
    ? familyOnlyScope.documents
    : graphScope
    ? graphScope.documents
    : resolvedSource
      ? resolvedSource.documents
      : documents;
  const diagnostics = scopedDocuments.flatMap((document) => document.diagnostics);
  const completedRecords = await detectCompletedRecords({ rootDir, documents: scopedDocuments });
  const nextFollowUps = await findNextFollowUps({
    rootDir,
    documents: scopedDocuments,
    completedRecords,
  });
  const roleCoverage = resolved
    ? buildDocumentRoleMatrix(documents, { target: resolved.document })
    : undefined;

  return {
    ...(target ? { target } : {}),
    ...(resolved ? { document: summarizeDocument(resolved.document) } : {}),
    ...(resolvedSource ? {
      sourceTarget: {
        path: resolvedSource.path,
        matches: resolvedSource.matches.map((match) => ({
          document: summarizeDocument(match.document),
          source: match.source,
        })),
        limitation: resolvedSource.limitation,
      },
    } : {}),
    ...(resolved?.matchedTask ? {
      matchedTask: {
        id: resolved.matchedTask.id,
        title: resolved.matchedTask.title,
        state: taskState(resolved.matchedTask),
      },
    } : {}),
    ...(resolved?.document.familyId ? { familyId: resolved.document.familyId } : {}),
    counts: countDocuments(documents, scopedDocuments),
    nextFollowUp: nextFollowUps[0] ?? null,
    nextFollowUps,
    completedRecords,
    diagnostics,
    ...(roleCoverage ? { roleCoverage } : {}),
  };
}

async function buildCollectResult(
  documents: readonly DocumentEnvelope[],
  rootDir: string,
  target: string,
  graphInput: DocumentGraphTraversalInput | undefined,
  graphFilters: DocumentGraphViewFilterInput = {},
  scopeOptions: DocumentCommandScopeOptions = {},
): Promise<CollectResult> {
  const status = await buildStatusResult(documents, rootDir, target, scopeOptions);
  const resolved = resolveDocument(documents, target);
  const resolvedSource = !resolved && isPathLikeTarget(target)
    ? resolveSourceTarget(documents, target)
    : undefined;
  const familyOnlyScope = resolved && scopeOptions.familyOnly === true
    ? collectFamilyOnlyScope(documents, resolved, scopeOptions, graphInput)
    : undefined;
  const graphScope = graphInput && !familyOnlyScope
    ? collectGraphScopedDocuments(documents, rootDir, graphInput)
    : resolved && !familyOnlyScope
      ? collectGraphScopedDocuments(documents, rootDir, {
        target: collectTraversalTarget(target, resolved),
        preset: "family",
        includeContext: false,
      })
      : undefined;
  const scopedDocuments = familyOnlyScope
    ? familyOnlyScope.documents
    : graphScope
    ? graphScope.documents
    : resolvedSource
      ? resolvedSource.documents
      : [];
  const graphResult = graphInput && (familyOnlyScope ?? graphScope)
    ? toDocsGraphCliResult((familyOnlyScope ?? graphScope)!.traversal, graphFilters)
    : undefined;
  const viewDocuments = graphResult && (familyOnlyScope ?? graphScope)
    ? collectDocumentsForGraphView(
      documents,
      (familyOnlyScope ?? graphScope)!.traversal,
      graphResult.filtering.filteredNodeIds,
    ).documents
    : scopedDocuments;
  const completedRecords = graphResult
    ? await detectCompletedRecords({ rootDir, documents: viewDocuments })
    : status.completedRecords;
  const nextFollowUps = graphResult
    ? await findNextFollowUps({ rootDir, documents: viewDocuments, completedRecords })
    : status.nextFollowUps;

  return {
    ...status,
    counts: countDocuments(documents, viewDocuments),
    nextFollowUp: nextFollowUps[0] ?? null,
    nextFollowUps,
    completedRecords,
    diagnostics: viewDocuments.flatMap((document) => document.diagnostics),
    familyMembers: viewDocuments.map(summarizeDocument),
    metadata: viewDocuments.map((document) => ({
      stableId: document.stableId,
      metadata: document.metadata,
    })),
    links: viewDocuments.flatMap((document) => document.links),
    sources: viewDocuments.flatMap((document) => document.sources),
    tasks: viewDocuments.flatMap((document) => document.tasks),
    evidence: viewDocuments.flatMap((document) => document.evidence),
    ...(graphResult ? { graph: graphResult } : {}),
  };
}

async function buildPrdAuthoringContext(
  documents: readonly DocumentEnvelope[],
  rootDir: string,
  target: string,
  graphFilters: DocumentGraphViewFilterInput = {},
  scopeOptions: DocumentCommandScopeOptions = {},
): Promise<PrdAuthoringContext> {
  const resolved = resolveDocument(documents, target);
  const familyOnlyScope = resolved && scopeOptions.familyOnly === true
    ? collectFamilyOnlyScope(documents, resolved, scopeOptions)
    : undefined;
  const graphScope = resolved && !familyOnlyScope
    ? collectGraphScopedDocuments(documents, rootDir, {
      target: prdContextTraversalTarget(target, resolved),
      axes: PRD_CONTEXT_TRAVERSAL_AXES,
      direction: "both",
      depth: 2,
      includeContext: false,
    })
    : undefined;
  const relatedScope = familyOnlyScope ?? graphScope;
  const graphResult = relatedScope
    ? toDocsGraphCliResult(relatedScope.traversal, graphFilters)
    : undefined;
  const relatedViewScope = graphResult && relatedScope
    ? collectDocumentsForGraphView(
      documents,
      relatedScope.traversal,
      graphResult.filtering.filteredNodeIds,
    )
    : relatedScope;
  const relatedDocuments = relatedViewScope
    ? relatedViewScope.documents
    : [];
  const topicTokens = prdTopicTokens(target, resolved?.document);
  const normalizedFilters = normalizeDocumentGraphViewFilters(graphFilters);
  const topicDocuments = resolved
    ? []
    : documents.filter((document) =>
      matchesPrdTopic(document, target, topicTokens)
      && prdTopicDocumentAllowed(document, scopeOptions)
      && documentMatchesGraphViewFilters(document, normalizedFilters, false)
    );
  const scopedDocuments = uniqueDocuments([...relatedDocuments, ...topicDocuments])
    .toSorted(compareDocuments);
  const rankingByDocumentKey = graphResult && relatedScope
    ? buildPrdContextRankingByDocumentKey(
      documents,
      relatedScope.traversal,
      graphResult.rankedNodes,
    )
    : new Map<string, PrdContextSourceRanking>();
  const rankedScopedDocuments = orderPrdContextDocuments(scopedDocuments, rankingByDocumentKey);
  const relatedKeys = new Set(relatedDocuments.map(documentKey));
  const topicKeys = new Set(topicDocuments.map(documentKey));
  const openTodos = await collectPrdOpenTodos(rootDir, rankedScopedDocuments);
  const scenarioMatrixRows = await collectScenarioMatrixRows(rootDir, rankedScopedDocuments);
  const sources = rankedScopedDocuments.flatMap((document) => document.sources.map((source) =>
    toPrdContextSourceRef(document, source)
  ));
  const evidence = rankedScopedDocuments.flatMap((document) => document.evidence.map((item) =>
    toPrdContextEvidence(document, item)
  ));
  const diagnostics = rankedScopedDocuments.flatMap((document) => document.diagnostics);
  const relatedSpecs = rankedScopedDocuments
    .filter((document) => document.kind === "spec")
    .map(summarizePrdContextDocument);
  const plans = rankedScopedDocuments
    .filter((document) => document.kind === "plan")
    .map(summarizePrdContextDocument);
  const priorPrds = rankedScopedDocuments
    .filter((document) => document.kind === "prd")
    .map(summarizePrdContextDocument);
  const prdJsonCompletion = rankedScopedDocuments
    .filter((document) => document.kind === "ralph-prd-json")
    .map(toPrdJsonCompletionState);
  const ralphSessionState = rankedScopedDocuments
    .filter((document) => document.kind === "ralph-session")
    .map(toRalphSessionContextState);
  const contextSources = rankedScopedDocuments.map((document) =>
    toPrdContextSource(
      document,
      resolved?.document,
      relatedKeys,
      topicKeys,
      relatedViewScope?.reasonByDocumentKey,
      rankingByDocumentKey,
    )
  );

  return {
    target,
    ...(resolved ? { resolvedTarget: summarizeDocument(resolved.document) } : {}),
    topicTokens,
    counts: {
      contextSources: contextSources.length,
      relatedSpecs: relatedSpecs.length,
      openTodos: openTodos.length,
      plans: plans.length,
      priorPrds: priorPrds.length,
      prdJsonCompletion: prdJsonCompletion.length,
      ralphSessions: ralphSessionState.length,
      scenarioMatrixRows: scenarioMatrixRows.length,
      sources: sources.length,
      evidence: evidence.length,
      diagnostics: diagnostics.length,
    },
    contextSources,
    relatedSpecs,
    openTodos,
    plans,
    priorPrds,
    prdJsonCompletion,
    ralphSessionState,
    scenarioMatrixRows,
    sources,
    evidence,
    diagnostics,
  };
}

function prdTopicDocumentAllowed(
  document: DocumentEnvelope,
  scopeOptions: DocumentCommandScopeOptions,
): boolean {
  if (scopeOptions.familyOnly !== true) return true;
  if (document.kind === "ralph-session") return scopeOptions.includeSession === true;
  if (document.kind === "prd" || document.kind === "ralph-prd-json") {
    return !normalizePath(document.path).split("/").includes("archive")
      && document.metadata.lifecycle !== "archived";
  }
  return true;
}

function documentMatchesGraphViewFilters(
  document: DocumentEnvelope,
  filters: NormalizedDocumentGraphViewFilters,
  hasTraversalAxis: boolean,
): boolean {
  if (!filters.includeArchive && isArchiveViewDocument(document)) return false;
  if (filters.axes.length > 0 && !hasTraversalAxis) return false;
  if (filters.kinds.length > 0 && !matchesAnyFilter(documentKindValues(document), filters.kinds)) {
    return false;
  }
  if (filters.roles.length > 0 && !matchesAnyFilter(documentRoleValues(document), filters.roles)) {
    return false;
  }
  if (
    filters.followUpCategories.length > 0 &&
    !matchesAnyFilter(documentFollowUpCategoryValues(document), filters.followUpCategories)
  ) {
    return false;
  }
  return true;
}

function isArchiveViewDocument(document: DocumentEnvelope): boolean {
  const lifecycle = asString(document.metadata.lifecycle)?.toLowerCase();
  if (lifecycle === "archived" || lifecycle === "historical") return true;
  const status = asString(document.metadata.status)?.toLowerCase();
  if (status === "archived" || status === "historical") return true;
  return normalizePath(document.path).split("/").includes("archive");
}

function documentKindValues(document: DocumentEnvelope): readonly string[] {
  return unique([
    document.kind,
    asString(document.metadata.documentKind),
  ]);
}

function documentRoleValues(document: DocumentEnvelope): readonly string[] {
  const values = [
    document.metadata.type === "knowledge" || document.kind === "knowledge" ? "knowledge" : undefined,
    isRoleLikeDocumentKind(document.kind) ? document.kind : undefined,
    roleFromPath(document.path),
  ];
  return unique(values);
}

function documentFollowUpCategoryValues(document: DocumentEnvelope): readonly string[] {
  return unique([
    asString(document.metadata.followUpCategory),
    asString(document.metadata.nextFollowUpCategory),
    asString(document.metadata.todoCategory),
    asString(document.metadata.category),
    ...asStringArray(document.metadata.followUpCategories),
    ...asStringArray(document.metadata.todoCategories),
  ]);
}

function isRoleLikeDocumentKind(kind: string): boolean {
  return [
    "spec",
    "todo",
    "plan",
    "rule",
    "cases",
    "test",
    "memo",
    "knowledge",
    "prd",
    "ralph-prd-json",
  ].includes(kind);
}

function roleFromPath(path: string): string | undefined {
  return path.match(/\.(spec|todo|plan|rule|cases|test|memo)\.md$/)?.[1];
}

function matchesAnyFilter(values: readonly string[], filters: readonly string[]): boolean {
  const normalizedValues = new Set(values.map(normalizeFilterValue));
  return filters.some((filter) => normalizedValues.has(normalizeFilterValue(filter)));
}

function normalizeFilterValue(value: string): string {
  return value.trim().toLowerCase();
}

function toPrdContextSource(
  document: DocumentEnvelope,
  resolvedTarget: DocumentEnvelope | undefined,
  relatedKeys: ReadonlySet<string>,
  topicKeys: ReadonlySet<string>,
  graphReasons: ReadonlyMap<string, string> | undefined,
  rankingByDocumentKey: ReadonlyMap<string, PrdContextSourceRanking>,
): PrdContextSource {
  const summary = summarizeDocument(document);
  const key = documentKey(document);
  const ranking = rankingByDocumentKey.get(key);
  return {
    kind: document.kind,
    stableId: document.stableId,
    path: document.path,
    ...(summary.title ? { title: summary.title } : {}),
    reason: document === resolvedTarget
      ? "target"
      : graphReasons?.get(key)
        ?? (relatedKeys.has(key)
          ? "graph-related"
          : topicKeys.has(key)
          ? "topic-match"
          : "included"),
    ...(ranking ? { ranking } : {}),
  };
}

function buildPrdContextRankingByDocumentKey(
  documents: readonly DocumentEnvelope[],
  traversal: DocumentGraphTraversalResult,
  rankedNodes: DocumentGraphRankingResult["rankedNodes"],
): ReadonlyMap<string, PrdContextSourceRanking> {
  const rankingByDocumentKey = new Map<string, PrdContextSourceRanking>();
  const traversalNodeById = new Map(traversal.nodes.map((node) => [node.id, node]));

  for (const rankedNode of rankedNodes) {
    const traversalNode = traversalNodeById.get(rankedNode.nodeId);
    if (!traversalNode) continue;

    const nodeScope = collectDocumentGraphTraversalDocuments(documents, {
      ...traversal,
      nodes: [traversalNode],
    });
    const ranking: PrdContextSourceRanking = {
      rank: rankedNode.rank,
      score: rankedNode.score,
      strength: rankedNode.strength,
      reasons: rankedNode.reasonSummary,
    };

    for (const document of nodeScope.documents) {
      const key = documentKey(document);
      const existing = rankingByDocumentKey.get(key);
      if (existing && existing.rank < ranking.rank) continue;
      rankingByDocumentKey.set(key, ranking);
    }
  }

  return rankingByDocumentKey;
}

function orderPrdContextDocuments(
  documents: readonly DocumentEnvelope[],
  rankingByDocumentKey: ReadonlyMap<string, PrdContextSourceRanking>,
): readonly DocumentEnvelope[] {
  return [...documents].toSorted((left, right) => {
    const leftRanking = rankingByDocumentKey.get(documentKey(left));
    const rightRanking = rankingByDocumentKey.get(documentKey(right));
    if (leftRanking && rightRanking) {
      return leftRanking.rank - rightRanking.rank || compareDocuments(left, right);
    }
    if (leftRanking) return -1;
    if (rightRanking) return 1;
    return compareDocuments(left, right);
  });
}

function summarizePrdContextDocument(document: DocumentEnvelope): PrdContextDocumentSummary {
  const summary = summarizeDocument(document);
  const purpose = asString(document.metadata.purpose);
  const overview = asString(document.metadata.overview);
  return {
    ...summary,
    ...(purpose ? { summary: purpose } : overview ? { summary: overview } : {}),
  };
}

async function collectPrdOpenTodos(
  rootDir: string,
  documents: readonly DocumentEnvelope[],
): Promise<readonly PrdOpenTodo[]> {
  const todos: PrdOpenTodo[] = [];
  for (const document of documents) {
    if (document.kind !== "todo") continue;
    const content = await readRepoFile(rootDir, document.path);
    if (content === null) continue;
    for (const item of parseOpenTodoItems(content)) {
      todos.push({
        documentId: document.stableId,
        path: document.path,
        pointer: item.pointer,
        text: item.text,
      });
    }
  }
  return todos;
}

async function collectScenarioMatrixRows(
  rootDir: string,
  documents: readonly DocumentEnvelope[],
): Promise<readonly ScenarioMatrixRow[]> {
  const rows: ScenarioMatrixRow[] = [];
  for (const document of documents) {
    const content = await readRepoFile(rootDir, document.path);
    if (content === null || !/Scenario Matrix/i.test(content)) continue;
    const section = extractMarkdownSection(content, "Scenario Matrix");
    if (!section) continue;
    const parsedRows = parseMarkdownTableRows(section);
    parsedRows.forEach((cells, index) => {
      rows.push({
        documentId: document.stableId,
        path: document.path,
        rowIndex: index + 1,
        cells,
        evidenceIds: unique(Object.values(cells).flatMap((value) =>
          value.match(/\bE-[A-Za-z0-9][A-Za-z0-9_-]*\b/g) ?? []
        )),
      });
    });
  }
  return rows;
}

function toPrdContextSourceRef(
  document: DocumentEnvelope,
  source: DocumentSource,
): PrdContextDocumentSource {
  return {
    documentId: document.stableId,
    documentKind: document.kind,
    documentPath: document.path,
    sourceId: source.id,
    ...(source.path ? { path: source.path } : {}),
    ...(source.label ? { label: source.label } : {}),
    metadata: source.metadata,
  };
}

function toPrdContextEvidence(
  document: DocumentEnvelope,
  evidence: DocumentEvidence,
): PrdContextEvidence {
  return {
    documentId: document.stableId,
    documentKind: document.kind,
    documentPath: document.path,
    id: evidence.id,
    ...(evidence.kind ? { kind: evidence.kind } : {}),
    ...(evidence.summary ? { summary: evidence.summary } : {}),
    metadata: evidence.metadata,
  };
}

function toPrdJsonCompletionState(document: DocumentEnvelope): PrdJsonCompletionState {
  const storyCount = asNumber(document.metadata.storyCount) ?? document.tasks.length;
  const passedStoryCount = asNumber(document.metadata.passedStoryCount)
    ?? document.tasks.filter((task) => task.metadata.passes === true).length;
  const name = asString(document.metadata.name);
  return {
    documentId: document.stableId,
    path: document.path,
    ...(name ? { name } : {}),
    storyCount,
    passedStoryCount,
    allStoriesPassing: storyCount > 0 && storyCount === passedStoryCount,
    tasks: document.tasks.map((task) => ({
      id: task.id,
      title: task.title,
      passes: task.metadata.passes === true,
      state: taskState(task),
    })),
  };
}

function toRalphSessionContextState(document: DocumentEnvelope): RalphSessionContextState {
  const id = asString(document.metadata.id);
  const status = asString(document.metadata.status);
  const prdPath = asString(document.metadata.prdPath);
  const totalTasks = asNumber(document.metadata.totalTasks);
  const tasksCompleted = asNumber(document.metadata.tasksCompleted);
  return {
    documentId: document.stableId,
    path: document.path,
    ...(id ? { id } : {}),
    ...(status ? { status } : {}),
    ...(prdPath ? { prdPath } : {}),
    ...(totalTasks !== undefined ? { totalTasks } : {}),
    ...(tasksCompleted !== undefined ? { tasksCompleted } : {}),
    diagnostics: document.diagnostics,
  };
}

function buildPrdScaffoldMarkdown(context: PrdAuthoringContext): string {
  const title = prdScaffoldTitle(context);
  const sourceLines = context.contextSources.length > 0
    ? context.contextSources.map((source) =>
      `- [${source.kind}] \`${source.stableId}\` (${source.path}) - ${source.reason}`
    )
    : ["- No matching control-plane sources were found; fill this PRD from planner input."];
  const specLines = context.relatedSpecs.slice(0, 5).map((spec) =>
    `- \`${spec.stableId}\`: ${spec.summary ?? spec.title ?? spec.path}`
  );
  const todoLines = context.openTodos.slice(0, 5).map((todo) =>
    `- ${todo.text} (${todo.path} ${todo.pointer})`
  );
  const planLines = context.plans.slice(0, 5).map((plan) =>
    `- \`${plan.stableId}\`: ${plan.summary ?? plan.title ?? plan.path}`
  );
  const qualityGates = scaffoldQualityGates(context);

  return `[PRD]
# PRD: ${title}

## Overview

Draft the product requirement for \`${context.target}\` using the docs control-plane context below.
${specLines.length > 0 ? `\nRelated specs:\n${specLines.join("\n")}\n` : ""}

## Goals

- [ ] Define the planner-visible outcome for this PRD.
- [ ] Ground implementation scope in existing specs, TODOs, plans, evidence, and ralph state.
${todoLines.length > 0 ? `- [ ] Resolve or explicitly defer surfaced open TODOs.\n` : ""}

## Quality Gates

${qualityGates.map((gate) => `- [ ] ${gate}`).join("\n")}

## User Stories

### US-001: Primary outcome

**Description:** As a planner, I want the implementation path to be explicit so that execution can proceed without guessing.

**Acceptance Criteria:**
- [ ] The story references the relevant specs, TODOs, evidence, and prior PRD state.
- [ ] The story states validation commands or observable evidence.
- [ ] The story avoids creating ralph PRD JSON unless an explicit adapter command is used.

## Non-Goals

- Calling \`ralph-tui\` directly from PRD authoring.
- Creating PRD JSON from this scaffold.
- Mutating definition docs, TODOs, plans, evidence registries, or ralph session state.

## Technical Considerations

${planLines.length > 0 ? `Existing plans:\n${planLines.join("\n")}\n` : "- TODO: Capture architectural constraints and source-owned vocabulary boundaries.\n"}
- PRD authoring reads neutral control-plane envelopes; repository documents remain source of truth.
- PRD JSON completion states surfaced: ${context.prdJsonCompletion.length}.
- Ralph session states surfaced: ${context.ralphSessionState.length}.
- Scenario matrix rows surfaced: ${context.scenarioMatrixRows.length}.

## Success Metrics

- [ ] The PRD can be reviewed without opening unrelated documents.
- [ ] Each user story maps to at least one quality gate or evidence source.
- [ ] Open questions are resolved or deliberately deferred before execution.

## Open Questions

- [ ] What is the smallest useful version of this PRD scope?
- [ ] Which surfaced TODOs are in scope now versus deferred?
- [ ] Which evidence or scenario matrix rows must be refreshed?

## Control-Plane Context Sources

${sourceLines.join("\n")}
[/PRD]
`;
}

function scaffoldQualityGates(context: PrdAuthoringContext): readonly string[] {
  const fromPriorPrds = context.priorPrds.flatMap((prd) =>
    Array.isArray(prd.metadata.qualityGates)
      ? prd.metadata.qualityGates.filter((item): item is string => typeof item === "string")
      : []
  );
  const fromJsonTasks = context.prdJsonCompletion.flatMap((prd) =>
    prd.tasks.flatMap((task) => {
      const source = context.contextSources.find((item) => item.stableId === prd.documentId);
      return source ? [`Review \`${source.path}\` state for ${task.id}.`] : [];
    })
  );
  return unique([
    ...fromPriorPrds,
    ...fromJsonTasks,
    "`pnpm --filter @qa-sdk/cli test -- docs` passes.",
    "`pnpm --filter @qa-sdk/cli typecheck` passes.",
  ]).slice(0, 8);
}

function prdScaffoldTitle(context: PrdAuthoringContext): string {
  const sourceTitle = context.resolvedTarget?.title
    ?? context.relatedSpecs[0]?.title
    ?? context.priorPrds[0]?.title;
  if (sourceTitle) return sourceTitle.replace(/^PRD:\s*/i, "").trim();
  return titleizeTopic(context.target);
}

function prdTopicTokens(
  target: string,
  document: DocumentEnvelope | undefined,
): readonly string[] {
  const values = [
    target,
    document?.stableId,
    document?.familyId,
    asString(document?.metadata.defId),
    asString(document?.metadata.title),
    asString(document?.metadata.name),
    ...asStringArray(document?.metadata.tags),
  ];
  const tokens = values.flatMap((value) => tokenizeTopic(value ?? ""))
    .filter((token) => !GENERIC_TOPIC_TOKENS.has(token));
  return unique(tokens.length > 0 ? tokens : tokenizeTopic(target));
}

function matchesPrdTopic(
  document: DocumentEnvelope,
  target: string,
  tokens: readonly string[],
): boolean {
  const normalizedTarget = normalizeSearchText(target);
  const text = normalizeSearchText(searchableText(document));
  if (normalizedTarget.length >= 3 && text.includes(normalizedTarget)) return true;
  return tokens.some((token) => text.includes(token));
}

function tokenizeTopic(value: string): readonly string[] {
  return normalizeSearchText(value)
    .split(" ")
    .filter((token) => token.length >= 3);
}

function parseOpenTodoItems(content: string): readonly { readonly text: string; readonly pointer: string }[] {
  return content
    .split(/\r?\n/)
    .map((line, index) => {
      const match = line.match(/^\s*[-*]\s+\[ \]\s+(.+?)\s*$/);
      if (!match) return null;
      return {
        text: match[1]?.trim() ?? "",
        pointer: `line ${index + 1}`,
      };
    })
    .filter((item): item is { readonly text: string; readonly pointer: string } =>
      item !== null && item.text.length > 0
    );
}

function extractMarkdownSection(content: string, title: string): string | null {
  const headingRe = new RegExp(String.raw`^##\s+${escapeRegExp(title)}\s*$`, "im");
  const match = content.match(headingRe);
  if (!match || match.index === undefined) return null;
  const start = match.index + match[0].length;
  const rest = content.slice(start);
  const nextHeading = rest.search(/^##\s+/m);
  return (nextHeading >= 0 ? rest.slice(0, nextHeading) : rest).trim();
}

function parseMarkdownTableRows(section: string): readonly Readonly<Record<string, string>>[] {
  const tableLines = section
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("|") && line.endsWith("|"));
  if (tableLines.length < 2) return [];
  const headers = splitMarkdownTableRow(tableLines[0]!);
  return tableLines.slice(2).map((line) => {
    const cells = splitMarkdownTableRow(line);
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header || `column${index + 1}`] = cells[index] ?? "";
    });
    return row;
  }).filter((row) => Object.values(row).some((value) => value.length > 0));
}

function splitMarkdownTableRow(line: string): readonly string[] {
  return line
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

async function readRepoFile(rootDir: string, path: string): Promise<string | null> {
  try {
    return await readFile(resolve(rootDir, normalizePath(path)), "utf8");
  } catch {
    return null;
  }
}

function resolveOutputPath(rootDir: string, path: string): string {
  return path.startsWith("/") ? resolve(path) : resolve(rootDir, path);
}

function formatMaterializedOutputPath(rootDir: string, outputPath: string): string {
  const resolved = resolve(outputPath);
  const relativePath = relative(rootDir, resolved).replaceAll("\\", "/");
  if (relativePath && relativePath !== ".." && !relativePath.startsWith("../") && !isAbsolute(relativePath)) {
    return relativePath;
  }
  return resolved.replaceAll("\\", "/");
}

function countDocuments(
  allDocuments: readonly DocumentEnvelope[],
  scopedDocuments: readonly DocumentEnvelope[],
): StatusResult["counts"] {
  return {
    documents: allDocuments.length,
    familyMembers: scopedDocuments.length,
    links: scopedDocuments.reduce((count, document) => count + document.links.length, 0),
    sources: scopedDocuments.reduce((count, document) => count + document.sources.length, 0),
    tasks: scopedDocuments.reduce((count, document) => count + document.tasks.length, 0),
    evidence: scopedDocuments.reduce((count, document) => count + document.evidence.length, 0),
    diagnostics: scopedDocuments.reduce((count, document) => count + document.diagnostics.length, 0),
  };
}

function collectGraphScopedDocuments(
  documents: readonly DocumentEnvelope[],
  rootDir: string,
  input: DocumentGraphTraversalInput,
): GraphDocumentScope {
  const index = buildDocumentGraphIndex(documents, {
    rootDir,
    includeContext: input.includeContext,
  });
  const traversal = traverseDocumentGraph(index, input);
  const scope = collectDocumentGraphTraversalDocuments(documents, traversal);

  return {
    traversal,
    documents: scope.documents,
    reasonByDocumentKey: scope.reasonByDocumentKey,
  };
}

function collectDocumentsForGraphView(
  documents: readonly DocumentEnvelope[],
  traversal: DocumentGraphTraversalResult,
  nodeIds: readonly string[],
): GraphDocumentScope {
  const includedNodeIds = new Set(nodeIds);
  const viewTraversal: DocumentGraphTraversalResult = {
    ...traversal,
    nodes: traversal.nodes.filter((node) => includedNodeIds.has(node.id)),
  };
  const scope = collectDocumentGraphTraversalDocuments(documents, viewTraversal);

  return {
    traversal,
    documents: scope.documents,
    reasonByDocumentKey: scope.reasonByDocumentKey,
  };
}

function collectFamilyOnlyScope(
  documents: readonly DocumentEnvelope[],
  resolved: ResolvedDocument,
  options: DocumentCommandScopeOptions,
  graphInput?: DocumentGraphTraversalInput,
): GraphDocumentScope {
  const scope = collectDocumentFamilyOnlyScope(documents, {
    target: resolved.document,
    includeSession: options.includeSession === true,
  });
  return {
    traversal: toFamilyOnlyTraversal(resolved.document, scope.documents, graphInput),
    documents: scope.documents,
    reasonByDocumentKey: scope.reasonByDocumentKey,
  };
}

function toFamilyOnlyTraversal(
  target: DocumentEnvelope,
  documents: readonly DocumentEnvelope[],
  graphInput: DocumentGraphTraversalInput | undefined,
): DocumentGraphTraversalResult {
  const targetNodeId = `document:${target.stableId}`;
  const nodes = documents.map((document) => {
    const nodeId = `document:${document.stableId}`;
    const isTarget = documentKey(document) === documentKey(target);
    return {
      id: nodeId,
      kind: familyOnlyGraphNodeKind(document),
      label: titleOf(document),
      stableId: document.stableId,
      ...(document.familyId ? { familyId: document.familyId } : {}),
      path: document.path,
      metadata: document.metadata,
      reasons: [],
      depth: isTarget ? 0 : 1,
      pathFromTarget: {
        targetNodeId,
        nodeId,
        depth: isTarget ? 0 : 1,
        nodeIds: isTarget ? [targetNodeId] : [targetNodeId, nodeId],
        edgeIds: [],
        steps: [],
      },
    };
  });

  return {
    input: {
      target: graphInput?.target ?? target.stableId,
      axes: graphInput?.axes ?? ["role", "composition"],
      direction: graphInput?.direction ?? "both",
      depth: graphInput?.depth ?? 1,
      limit: graphInput?.limit ?? documents.length,
      includeContext: graphInput?.includeContext ?? false,
      ...(graphInput?.preset ? { preset: graphInput.preset } : {}),
    },
    targetResolution: {
      target: graphInput?.target ?? target.stableId,
      lookupKind: "stable-id",
      indexed: true,
      nodes: [],
      diagnostics: [],
    },
    targetNodeId,
    nodes,
    edges: [],
    paths: [],
    roleGroups: [],
    missingRoles: [],
    nodeCount: nodes.length,
    edgeCount: 0,
    truncated: false,
    omittedCounts: {
      nodes: 0,
      edges: 0,
      depth: 0,
    },
    omittedCount: 0,
    diagnostics: [],
  };
}

function familyOnlyGraphNodeKind(
  document: DocumentEnvelope,
): DocumentGraphTraversalResult["nodes"][number]["kind"] {
  if (document.kind === "knowledge" || document.metadata.type === "knowledge") return "knowledge";
  switch (document.kind) {
    case "spec":
    case "todo":
    case "plan":
    case "rule":
    case "cases":
    case "test":
    case "memo":
    case "prd":
    case "ralph-prd-json":
    case "ralph-session":
      return document.kind;
    default:
      return "document";
  }
}

function statusTraversalTarget(
  target: string,
  resolved: ResolvedDocument,
): string {
  return resolved.matchedTask ? resolved.document.stableId : target;
}

function collectTraversalTarget(
  target: string,
  resolved: ResolvedDocument,
): string {
  return resolved.matchedTask ? resolved.document.stableId : target;
}

function prdContextTraversalTarget(
  target: string,
  resolved: ResolvedDocument,
): string {
  return resolved.matchedTask ? resolved.document.stableId : target;
}

function resolveDocument(
  documents: readonly DocumentEnvelope[],
  target: string,
): ResolvedDocument | undefined {
  const normalizedTarget = normalizePath(target);
  const identityMatches = documents.filter((document) => documentIdentityValues(document).includes(target));
  const pathMatches = documents.filter((document) => documentPathValues(document).includes(normalizedTarget));
  const byDocument = [...identityMatches, ...pathMatches].toSorted(compareResolutionPriority)[0];
  if (byDocument) return { document: byDocument };

  for (const document of documents) {
    const matchedTask = document.tasks.find((task) => task.id === target);
    if (matchedTask) return { document, matchedTask };
  }
  return undefined;
}

interface ResolvedSourceTarget {
  readonly path: string;
  readonly documents: readonly DocumentEnvelope[];
  readonly matches: readonly {
    readonly document: DocumentEnvelope;
    readonly source: DocumentSource;
  }[];
  readonly limitation: string;
}

function resolveSourceTarget(
  documents: readonly DocumentEnvelope[],
  target: string,
): ResolvedSourceTarget {
  const normalizedTarget = normalizePath(target);
  const matches = documents.flatMap((document) =>
    document.sources
      .filter((source) => sourceMatchesPath(source, normalizedTarget))
      .map((source) => ({ document, source }))
  );
  const matchedDocuments = uniqueDocuments(matches.map((match) => match.document))
    .toSorted(compareDocuments);
  return {
    path: normalizedTarget,
    documents: matchedDocuments,
    matches: matches.toSorted((left, right) => compareDocuments(left.document, right.document)),
    limitation: "Source-path status is limited to documents that declare this path in frontmatter or evidence sources; it does not scan the full repository.",
  };
}

function sourceMatchesPath(source: DocumentSource, normalizedTarget: string): boolean {
  const candidates = [
    source.path,
    normalizeOptionalPath(source.label),
    normalizeOptionalPath(source.metadata.value),
  ];
  return candidates.some((candidate) => candidate === normalizedTarget);
}

function isPathLikeTarget(target: string): boolean {
  return target.includes("/") || target.includes("\\") || /\.[A-Za-z0-9]+(?::|$)/.test(target);
}

function compareResolutionPriority(left: DocumentEnvelope, right: DocumentEnvelope): number {
  return (RESOLUTION_KIND_PRIORITY[left.kind] ?? 50) - (RESOLUTION_KIND_PRIORITY[right.kind] ?? 50)
    || compareDocuments(left, right);
}

function taskState(task: DocumentTask): string {
  if (typeof task.status === "string" && task.status.trim()) return task.status.trim();
  if (task.metadata.passes === true) return "passed";
  if (task.metadata.passes === false) return "open";
  return "open";
}

function matchesSearch(
  document: DocumentEnvelope,
  query: string,
  kinds: readonly string[],
  metadataFilter: DocumentMetadata,
): boolean {
  if (kinds.length > 0 && !kinds.includes(document.kind)) return false;
  for (const [key, expected] of Object.entries(metadataFilter)) {
    const actual = document.metadata[key];
    if (Array.isArray(actual)) {
      if (!actual.map(String).includes(String(expected))) return false;
      continue;
    }
    if (String(actual) !== String(expected)) return false;
  }

  const normalizedQuery = query.toLowerCase();
  return searchableText(document).toLowerCase().includes(normalizedQuery);
}

function searchableText(document: DocumentEnvelope): string {
  return [
    document.adapterId,
    document.kind,
    document.stableId,
    document.familyId,
    document.path,
    ...documentIdentityValues(document),
    ...metadataReferenceValues(document.metadata),
    ...document.sections.flatMap((section) => [
      section.id,
      section.title,
      section.anchor,
      section.content,
      ...metadataReferenceValues(section.metadata),
    ]),
    ...document.tasks.flatMap((task) => [
      task.id,
      task.title,
      task.status,
      ...metadataReferenceValues(task.metadata),
    ]),
    ...document.sources.flatMap((source) => [
      source.id,
      source.path,
      source.label,
      ...metadataReferenceValues(source.metadata),
    ]),
    ...document.links.flatMap((link) => [
      link.type,
      link.sourceId,
      link.targetId,
      ...metadataReferenceValues(link.metadata),
    ]),
    ...document.evidence.flatMap((evidence) => [
      evidence.id,
      evidence.kind,
      evidence.summary,
      ...metadataReferenceValues(evidence.metadata),
    ]),
  ].filter((value): value is string => typeof value === "string").join("\n");
}

function summarizeDocument(document: DocumentEnvelope): DocumentSummary {
  return {
    adapterId: document.adapterId,
    kind: document.kind,
    stableId: document.stableId,
    ...(document.familyId ? { familyId: document.familyId } : {}),
    path: document.path,
    ...(titleOf(document) ? { title: titleOf(document) } : {}),
    metadata: document.metadata,
  };
}

function titleOf(document: DocumentEnvelope): string {
  for (const key of ["title", "name", "defId"] as const) {
    const value = document.metadata[key];
    if (typeof value === "string" && value.trim().length > 0) return value;
  }
  return document.stableId;
}

function documentIdentityValues(document: DocumentEnvelope): readonly string[] {
  return unique([
    document.stableId,
    document.familyId,
    document.path,
    asString(document.metadata.defId),
    asString(document.metadata.title),
    asString(document.metadata.name),
    asString(document.metadata.sourcePath),
    asString(document.metadata.artifactId),
    asString(document.metadata.artifactRef),
    asString(document.metadata.outputPath),
    asString(document.metadata.ownerDefinitionId),
    ...document.tasks.map((task) => task.id),
  ]);
}

function documentPathValues(document: DocumentEnvelope): readonly string[] {
  return unique([
    normalizePath(document.path),
    normalizePath(document.rawSource.path),
    normalizeOptionalPath(document.metadata.sourcePath),
    normalizeOptionalPath(document.metadata.outputPath),
  ]);
}

function metadataReferenceValues(metadata: DocumentMetadata): readonly string[] {
  const values: string[] = [];
  for (const value of Object.values(metadata)) {
    appendMetadataValue(values, value);
  }
  return values;
}

function appendMetadataValue(values: string[], value: unknown): void {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    values.push(String(value));
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) appendMetadataValue(values, item);
    return;
  }
  if (value && typeof value === "object") {
    for (const item of Object.values(value)) appendMetadataValue(values, item);
  }
}

function parseMetadataFilters(values: readonly string[]): DocumentMetadata {
  const metadata: Record<string, string> = {};
  for (const value of values.flatMap(splitCsv)) {
    const separator = value.indexOf("=");
    if (separator <= 0) continue;
    const key = value.slice(0, separator).trim();
    const expected = value.slice(separator + 1).trim();
    if (key) metadata[key] = expected;
  }
  return metadata;
}

function printStatus(result: StatusResult): void {
  if (result.target && !result.document && !result.sourceTarget) {
    console.log(`docs status: ${result.target} not found`);
    return;
  }

  console.log(`docs status: ${result.sourceTarget ? `source ${result.sourceTarget.path}` : result.document?.stableId ?? "workspace"}`);
  if (result.document) {
    console.log(`  kind: ${result.document.kind}`);
    console.log(`  path: ${result.document.path}`);
  }
  if (result.sourceTarget) {
    console.log(`  source matches: ${result.sourceTarget.matches.length}`);
    console.log(`  limitation: ${result.sourceTarget.limitation}`);
  }
  if (result.familyId) console.log(`  family: ${result.familyId}`);
  console.log(`  documents: ${result.counts.familyMembers} related / ${result.counts.documents} total`);
  console.log(`  links/sources/tasks/evidence/diagnostics: ${result.counts.links}/${result.counts.sources}/${result.counts.tasks}/${result.counts.evidence}/${result.counts.diagnostics}`);
  printFollowUp(result.nextFollowUp);
  printAdditionalFollowUps(result.nextFollowUps);
  printCompletedRecords(result.completedRecords);
  printDiagnostics(result.diagnostics);
}

function printCollect(result: CollectResult): void {
  if (result.target && !result.document && !result.sourceTarget) {
    console.log(`docs collect: ${result.target} not found`);
    return;
  }

  printStatus(result);
  if (result.graph) {
    printCollectGraphView(result.graph);
  }
  console.log("");
  console.log(`family members (${result.familyMembers.length}):`);
  for (const member of result.familyMembers) {
    console.log(`  - [${member.kind}] ${member.stableId}`);
    console.log(`    path: ${member.path}`);
    if (member.title) console.log(`    title: ${member.title}`);
  }
  printNamedCollection("links", result.links, (link) =>
    `${link.type}: ${link.sourceId ?? "(source)"} -> ${link.targetId}`
  );
  printNamedCollection("sources", result.sources, (source) =>
    `${source.id}${source.path ? ` ${source.path}` : ""}${source.label ? ` (${source.label})` : ""}`
  );
  printNamedCollection("tasks", result.tasks, (task) =>
    `${task.id}: ${task.title} [${taskState(task)}]`
  );
  printNamedCollection("evidence", result.evidence, (evidence) =>
    `${evidence.id}${evidence.kind ? ` [${evidence.kind}]` : ""}${evidence.summary ? ` ${evidence.summary}` : ""}`
  );
}

function printCollectGraphView(result: DocsGraphCliResult): void {
  console.log("");
  console.log("graph view:");
  console.log(`  active ranked nodes: ${result.filtering.counts.filteredNodes}/${result.filtering.counts.rawRankedNodes}`);
  console.log(`  view nodes/edges/paths: ${result.summary.nodes}/${result.summary.edges}/${result.summary.paths}`);
  console.log(`  kinds: ${formatGraphSummaryCounts(result.summary.counts.byNodeKind)}`);
  console.log(`  axes: ${formatGraphSummaryCounts(result.summary.counts.byTraversalAxis)}`);
  const topRanked = result.rankedNodes.slice(0, 3).map((node) =>
    `#${node.rank} [${node.kind}] ${node.stableId ?? node.nodeId}`
  );
  console.log(`  top ranked: ${topRanked.length > 0 ? topRanked.join("; ") : "(none)"}`);
  for (const line of graphFilterText(result)) {
    console.log(`  ${line}`);
  }
}

function printSearch(result: SearchResult): void {
  console.log(`docs search: "${result.query}" -> ${result.results.length} result(s)`);
  console.log("  warning: text search is broad; prefer metadata filters or docs graph with explicit axes for bounded traversal");
  for (const item of result.results) {
    console.log(`  - [${item.kind}] ${item.stableId}`);
    console.log(`    path: ${item.path}`);
    if (item.title) console.log(`    title: ${item.title}`);
  }
}

function printGraph(result: DocsGraphCliResult): void {
  console.log(`docs graph: ${result.input.target}`);
  console.log(`  target: ${result.targetNodeId ?? "(not found)"}`);
  console.log(`  lookup: ${result.targetResolution.lookupKind}${result.targetResolution.indexed ? " indexed" : " unindexed"}`);
  console.log(`  axes: ${result.input.axes.join(", ") || "(none)"}`);
  console.log(`  direction: ${result.input.direction}`);
  console.log(`  depth: ${result.input.depth}`);
  console.log(`  limit: ${result.input.limit}`);
  if (result.input.preset) console.log(`  preset: ${result.input.preset}`);
  for (const line of graphFilterText(result)) {
    console.log(`  ${line}`);
  }
  for (const warning of graphTextWarnings(result)) {
    console.log(`  ${warning}`);
  }
  console.log(`  node count: ${result.counts.nodes}`);
  console.log(`  edge count: ${result.counts.edges}`);
  console.log(`  truncated: ${result.truncated ? "yes" : "no"}${formatOmittedCounts(result)}`);
  if (result.filtering.counts.filteredNodes !== result.filtering.counts.rawRankedNodes) {
    console.log(`  active ranked view: ${result.filtering.counts.filteredNodes}/${result.filtering.counts.rawRankedNodes} node(s)`);
  }

  printGraphSummary(result);

  console.log("");
  console.log(`ranked view (${result.rankedNodes.length}):`);
  for (const node of result.rankedNodes) {
    const path = node.path ? ` ${node.path}` : "";
    console.log(
      `  - #${node.rank} [${node.kind}] ${node.nodeId} score=${node.score} strength=${node.strength}${path}`,
    );
  }

  console.log("");
  console.log(`nodes (${result.nodes.length} raw traversal):`);
  for (const node of result.nodes) {
    const path = node.path ? ` ${node.path}` : "";
    console.log(`  - [${node.kind}] ${node.id}${path}`);
  }

  console.log("");
  console.log(`edge reasons (${result.edges.length}):`);
  for (const edge of result.edges) {
    const authored = edge.authoredType ? ` ${edge.authoredType}` : "";
    console.log(`  - [${edge.axis}] ${edge.fromNodeId} -> ${edge.toNodeId} (${edge.kind}${authored})`);
    console.log(`    traversal: ${edge.traversal.direction} from ${edge.traversal.fromNodeId} to ${edge.traversal.toNodeId}`);
    for (const reason of edge.reasons) {
      console.log(`    reason: ${reason.reason}`);
      if (reason.rawSource) {
        console.log(`      source: ${formatRawSource(reason.rawSource)}`);
      }
    }
  }

  for (const line of formatDocumentGraphTraversalRoleGroups(result)) {
    console.log(line);
  }

  const diagnostics = result.diagnostics.filter((diagnostic) => !isGraphWarningDiagnostic(diagnostic));
  if (diagnostics.length > 0) {
    console.log("");
    console.log(`diagnostics (${diagnostics.length}):`);
    for (const diagnostic of diagnostics.slice(0, 5)) {
      console.log(`  - ${diagnostic}`);
    }
    if (diagnostics.length > 5) {
      console.log(`  ... ${diagnostics.length - 5} more`);
    }
  }
}

function printGraphSummary(result: DocsGraphCliResult): void {
  const summary = result.summary;
  console.log("  summary:");
  console.log(`    view nodes/edges/paths: ${summary.nodes}/${summary.edges}/${summary.paths}`);
  console.log(`    kinds: ${formatGraphSummaryCounts(summary.counts.byNodeKind)}`);
  console.log(`    axes: ${formatGraphSummaryCounts(summary.counts.byTraversalAxis)}`);
  if (Object.keys(summary.counts.byDocumentRole).length > 0) {
    console.log(`    roles: ${formatGraphSummaryCounts(summary.counts.byDocumentRole)}`);
  }
  if (Object.keys(summary.counts.byFollowUpCategory).length > 0) {
    console.log(`    follow-ups: ${formatGraphSummaryCounts(summary.counts.byFollowUpCategory)}`);
  }
  if (
    summary.archive.included > 0 ||
    summary.archive.excluded > 0 ||
    result.filters.includeArchive
  ) {
    console.log(`    archive: included ${summary.archive.included}, excluded ${summary.archive.excluded}`);
  }
  console.log(`    diagnostics: ${summary.diagnostics}`);
}

function formatGraphSummaryCounts(counts: Readonly<Record<string, number>>): string {
  const entries = Object.entries(counts);
  if (entries.length === 0) return "(none)";
  return entries.map(([name, count]) => `${name}=${count}`).join(", ");
}

function graphTextWarnings(result: DocsGraphCliResult): readonly string[] {
  const warnings = result.diagnostics.filter(isGraphWarningDiagnostic);
  if (warnings.length > 0) return warnings;
  if (result.input.axes.includes("context")) return [BROAD_DOCUMENT_GRAPH_TRAVERSAL_WARNING];
  return [];
}

function graphFilterText(result: DocsGraphCliResult): readonly string[] {
  const lines: string[] = [];
  if (result.filters.kinds.length > 0) lines.push(`kind filter: ${result.filters.kinds.join(", ")}`);
  if (result.filters.roles.length > 0) lines.push(`role filter: ${result.filters.roles.join(", ")}`);
  if (result.filters.axes.length > 0) lines.push(`post-traversal axis filter: ${result.filters.axes.join(", ")}`);
  if (result.filters.followUpCategories.length > 0) {
    lines.push(`follow-up category filter: ${result.filters.followUpCategories.join(", ")}`);
  }
  if (result.filters.includeArchive) {
    lines.push("archive view: included");
  } else if (result.filtering.counts.excludedByArchive > 0) {
    lines.push(`archive view: excluded ${result.filtering.counts.excludedByArchive} archived node(s)`);
  }
  return lines;
}

function isGraphWarningDiagnostic(diagnostic: string): boolean {
  return diagnostic.startsWith("warning:");
}

function formatOmittedCounts(result: DocsGraphCliResult): string {
  if (!result.truncated) return "";
  const parts = [];
  if (result.omittedCounts.nodes > 0) parts.push(`${result.omittedCounts.nodes} node(s)`);
  if (result.omittedCounts.edges > 0) parts.push(`${result.omittedCounts.edges} edge(s)`);
  if (result.omittedCounts.depth > 0) {
    parts.push(`${result.omittedCounts.depth} depth-frontier node(s)`);
  }
  return parts.length > 0 ? ` (omitted ${parts.join(", ")})` : "";
}

function formatRawSource(rawSource: DocumentRawSourcePointer): string {
  return `${rawSource.path}${rawSource.pointer ? `#${rawSource.pointer}` : ""}`;
}

function printDrift(result: DocumentDriftResult): void {
  console.log(`docs drift: ${result.counts.total} issue(s)`);
  if (result.scope.prd) console.log(`  prd: ${result.scope.prd}`);
  console.log(`  documents: ${result.scope.documents}`);
  for (const severity of ["error", "warning", "info"] as const satisfies readonly DocumentDriftSeverity[]) {
    printDriftIssueGroup(severity, result.issuesBySeverity[severity]);
  }
}

function printMetadataTransformPreview(result: MetadataTransformPreview): void {
  console.log(`docs transform metadata: ${result.mode}`);
  console.log(`  rule: ${result.ruleSource}`);
  console.log(`  dry-run defaulted: ${result.dryRunDefaulted ? "yes" : "no"}`);
  console.log(`  affected paths: ${result.counts.affected} / ${result.counts.matched} matched`);
  for (const changeSet of result.changeSets) {
    console.log(`  - ${changeSet.path}`);
    console.log(`    before: ${JSON.stringify(changeSet.before)}`);
    console.log(`    after: ${JSON.stringify(changeSet.after)}`);
    for (const change of changeSet.changes) {
      console.log(`    change: ${change.description}`);
    }
  }
  printDiagnostics(result.diagnostics);
}

function printPrdAuthoringContext(context: PrdAuthoringContext): void {
  console.log(`docs prd context: ${context.target}`);
  if (context.resolvedTarget) {
    console.log(`  target: [${context.resolvedTarget.kind}] ${context.resolvedTarget.stableId}`);
    console.log(`  path: ${context.resolvedTarget.path}`);
  }
  console.log(`  context sources: ${context.counts.contextSources}`);
  console.log(`  specs/todos/plans/prds: ${context.counts.relatedSpecs}/${context.counts.openTodos}/${context.counts.plans}/${context.counts.priorPrds}`);
  console.log(`  prd-json/session/scenario rows: ${context.counts.prdJsonCompletion}/${context.counts.ralphSessions}/${context.counts.scenarioMatrixRows}`);
  console.log(`  sources/evidence/diagnostics: ${context.counts.sources}/${context.counts.evidence}/${context.counts.diagnostics}`);
  printNamedCollection("related specs", context.relatedSpecs.slice(0, 8), (spec) =>
    `${spec.stableId} ${spec.path}${spec.summary ? ` - ${spec.summary}` : ""}`
  );
  printNamedCollection("open TODOs", context.openTodos.slice(0, 8), (todo) =>
    `${todo.text} (${todo.path} ${todo.pointer})`
  );
  printNamedCollection("plans", context.plans.slice(0, 8), (plan) =>
    `${plan.stableId} ${plan.path}${plan.summary ? ` - ${plan.summary}` : ""}`
  );
  printNamedCollection("prior PRDs", context.priorPrds.slice(0, 8), (prd) =>
    `${prd.stableId} ${prd.path}${prd.title ? ` - ${prd.title}` : ""}`
  );
  printNamedCollection("PRD JSON completion", context.prdJsonCompletion, (state) =>
    `${state.documentId} ${state.passedStoryCount}/${state.storyCount} passing (${state.path})`
  );
  printNamedCollection("ralph sessions", context.ralphSessionState, (state) =>
    `${state.documentId} ${state.status ?? "unknown"}${state.prdPath ? ` prd=${state.prdPath}` : ""}`
  );
  printNamedCollection("scenario matrix rows", context.scenarioMatrixRows.slice(0, 8), (row) =>
    `${row.path} row ${row.rowIndex}${row.evidenceIds.length > 0 ? ` evidence=${row.evidenceIds.join(",")}` : ""}`
  );
  printNamedCollection("context sources", context.contextSources.slice(0, 12), (source) =>
    `[${source.kind}] ${source.stableId} ${source.path} (${source.reason})`
  );
}

function printPrdScaffoldResult(result: PrdScaffoldResult): void {
  console.log(`docs prd scaffold: wrote ${result.output}`);
  console.log(`  bytes: ${result.bytes}`);
  console.log(`  context sources: ${result.context.counts.contextSources}`);
  console.log(`  open TODOs: ${result.context.counts.openTodos}`);
  console.log(`  prior PRDs: ${result.context.counts.priorPrds}`);
}

function printPrdToRalphJsonResult(result: PrdToRalphJsonPreview, wrote: boolean): void {
  console.log(`docs prd to-ralph-json: ${wrote ? "wrote" : "blocked"} ${result.output}`);
  console.log(`  input: ${result.input}`);
  console.log(`  stories: ${result.storyCount}`);
  console.log(`  bytes: ${result.bytes}`);
  printDiagnostics(result.diagnostics);
}

function printPrdCompletionSyncPreview(result: PrdCompletionSyncPreview): void {
  console.log(`docs prd sync-completion: ${result.mode}`);
  if (result.prd) {
    console.log(`  prd: ${result.prd.path}`);
    console.log(`  completed stories: ${result.prd.completedStoryCount}/${result.prd.storyCount}`);
  }
  console.log(`  dry-run defaulted: ${result.dryRunDefaulted ? "yes" : "no"}`);
  console.log(`  affected docs: ${result.counts.affectedDocs}`);
  console.log(`  open TODO candidates: ${result.counts.openTodoCandidates}`);
  console.log(`  spec update candidates: ${result.counts.specUpdateCandidates}`);
  console.log(`  blocked promotions: ${result.counts.blockedPromotions}`);
  console.log(`  roadmap update candidates: ${result.counts.roadmapUpdateCandidates}`);
  console.log(`  scenario matrix update candidates: ${result.counts.scenarioMatrixUpdateCandidates}`);
  console.log(`  session drift: ${result.counts.sessionDrift}`);
  printNamedCollection("completed stories", result.completedStories, (story) =>
    `${story.id}: ${story.title}${story.evidenceRefs.length > 0 ? ` evidence=${story.evidenceRefs.join(",")}` : ""}`
  );
  printNamedCollection("affected docs", result.affectedDocs.slice(0, 12), (document) =>
    `[${document.kind}] ${document.stableId} ${document.path} (${document.reason})`
  );
  printNamedCollection("open TODO candidates", result.openTodoCandidates, (candidate) =>
    `${candidate.promotionState} ${candidate.text} (${candidate.path} ${candidate.pointer})`
  );
  printNamedCollection("spec update candidates", result.specUpdateCandidates, (candidate) =>
    `${candidate.promotionState} ${candidate.documentId} ${candidate.path}`
  );
  printNamedCollection("roadmap update candidates", result.roadmapUpdateCandidates, (candidate) =>
    `${candidate.documentId} ${candidate.path}`
  );
  printNamedCollection("scenario matrix update candidates", result.scenarioMatrixUpdateCandidates, (candidate) =>
    `${candidate.path}${candidate.rowIndex ? ` row ${candidate.rowIndex}` : ""}${candidate.evidenceIds.length > 0 ? ` evidence=${candidate.evidenceIds.join(",")}` : ""}`
  );
  printDiagnostics([...result.sessionDrift, ...result.diagnostics]);
}

function toPrdToRalphJsonOutput(result: PrdToRalphJsonPreview): object {
  return {
    input: result.input,
    output: result.output,
    bytes: result.bytes,
    storyCount: result.storyCount,
    root: result.root,
    diagnostics: result.diagnostics,
  };
}

function printDriftIssueGroup(
  severity: DocumentDriftSeverity,
  issues: readonly DocumentDriftIssue[],
): void {
  if (issues.length === 0) return;
  console.log("");
  console.log(`${severity}s (${issues.length}):`);
  for (const issue of issues) {
    const pointer = issue.pointer ? ` ${issue.pointer}` : "";
    console.log(`  - [${issue.code}] ${issue.path}${pointer}`);
    console.log(`    ${issue.message}`);
    console.log(`    hint: ${issue.remediation}`);
  }
}

function printFollowUp(followUp: FollowUpState | null): void {
  if (!followUp) {
    console.log("  next follow-up: none");
    return;
  }
  const task = followUp.taskId ? ` ${followUp.taskId}` : "";
  console.log(`  next follow-up: ${followUp.state} ${followUp.kind}${task} - ${followUp.title}`);
  if (followUp.category) console.log(`    category: ${followUp.categoryLabel ?? followUp.category}`);
  console.log(`    source: ${followUp.source} ${followUp.path}`);
  console.log(`    reason: ${followUp.reason}`);
}

function printAdditionalFollowUps(followUps: readonly FollowUpState[]): void {
  const additional = followUps.slice(1, 6);
  if (additional.length === 0) return;
  console.log(`  additional follow-ups (${followUps.length - 1}):`);
  for (const followUp of additional) {
    const category = followUp.categoryLabel ?? followUp.category ?? "uncategorized";
    console.log(`    - [${category}] ${followUp.title} (${followUp.path}${followUp.pointer ? ` ${followUp.pointer}` : ""})`);
  }
  if (followUps.length > 6) {
    console.log(`    ... ${followUps.length - 6} more`);
  }
}

function printCompletedRecords(records: readonly CompletedRecordState[]): void {
  if (records.length === 0) return;
  console.log(`  completed records (${records.length}):`);
  for (const record of records.slice(0, 5)) {
    const paired = record.pairedPath ? ` paired=${record.pairedPath}` : "";
    console.log(`    - [${record.state}] ${record.title} (${record.path}${paired})`);
  }
  if (records.length > 5) {
    console.log(`    ... ${records.length - 5} more`);
  }
}

function printDiagnostics(diagnostics: readonly DocumentDiagnostic[]): void {
  if (diagnostics.length === 0) return;
  console.log(`  diagnostics (${diagnostics.length}):`);
  for (const diagnostic of diagnostics.slice(0, 5)) {
    const path = diagnostic.rawSource?.path ? ` ${diagnostic.rawSource.path}` : "";
    console.log(`    - ${diagnostic.severity} ${diagnostic.code}:${path} ${diagnostic.message}`);
  }
  if (diagnostics.length > 5) {
    console.log(`    ... ${diagnostics.length - 5} more`);
  }
}

function hasErrorDiagnostic(diagnostics: readonly DocumentDiagnostic[]): boolean {
  return diagnostics.some((diagnostic) => diagnostic.severity === "error");
}

function printNamedCollection<T>(
  title: string,
  items: readonly T[],
  lineOf: (item: T) => string,
): void {
  console.log("");
  console.log(`${title} (${items.length}):`);
  for (const item of items) {
    console.log(`  - ${lineOf(item)}`);
  }
}

function printDocsHelp(): void {
  console.log(`qa-sdk docs\n\n${formatHelpSections(HELP_SECTIONS)}`);
}

function printJson(value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
}

function printStructuredError(value: StructuredDocsError, json: boolean): void {
  const text = JSON.stringify(value, null, 2);
  if (json) {
    console.log(text);
    return;
  }
  console.error(text);
}

function getRootDir(): string {
  let current = process.cwd();
  while (true) {
    if (existsSync(join(current, "pnpm-workspace.yaml")) && existsSync(join(current, "docs"))) {
      return current;
    }
    const parent = dirname(current);
    if (parent === current) return process.cwd();
    current = parent;
  }
}

function pickLast(
  flags: Readonly<Record<string, readonly string[]>>,
  name: string,
): string | undefined {
  const values = flags[name];
  return values?.[values.length - 1];
}

function pickAll(
  flags: Readonly<Record<string, readonly string[]>>,
  name: string,
  fallback: readonly string[],
): readonly string[] {
  const values = flags[name];
  return values && values.length > 0 ? values.flatMap(splitCsv) : fallback;
}

function hasFlag(
  flags: Readonly<Record<string, readonly string[]>>,
  name: string,
): boolean {
  return flags[name]?.some((value) => value === "true") ?? false;
}

function splitCsv(value: string): readonly string[] {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function compareDocuments(left: DocumentEnvelope, right: DocumentEnvelope): number {
  return left.path.localeCompare(right.path)
    || left.kind.localeCompare(right.kind)
    || left.stableId.localeCompare(right.stableId);
}

function uniqueDocuments(documents: readonly DocumentEnvelope[]): readonly DocumentEnvelope[] {
  const seen = new Set<string>();
  const uniqueDocs: DocumentEnvelope[] = [];
  for (const document of documents) {
    const key = `${document.adapterId}:${document.stableId}:${document.path}`;
    if (seen.has(key)) continue;
    seen.add(key);
    uniqueDocs.push(document);
  }
  return uniqueDocs;
}

function unique(values: readonly (string | undefined)[]): readonly string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function asStringArray(value: unknown): readonly string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function documentKey(document: DocumentEnvelope): string {
  return `${document.adapterId}:${document.stableId}:${document.path}`;
}

function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .replace(/`([^`]+)`/g, "$1")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titleizeTopic(value: string): string {
  const base = basename(value.replace(/[/\\]+$/, "")) || value;
  const words = base
    .replace(/\.(?:md|json)$/i, "")
    .split(/[-_\s]+/)
    .map((word) => word ? `${word[0]!.toUpperCase()}${word.slice(1)}` : "")
    .filter(Boolean);
  return words.length > 0 ? words.join(" ") : "New PRD";
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeOptionalPath(value: unknown): string | undefined {
  return typeof value === "string" ? normalizePath(value) : undefined;
}

function normalizePath(value: string): string {
  const normalized = value.replaceAll("\\", "/").replace(/\/+/g, "/");
  if (normalized.startsWith("/")) {
    const root = getRootDir();
    const relativePath = relative(root, resolve(normalized));
    return relativePath && !relativePath.startsWith("..")
      ? relativePath.replaceAll("\\", "/")
      : normalized;
  }
  return normalized;
}
