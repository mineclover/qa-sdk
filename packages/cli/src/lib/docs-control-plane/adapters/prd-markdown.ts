import { readdir, readFile, stat } from "node:fs/promises";
import { basename, join, relative } from "node:path";

import {
  defineDocumentAdapter,
  normalizeDocumentEnvelope,
} from "../normalize.js";
import { matchesDocumentQuery } from "../query.js";
import type {
  DocumentAdapter,
  DocumentCollectionQuery,
  DocumentDiagnosticInput,
  DocumentEnvelope,
  DocumentMetadata,
  DocumentSectionInput,
  DocumentTaskInput,
} from "../types.js";

export const PRD_MARKDOWN_ADAPTER_ID = "prd-markdown";

export interface PrdMarkdownAdapterOptions {
  readonly rootDir: string;
  readonly paths?: readonly string[];
  readonly dirs?: readonly string[];
}

interface PrdSection {
  readonly title: string;
  readonly content: string;
  readonly order: number;
}

interface PrdStory {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly acceptanceCriteria: readonly PrdCriterion[];
  readonly order: number;
}

interface PrdCriterion {
  readonly text: string;
  readonly checked?: boolean;
}

const DEFAULT_PRD_DIRS = ["tasks"];
const IGNORED_DIRS = new Set(["node_modules", "dist", ".git", ".next", ".turbo", "coverage"]);
const PRD_BLOCK_RE = /\[PRD\]([\s\S]*?)\[\/PRD\]/i;
const SECTION_TITLES = new Set([
  "overview",
  "goals",
  "quality gates",
  "user stories",
  "functional requirements",
  "non-goals",
  "open questions",
]);

export function createPrdMarkdownAdapter(
  options: PrdMarkdownAdapterOptions,
): DocumentAdapter {
  const rootDir = options.rootDir;
  const dirs = options.dirs ?? DEFAULT_PRD_DIRS;
  const paths = options.paths;

  return defineDocumentAdapter({
    id: PRD_MARKDOWN_ADAPTER_ID,
    async listDocuments(query?: DocumentCollectionQuery) {
      const envelopes = await collectPrdMarkdownEnvelopes(rootDir, dirs, paths);
      return envelopes.filter((envelope) => matchesDocumentQuery(envelope, query));
    },
    async getDocument(stableId: string) {
      const envelopes = await collectPrdMarkdownEnvelopes(rootDir, dirs, paths);
      return envelopes.find((envelope) => envelope.stableId === stableId)
        ?? envelopes.find((envelope) => envelope.metadata.title === stableId)
        ?? null;
    },
  });
}

async function collectPrdMarkdownEnvelopes(
  rootDir: string,
  dirs: readonly string[],
  paths: readonly string[] | undefined,
): Promise<readonly DocumentEnvelope[]> {
  const files = paths
    ? paths.map((path) => resolvePath(rootDir, path))
    : (await Promise.all(dirs.map((dir) => findMarkdownFiles(resolvePath(rootDir, dir)))))
      .flat()
      .toSorted();

  const envelopes: DocumentEnvelope[] = [];
  for (const filePath of files) {
    const content = await safeRead(filePath);
    if (content === null) continue;
    if (!PRD_BLOCK_RE.test(content) && !paths) continue;
    envelopes.push(buildPrdMarkdownEnvelope(rootDir, filePath, content));
  }
  return envelopes;
}

function buildPrdMarkdownEnvelope(
  rootDir: string,
  filePath: string,
  content: string,
): DocumentEnvelope {
  const relativePath = toRepoPath(rootDir, filePath);
  const diagnostics: DocumentDiagnosticInput[] = [];
  const prdBlock = extractPrdBlock(relativePath, content, diagnostics);
  const sections = parseSections(prdBlock);
  const sectionByTitle = new Map(sections.map((section) => [normalizeTitle(section.title), section]));
  const title = prdBlock.match(/^#\s+(?:PRD:\s*)?(.+)/m)?.[1]?.trim() ?? basename(relativePath, ".md");
  const familyId = relativePath.replace(/\.md$/, "");
  const qualityGates = parseList(sectionByTitle.get("quality gates")?.content ?? "");
  const stories = parseStories(sectionByTitle.get("user stories")?.content ?? "");
  const metadata: DocumentMetadata = {
    title,
    sourcePath: relativePath,
    overview: normalizeBlock(sectionByTitle.get("overview")?.content ?? ""),
    goals: parseList(sectionByTitle.get("goals")?.content ?? ""),
    qualityGates,
    functionalRequirements: parseList(sectionByTitle.get("functional requirements")?.content ?? ""),
    nonGoals: parseList(sectionByTitle.get("non-goals")?.content ?? ""),
    openQuestions: parseListOrParagraphs(sectionByTitle.get("open questions")?.content ?? ""),
  };

  return normalizeDocumentEnvelope({
    adapterId: PRD_MARKDOWN_ADAPTER_ID,
    kind: "prd",
    stableId: familyId,
    familyId,
    path: relativePath,
    metadata,
    sections: toDocumentSections(relativePath, sections),
    tasks: stories.map((story) => toDocumentTask(relativePath, story, qualityGates)),
    diagnostics,
    rawSource: {
      path: relativePath,
      sourceSchema: "prd-markdown",
    },
  });
}

function extractPrdBlock(
  sourcePath: string,
  content: string,
  diagnostics: DocumentDiagnosticInput[],
): string {
  const match = content.match(PRD_BLOCK_RE);
  if (!match) {
    diagnostics.push({
      code: "prd-markdown-missing-prd-block",
      severity: "warning",
      message: "PRD markdown should be wrapped in [PRD]...[/PRD].",
      rawSource: {
        path: sourcePath,
        pointer: "[PRD]",
      },
      metadata: {
        source: PRD_MARKDOWN_ADAPTER_ID,
      },
    });
    return content;
  }
  return match[1]?.trim() ?? "";
}

function parseSections(content: string): readonly PrdSection[] {
  const headings = [...content.matchAll(/^##\s+(.+)$/gm)]
    .map((match) => ({
      title: match[1]?.trim() ?? "",
      index: match.index ?? 0,
      endOfHeading: (match.index ?? 0) + match[0].length,
    }))
    .filter((heading) => SECTION_TITLES.has(normalizeTitle(heading.title)));

  return headings.map((heading, index) => {
    const next = headings[index + 1];
    return {
      title: heading.title,
      content: content.slice(heading.endOfHeading, next?.index ?? content.length).trim(),
      order: index,
    };
  });
}

function parseStories(content: string): readonly PrdStory[] {
  const headings = [...content.matchAll(/^###\s+(US-[A-Za-z0-9_-]+)\s*:\s*(.+)$/gm)]
    .map((match) => ({
      id: match[1]?.trim() ?? "",
      title: match[2]?.trim() ?? "",
      index: match.index ?? 0,
      endOfHeading: (match.index ?? 0) + match[0].length,
    }));

  return headings.map((heading, index) => {
    const next = headings[index + 1];
    const block = content.slice(heading.endOfHeading, next?.index ?? content.length).trim();
    return {
      id: heading.id,
      title: heading.title,
      description: parseLabelBlock(block, "Description"),
      acceptanceCriteria: parseAcceptanceCriteria(block),
      order: index,
    };
  });
}

function parseAcceptanceCriteria(block: string): readonly PrdCriterion[] {
  const content = parseLabeledSection(block, "Acceptance Criteria");
  if (!content) return [];
  return content
    .split(/\r?\n/)
    .map((line) => {
      const checkbox = line.match(/^\s*-\s+\[([ xX])\]\s+(.+)$/);
      if (checkbox) {
        return {
          text: checkbox[2]?.trim() ?? "",
          checked: checkbox[1]?.toLowerCase() === "x",
        };
      }
      const bullet = line.match(/^\s*-\s+(.+)$/);
      if (bullet) {
        return {
          text: bullet[1]?.trim() ?? "",
        };
      }
      return null;
    })
    .filter((item): item is PrdCriterion => item !== null && item.text.length > 0);
}

function parseLabelBlock(block: string, label: string): string | undefined {
  const match = block.match(new RegExp(String.raw`\*\*${escapeRegExp(label)}:\*\*\s*(.+)`));
  return match?.[1]?.trim();
}

function parseLabeledSection(block: string, label: string): string {
  const labelRe = new RegExp(String.raw`^\*\*${escapeRegExp(label)}:\*\*\s*$`, "m");
  const match = block.match(labelRe);
  if (!match || match.index === undefined) return "";
  const start = match.index + match[0].length;
  const rest = block.slice(start);
  const nextLabel = rest.search(/^\*\*[^*]+:\*\*\s*$/m);
  return (nextLabel >= 0 ? rest.slice(0, nextLabel) : rest).trim();
}

function toDocumentSections(
  sourcePath: string,
  sections: readonly PrdSection[],
): readonly DocumentSectionInput[] {
  return sections.map((section) => ({
    id: slug(section.title),
    title: section.title,
    content: section.content,
    order: section.order,
    rawSource: {
      path: sourcePath,
      pointer: `## ${section.title}`,
    },
  }));
}

function toDocumentTask(
  sourcePath: string,
  story: PrdStory,
  qualityGates: readonly string[],
): DocumentTaskInput {
  const checkedCriteria = story.acceptanceCriteria.filter((criterion) => criterion.checked === true).length;
  const checkableCriteria = story.acceptanceCriteria.filter((criterion) => criterion.checked !== undefined).length;
  return {
    id: story.id,
    title: story.title,
    rawSource: {
      path: sourcePath,
      pointer: `### ${story.id}`,
    },
    metadata: {
      ...(story.description ? { description: story.description } : {}),
      acceptanceCriteria: story.acceptanceCriteria.map((criterion) => ({ ...criterion })),
      qualityGates: [...qualityGates],
      passes: checkableCriteria > 0 && checkedCriteria === checkableCriteria,
      sourceOrder: story.order,
    },
  };
}

function parseList(content: string): readonly string[] {
  return content
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*-\s+(.+)$/)?.[1]?.trim())
    .filter((line): line is string => Boolean(line));
}

function parseListOrParagraphs(content: string): readonly string[] {
  const list = parseList(content);
  if (list.length > 0) return list;
  const block = normalizeBlock(content);
  return block ? [block] : [];
}

function normalizeBlock(content: string): string {
  return content.trim().replace(/\n{3,}/g, "\n\n");
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

async function safeRead(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, "utf8");
  } catch {
    return null;
  }
}

function resolvePath(rootDir: string, path: string): string {
  return path.startsWith("/") ? path : join(rootDir, path);
}

function toRepoPath(rootDir: string, filePath: string): string {
  return normalizePath(relative(rootDir, filePath));
}

function normalizePath(value: string): string {
  return value.replaceAll("\\", "/").replace(/\/+/g, "/");
}

function normalizeTitle(value: string): string {
  return value.trim().toLowerCase();
}

function slug(value: string): string {
  return normalizeTitle(value).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
