import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { extractFrontmatter } from "./frontmatter.js";

export interface CodeReferenceInput {
  codePath: string;
  docId: string;
  relationType: "boundary" | "doc";
  sourceKind: "code_comment" | "doc_frontmatter";
  symbol?: string;
  line?: number;
}

export interface CodeReferenceTarget {
  codePath: string;
  symbol?: string;
}

const CODE_TARGET_RE = /^(.+?\.(?:ts|tsx|js|jsx|mjs|cjs|json|sh))(?:(?::|#)(.+))?$/;
const CODE_FILE_RE = /\.(ts|tsx|js|jsx|mjs|cjs)$/;
const IGNORED_DIRS = new Set(["node_modules", "dist", ".git", ".next", ".turbo", "coverage"]);

function walkFiles(startPath: string, predicate: (file: string) => boolean): string[] {
  if (!existsSync(startPath)) return [];
  const files: string[] = [];

  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!IGNORED_DIRS.has(entry.name)) walk(join(dir, entry.name));
        continue;
      }
      if (!entry.isFile()) continue;
      const full = join(dir, entry.name);
      if (predicate(full)) files.push(full);
    }
  };

  walk(startPath);
  return files;
}

function extractDocIdFromYaml(yaml: string): string | null {
  if (!/(^|\n)def:\s*$/m.test(yaml)) return null;
  const match = yaml.match(/^\s*id:\s*(.+)$/m);
  return match ? match[1]!.trim() : null;
}

function extractSourceEntriesFromYaml(yaml: string): string[] {
  const values: string[] = [];
  const single = yaml.match(/^source:\s*(.+)$/m);
  if (single) values.push(single[1]!.trim());

  const lines = yaml.split(/\r?\n/);
  let inSources = false;
  for (const line of lines) {
    if (/^sources:\s*$/.test(line.trim())) {
      inSources = true;
      continue;
    }
    if (!inSources) continue;
    const item = line.match(/^\s*-\s*(.+)$/);
    if (item) {
      values.push(item[1]!.trim());
      continue;
    }
    if (line.trim() !== "" && !line.startsWith(" ")) {
      inSources = false;
    }
  }

  return values;
}

export function parseCodeReferenceTarget(value: string): CodeReferenceTarget | null {
  const normalized = value.trim();
  if (!normalized) return null;
  const match = normalized.match(CODE_TARGET_RE);
  if (!match) return null;
  return {
    codePath: match[1]!.trim(),
    symbol: match[2]?.trim() || undefined,
  };
}

export function formatCodeReferenceTarget(target: CodeReferenceTarget): string {
  return target.symbol ? `${target.codePath}:${target.symbol}` : target.codePath;
}

export function makeCodeReferenceScopeKey(codePath: string, symbol?: string): string {
  return `${codePath}#${symbol ?? ""}`;
}

function parseDocFrontmatterSources(rootDir: string, docsDir: string): CodeReferenceInput[] {
  const docsRoot = join(rootDir, docsDir);
  const markdownFiles = walkFiles(docsRoot, (file) => file.endsWith(".md"));
  const refs: CodeReferenceInput[] = [];

  for (const filePath of markdownFiles) {
    const content = readFileSync(filePath, "utf8");
    const frontmatter = extractFrontmatter(content);
    if (!frontmatter) continue;
    const docId = extractDocIdFromYaml(frontmatter.yaml);
    if (!docId) continue;

    for (const entry of extractSourceEntriesFromYaml(frontmatter.yaml)) {
      const target = parseCodeReferenceTarget(entry);
      if (!target || !target.codePath.startsWith("packages/")) continue;
      refs.push({
        codePath: target.codePath,
        docId,
        relationType: "doc",
        sourceKind: "doc_frontmatter",
        symbol: target.symbol,
      });
    }
  }

  return refs;
}

function parseCodeCommentRefs(rootDir: string, codeDirs: readonly string[]): CodeReferenceInput[] {
  const refs: CodeReferenceInput[] = [];
  const pattern = /@def\.(boundary|doc)\s+([A-Za-z0-9_-]+)(?:#([^\s`]+))?/;

  for (const dir of codeDirs) {
    const root = join(rootDir, dir);
    const codeFiles = walkFiles(root, (file) => CODE_FILE_RE.test(file));

    for (const filePath of codeFiles) {
      const relPath = relative(rootDir, filePath);
      const lines = readFileSync(filePath, "utf8").split(/\r?\n/);
      for (let index = 0; index < lines.length; index++) {
        const match = lines[index]!.match(pattern);
        if (!match) continue;
        refs.push({
          codePath: relPath,
          docId: match[2]!,
          relationType: match[1] as "boundary" | "doc",
          sourceKind: "code_comment",
          symbol: match[3] || undefined,
          line: index + 1,
        });
      }
    }
  }

  return refs;
}

export function collectCodeReferences(
  rootDir: string,
  options: {
    docsDir?: string;
    codeDirs?: readonly string[];
  } = {},
): CodeReferenceInput[] {
  const docsDir = options.docsDir ?? "docs";
  const codeDirs = options.codeDirs ?? ["packages"];
  const refs = [
    ...parseDocFrontmatterSources(rootDir, docsDir),
    ...parseCodeCommentRefs(rootDir, codeDirs),
  ];

  const deduped = new Map<string, CodeReferenceInput>();
  for (const ref of refs) {
    const key = [
      ref.codePath,
      ref.docId,
      ref.relationType,
      ref.sourceKind,
      ref.symbol ?? "",
      ref.line ?? "",
    ].join("|");
    deduped.set(key, ref);
  }

  return [...deduped.values()];
}
