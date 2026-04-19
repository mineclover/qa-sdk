// @def.boundary docs-control-plane
// @def.doc docs-control-plane

import { basename, relative, resolve } from "node:path";

import {
  createPrdMarkdownAdapter,
  buildRalphPrdJsonEnvelopeFromContent,
} from "./index.js";
import type {
  DocumentDiagnostic,
  DocumentEnvelope,
  DocumentTask,
} from "doc-envelope";

export interface PrdToRalphJsonOptions {
  readonly rootDir: string;
  readonly inputPath: string;
  readonly outputPath: string;
}

export interface RalphPrdJsonStory {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly acceptanceCriteria: readonly string[];
  readonly priority: number;
  readonly passes: false;
  readonly notes: "";
  readonly dependsOn: readonly string[];
}

export interface RalphPrdJsonRoot {
  readonly name: string;
  readonly branchName: string;
  readonly description: string;
  readonly userStories: readonly RalphPrdJsonStory[];
}

export interface PrdToRalphJsonPreview {
  readonly input: string;
  readonly output: string;
  readonly bytes: number;
  readonly storyCount: number;
  readonly root: RalphPrdJsonRoot | null;
  readonly content: string;
  readonly diagnostics: readonly DocumentDiagnostic[];
  readonly validationDocument: DocumentEnvelope | null;
}

export async function previewPrdToRalphJson(
  options: PrdToRalphJsonOptions,
): Promise<PrdToRalphJsonPreview> {
  const input = toRepoPath(options.rootDir, options.inputPath);
  const output = toRepoPath(options.rootDir, options.outputPath);
  const adapter = createPrdMarkdownAdapter({
    rootDir: options.rootDir,
    paths: [options.inputPath],
  });
  const [prdDocument] = await adapter.listDocuments();
  if (!prdDocument) {
    return {
      input,
      output,
      bytes: 0,
      storyCount: 0,
      root: null,
      content: "",
      diagnostics: [
        diagnostic(input, "prd-to-ralph-json-input-not-found", "error", "PRD markdown input could not be read through the PRD markdown adapter."),
      ],
      validationDocument: null,
    };
  }

  const root = buildRalphJsonRoot(prdDocument);
  const content = `${JSON.stringify(root, null, 2)}\n`;
  const validationDocument = buildRalphPrdJsonEnvelopeFromContent(
    options.rootDir,
    options.outputPath,
    content,
  );
  return {
    input,
    output,
    bytes: Buffer.byteLength(content, "utf8"),
    storyCount: root.userStories.length,
    root,
    content,
    diagnostics: validationDocument.diagnostics,
    validationDocument,
  };
}

function buildRalphJsonRoot(document: DocumentEnvelope): RalphPrdJsonRoot {
  const name = asString(document.metadata.title) ?? titleizePath(document.path);
  const description = asString(document.metadata.overview)
    ?? firstString(document.metadata.goals)
    ?? `Generated from ${document.path}.`;
  const stories = document.tasks.map((task, index) =>
    toRalphStory(task, document.tasks, index)
  );
  return {
    name,
    branchName: `ralph/${slug(stripPrdSuffix(name))}`,
    description,
    userStories: stories,
  };
}

function toRalphStory(
  task: DocumentTask,
  allTasks: readonly DocumentTask[],
  index: number,
): RalphPrdJsonStory {
  const storyIds = allTasks.map((item) => item.id);
  const explicitDependencies = resolveExplicitDependencies(
    asStringArray(task.metadata.prerequisites),
    storyIds,
    index,
  );
  const dependsOn = explicitDependencies.length > 0
    ? explicitDependencies
    : index > 0
      ? [allTasks[index - 1]!.id]
      : [];

  return {
    id: task.id,
    title: task.title,
    description: asString(task.metadata.description) ?? "",
    acceptanceCriteria: unique([
      ...acceptanceCriteriaText(task.metadata.acceptanceCriteria),
      ...asStringArray(task.metadata.qualityGates),
    ]),
    priority: index + 1,
    passes: false,
    notes: "",
    dependsOn,
  };
}

function resolveExplicitDependencies(
  hints: readonly string[],
  storyIds: readonly string[],
  currentIndex: number,
): readonly string[] {
  if (hints.length === 0) return [];
  const previousIds = new Set(storyIds.slice(0, currentIndex).map((id) => id.toLowerCase()));
  const canonicalIds = new Map(storyIds.map((id) => [id.toLowerCase(), id]));
  const matched = new Set<string>();
  for (const hint of hints) {
    for (const token of hint.match(/\b[A-Za-z]+-[A-Za-z0-9_-]+\b/g) ?? []) {
      const canonical = canonicalIds.get(token.toLowerCase());
      if (canonical && previousIds.has(canonical.toLowerCase())) {
        matched.add(canonical);
      }
    }
  }
  return storyIds.slice(0, currentIndex).filter((id) => matched.has(id));
}

function acceptanceCriteriaText(value: unknown): readonly string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === "string") return item.trim();
      if (item && typeof item === "object" && "text" in item && typeof item.text === "string") {
        return item.text.trim();
      }
      return "";
    })
    .filter(Boolean);
}

function diagnostic(
  path: string,
  code: string,
  severity: "error" | "warning",
  message: string,
): DocumentDiagnostic {
  return {
    code,
    severity,
    message,
    rawSource: {
      path,
      metadata: {},
    },
    metadata: {
      source: "prd-to-ralph-json",
    },
  };
}

function toRepoPath(rootDir: string, path: string): string {
  const absolutePath = path.startsWith("/") ? resolve(path) : resolve(rootDir, path);
  const relativePath = relative(rootDir, absolutePath);
  return normalizePath(relativePath && !relativePath.startsWith("..") ? relativePath : path);
}

function normalizePath(value: string): string {
  return value.replaceAll("\\", "/").replace(/\/+/g, "/");
}

function titleizePath(path: string): string {
  const name = basename(path).replace(/\.(?:md|json)$/i, "");
  return name
    .split(/[-_\s]+/)
    .map((part) => part ? `${part[0]!.toUpperCase()}${part.slice(1)}` : "")
    .filter(Boolean)
    .join(" ");
}

function stripPrdSuffix(value: string): string {
  const stripped = value.replace(/\bprd\b/gi, "").replace(/\s+/g, " ").trim();
  return stripped || value;
}

function slug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/`([^`]+)`/g, "$1")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "prd";
}

function unique(values: readonly string[]): readonly string[] {
  return [...new Set(values.filter((value) => value.length > 0))];
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function firstString(value: unknown): string | undefined {
  return Array.isArray(value)
    ? value.find((item): item is string => typeof item === "string" && item.trim().length > 0)?.trim()
    : undefined;
}

function asStringArray(value: unknown): readonly string[] {
  return Array.isArray(value)
    ? value.map((item) => typeof item === "string" ? item.trim() : "").filter(Boolean)
    : [];
}
