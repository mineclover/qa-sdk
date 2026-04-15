/**
 * qa-sdk docs - cross-document control-plane CLI.
 *
 * `qa-sdk def` remains the definition-catalog primitive surface. This command
 * reads compatible document systems through neutral adapters so maintainers can
 * inspect family state, collect related facts, and search across sources.
 */

import { existsSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

import {
  createArtifactEvidenceAdapter,
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
  type DocumentSource,
  type DocumentTask,
} from "../lib/docs-control-plane/index.js";
import { formatHelpSections, type CommandHelpSectionSpec } from "../command-spec.js";

type DocsCommand = "help" | "status" | "collect" | "search";

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
}

interface SearchResult {
  readonly query: string;
  readonly filters: {
    readonly kinds: readonly string[];
    readonly metadata: DocumentMetadata;
  };
  readonly results: readonly DocumentSummary[];
}

const HELP_SECTIONS: readonly CommandHelpSectionSpec[] = [
  {
    title: "Usage",
    lines: [
      "qa-sdk docs status [doc-id|path] [--json]",
      "qa-sdk docs collect <doc-id|path> [--json]",
      "qa-sdk docs search <query> [--kind <kind>] [--metadata key=value] [--json]",
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

export async function cliDocs(args: string[]): Promise<void> {
  const parsed = parseDocsArgs(args);
  if (parsed.command === "help") {
    printDocsHelp();
    return;
  }

  const options = runtimeOptions(parsed.flags);
  const documents = await collectAllDocuments(createDocsAdapters(options));

  if (parsed.command === "status") {
    await cmdStatus(documents, parsed.positional[0], hasFlag(parsed.flags, "json"));
    return;
  }

  if (parsed.command === "collect") {
    await cmdCollect(documents, parsed.positional[0], hasFlag(parsed.flags, "json"));
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
  if (value === "status" || value === "collect" || value === "search" || value === "help") {
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
      ...(options.prdJsonPath ? { prdJsonPath: options.prdJsonPath } : {}),
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
  target: string | undefined,
  json: boolean,
): Promise<void> {
  const result = buildStatusResult(documents, target);
  if (json) {
    printJson(result);
    return;
  }
  printStatus(result);
}

async function cmdCollect(
  documents: readonly DocumentEnvelope[],
  target: string | undefined,
  json: boolean,
): Promise<void> {
  if (!target) {
    console.error("docs collect requires <doc-id|path>");
    process.exitCode = 1;
    return;
  }

  const result = buildCollectResult(documents, target);
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

function buildStatusResult(
  documents: readonly DocumentEnvelope[],
  target: string | undefined,
): StatusResult {
  const resolved = target ? resolveDocument(documents, target) : undefined;
  const scopedDocuments = resolved
    ? collectRelatedDocuments(documents, resolved.document)
    : documents;
  const diagnostics = scopedDocuments.flatMap((document) => document.diagnostics);

  return {
    ...(target ? { target } : {}),
    ...(resolved ? { document: summarizeDocument(resolved.document) } : {}),
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
  target: string,
): CollectResult {
  const status = buildStatusResult(documents, target);
  const resolved = resolveDocument(documents, target);
  const scopedDocuments = resolved
    ? collectRelatedDocuments(documents, resolved.document)
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
  };
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

function compareResolutionPriority(left: DocumentEnvelope, right: DocumentEnvelope): number {
  return (RESOLUTION_KIND_PRIORITY[left.kind] ?? 50) - (RESOLUTION_KIND_PRIORITY[right.kind] ?? 50)
    || compareDocuments(left, right);
}

function collectRelatedDocuments(
  documents: readonly DocumentEnvelope[],
  document: DocumentEnvelope,
): readonly DocumentEnvelope[] {
  const familyMembers = document.familyId
    ? documents.filter((candidate) => candidate.familyId === document.familyId)
    : [document];
  const identities = new Set(familyMembers.flatMap(documentIdentityValues));
  const paths = new Set(familyMembers.flatMap(documentPathValues));
  const related = documents.filter((candidate) =>
    familyMembers.includes(candidate)
    || candidateMatchesIdentities(candidate, identities, paths)
  );
  return uniqueDocuments(related).toSorted(compareDocuments);
}

function candidateMatchesIdentities(
  candidate: DocumentEnvelope,
  identities: ReadonlySet<string>,
  paths: ReadonlySet<string>,
): boolean {
  if (documentIdentityValues(candidate).some((value) => identities.has(value))) return true;
  if (documentPathValues(candidate).some((value) => paths.has(value))) return true;
  if (candidate.links.some((link) =>
    identities.has(link.sourceId ?? "")
    || identities.has(link.targetId)
  )) return true;
  if (candidate.sources.some((source) =>
    Boolean(source.path && paths.has(normalizePath(source.path)))
    || identities.has(source.label ?? "")
  )) return true;

  const metadataRefs = metadataReferenceValues(candidate.metadata);
  return metadataRefs.some((value) => identities.has(value) || paths.has(normalizePath(value)));
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
  if (result.target && !result.document) {
    console.log(`docs status: ${result.target} not found`);
    return;
  }

  console.log(`docs status: ${result.document?.stableId ?? "workspace"}`);
  if (result.document) {
    console.log(`  kind: ${result.document.kind}`);
    console.log(`  path: ${result.document.path}`);
  }
  if (result.familyId) console.log(`  family: ${result.familyId}`);
  console.log(`  documents: ${result.counts.familyMembers} related / ${result.counts.documents} total`);
  console.log(`  links/sources/tasks/evidence/diagnostics: ${result.counts.links}/${result.counts.sources}/${result.counts.tasks}/${result.counts.evidence}/${result.counts.diagnostics}`);
  printFollowUp(result.nextFollowUp);
  printDiagnostics(result.diagnostics);
}

function printCollect(result: CollectResult): void {
  if (result.target && !result.document) {
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
  for (const item of result.results) {
    console.log(`  - [${item.kind}] ${item.stableId}`);
    console.log(`    path: ${item.path}`);
    if (item.title) console.log(`    title: ${item.title}`);
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
