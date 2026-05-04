// @def.boundary docs-control-plane
// @def.doc docs-control-plane

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";

import { type CompletedRecordState } from "doc-envelope";
import { detectCompletedRecordsWithRalphIntegration } from "../completed-records-combined.js";
import type {
  DocumentEnvelope,
  DocumentMetadata,
  DocumentSource,
  DocumentTask,
} from "doc-envelope";

export type DocumentDriftSeverity = "error" | "warning" | "info";

export interface DocumentDriftIssue {
  readonly severity: DocumentDriftSeverity;
  readonly code: string;
  readonly message: string;
  readonly path: string;
  readonly pointer?: string;
  readonly remediation: string;
  readonly metadata: DocumentMetadata;
}

export interface DocumentDriftResult {
  readonly scope: {
    readonly prd?: string;
    readonly documents: number;
  };
  readonly counts: {
    readonly total: number;
    readonly error: number;
    readonly warning: number;
    readonly info: number;
  };
  readonly issuesBySeverity: Record<DocumentDriftSeverity, readonly DocumentDriftIssue[]>;
  readonly issues: readonly DocumentDriftIssue[];
}

export interface DetectDocumentDriftOptions {
  readonly rootDir: string;
  readonly prdPath?: string;
  readonly includeTransient?: boolean;
}

interface DriftContext {
  readonly rootDir: string;
  readonly allDocuments: readonly DocumentEnvelope[];
  readonly scopedDocuments: readonly DocumentEnvelope[];
  readonly fileCache: Map<string, string | null>;
  readonly issueKeys: Set<string>;
  readonly issues: DocumentDriftIssue[];
}

interface OpenTodoItem {
  readonly text: string;
  readonly pointer: string;
}

interface ScenarioEvidenceReference {
  readonly id: string;
  readonly link: string;
  readonly testPath: string;
  readonly testTitle: string;
}

const SEVERITIES: readonly DocumentDriftSeverity[] = ["error", "warning", "info"];
const COMPLETE_WORD_RE = /\b(completed?|done|closed|implemented|finished|resolved)\b|완료|닫힘|구현됨|구현됐다/i;
const STOP_WORDS = new Set([
  "and",
  "are",
  "for",
  "from",
  "must",
  "open",
  "pass",
  "passes",
  "should",
  "that",
  "the",
  "this",
  "todo",
  "using",
  "with",
]);

export async function detectDocumentDrift(
  documents: readonly DocumentEnvelope[],
  options: DetectDocumentDriftOptions,
): Promise<DocumentDriftResult> {
  const scopedDocuments = options.prdPath
    ? scopeDocumentsToPrd(documents, options.prdPath)
    : documents;
  const context: DriftContext = {
    rootDir: options.rootDir,
    allDocuments: documents,
    scopedDocuments,
    fileCache: new Map(),
    issueKeys: new Set(),
    issues: [],
  };

  if (options.includeTransient === true) {
    detectRalphSessionDriftDiagnostics(context);
  }
  await detectCompletedRecordCandidates(context);
  detectPrdMarkdownUncheckedAfterJsonComplete(context);
  await detectOpenTodosDescribedAsComplete(context);
  await detectScenarioMatrixTitleDrift(context);
  detectMissingSourceReferences(context);
  detectDefinitionLevelViolations(context);

  const issues = context.issues.toSorted(compareDriftIssues);
  const issuesBySeverity = groupIssuesBySeverity(issues);

  return {
    scope: {
      ...(options.prdPath ? { prd: normalizeRepoPath(options.rootDir, options.prdPath) } : {}),
      documents: scopedDocuments.length,
    },
    counts: {
      total: issues.length,
      error: issuesBySeverity.error.length,
      warning: issuesBySeverity.warning.length,
      info: issuesBySeverity.info.length,
    },
    issuesBySeverity,
    issues,
  };
}

function detectRalphSessionDriftDiagnostics(context: DriftContext): void {
  for (const document of context.scopedDocuments) {
    for (const diagnostic of document.diagnostics) {
      if (!diagnostic.code.startsWith("ralph-session-")) continue;
      addIssue(context, {
        severity: toDriftSeverity(diagnostic.severity),
        code: diagnostic.code,
        message: diagnostic.message,
        path: diagnostic.rawSource?.path ?? document.path,
        ...(diagnostic.rawSource?.pointer ? { pointer: diagnostic.rawSource.pointer } : {}),
        remediation: ralphSessionRemediation(diagnostic.code),
        metadata: {
          ...diagnostic.metadata,
          documentId: document.stableId,
        },
      });
    }
  }
}

function ralphSessionRemediation(code: string): string {
  if (code === "ralph-session-prd-complete-session-running") {
    return "Stop or archive the ralph session, or reopen the PRD JSON story state if work is still active.";
  }
  return "Update the ralph session metadata counts, or rerun the tracker sync so session state matches the PRD JSON story state.";
}

async function detectCompletedRecordCandidates(context: DriftContext): Promise<void> {
  const completedRecords = await detectCompletedRecordsWithRalphIntegration({
    rootDir: context.rootDir,
    documents: context.scopedDocuments,
    readDocument: (document) => readRepoFile(context, document.path),
  });

  for (const record of completedRecords) {
    addIssue(context, {
      severity: "info",
      code: completedRecordDriftCode(record),
      message: completedRecordDriftMessage(record),
      path: record.path,
      remediation: completedRecordRemediation(record),
      metadata: completedRecordMetadata(record),
    });
  }
}

function completedRecordDriftCode(record: CompletedRecordState): string {
  if (record.kind === "todo") return "completed-todo-record-candidate";
  if (record.kind === "prd") return "completed-prd-record-candidate";
  return "completed-record-candidate";
}

function completedRecordDriftMessage(record: CompletedRecordState): string {
  if (record.kind === "todo") {
    return `Completed TODO record candidate: ${record.title}`;
  }
  if (record.kind === "prd") {
    return `Completed PRD markdown record candidate: ${record.title}`;
  }
  return `Completed record candidate: ${record.title}`;
}

function completedRecordRemediation(record: CompletedRecordState): string {
  if (record.kind === "todo") {
    return "Review whether the checked-only TODO should stay as evidence, move to archive, convert to memo, or be promoted through an explicit lifecycle workflow.";
  }
  if (record.kind === "prd") {
    return "Review whether the completed PRD markdown should stay as evidence, move to archive, or feed a separate explicit lifecycle cleanup workflow.";
  }
  return "Review whether the completed record should stay as evidence or be handled by an explicit lifecycle cleanup workflow.";
}

function completedRecordMetadata(record: CompletedRecordState): DocumentMetadata {
  return {
    source: record.source,
    kind: record.kind,
    documentId: record.documentId,
    state: record.state,
    title: record.title,
    reason: record.reason,
    ...(record.lifecycle ? { lifecycle: record.lifecycle } : {}),
    ...(record.completedCount !== undefined ? { completedCount: record.completedCount } : {}),
    ...(record.openCount !== undefined ? { openCount: record.openCount } : {}),
    ...(record.storyCount !== undefined ? { storyCount: record.storyCount } : {}),
    ...(record.passedStoryCount !== undefined ? { passedStoryCount: record.passedStoryCount } : {}),
    ...(record.pairedDocumentId ? { pairedDocumentId: record.pairedDocumentId } : {}),
    ...(record.pairedPath ? { pairedPath: record.pairedPath } : {}),
  };
}

function detectPrdMarkdownUncheckedAfterJsonComplete(context: DriftContext): void {
  const markdownPrds = context.scopedDocuments.filter((document) => document.kind === "prd");
  const prdJsonDocuments = context.scopedDocuments
    .filter((document) => document.kind === "ralph-prd-json")
    .filter(isCompletePrdJsonDocument);

  for (const prdJson of prdJsonDocuments) {
    const prdMarkdown = markdownPrds.find((candidate) =>
      candidate.familyId === prdJson.familyId
      || stripKnownExtension(candidate.path) === stripKnownExtension(prdJson.path)
    );
    if (!prdMarkdown) continue;

    for (const markdownTask of prdMarkdown.tasks) {
      const jsonTask = prdJson.tasks.find((task) => task.id === markdownTask.id);
      if (!jsonTask || jsonTask.metadata.passes !== true) continue;

      const uncheckedCriteria = acceptanceCriteria(markdownTask)
        .filter((criterion) => criterion.checked === false);
      if (uncheckedCriteria.length === 0) continue;

      addIssue(context, {
        severity: "warning",
        code: "prd-markdown-unchecked-after-json-complete",
        message: `PRD JSON ${prdJson.path} is complete but markdown story ${markdownTask.id} still has unchecked acceptance criteria.`,
        path: markdownTask.rawSource?.path ?? prdMarkdown.path,
        ...(markdownTask.rawSource?.pointer ? { pointer: markdownTask.rawSource.pointer } : {}),
        remediation: "Check completed markdown criteria, or set the matching PRD JSON story passes=false until the work is actually complete.",
        metadata: {
          prdJsonPath: prdJson.path,
          prdMarkdownPath: prdMarkdown.path,
          storyId: markdownTask.id,
          uncheckedCriteria: uncheckedCriteria.map((criterion) => criterion.text),
        },
      });
    }
  }
}

async function detectOpenTodosDescribedAsComplete(context: DriftContext): Promise<void> {
  const todoDocuments = context.scopedDocuments.filter((document) => document.kind === "todo");
  for (const todoDocument of todoDocuments) {
    const content = await readRepoFile(context, todoDocument.path);
    if (!content) continue;

    const openTodos = parseOpenTodos(content);
    if (openTodos.length === 0) continue;

    const candidates = completionCandidateDocuments(context, todoDocument);
    for (const item of openTodos) {
      const match = await findCompletedMention(context, item, candidates);
      if (!match) continue;
      addIssue(context, {
        severity: "warning",
        code: "todo-open-described-complete",
        message: `TODO item is still open but related documentation describes it as complete: ${item.text}`,
        path: todoDocument.path,
        pointer: item.pointer,
        remediation: "Check the TODO item, or remove the completed claim from the related spec or PRD notes.",
        metadata: {
          todo: item.text,
          completedInPath: match.document.path,
          completedInDocumentId: match.document.stableId,
          evidence: match.segment,
        },
      });
    }
  }
}

async function detectScenarioMatrixTitleDrift(context: DriftContext): Promise<void> {
  for (const document of context.scopedDocuments) {
    const content = await readRepoFile(context, document.path);
    if (!content || !content.includes("Scenario Matrix") || !/\bE-[A-Z0-9]/.test(content)) continue;

    const evidenceIds = new Set(content.match(/\bE-[A-Z0-9][A-Z0-9_-]*\b/g) ?? []);
    const references = parseScenarioEvidenceReferences(context.rootDir, document.path, content);
    const referencesById = new Map(references.map((reference) => [reference.id, reference]));

    for (const evidenceId of evidenceIds) {
      if (referencesById.has(evidenceId)) continue;
      addIssue(context, {
        severity: "warning",
        code: "scenario-matrix-evidence-reference-missing",
        message: `Scenario matrix evidence id ${evidenceId} has no test title reference.`,
        path: document.path,
        remediation: "Add an Evidence References entry with a concrete test file and test title, or remove the stale E-* marker.",
        metadata: {
          evidenceId,
          documentId: document.stableId,
        },
      });
    }

    for (const reference of references) {
      const testContent = await readRepoFile(context, reference.testPath);
      if (testContent === null) {
        addIssue(context, {
          severity: "error",
          code: "scenario-matrix-test-file-missing",
          message: `Scenario matrix evidence ${reference.id} points to a missing test file: ${reference.testPath}`,
          path: document.path,
          remediation: "Update the Evidence References test file path or restore the missing test file.",
          metadata: {
            evidenceId: reference.id,
            testPath: reference.testPath,
            testTitle: reference.testTitle,
            link: reference.link,
          },
        });
        continue;
      }

      if (!testContent.includes(reference.testTitle)) {
        addIssue(context, {
          severity: "warning",
          code: "scenario-matrix-test-title-missing",
          message: `Scenario matrix evidence ${reference.id} names a test title that no longer exists: ${reference.testTitle}`,
          path: document.path,
          remediation: "Update the Evidence References test title to the current test name, or restore the renamed test.",
          metadata: {
            evidenceId: reference.id,
            testPath: reference.testPath,
            testTitle: reference.testTitle,
            link: reference.link,
          },
        });
      }
    }
  }
}

function detectMissingSourceReferences(context: DriftContext): void {
  for (const document of context.scopedDocuments) {
    for (const source of document.sources) {
      const sourcePath = documentSourcePath(source);
      if (!sourcePath) continue;
      const normalizedPath = normalizeRepoPath(context.rootDir, sourcePath);
      if (existsSync(resolveRepoPath(context.rootDir, normalizedPath))) continue;

      addIssue(context, {
        severity: "error",
        code: "document-source-reference-missing",
        message: `Document source reference points to a missing file: ${normalizedPath}`,
        path: source.rawSource?.path ?? document.path,
        ...(source.rawSource?.pointer ? { pointer: source.rawSource.pointer } : {}),
        remediation: "Create the referenced file, or update/remove the stale source reference in the owning document.",
        metadata: {
          documentId: document.stableId,
          sourceId: source.id,
          sourcePath: normalizedPath,
          sourceLabel: source.label,
        },
      });
    }
  }
}

function detectDefinitionLevelViolations(context: DriftContext): void {
  for (const document of context.scopedDocuments) {
    for (const diagnostic of document.diagnostics) {
      if (diagnostic.code !== "level-violation") continue;
      addIssue(context, {
        severity: toDriftSeverity(diagnostic.severity),
        code: "definition-level-violation",
        message: diagnostic.message,
        path: diagnostic.rawSource?.path ?? document.path,
        ...(diagnostic.rawSource?.pointer ? { pointer: diagnostic.rawSource.pointer } : {}),
        remediation: definitionLevelRemediation(document),
        metadata: {
          ...diagnostic.metadata,
          documentId: document.stableId,
          level: document.metadata.level,
        },
      });
    }
  }
}

function scopeDocumentsToPrd(
  documents: readonly DocumentEnvelope[],
  prdPath: string,
): readonly DocumentEnvelope[] {
  const normalizedPrdPath = normalizePath(prdPath);
  const prdFamilyId = stripKnownExtension(normalizedPrdPath);
  return documents.filter((document) =>
    document.familyId === prdFamilyId
    || document.stableId === prdFamilyId
    || stripKnownExtension(document.path) === prdFamilyId
    || stripKnownExtension(asString(document.metadata.prdPath) ?? "") === prdFamilyId
  );
}

function isCompletePrdJsonDocument(document: DocumentEnvelope): boolean {
  const storyCount = asNumber(document.metadata.storyCount);
  const passedStoryCount = asNumber(document.metadata.passedStoryCount);
  if (storyCount !== undefined && passedStoryCount !== undefined) {
    return storyCount > 0 && storyCount === passedStoryCount;
  }
  return document.tasks.length > 0 && document.tasks.every((task) => task.metadata.passes === true);
}

function acceptanceCriteria(
  task: DocumentTask,
): readonly { readonly text: string; readonly checked?: boolean }[] {
  const rawCriteria = task.metadata.acceptanceCriteria;
  if (!Array.isArray(rawCriteria)) return [];
  return rawCriteria
    .map((criterion) => {
      if (typeof criterion === "string") return { text: criterion };
      if (!isRecord(criterion) || typeof criterion.text !== "string") return null;
      return Object.assign({text:criterion.text}, typeof criterion.checked===`boolean`?{checked:criterion.checked}:{});
    })
    .filter((criterion): criterion is { readonly text: string; readonly checked?: boolean } =>
      criterion !== null && criterion.text.trim().length > 0
    );
}

function parseOpenTodos(content: string): readonly OpenTodoItem[] {
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
    .filter((item): item is OpenTodoItem => item !== null && item.text.length > 0);
}

function completionCandidateDocuments(
  context: DriftContext,
  todoDocument: DocumentEnvelope,
): readonly DocumentEnvelope[] {
  return context.scopedDocuments.filter((document) => {
    if (document === todoDocument) return false;
    if (todoDocument.familyId && document.familyId === todoDocument.familyId) return true;
    return document.kind === "prd" || document.kind === "ralph-prd-json";
  });
}

async function findCompletedMention(
  context: DriftContext,
  item: OpenTodoItem,
  candidates: readonly DocumentEnvelope[],
): Promise<{ readonly document: DocumentEnvelope; readonly segment: string } | null> {
  for (const document of candidates) {
    const content = await candidateCompletionText(context, document);
    const segment = findCompletionSegment(content, item.text);
    if (segment) return { document, segment };
  }
  return null;
}

async function candidateCompletionText(
  context: DriftContext,
  document: DocumentEnvelope,
): Promise<string> {
  const fileContent = await readRepoFile(context, document.path);
  const taskNotes = document.tasks.flatMap((task) => [
    asString(task.metadata.notes),
    asString(task.metadata.completionNotes),
  ]);
  return [
    fileContent,
    asString(document.metadata.notes),
    asString(document.metadata.completionNotes),
    ...taskNotes,
  ].filter((value): value is string => Boolean(value)).join("\n");
}

function findCompletionSegment(content: string, todoText: string): string | null {
  const segments = content.split(/\r?\n/).map((segment) => segment.trim()).filter(Boolean);
  for (const segment of segments) {
    if (describesCompletion(segment, todoText)) return segment;
  }
  return null;
}

function describesCompletion(segment: string, todoText: string): boolean {
  if (!COMPLETE_WORD_RE.test(segment)) return false;

  const normalizedSegment = normalizeSearchText(segment);
  const normalizedTodo = normalizeSearchText(todoText);
  if (normalizedTodo.length >= 12 && normalizedSegment.includes(normalizedTodo)) return true;

  const tokens = significantTokens(todoText);
  if (tokens.length === 0) return false;
  const matched = tokens.filter((token) => normalizedSegment.includes(token)).length;
  return matched >= Math.max(1, Math.ceil(tokens.length * 0.6));
}

function significantTokens(value: string): readonly string[] {
  return normalizeSearchText(value)
    .split(" ")
    .filter((token) => token.length >= 4 && !STOP_WORDS.has(token));
}

function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .replace(/`([^`]+)`/g, "$1")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseScenarioEvidenceReferences(
  rootDir: string,
  documentPath: string,
  content: string,
): readonly ScenarioEvidenceReference[] {
  return [...content.matchAll(
    /^-\s+`(E-[A-Za-z0-9_-]+)`:\s+\[[^\]]+\]\(([^)]+)\)\s+test title\s+`([^`]+)`/gm,
  )].map((match) => {
    const link = match[2]?.trim() ?? "";
    return {
      id: match[1]?.trim() ?? "",
      link,
      testPath: resolveMarkdownLink(rootDir, documentPath, link),
      testTitle: match[3]?.trim() ?? "",
    };
  }).filter((reference) =>
    reference.id.length > 0
    && reference.link.length > 0
    && reference.testTitle.length > 0
  );
}

function documentSourcePath(source: DocumentSource): string | undefined {
  if (source.path) return source.path;
  const labelPath = source.label ? pathLikeReference(source.label) : undefined;
  if (labelPath) return labelPath;
  const metadataValue = asString(source.metadata.value);
  return metadataValue ? pathLikeReference(metadataValue) : undefined;
}

function pathLikeReference(value: string): string | undefined {
  const normalized = value.trim();
  const direct = normalized.match(/^(.+\.(?:c|cc|cpp|css|go|html|java|js|json|jsx|kt|md|py|rb|rs|ts|tsx|txt|yaml|yml))(?:[:#].*)?$/);
  if (direct?.[1]) return direct[1];
  if (normalized.includes("/") || normalized.includes("\\")) return normalized;
  return undefined;
}

async function readRepoFile(
  context: DriftContext,
  path: string,
): Promise<string | null> {
  const repoPath = normalizeRepoPath(context.rootDir, path);
  if (context.fileCache.has(repoPath)) {
    return context.fileCache.get(repoPath) ?? null;
  }

  const resolvedPath = resolveRepoPath(context.rootDir, repoPath);
  try {
    const content = await readFile(resolvedPath, "utf8");
    context.fileCache.set(repoPath, content);
    return content;
  } catch {
    context.fileCache.set(repoPath, null);
    return null;
  }
}

function addIssue(
  context: DriftContext,
  issue: DocumentDriftIssue,
): void {
  const key = [
    issue.severity,
    issue.code,
    issue.path,
    issue.pointer ?? "",
    issue.message,
  ].join("\0");
  if (context.issueKeys.has(key)) return;
  context.issueKeys.add(key);
  context.issues.push(issue);
}

function groupIssuesBySeverity(
  issues: readonly DocumentDriftIssue[],
): Record<DocumentDriftSeverity, readonly DocumentDriftIssue[]> {
  return {
    error: issues.filter((issue) => issue.severity === "error"),
    warning: issues.filter((issue) => issue.severity === "warning"),
    info: issues.filter((issue) => issue.severity === "info"),
  };
}

function compareDriftIssues(left: DocumentDriftIssue, right: DocumentDriftIssue): number {
  return severityRank(left.severity) - severityRank(right.severity)
    || left.path.localeCompare(right.path)
    || (left.pointer ?? "").localeCompare(right.pointer ?? "")
    || left.code.localeCompare(right.code);
}

function severityRank(severity: DocumentDriftSeverity): number {
  const index = SEVERITIES.indexOf(severity);
  return index >= 0 ? index : SEVERITIES.length;
}

function toDriftSeverity(severity: string): DocumentDriftSeverity {
  if (severity === "error" || severity === "warning" || severity === "info") return severity;
  return "warning";
}

function definitionLevelRemediation(document: DocumentEnvelope): string {
  const level = asString(document.metadata.level) ?? "leaf";
  if (level === "group" || level === "module") {
    return "Add a contains link to at least one child document, or change the document level to leaf if it should not own children.";
  }
  return "Remove the contains links from the leaf document, or change its level to module/group if it owns child documents.";
}

function resolveMarkdownLink(rootDir: string, documentPath: string, link: string): string {
  const cleaned = link.split("#")[0]?.trim() ?? link;
  if (/^[a-z]+:\/\//i.test(cleaned)) return cleaned;
  const resolved = isAbsolute(cleaned)
    ? cleaned
    : resolve(rootDir, dirname(normalizePath(documentPath)), cleaned);
  return normalizeRepoPath(rootDir, resolved);
}

function resolveRepoPath(rootDir: string, path: string): string {
  return isAbsolute(path) ? path : resolve(rootDir, path);
}

function normalizeRepoPath(rootDir: string, path: string): string {
  const normalized = normalizePath(path);
  if (!isAbsolute(normalized)) return normalized;
  const relativePath = relative(rootDir, normalized);
  return relativePath && !relativePath.startsWith("..")
    ? normalizePath(relativePath)
    : normalized;
}

function normalizePath(value: string): string {
  return value.replaceAll("\\", "/").replace(/\/+/g, "/");
}

function stripKnownExtension(value: string): string {
  return normalizePath(value).replace(/\.(?:md|json)$/i, "");
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
