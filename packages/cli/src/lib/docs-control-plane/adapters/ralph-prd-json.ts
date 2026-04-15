import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative } from "node:path";

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
  DocumentTaskInput,
} from "../types.js";

export const RALPH_PRD_JSON_ADAPTER_ID = "ralph-prd-json";

export interface RalphPrdJsonAdapterOptions {
  readonly rootDir: string;
  readonly paths?: readonly string[];
  readonly dirs?: readonly string[];
}

export interface RalphPrdJsonSummary {
  readonly path: string;
  readonly storyCount: number;
  readonly passedStoryCount: number;
  readonly allStoriesPassing: boolean;
}

interface ParsedRalphPrdJson {
  readonly root: Record<string, unknown> | null;
  readonly relativePath: string;
  readonly diagnostics: readonly DocumentDiagnosticInput[];
}

const DEFAULT_PRD_JSON_DIRS = ["tasks"];
const IGNORED_DIRS = new Set(["node_modules", "dist", ".git", ".next", ".turbo", "coverage"]);

export function createRalphPrdJsonAdapter(
  options: RalphPrdJsonAdapterOptions,
): DocumentAdapter {
  const rootDir = options.rootDir;
  const dirs = options.dirs ?? DEFAULT_PRD_JSON_DIRS;
  const paths = options.paths;

  return defineDocumentAdapter({
    id: RALPH_PRD_JSON_ADAPTER_ID,
    async listDocuments(query?: DocumentCollectionQuery) {
      const envelopes = await collectRalphPrdJsonEnvelopes(rootDir, dirs, paths);
      return envelopes.filter((envelope) => matchesDocumentQuery(envelope, query));
    },
    async getDocument(stableId: string) {
      const envelopes = await collectRalphPrdJsonEnvelopes(rootDir, dirs, paths);
      return envelopes.find((envelope) => envelope.stableId === stableId)
        ?? envelopes.find((envelope) => envelope.metadata.name === stableId)
        ?? null;
    },
  });
}

export async function readRalphPrdJsonSummary(
  rootDir: string,
  prdPath: string,
): Promise<RalphPrdJsonSummary | null> {
  const filePath = resolvePath(rootDir, prdPath);
  const content = await safeRead(filePath);
  if (content === null) return null;
  const parsed = parseRalphPrdJson(rootDir, filePath, content);
  if (!parsed.root) return null;
  const stories = getStories(parsed.root);
  const passedStoryCount = stories.filter((story) => story.passes === true).length;
  return {
    path: parsed.relativePath,
    storyCount: stories.length,
    passedStoryCount,
    allStoriesPassing: stories.length > 0 && passedStoryCount === stories.length,
  };
}

export function buildRalphPrdJsonEnvelopeFromContent(
  rootDir: string,
  prdPath: string,
  content: string,
): DocumentEnvelope {
  return buildRalphPrdJsonEnvelope(
    parseRalphPrdJson(rootDir, resolvePath(rootDir, prdPath), content),
  );
}

async function collectRalphPrdJsonEnvelopes(
  rootDir: string,
  dirs: readonly string[],
  paths: readonly string[] | undefined,
): Promise<readonly DocumentEnvelope[]> {
  const files = paths
    ? paths.map((path) => resolvePath(rootDir, path))
    : (await Promise.all(dirs.map((dir) => findJsonFiles(resolvePath(rootDir, dir)))))
      .flat()
      .toSorted();

  const envelopes: DocumentEnvelope[] = [];
  for (const filePath of files) {
    const content = await safeRead(filePath);
    if (content === null) continue;
    const parsed = parseRalphPrdJson(rootDir, filePath, content);
    if (!parsed.root && !paths) continue;
    if (parsed.root && !looksLikeRalphPrd(parsed.root) && !paths) continue;
    envelopes.push(buildRalphPrdJsonEnvelope(parsed));
  }
  return envelopes;
}

function parseRalphPrdJson(
  rootDir: string,
  filePath: string,
  content: string,
): ParsedRalphPrdJson {
  const relativePath = toRepoPath(rootDir, filePath);
  const diagnostics: DocumentDiagnosticInput[] = [];
  let value: unknown;
  try {
    value = JSON.parse(content);
  } catch (error) {
    diagnostics.push({
      code: "ralph-prd-json-parse-error",
      severity: "error",
      message: error instanceof Error ? error.message : "Failed to parse ralph PRD JSON.",
      rawSource: {
        path: relativePath,
      },
      metadata: {
        source: RALPH_PRD_JSON_ADAPTER_ID,
      },
    });
    return { root: null, relativePath, diagnostics };
  }

  if (!isRecord(value)) {
    diagnostics.push({
      code: "ralph-prd-json-root-not-object",
      severity: "error",
      message: "Ralph PRD JSON root must be an object.",
      rawSource: {
        path: relativePath,
      },
      metadata: {
        source: RALPH_PRD_JSON_ADAPTER_ID,
      },
    });
    return { root: null, relativePath, diagnostics };
  }

  diagnostics.push(...validateRalphPrdJson(relativePath, value));
  return { root: value, relativePath, diagnostics };
}

function buildRalphPrdJsonEnvelope(
  parsed: ParsedRalphPrdJson,
): DocumentEnvelope {
  const root = parsed.root;
  const familyId = parsed.relativePath.replace(/\.json$/, "");
  const metadata: DocumentMetadata = {
    sourcePath: parsed.relativePath,
    ...(root ? {
      name: pickString(root.name) ?? "",
      branchName: pickString(root.branchName) ?? "",
      description: pickString(root.description) ?? "",
      storyCount: getStories(root).length,
      passedStoryCount: getStories(root).filter((story) => story.passes === true).length,
    } : {}),
  };

  return normalizeDocumentEnvelope({
    adapterId: RALPH_PRD_JSON_ADAPTER_ID,
    kind: "ralph-prd-json",
    stableId: familyId,
    familyId,
    path: parsed.relativePath,
    metadata,
    tasks: root ? getStories(root).map((story, index) => toDocumentTask(parsed.relativePath, story, index)) : [],
    diagnostics: parsed.diagnostics,
    rawSource: {
      path: parsed.relativePath,
      sourceSchema: "ralph-prd-json",
    },
  });
}

function validateRalphPrdJson(
  sourcePath: string,
  root: Record<string, unknown>,
): readonly DocumentDiagnosticInput[] {
  const diagnostics: DocumentDiagnosticInput[] = [];
  for (const field of ["name", "branchName", "description"] as const) {
    if (!pickString(root[field])) {
      diagnostics.push(toDiagnostic(sourcePath, `/${field}`, "ralph-prd-json-missing-root-field", "error", `Ralph PRD JSON root field ${field} must be a non-empty string.`));
    }
  }
  if (!Array.isArray(root.userStories)) {
    diagnostics.push(toDiagnostic(sourcePath, "/userStories", "ralph-prd-json-missing-user-stories", "error", "Ralph PRD JSON root field userStories must be an array."));
  }
  if ("prd" in root) {
    diagnostics.push(toDiagnostic(sourcePath, "/prd", "ralph-prd-json-root-prd", "error", "Ralph PRD JSON must use a flat root, not a root prd object."));
  }
  if ("tasks" in root) {
    diagnostics.push(toDiagnostic(sourcePath, "/tasks", "ralph-prd-json-root-tasks", "error", "Ralph PRD JSON must use userStories, not root tasks."));
  }
  if ("metadata" in root) {
    diagnostics.push(toDiagnostic(sourcePath, "/metadata", "ralph-prd-json-root-metadata", "warning", "Ralph PRD JSON metadata belongs in source-owned story fields or external session state, not root metadata."));
  }

  getStories(root).forEach((story, index) => {
    const pointer = `/userStories/${index}`;
    if ("status" in story) {
      diagnostics.push(toDiagnostic(sourcePath, `${pointer}/status`, "ralph-prd-json-story-status", "warning", "Story status is a schema anti-pattern; use passes plus notes/completionNotes."));
    }
    if ("passes" in story && typeof story.passes !== "boolean") {
      diagnostics.push(toDiagnostic(sourcePath, `${pointer}/passes`, "ralph-prd-json-story-passes-non-boolean", "error", "Story passes must be a boolean when present."));
    }
    if (!("dependsOn" in story)) {
      diagnostics.push(toDiagnostic(sourcePath, `${pointer}/dependsOn`, "ralph-prd-json-story-depends-on-missing", "warning", "Story dependsOn should be explicit, even when empty."));
    } else if (!Array.isArray(story.dependsOn)) {
      diagnostics.push(toDiagnostic(sourcePath, `${pointer}/dependsOn`, "ralph-prd-json-story-depends-on-invalid", "error", "Story dependsOn must be an array of story ids."));
    }
  });

  return diagnostics;
}

function toDocumentTask(
  sourcePath: string,
  story: Record<string, unknown>,
  index: number,
): DocumentTaskInput {
  const id = pickString(story.id) ?? `story:${index + 1}`;
  const acceptanceCriteria = toStringList(story.acceptanceCriteria);
  return {
    id,
    title: pickString(story.title) ?? id,
    rawSource: {
      path: sourcePath,
      pointer: `/userStories/${index}`,
    },
    metadata: {
      description: pickString(story.description) ?? "",
      priority: story.priority,
      passes: story.passes === true,
      dependsOn: toStringList(story.dependsOn),
      notes: pickString(story.notes) ?? "",
      completionNotes: pickString(story.completionNotes) ?? "",
      acceptanceCriteria,
      qualityGates: extractQualityGates(acceptanceCriteria),
      ...(story.status !== undefined ? { storyStatus: story.status } : {}),
      sourceOrder: index,
    },
  };
}

function extractQualityGates(criteria: readonly string[]): readonly string[] {
  return criteria.filter((criterion) =>
    /`[^`]+`/.test(criterion) && /\bpasses\b/i.test(criterion)
  );
}

function looksLikeRalphPrd(root: Record<string, unknown>): boolean {
  return "userStories" in root || "name" in root || "branchName" in root || "prd" in root || "tasks" in root;
}

function getStories(root: Record<string, unknown>): readonly Record<string, unknown>[] {
  if (!Array.isArray(root.userStories)) return [];
  return root.userStories.filter(isRecord);
}

function toDiagnostic(
  sourcePath: string,
  pointer: string,
  code: string,
  severity: "error" | "warning",
  message: string,
): DocumentDiagnosticInput {
  return {
    code,
    severity,
    message,
    rawSource: {
      path: sourcePath,
      pointer,
    },
    metadata: {
      source: RALPH_PRD_JSON_ADAPTER_ID,
    },
  };
}

async function findJsonFiles(dir: string): Promise<string[]> {
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
      if (!IGNORED_DIRS.has(entry.name)) files.push(...await findJsonFiles(fullPath));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".json")) files.push(fullPath);
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

function pickString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function toStringList(value: unknown): readonly string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => typeof item === "string" ? item.trim() : "")
    .filter((item) => item.length > 0);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
