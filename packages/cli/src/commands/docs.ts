/**
 * qa-sdk docs - cross-document control-plane CLI.
 *
 * `qa-sdk def` remains the definition-catalog primitive surface. This command
 * reads compatible document systems through neutral adapters so maintainers can
 * inspect family state, collect related facts, and search across sources.
 */

import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join, relative, resolve } from "node:path";

import {
  createArtifactEvidenceAdapter,
  buildDocumentGraphIndex,
  BROAD_DOCUMENT_GRAPH_TRAVERSAL_WARNING,
  CANONICAL_TRAVERSAL_AXES,
  collectDocumentGraphTraversalDocuments,
  createDefinitionMarkdownAdapter,
  createPrdMarkdownAdapter,
  createRalphPrdJsonAdapter,
  createRalphSessionAdapter,
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
  isTraversalAxis,
  isTraversalDirection,
  isTraversalPresetId,
  previewPrdCompletionSync,
  TRAVERSAL_DIRECTIONS,
  TRAVERSAL_PRESET_IDS,
  traverseDocumentGraph,
  type DocumentGraphTraversalInput,
  type DocumentGraphTraversalResult,
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

interface FollowUpState {
  readonly source: string;
  readonly kind: string;
  readonly documentId: string;
  readonly path: string;
  readonly state: string;
  readonly title: string;
  readonly taskId?: string;
  readonly reason: string;
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
  readonly diagnostics: readonly DocumentDiagnostic[];
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

interface PrdContextSource {
  readonly kind: string;
  readonly stableId: string;
  readonly path: string;
  readonly title?: string;
  readonly reason: string;
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
      "qa-sdk docs status [doc-id|path] [--json]",
      "qa-sdk docs collect <doc-id|path> [--graph] [--axis <csv>] [--direction out|in|both] [--depth <n>] [--limit <n>] [--preset <name>] [--json]",
      "qa-sdk docs graph <target> [--axis <csv>] [--direction out|in|both] [--depth <n>] [--limit <n>] [--preset <name>] [--json]",
      "qa-sdk docs search <query> [--kind <kind>] [--metadata key=value] [--json]",
      "qa-sdk docs drift [--prd <file>] [--json]",
      "qa-sdk docs prd context <topic|doc-id> [--json]",
      "qa-sdk docs prd scaffold <topic|doc-id> --output <file> [--json]",
      "qa-sdk docs prd to-ralph-json <prd.md> --output <prd.json> [--json]",
      "qa-sdk docs prd sync-completion --prd <prd.json> --dry-run [--json]",
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
      "--axis <csv>                 graph traversal axes: composition, refinement, dependency, constraint, trace, source, evidence, role, context",
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

const CLOSED_TASK_STATES = new Set([
  "done",
  "closed",
  "complete",
  "completed",
  "pass",
  "passed",
  "passing",
  "true",
  "yes",
]);

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
const COLLECT_GRAPH_FLAG_NAMES = new Set(["axis", "direction", "depth", "limit", "preset"]);
const STATUS_TRAVERSAL_AXES = ["role"] as const satisfies readonly TraversalAxis[];
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
    await cmdStatus(documents, options, parsed.positional[0], hasFlag(parsed.flags, "json"));
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
    await cmdDrift(documents, options, hasFlag(parsed.flags, "json"));
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
  json: boolean,
): Promise<void> {
  const result = buildStatusResult(documents, options.rootDir, target);
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

  const result = buildCollectResult(documents, options.rootDir, target, graphInput);
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
  const result = toDocsGraphCliResult(traversal);

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

function isStructuredDocsError(value: unknown): value is StructuredDocsError {
  return Boolean(
    value &&
    typeof value === "object" &&
    "error" in value,
  );
}

function toDocsGraphCliResult(
  result: DocumentGraphTraversalResult,
): DocsGraphCliResult {
  return {
    input: result.input,
    targetResolution: result.targetResolution,
    ...(result.targetNodeId ? { targetNodeId: result.targetNodeId } : {}),
    nodes: result.nodes,
    edges: result.edges,
    paths: result.paths,
    roleGroups: result.roleGroups,
    missingRoles: result.missingRoles,
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
  json: boolean,
): Promise<void> {
  const result = await detectDocumentDrift(documents, {
    rootDir: options.rootDir,
    ...(options.prdPath ? { prdPath: options.prdPath } : {}),
  });

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
    console.error("Usage: qa-sdk docs prd context <topic|doc-id> [--json]");
    console.error("Usage: qa-sdk docs prd scaffold <topic|doc-id> --output <file> [--json]");
    console.error("Usage: qa-sdk docs prd to-ralph-json <prd.md> --output <prd.json> [--json]");
    console.error("Usage: qa-sdk docs prd sync-completion --prd <prd.json> --dry-run [--json]");
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

  const context = await buildPrdAuthoringContext(documents, options.rootDir, target);

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
    output: normalizePath(relative(options.rootDir, outputPath)),
    bytes: Buffer.byteLength(markdown, "utf8"),
    context,
  };

  if (json) {
    printJson(result);
    return;
  }
  printPrdScaffoldResult(result);
}

function buildStatusResult(
  documents: readonly DocumentEnvelope[],
  rootDir: string,
  target: string | undefined,
): StatusResult {
  const resolved = target ? resolveDocument(documents, target) : undefined;
  const resolvedSource = !resolved && target && isPathLikeTarget(target)
    ? resolveSourceTarget(documents, target)
    : undefined;
  const graphScope = resolved
    ? collectGraphScopedDocuments(documents, rootDir, {
      target: statusTraversalTarget(target ?? resolved.document.stableId, resolved),
      axes: STATUS_TRAVERSAL_AXES,
      direction: "both",
      depth: 1,
      includeContext: false,
    })
    : undefined;
  const scopedDocuments = graphScope
    ? graphScope.documents
    : resolvedSource
      ? resolvedSource.documents
      : documents;
  const diagnostics = scopedDocuments.flatMap((document) => document.diagnostics);

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
    nextFollowUp: findNextFollowUp(scopedDocuments),
    diagnostics,
  };
}

function buildCollectResult(
  documents: readonly DocumentEnvelope[],
  rootDir: string,
  target: string,
  graphInput: DocumentGraphTraversalInput | undefined,
): CollectResult {
  const status = buildStatusResult(documents, rootDir, target);
  const resolved = resolveDocument(documents, target);
  const resolvedSource = !resolved && isPathLikeTarget(target)
    ? resolveSourceTarget(documents, target)
    : undefined;
  const graphScope = graphInput
    ? collectGraphScopedDocuments(documents, rootDir, graphInput)
    : resolved
      ? collectGraphScopedDocuments(documents, rootDir, {
        target: collectTraversalTarget(target, resolved),
        preset: "family",
        includeContext: false,
      })
      : undefined;
  const scopedDocuments = graphScope
    ? graphScope.documents
    : resolvedSource
      ? resolvedSource.documents
      : [];

  return {
    ...status,
    familyMembers: scopedDocuments.map(summarizeDocument),
    metadata: scopedDocuments.map((document) => ({
      stableId: document.stableId,
      metadata: document.metadata,
    })),
    links: scopedDocuments.flatMap((document) => document.links),
    sources: scopedDocuments.flatMap((document) => document.sources),
    tasks: scopedDocuments.flatMap((document) => document.tasks),
    evidence: scopedDocuments.flatMap((document) => document.evidence),
    ...(graphScope && graphInput ? { graph: toDocsGraphCliResult(graphScope.traversal) } : {}),
  };
}

async function buildPrdAuthoringContext(
  documents: readonly DocumentEnvelope[],
  rootDir: string,
  target: string,
): Promise<PrdAuthoringContext> {
  const resolved = resolveDocument(documents, target);
  const graphScope = resolved
    ? collectGraphScopedDocuments(documents, rootDir, {
      target: prdContextTraversalTarget(target, resolved),
      axes: PRD_CONTEXT_TRAVERSAL_AXES,
      direction: "both",
      depth: 2,
      includeContext: false,
    })
    : undefined;
  const relatedDocuments = graphScope
    ? graphScope.documents
    : [];
  const topicTokens = prdTopicTokens(target, resolved?.document);
  const topicDocuments = resolved
    ? []
    : documents.filter((document) => matchesPrdTopic(document, target, topicTokens));
  const scopedDocuments = uniqueDocuments([...relatedDocuments, ...topicDocuments])
    .toSorted(compareDocuments);
  const relatedKeys = new Set(relatedDocuments.map(documentKey));
  const topicKeys = new Set(topicDocuments.map(documentKey));
  const openTodos = await collectPrdOpenTodos(rootDir, scopedDocuments);
  const scenarioMatrixRows = await collectScenarioMatrixRows(rootDir, scopedDocuments);
  const sources = scopedDocuments.flatMap((document) => document.sources.map((source) =>
    toPrdContextSourceRef(document, source)
  ));
  const evidence = scopedDocuments.flatMap((document) => document.evidence.map((item) =>
    toPrdContextEvidence(document, item)
  ));
  const diagnostics = scopedDocuments.flatMap((document) => document.diagnostics);
  const relatedSpecs = scopedDocuments
    .filter((document) => document.kind === "spec")
    .map(summarizePrdContextDocument);
  const plans = scopedDocuments
    .filter((document) => document.kind === "plan")
    .map(summarizePrdContextDocument);
  const priorPrds = scopedDocuments
    .filter((document) => document.kind === "prd")
    .map(summarizePrdContextDocument);
  const prdJsonCompletion = scopedDocuments
    .filter((document) => document.kind === "ralph-prd-json")
    .map(toPrdJsonCompletionState);
  const ralphSessionState = scopedDocuments
    .filter((document) => document.kind === "ralph-session")
    .map(toRalphSessionContextState);
  const contextSources = scopedDocuments.map((document) =>
    toPrdContextSource(
      document,
      resolved?.document,
      relatedKeys,
      topicKeys,
      graphScope?.reasonByDocumentKey,
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

function toPrdContextSource(
  document: DocumentEnvelope,
  resolvedTarget: DocumentEnvelope | undefined,
  relatedKeys: ReadonlySet<string>,
  topicKeys: ReadonlySet<string>,
  graphReasons: ReadonlyMap<string, string> | undefined,
): PrdContextSource {
  const summary = summarizeDocument(document);
  const key = documentKey(document);
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
  };
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

function findNextFollowUp(
  documents: readonly DocumentEnvelope[],
): FollowUpState | null {
  const sessionFollowUp = documents
    .flatMap((document) => document.diagnostics.map((diagnostic) => ({ document, diagnostic })))
    .find(({ diagnostic }) => diagnostic.code === "ralph-session-prd-complete-session-running");
  if (sessionFollowUp) {
    return {
      source: sessionFollowUp.document.adapterId,
      kind: sessionFollowUp.document.kind,
      documentId: sessionFollowUp.document.stableId,
      path: sessionFollowUp.document.path,
      state: String(sessionFollowUp.document.metadata.status ?? "running"),
      title: "Ralph session follow-up",
      reason: sessionFollowUp.diagnostic.message,
    };
  }

  for (const document of documents) {
    const openTask = document.tasks.find(isOpenTask);
    if (!openTask) continue;
    return {
      source: document.adapterId,
      kind: document.kind,
      documentId: document.stableId,
      path: document.path,
      taskId: openTask.id,
      state: taskState(openTask),
      title: openTask.title,
      reason: "open task state",
    };
  }

  const todo = documents.find((document) => document.kind === "todo");
  if (todo) {
    return {
      source: todo.adapterId,
      kind: todo.kind,
      documentId: todo.stableId,
      path: todo.path,
      state: String(todo.metadata.lifecycle ?? "todo"),
      title: titleOf(todo),
      reason: "todo family member present",
    };
  }

  return null;
}

function isOpenTask(task: DocumentTask): boolean {
  const state = taskState(task);
  return !CLOSED_TASK_STATES.has(state.toLowerCase());
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
  printDiagnostics(result.diagnostics);
}

function printCollect(result: CollectResult): void {
  if (result.target && !result.document && !result.sourceTarget) {
    console.log(`docs collect: ${result.target} not found`);
    return;
  }

  printStatus(result);
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
  for (const warning of graphTextWarnings(result)) {
    console.log(`  ${warning}`);
  }
  console.log(`  node count: ${result.counts.nodes}`);
  console.log(`  edge count: ${result.counts.edges}`);
  console.log(`  truncated: ${result.truncated ? "yes" : "no"}${formatOmittedCounts(result)}`);

  console.log("");
  console.log(`nodes (${result.nodes.length}):`);
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

function graphTextWarnings(result: DocsGraphCliResult): readonly string[] {
  const warnings = result.diagnostics.filter(isGraphWarningDiagnostic);
  if (warnings.length > 0) return warnings;
  if (result.input.axes.includes("context")) return [BROAD_DOCUMENT_GRAPH_TRAVERSAL_WARNING];
  return [];
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
  console.log(`    source: ${followUp.source} ${followUp.path}`);
  console.log(`    reason: ${followUp.reason}`);
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
