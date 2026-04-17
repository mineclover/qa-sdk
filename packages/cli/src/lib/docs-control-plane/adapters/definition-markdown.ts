import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative } from "node:path";

import {
  extractFrontmatter,
  extractSourceEntriesFromYaml,
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
} from "../normalize.js";
import { matchesDocumentQuery } from "../query.js";
import { classifyTodoHeading, type TodoFollowUpCategory } from "../todo-lifecycle.js";
import type {
  DocumentAdapter,
  DocumentCollectionQuery,
  DocumentDiagnosticInput,
  DocumentEnvelope,
  DocumentLinkInput,
  DocumentMetadata,
  DocumentSectionInput,
  DocumentSourceInput,
} from "../types.js";

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
  const usedStableIds = new Set<string>();

  return parsedDocs
    .map((doc) => {
      const stableId = buildStableId(doc, defIdCounts.get(doc.document.def.id) ?? 0, usedStableIds);
      return buildEnvelope(doc, stableId, diagnosticsByDocId.get(doc.document.def.id) ?? []);
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
): DocumentEnvelope {
  const { def, body } = parsed.document;
  const summary = summarizeDocument(
    def.id,
    def.scope,
    def.aspect,
    def.depth,
    parsed.title,
    body,
  );
  const overview = summary.overview.join("\n\n");
  const todoCategories = parsed.kind === "todo" ? todoFollowUpCategories(body) : [];
  const metadata: DocumentMetadata = {
    defId: def.id,
    title: parsed.title,
    type: def.type ?? "spec",
    ...(def.knowledge_kind ? { knowledgeKind: def.knowledge_kind } : {}),
    level: def.level,
    scope: def.scope,
    aspect: def.aspect,
    depth: def.depth,
    lifecycle: def.lifecycle,
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
  };

  return normalizeDocumentEnvelope({
    adapterId: DEFINITION_MARKDOWN_ADAPTER_ID,
    kind: parsed.kind,
    stableId,
    familyId: parsed.familyId,
    path: parsed.relativePath,
    metadata,
    links: toDocumentLinks(def.id, def.links ?? []),
    sources: toDocumentSources(parsed),
    sections: toDocumentSections(parsed.relativePath, summary.purpose, summary.overview),
    diagnostics: validationIssues.map((issue) => toDocumentDiagnostic(parsed.relativePath, issue)),
    rawSource: {
      path: parsed.relativePath,
      sourceSchema: "definition-frontmatter",
      metadata: {
        defId: def.id,
      },
    },
  });
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
  purpose: string | null,
  overview: readonly string[],
): readonly DocumentSectionInput[] {
  const sections: DocumentSectionInput[] = [];
  if (purpose) {
    sections.push({
      id: "purpose",
      title: "purpose",
      anchor: "^purpose",
      content: purpose,
      order: 0,
      rawSource: { path: sourcePath, pointer: "^purpose" },
    });
  }
  overview.forEach((content, index) => {
    sections.push({
      id: index === 0 ? "overview" : `overview:${index + 1}`,
      title: "overview",
      anchor: "^overview",
      content,
      order: index + 1,
      rawSource: { path: sourcePath, pointer: "^overview" },
    });
  });
  return sections;
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
