// @def.boundary docs-control-plane
// @def.doc docs-control-plane

import { readFile, readdir, stat } from "node:fs/promises";
import { basename, extname, join, relative, resolve } from "node:path";

export type MarkdownBundleFormat = "markdown" | "toc" | "stats" | "json";

export interface MarkdownBundleSource {
  readonly stage: string;
  readonly path: string;
  readonly lines: number;
  readonly headings: readonly MarkdownBundleHeading[];
  readonly warnings: readonly string[];
  readonly content: string;
}

export interface MarkdownBundleHeading {
  readonly level: number;
  readonly text: string;
  readonly line: number;
}

export interface MarkdownBundlePreview {
  readonly mode: "bundle-preview";
  readonly temporary: true;
  readonly rootDir: string;
  readonly target: string;
  readonly generatedAt: string;
  readonly sources: readonly MarkdownBundleSource[];
  readonly warnings: readonly string[];
  readonly counts: {
    readonly files: number;
    readonly lines: number;
    readonly warnings: number;
  };
}

const LARGE_FILE_LINE_THRESHOLD = 1000;
const IGNORED_DIRS = new Set([".git", ".next", ".turbo", "coverage", "dist", "node_modules"]);

export async function buildMarkdownBundlePreview(options: {
  readonly rootDir: string;
  readonly target: string;
  readonly order?: readonly string[];
}): Promise<MarkdownBundlePreview> {
  const rootDir = resolve(options.rootDir);
  const targetPath = resolve(rootDir, options.target);
  const files = await resolveBundleFiles(targetPath);
  const orderedFiles = orderBundleFiles(rootDir, files, options.order ?? []);
  const sources = await Promise.all(orderedFiles.map((filePath) => readBundleSource(rootDir, filePath)));
  const duplicateHeadingWarnings = duplicateHeadingDiagnostics(sources);
  const warnings = [
    ...sources.flatMap((source) => source.warnings.map((warning) => `${source.path}: ${warning}`)),
    ...duplicateHeadingWarnings,
  ];

  return {
    mode: "bundle-preview",
    temporary: true,
    rootDir,
    target: normalizePath(relative(rootDir, targetPath)),
    generatedAt: new Date().toISOString(),
    sources,
    warnings,
    counts: {
      files: sources.length,
      lines: sources.reduce((sum, source) => sum + source.lines, 0),
      warnings: warnings.length,
    },
  };
}

export function renderMarkdownBundlePreview(
  preview: MarkdownBundlePreview,
  format: MarkdownBundleFormat,
): string {
  if (format === "json") return `${JSON.stringify(preview, null, 2)}\n`;
  if (format === "toc") return renderBundleToc(preview);
  if (format === "stats") return renderBundleStats(preview);
  return renderBundleMarkdown(preview);
}

async function resolveBundleFiles(targetPath: string): Promise<readonly string[]> {
  const targetStat = await stat(targetPath);
  if (targetStat.isFile()) return [targetPath];
  if (!targetStat.isDirectory()) return [];
  return findMarkdownFiles(targetPath);
}

async function findMarkdownFiles(dir: string): Promise<readonly string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (IGNORED_DIRS.has(entry.name)) continue;
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await findMarkdownFiles(fullPath));
    } else if (entry.isFile() && /\.(md|mdx)$/i.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files.toSorted((left, right) => left.localeCompare(right));
}

function orderBundleFiles(rootDir: string, files: readonly string[], order: readonly string[]): readonly string[] {
  if (order.length === 0) return files;
  const rank = new Map(order.map((item, index) => [item, index]));
  return [...files].toSorted((left, right) => {
    const leftKey = bundleOrderKey(rootDir, left);
    const rightKey = bundleOrderKey(rootDir, right);
    const leftRank = rank.get(leftKey) ?? rank.get(stripExtension(leftKey)) ?? Number.MAX_SAFE_INTEGER;
    const rightRank = rank.get(rightKey) ?? rank.get(stripExtension(rightKey)) ?? Number.MAX_SAFE_INTEGER;
    return leftRank - rightRank || leftKey.localeCompare(rightKey);
  });
}

async function readBundleSource(rootDir: string, filePath: string): Promise<MarkdownBundleSource> {
  const content = await readFile(filePath, "utf8");
  const path = normalizePath(relative(rootDir, filePath));
  const lines = countLines(content);
  const warnings = [
    ...(lines > LARGE_FILE_LINE_THRESHOLD ? [`large file: ${lines} lines`] : []),
  ];
  return {
    stage: inferStage(path),
    path,
    lines,
    headings: extractHeadings(content),
    warnings,
    content,
  };
}

function extractHeadings(content: string): readonly MarkdownBundleHeading[] {
  const headings: MarkdownBundleHeading[] = [];
  const headingRe = /^(#{1,6})[ \t]+(.+?)\s*#*\s*$/gm;
  for (const match of content.matchAll(headingRe)) {
    headings.push({
      level: match[1]?.length ?? 1,
      text: (match[2] ?? "").trim(),
      line: offsetToLine(content, match.index ?? 0),
    });
  }
  return headings;
}

function duplicateHeadingDiagnostics(sources: readonly MarkdownBundleSource[]): readonly string[] {
  const bySlug = new Map<string, string[]>();
  for (const source of sources) {
    for (const heading of source.headings) {
      const slug = slugifyHeading(heading.text);
      const group = bySlug.get(slug) ?? [];
      group.push(`${source.path}:${heading.line}`);
      bySlug.set(slug, group);
    }
  }
  return [...bySlug.entries()]
    .filter(([, refs]) => refs.length > 1)
    .map(([slug, refs]) => `duplicate merged heading anchor #${slug}: ${refs.join(", ")}`);
}

function renderBundleMarkdown(preview: MarkdownBundlePreview): string {
  const lines = [
    "<!-- TEMPORARY READ-ONLY BUNDLE PREVIEW",
    "     This document is generated for inspection only.",
    "     Do not edit it as a source document; edit the listed source files instead.",
    `     generatedAt: ${preview.generatedAt}`,
    `     target: ${preview.target}`,
    "-->",
    "",
    "# Temporary Bundle Preview",
    "",
    `> READ-ONLY TEMPORARY PREVIEW. Source files remain separate. Files: ${preview.counts.files}. Lines: ${preview.counts.lines}.`,
    "",
  ];
  if (preview.warnings.length > 0) {
    lines.push("## Preview Warnings", "");
    for (const warning of preview.warnings) lines.push(`- ${warning}`);
    lines.push("");
  }
  lines.push("## Sources", "");
  for (const source of preview.sources) {
    lines.push(`- ${source.stage} ${source.path} (${source.lines} lines)`);
  }
  lines.push("");
  for (const source of preview.sources) {
    lines.push(
      "<!-- BEGIN TEMPORARY SOURCE COPY",
      `     source: ${source.path}`,
      `     stage: ${source.stage}`,
      `     lines: ${source.lines}`,
      "     Edit the original source file, not this preview.",
      "-->",
      "",
      `---`,
      `temporary_source: ${source.path}`,
      `temporary_stage: ${source.stage}`,
      `temporary_lines: ${source.lines}`,
      `---`,
      "",
      source.content.trimEnd(),
      "",
      `<!-- END TEMPORARY SOURCE COPY: ${source.path} -->`,
      "",
    );
  }
  return `${lines.join("\n")}\n`;
}

function renderBundleToc(preview: MarkdownBundlePreview): string {
  const lines = [
    "TEMPORARY READ-ONLY BUNDLE PREVIEW",
    `target: ${preview.target}`,
    `files: ${preview.counts.files}`,
    "",
  ];
  for (const source of preview.sources) {
    lines.push(`${source.stage} ${source.path} (${source.lines} lines)`);
    for (const heading of source.headings) {
      lines.push(`${"  ".repeat(Math.max(0, heading.level - 1))}- L${heading.level} ${heading.text} (line ${heading.line})`);
    }
  }
  return `${lines.join("\n")}\n`;
}

function renderBundleStats(preview: MarkdownBundlePreview): string {
  const rows = preview.sources.map((source) => ({
    stage: source.stage,
    file: stripExtension(basename(source.path)),
    lines: source.lines,
  }));
  const maxLines = Math.max(0, ...rows.map((row) => row.lines));
  const lines = [
    "TEMPORARY READ-ONLY BUNDLE PREVIEW",
    "",
    "단계  파일                                  줄수",
    "───────────────────────────────────────────────",
  ];
  for (const row of rows) {
    const marker = row.lines === maxLines && rows.length > 1 ? "  <- largest" : "";
    lines.push(`${row.stage.padEnd(5)} ${row.file.padEnd(36)} ${String(row.lines).padStart(5)}${marker}`);
  }
  if (preview.warnings.length > 0) {
    lines.push("", "warnings:");
    for (const warning of preview.warnings) lines.push(`- ${warning}`);
  }
  return `${lines.join("\n")}\n`;
}

function inferStage(path: string): string {
  const name = stripExtension(basename(path));
  const match = name.match(/(?:^|[-_])stage[-_]?([0-9]+[a-z]?)/i) ?? name.match(/^([A-Z]-stage-[0-9]+[a-z]?)/i);
  return match?.[1] ?? name;
}

function bundleOrderKey(rootDir: string, filePath: string): string {
  return stripExtension(basename(relative(rootDir, filePath)));
}

function stripExtension(value: string): string {
  const extension = extname(value);
  return extension ? value.slice(0, -extension.length) : value;
}

function countLines(content: string): number {
  if (!content) return 0;
  return content.split(/\r?\n/).length;
}

function offsetToLine(content: string, offset: number): number {
  let line = 1;
  for (let index = 0; index < offset; index += 1) {
    if (content[index] === "\n") line += 1;
  }
  return line;
}

function slugifyHeading(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}\s_-]+/gu, "")
    .replace(/\s+/g, "-");
}

function normalizePath(path: string): string {
  return path.replaceAll("\\", "/").replace(/^\.\//, "");
}
