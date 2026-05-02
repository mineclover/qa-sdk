// @def.boundary docs-control-plane
// @def.doc docs-control-plane

import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative } from "node:path";

import {
  extractFrontmatter,
  collectCodeReferences,
  extractSourceEntriesFromYaml,
  findMarkedSections,
  parseCodeReferenceTarget,
  parseDocument,
  parseYaml,
  scanAndBuild,
  summarizeDocument,
  validateGraph,
  type ParsedDocument,
  type ValidationIssue,
} from "definition-catalog";

import {
  defineDocumentAdapter,
  normalizeDocumentEnvelope,
} from "doc-envelope";
import { matchesDocumentQuery } from "doc-envelope";
import { classifyTodoHeading, type TodoFollowUpCategory } from "doc-envelope";
import type {
  DocumentAdapter,
  DocumentCollectionQuery,
  DocumentDiagnosticInput,
  DocumentEnvelope,
  DocumentLinkInput,
  DocumentMetadata,
  DocumentSectionInput,
  DocumentSourceInput,
} from "doc-envelope";
import {
  extractBddDocumentMetadata,
  hasBddMetadata,
  type BddContractDiagnostic,
} from "../bdd-contract-extract.js";
import {
  extractWorkTopicDocumentMetadata,
  hasWorkTopicMetadata,
  type WorkTopicDiagnostic,
} from "../work-topic-extract.js";

export const DEFINITION_MARKDOWN_ADAPTER_ID = "definition-markdown";

export interface DefinitionMarkdownAdapterOptions {
  readonly rootDir: string;
  readonly docsDirs?: readonly string[];
}

type DefinitionMarkdownKind =
  | "spec"
  | "todo"
  | "plan"
  | "test"
  | "cases"
  | "memo"
  | "rule"
  | "definition";

interface ParsedDefinitionMarkdown {
  readonly document: ParsedDocument;
  readonly relativePath: string;
  readonly title: string;
  readonly kind: DefinitionMarkdownKind;
  readonly familyId: string;
  readonly sourceEntries: readonly string[];
}

const FAMILY_EXTENSION_RE = /\.(spec|todo|plan|test|cases|memo|rule)\.md$/;
const IGNORED_DIRS = new Set(["node_modules", "dist", ".git", ".next", ".turbo", "coverage"]);
const KIND_PRIORITY: Record<DefinitionMarkdownKind, number> = {
  spec: 0,
  rule: 1,
  cases: 2,
  test: 3,
  memo: 4,
  plan: 5,
  todo: 6,
  definition: 7,
};

export function createDefinitionMarkdownAdapter(
  options: DefinitionMarkdownAdapterOptions,
): DocumentAdapter {
  const rootDir = options.rootDir;
  const docsDirs = options.docsDirs ?? ["docs"];

  return defineDocumentAdapter({
    id: DEFINITION_MARKDOWN_ADAPTER_ID,
    async listDocuments(query?: DocumentCollectionQuery) {
      const envelopes = await collectDefinitionMarkdownEnvelopes(rootDir, docsDirs);
      return envelopes.filter((envelope) => matchesDocumentQuery(envelope, query));
    },
    async getDocument(stableId: string) {
      const envelopes = await collectDefinitionMarkdownEnvelopes(rootDir, docsDirs);
      return envelopes.find((envelope) => envelope.stableId === stableId)
        ?? resolveByDefId(envelopes, stableId)
        ?? null;
    },
  });
}

async function collectDefinitionMarkdownEnvelopes(
  rootDir: string,
  docsDirs: readonly string[],
): Promise<readonly DocumentEnvelope[]> {
  const resolvedDocsDirs = docsDirs.map((dir) => resolveDocsDir(rootDir, dir));
  const [scanResult, parsedDocs] = await Promise.all([
    scanAndBuild(rootDir, resolvedDocsDirs),
    collectParsedDefinitionMarkdown(rootDir, resolvedDocsDirs),
  ]);
  const validation = validateGraph(scanResult.registry);
  const diagnosticsByDocId = groupValidationIssuesByDocId(validation.issues);
  const defIdCounts = countBy(parsedDocs, (doc) => doc.document.def.id);
  const codeCommentSourcesByDocId = collectCodeCommentSourcesByDocId(rootDir);
  const usedStableIds = new Set<string>();

  return parsedDocs
    .map((doc) => {
      const stableId = buildStableId(doc, defIdCounts.get(doc.document.def.id) ?? 0, usedStableIds);
      return buildEnvelope(
        doc,
        stableId,
        diagnosticsByDocId.get(doc.document.def.id) ?? [],
        codeCommentSourcesByDocId.get(doc.document.def.id) ?? [],
      );
    })
    .filter((envelope): envelope is DocumentEnvelope => envelope !== null);
}

async function collectParsedDefinitionMarkdown(
  rootDir: string,
  docsDirs: readonly string[],
): Promise<readonly ParsedDefinitionMarkdown[]> {
  const files = (
    await Promise.all(docsDirs.map((dir) => findMarkdownFiles(dir)))
  ).flat().toSorted(comparePathByFamilyPriority);
  const parsedDocs: ParsedDefinitionMarkdown[] = [];

  for (const filePath of files) {
    const content = await readFile(filePath, "utf8");
    const frontmatter = extractFrontmatter(content);
    if (!frontmatter) continue;

    const yamlObject = parseYaml(frontmatter.yaml);
    if (!isRecord(yamlObject.def)) continue;

    try {
      const document = parseDocument(content, filePath);
      const relativePath = toRepoPath(rootDir, filePath);
      parsedDocs.push({
        document,
        relativePath,
        title: frontmatter.body.match(/^#\s+(.+)/m)?.[1] ?? document.def.id,
        kind: detectKind(relativePath),
        familyId: detectFamilyId(relativePath, yamlObject),
        sourceEntries: extractSourceEntriesFromYaml(frontmatter.yaml),
      });
    } catch {
      // scanAndBuild owns parse diagnostics for invalid definition frontmatter.
    }
  }

  return parsedDocs;
}

async function findMarkdownFiles(dir: string): Promise<string[]> {
  let dirStat;
  try {
    dirStat = await stat(dir);
  } catch {
    return [];
  }
  if (!dirStat.isDirectory()) return [];

  const files: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!IGNORED_DIRS.has(entry.name)) files.push(...await findMarkdownFiles(fullPath));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".md")) files.push(fullPath);
  }

  return files;
}

function buildEnvelope(
  parsed: ParsedDefinitionMarkdown,
  stableId: string,
  validationIssues: readonly ValidationIssue[],
  codeCommentSources: readonly DocumentSourceInput[],
): DocumentEnvelope {
  const { def, body } = parsed.document;
  const summary = summarizeDocument(
    def.id,
    def.scope ?? "",
    def.aspect ?? "",
    def.depth ?? "",
    parsed.title,
    body,
  );
  const overview = summary.overview.join("\n\n");
  const todoCategories = parsed.kind === "todo" ? todoFollowUpCategories(body) : [];
  const bddMetadata = parsed.kind === "cases" || parsed.kind === "test"
    ? extractBddDocumentMetadata(parsed.relativePath, body)
    : undefined;
  const workTopicMetadata = extractWorkTopicDocumentMetadata(parsed.relativePath, body);
  const allowsWorkTopic = parsed.kind === "plan" || parsed.kind === "todo";
  // 필드 소유권은 `docs/specs/definition-catalog/doc-metadata-field-ownership.rule.md` 참조.
  // scope/aspect/depth/layer/svc/address/version/revision은 현재 decision 비소비 —
  // frontmatter round-trip writer + docs status --json API surface 유지를 위해 passthrough.
  // 새 해석자는 def.* 네임스페이스에 직접 추가 금지. 해석자 namespace(B단계) 경로 사용.
  const metadata: DocumentMetadata = {
    defId: def.id,
    title: parsed.title,
    type: def.type ?? "spec",
    ...(def.knowledge_kind ? { knowledgeKind: def.knowledge_kind } : {}),
    ...(def.tier ? { tier: def.tier } : {}),
    level: def.level,
    scope: def.scope,
    aspect: def.aspect,
    depth: def.depth,
    lifecycle: def.lifecycle,
    ...(def.owner_system ? { ownerSystem: def.owner_system } : {}),
    ...(def.layer ? { layer: def.layer } : {}),
    tags: [...(def.tags ?? [])],
    ...(def.svc ? { svc: def.svc } : {}),
    ...(def.address ? { address: def.address } : {}),
    ...(def.version ? { version: def.version } : {}),
    ...(def.revision !== undefined ? { revision: def.revision } : {}),
    sourcePath: parsed.relativePath,
    documentKind: parsed.kind,
    ...(todoCategories.length > 0
      ? {
        followUpCategory: todoCategories[0],
        followUpCategories: todoCategories,
      }
      : {}),
    ...(summary.purpose ? { purpose: summary.purpose } : {}),
    ...(overview ? { overview } : {}),
    ...(bddMetadata && hasBddMetadata(bddMetadata) ? { bdd: bddMetadata } : {}),
    ...(allowsWorkTopic && hasWorkTopicMetadata(workTopicMetadata) ? { workTopic: workTopicMetadata } : {}),
  };

  return normalizeDocumentEnvelope({
    adapterId: DEFINITION_MARKDOWN_ADAPTER_ID,
    kind: parsed.kind,
    stableId,
    familyId: parsed.familyId,
    path: parsed.relativePath,
    metadata,
    links: toDocumentLinks(def.id, def.links ?? []),
    sources: [
      ...toDocumentSources(parsed),
      ...codeCommentSources,
    ],
    sections: toDocumentSections(parsed.relativePath, body),
    diagnostics: [
      ...validationIssues.map((issue) => toDocumentDiagnostic(parsed.relativePath, issue)),
      ...(bddMetadata?.diagnostics ?? []).map(toDocumentBddDiagnostic),
      ...workTopicMetadata.diagnostics.map(toDocumentWorkTopicDiagnostic),
      ...(!allowsWorkTopic && hasWorkTopicMetadata(workTopicMetadata)
        ? [toDocumentWorkTopicKindDiagnostic(parsed.relativePath, parsed.kind)]
        : []),
    ],
    rawSource: {
      path: parsed.relativePath,
      sourceSchema: "definition-frontmatter",
      metadata: {
        defId: def.id,
      },
    },
  });
}

function collectCodeCommentSourcesByDocId(rootDir: string): ReadonlyMap<string, readonly DocumentSourceInput[]> {
  const grouped = new Map<string, DocumentSourceInput[]>();
  for (const ref of collectCodeReferences(rootDir).filter((item) => item.sourceKind === "code_comment")) {
    const sources = grouped.get(ref.docId) ?? [];
    sources.push({
      id: `code-comment:${sources.length + 1}`,
      path: ref.codePath,
      ...(ref.symbol ? { label: ref.symbol } : {}),
      rawSource: {
        path: ref.codePath,
        ...(ref.line ? { pointer: `line ${ref.line}` } : {}),
        sourceSchema: "code-comment",
      },
      metadata: {
        value: ref.symbol ? `${ref.codePath}:${ref.symbol}` : ref.codePath,
        sourceKind: "code_comment",
        relationType: ref.relationType,
        ...(ref.line ? { line: ref.line } : {}),
        ...(ref.symbol ? { symbol: ref.symbol } : {}),
      },
    });
    grouped.set(ref.docId, sources);
  }
  return grouped;
}

function toDocumentBddDiagnostic(
  diagnostic: BddContractDiagnostic,
): DocumentDiagnosticInput {
  return {
    code: diagnostic.code,
    severity: diagnostic.severity,
    message: diagnostic.message,
    rawSource: {
      path: diagnostic.sourcePath,
      pointer: diagnostic.pointer,
      sourceSchema: "bdd-contract",
    },
    metadata: {
      source: "bdd-contract",
      ...(diagnostic.contractId ? { contractId: diagnostic.contractId } : {}),
      ...(diagnostic.metadata ?? {}),
    },
  };
}

function toDocumentWorkTopicDiagnostic(
  diagnostic: WorkTopicDiagnostic,
): DocumentDiagnosticInput {
  return {
    code: diagnostic.code,
    severity: diagnostic.severity,
    message: diagnostic.message,
    rawSource: {
      path: diagnostic.sourcePath,
      pointer: diagnostic.pointer,
      sourceSchema: "work-topic",
    },
    ...(diagnostic.metadata ? { metadata: diagnostic.metadata } : {}),
  };
}

function toDocumentWorkTopicKindDiagnostic(
  sourcePath: string,
  kind: DefinitionMarkdownKind,
): DocumentDiagnosticInput {
  return {
    code: "work-topic-invalid-document-kind",
    severity: "warning",
    message: `work_topic blocks are consumed only from plan or todo documents, not ${kind}.`,
    rawSource: {
      path: sourcePath,
      pointer: "work-topic",
      sourceSchema: "work-topic",
    },
    metadata: {
      documentKind: kind,
    },
  };
}

function toDocumentLinks(
  sourceId: string,
  links: readonly { readonly target: string; readonly type: string }[],
): readonly DocumentLinkInput[] {
  return links.map((link) => ({
    sourceId,
    targetId: link.target,
    type: link.type,
    metadata: {},
  }));
}

function toDocumentSources(parsed: ParsedDefinitionMarkdown): readonly DocumentSourceInput[] {
  return parsed.sourceEntries.map((entry, index) => {
    const target = parseCodeReferenceTarget(entry);
    return {
      id: `source:${index + 1}`,
      ...(target ? { path: target.codePath } : {}),
      ...(target?.symbol ? { label: target.symbol } : !target ? { label: entry } : {}),
      rawSource: {
        path: parsed.relativePath,
        pointer: "frontmatter.source",
      },
      metadata: {
        value: entry,
        sourceKind: "doc_frontmatter",
        ...(target?.symbol ? { symbol: target.symbol } : {}),
      },
    };
  });
}

function toDocumentSections(
  sourcePath: string,
  body: string,
): readonly DocumentSectionInput[] {
  const sections = [
    ...extractMarkedSections(sourcePath, body),
    ...extractHeadingSections(sourcePath, body),
  ].toSorted((left, right) => left.order - right.order);

  return sections.map((section, index) => ({
    ...section,
    order: index,
  }));
}

function extractMarkedSections(
  sourcePath: string,
  body: string,
): readonly (DocumentSectionInput & { readonly order: number })[] {
  const counts = new Map<string, number>();

  return findMarkedSections(body)
    .filter((section) => section.level > 0 && isTrackedMarker(section.marker))
    .map((section) => {
      const count = (counts.get(section.marker) ?? 0) + 1;
      counts.set(section.marker, count);
      return {
        id: count === 1 ? section.marker : `${section.marker}:${count}`,
        title: stripHeadingPrefix(section.header) || section.marker,
        anchor: `^${section.marker}`,
        content: section.body,
        order: section.line,
        rawSource: { path: sourcePath, pointer: `^${section.marker}` },
        metadata: sectionReferenceMetadata(section.body, section.marker),
      } satisfies DocumentSectionInput & { readonly order: number };
    });
}

function extractHeadingSections(
  sourcePath: string,
  body: string,
): readonly (DocumentSectionInput & { readonly order: number })[] {
  const counts = new Map<string, number>();

  return findHeadingSections(body, ["Scenario Matrix"])
    .map((section) => {
      const sectionId = slug(section.title);
      const count = (counts.get(sectionId) ?? 0) + 1;
      counts.set(sectionId, count);
      return {
        id: count === 1 ? sectionId : `${sectionId}:${count}`,
        title: section.title,
        anchor: sectionId,
        content: section.content,
        order: section.line,
        rawSource: { path: sourcePath, pointer: `## ${section.title}` },
        metadata: sectionReferenceMetadata(section.content, sectionId),
      } satisfies DocumentSectionInput & { readonly order: number };
    });
}

function isTrackedMarker(marker: string): boolean {
  return marker === "purpose" || marker === "overview" || marker === "constraint";
}

function stripHeadingPrefix(value: string): string {
  return value.replace(/^#{1,6}\s*/, "").trim();
}

function sectionReferenceMetadata(
  content: string,
  sectionKind: string,
): DocumentMetadata {
  const evidenceIds = unique(content.match(/\bE-[A-Za-z0-9][A-Za-z0-9_-]*\b/g) ?? []);
  const sourceRefs = unique(
    (
      content.match(/[A-Za-z0-9._/-]+\.(?:c|cc|cpp|css|go|html|java|js|json|jsx|kt|md|py|rb|rs|ts|tsx|txt|yaml|yml)(?::[A-Za-z0-9_$.-]+)?/g)
      ?? []
    ).map(stripSourceSymbol),
  );
  return {
    sectionKind,
    ...(sourceRefs.length > 0 ? { sourceRefs } : {}),
    ...(evidenceIds.length > 0 ? { evidenceIds } : {}),
  };
}

function stripSourceSymbol(value: string): string {
  return value.replace(/[:#][A-Za-z0-9_$.-]+$/, "");
}

function findHeadingSections(
  content: string,
  titles: readonly string[],
): readonly { readonly title: string; readonly content: string; readonly line: number }[] {
  const headings = [...content.matchAll(/^(#{2,6})\s+(.+?)\s*$/gm)]
    .map((match) => ({
      title: match[2]?.trim() ?? "",
      index: match.index ?? 0,
      endOfHeading: (match.index ?? 0) + match[0].length,
      line: countLinesBefore(content, match.index ?? 0),
    }))
    .filter((heading) => titles.some((title) => title.toLowerCase() === heading.title.toLowerCase()));

  return headings.map((heading, index) => {
    const next = headings[index + 1];
    return {
      title: heading.title,
      content: content.slice(heading.endOfHeading, next?.index ?? content.length).trim(),
      line: heading.line,
    };
  });
}

function countLinesBefore(content: string, index: number): number {
  let lines = 0;
  for (let position = 0; position < index; position += 1) {
    if (content[position] === "\n") lines += 1;
  }
  return lines;
}

function slug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function unique(values: readonly string[]): readonly string[] {
  return [...new Set(values.filter((value) => value.length > 0))];
}

function todoFollowUpCategories(body: string): readonly TodoFollowUpCategory[] {
  const categories = new Set<TodoFollowUpCategory>();
  let currentCategory = classifyTodoHeading("").category;
  for (const line of body.split(/\r?\n/)) {
    const heading = line.match(/^(#{2,6})\s+(.+?)\s*$/);
    if (heading) {
      const classified = classifyTodoHeading(heading[2]?.trim() ?? "");
      if (classified.category !== "uncategorized") {
        currentCategory = classified.category;
      }
      continue;
    }
    if (/^\s*[-*]\s+\[\s\]\s+/.test(line)) {
      categories.add(currentCategory);
    }
  }
  return [...categories];
}

function toDocumentDiagnostic(
  sourcePath: string,
  issue: ValidationIssue,
): DocumentDiagnosticInput {
  return {
    code: issue.type,
    severity: issue.severity,
    message: issue.message,
    rawSource: {
      path: sourcePath,
      pointer: "definition-catalog.validateGraph",
    },
    metadata: {
      docId: issue.docId,
      source: "definition-catalog",
    },
  };
}

function groupValidationIssuesByDocId(
  issues: readonly ValidationIssue[],
): Map<string, readonly ValidationIssue[]> {
  const grouped = new Map<string, ValidationIssue[]>();
  for (const issue of issues) {
    const items = grouped.get(issue.docId) ?? [];
    items.push(issue);
    grouped.set(issue.docId, items);
  }
  return grouped;
}

function buildStableId(
  parsed: ParsedDefinitionMarkdown,
  defIdCount: number,
  usedStableIds: Set<string>,
): string {
  const candidates = defIdCount <= 1
    ? [parsed.document.def.id, `${parsed.document.def.id}:${parsed.kind}`, `${parsed.document.def.id}:${parsed.relativePath}`]
    : [`${parsed.document.def.id}:${parsed.kind}`, `${parsed.document.def.id}:${parsed.relativePath}`];

  for (const candidate of candidates) {
    if (!usedStableIds.has(candidate)) {
      usedStableIds.add(candidate);
      return candidate;
    }
  }

  const fallback = `${parsed.document.def.id}:${parsed.relativePath}:${usedStableIds.size}`;
  usedStableIds.add(fallback);
  return fallback;
}

function detectFamilyId(
  relativePath: string,
  yamlObject: Record<string, unknown>,
): string {
  const def = isRecord(yamlObject.def) ? yamlObject.def : {};
  return pickString(def.familyId)
    ?? pickString(def.family_id)
    ?? pickString(yamlObject.familyId)
    ?? pickString(yamlObject.family_id)
    ?? relativePath.replace(FAMILY_EXTENSION_RE, "").replace(/\.md$/, "");
}

function detectKind(relativePath: string): DefinitionMarkdownKind {
  const match = relativePath.match(FAMILY_EXTENSION_RE);
  return match ? match[1] as DefinitionMarkdownKind : "definition";
}

function comparePathByFamilyPriority(left: string, right: string): number {
  const leftKind = detectKind(normalizePath(left));
  const rightKind = detectKind(normalizePath(right));
  return KIND_PRIORITY[leftKind] - KIND_PRIORITY[rightKind] || left.localeCompare(right);
}

function resolveByDefId(
  envelopes: readonly DocumentEnvelope[],
  defId: string,
): DocumentEnvelope | null {
  const matches = envelopes.filter((envelope) => envelope.metadata.defId === defId);
  if (matches.length === 0) return null;
  return matches.find((envelope) => envelope.kind === "spec") ?? matches[0] ?? null;
}

function countBy<T>(items: readonly T[], keyOf: (item: T) => string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = keyOf(item);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function resolveDocsDir(rootDir: string, dir: string): string {
  return dir.startsWith("/") ? dir : join(rootDir, dir);
}

function toRepoPath(rootDir: string, filePath: string): string {
  return normalizePath(relative(rootDir, filePath));
}

function normalizePath(value: string): string {
  return value.replaceAll("\\", "/").replace(/\/+/g, "/");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pickString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}
