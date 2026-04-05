/**
 * facet-scan — @facet 마커 파싱 + import 의존 분석.
 *
 * @facet 마커가 붙은 파일은 환경 의존 없는 순수 비즈니스 로직으로,
 * 격리된 테스트 인프라에서 동기화하여 테스트할 대상이다.
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, extname, dirname } from "node:path";

export interface FacetMarker {
  type: "file";
  exports: string[];
}

const FACET_RE = /@facet(?:\s+export\s+([\w,\s]+))?/;

export function parseFacetMarker(line: string): FacetMarker | null {
  const trimmed = line.replace(/^\s*(?:\/\/\s*|#\s*|\*\s*)/, "").trim();
  const match = trimmed.match(FACET_RE);
  if (!match) return null;

  const exports = match[1]
    ? match[1].split(",").map(s => s.trim()).filter(Boolean)
    : [];

  return { type: "file", exports };
}

// ---------------------------------------------------------------------------
// Task 2: scanFacetFiles — @facet 파일 수집
// ---------------------------------------------------------------------------

export interface FacetFile {
  relativePath: string;
  absolutePath: string;
  marker: FacetMarker;
}

export interface ScanResult {
  facetFiles: FacetFile[];
  root: string;
}

const EXCLUDE = [/node_modules/, /(?:^|\/)dist\//, /\.test\.\w+$/, /\.spec\.\w+$/];
const SCAN_EXTS = new Set([".ts", ".tsx", ".js", ".jsx", ".py"]);

export function scanFacetFiles(root: string): ScanResult {
  const facetFiles: FacetFile[] = [];

  function walk(dir: string): void {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const rel = relative(root, full);
      if (EXCLUDE.some(p => p.test(rel))) continue;

      const st = statSync(full);
      if (st.isDirectory()) { walk(full); continue; }
      if (!SCAN_EXTS.has(extname(full))) continue;

      const content = readFileSync(full, "utf-8");
      const firstMarker = content.split("\n")
        .map(line => parseFacetMarker(line))
        .find(m => m !== null);

      if (firstMarker) {
        facetFiles.push({ relativePath: rel, absolutePath: full, marker: firstMarker });
      }
    }
  }

  walk(root);
  return { facetFiles, root };
}

// ---------------------------------------------------------------------------
// Task 3: resolveImportDeps — import chain walk + block
// ---------------------------------------------------------------------------

export interface DepFile {
  relativePath: string;
  absolutePath: string;
}

export interface BlockedFile {
  relativePath: string;
  absolutePath: string;
  reason: string;
}

export interface ImportDepsResult {
  included: DepFile[];
  blocked: BlockedFile[];
}

const BLOCK_PATTERNS = [
  { pattern: /process\.env/, reason: "process.env" },
  { pattern: /import\s.*from\s+["']hono/, reason: "hono" },
  { pattern: /import\s.*from\s+["']express/, reason: "express" },
  { pattern: /import\s.*from\s+["']drizzle/, reason: "drizzle" },
  { pattern: /import\s.*from\s+["']better-sqlite3/, reason: "better-sqlite3" },
  { pattern: /createLogger\(/, reason: "createLogger" },
];

const TYPE_IMPORT_RE = /^import\s+type\s+/;

export function resolveImportDeps(entryPath: string, root: string): ImportDepsResult {
  const included: DepFile[] = [];
  const blocked: BlockedFile[] = [];
  const visited = new Set<string>();

  function walk(filePath: string, isTypeOnly: boolean): void {
    const resolved = resolveFilePath(filePath);
    if (!resolved || visited.has(resolved)) return;
    visited.add(resolved);

    const rel = relative(root, resolved);
    let content: string;
    try { content = readFileSync(resolved, "utf-8"); } catch { return; }

    if (!isTypeOnly) {
      for (const { pattern, reason } of BLOCK_PATTERNS) {
        if (pattern.test(content)) {
          blocked.push({ relativePath: rel, absolutePath: resolved, reason });
          return;
        }
      }
    }

    included.push({ relativePath: rel, absolutePath: resolved });

    for (const line of content.split("\n")) {
      const m = line.match(/^import\s+(?:type\s+)?(?:\{[^}]*\}|[\w*]+)\s+from\s+["']([^"']+)["']/);
      if (!m) continue;
      const importPath = m[1];
      if (importPath.startsWith(".")) {
        walk(join(dirname(resolved), importPath), TYPE_IMPORT_RE.test(line));
      }
    }
  }

  walk(entryPath, false);
  return {
    included: included.filter(f => f.absolutePath !== entryPath),
    blocked,
  };
}

function resolveFilePath(importPath: string): string | null {
  const candidates = [
    importPath,
    importPath.replace(/\.js$/, ".ts"),
    importPath + ".ts",
    importPath + "/index.ts",
  ];
  for (const c of candidates) {
    try { statSync(c); return c; } catch { /* next */ }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Task 4: generateIncludeList + facetScan CLI 엔트리
// ---------------------------------------------------------------------------

export function generateIncludeList(facetFiles: FacetFile[], deps: DepFile[]): string {
  const paths = new Set<string>();
  for (const f of facetFiles) paths.add(f.relativePath);
  for (const d of deps) paths.add(d.relativePath);

  const lines = [...paths].sort().map(p => `+ ${p}`);
  lines.push("- **");
  return lines.join("\n") + "\n";
}

export function facetScan(serviceRoot: string, opts: { output?: string; deps?: boolean } = {}): void {
  const { facetFiles } = scanFacetFiles(serviceRoot);

  if (facetFiles.length === 0) {
    console.log("@facet 마커 파일 없음");
    return;
  }

  const allDeps: DepFile[] = [];
  const allBlocked: BlockedFile[] = [];
  if (opts.deps !== false) {
    for (const f of facetFiles) {
      const { included, blocked } = resolveImportDeps(f.absolutePath, serviceRoot);
      allDeps.push(...included);
      allBlocked.push(...blocked);
    }
  }

  console.log(`@facet 파일: ${facetFiles.length}건`);
  for (const f of facetFiles) {
    const exports = f.marker.exports.length > 0 ? ` (export: ${f.marker.exports.join(", ")})` : "";
    console.log(`  ${f.relativePath}${exports}`);
  }

  if (allDeps.length > 0) {
    console.log(`\n의존성: ${allDeps.length}건`);
    for (const d of allDeps) console.log(`  ${d.relativePath}`);
  }

  if (allBlocked.length > 0) {
    console.log(`\nblock: ${allBlocked.length}건`);
    for (const b of allBlocked) console.log(`  ${b.relativePath} (${b.reason})`);
  }

  if (opts.output) {
    const list = generateIncludeList(facetFiles, allDeps);
    writeFileSync(opts.output, list, "utf-8");
    console.log(`\ninclude-list → ${opts.output}`);
  }
}
