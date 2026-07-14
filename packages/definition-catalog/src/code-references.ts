// @def.doc definition-catalog-spec
// @def.boundary definition-catalog-spec

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { extractFrontmatter } from './frontmatter.js';

export interface CodeReferenceInput {
  codePath: string;
  docId: string;
  relationType: 'boundary' | 'doc';
  sourceKind: 'code_comment' | 'doc_frontmatter';
  symbol?: string;
  line?: number;
}

export interface CodeReferenceTarget {
  codePath: string;
  symbol?: string;
}

export interface CodeLinkCoverageOptions {
  docsDir?: string;
  codeDirs?: readonly string[];
  scopes?: readonly string[];
  includeTests?: boolean;
  includeNonSrc?: boolean;
  /**
   * 분모에서 제외할 패키지 이름 목록. `packages/<excluded>/` 경로의 파일은
   * 분모(total)와 분자(linked/unlinked) 모두에서 빠진다. harness/smoke/bench 처럼
   * `@def.boundary` 부여 대상이 아닌 인프라 패키지를 걸러내기 위한 기본 제외 목록을
   * caller 가 주입하거나 `[]` 로 덮어써 비활성화할 수 있다.
   *
   * 기본값 (옵션 미지정시): {@link DEFAULT_EXCLUDE_PACKAGES}
   */
  excludePackages?: readonly string[];
}

/**
 * adjusted coverage 계산의 기본 제외 패키지.
 *
 * 2026-04-21 orphan audit (`docs/proposals/domain-hierarchy/reviews/2026-04-21-orphan-source-audit.md`)
 * 에서 category A(Infrastructure / harness) 로 분류된 패키지 4 종을 반영한다.
 */
export const DEFAULT_EXCLUDE_PACKAGES: readonly string[] = [
  'simulation-tests',
  'facet-tests',
  'viteplus-sdk-smoke',
  'bench',
];

export interface CoverageMetrics {
  readonly linked: number;
  readonly total: number;
  readonly percentage: number;
}

export interface AdjustedCoverageMetrics extends CoverageMetrics {
  readonly excluded: number;
}

export interface CodeLinkCoverageResult {
  readonly scopes: readonly string[];
  readonly totalFiles: number;
  readonly linkedFiles: number;
  readonly unlinkedFiles: number;
  readonly files: readonly string[];
  readonly raw: CoverageMetrics;
  readonly adjusted: AdjustedCoverageMetrics;
  readonly excludedPackages: readonly string[];
}

const CODE_TARGET_RE = /^(.+?\.(?:ts|tsx|js|jsx|mjs|cjs|json|sh))(?:(?::|#)(.+))?$/;
const CODE_FILE_RE = /\.(ts|tsx|js|jsx|mjs|cjs)$/;
const TEST_FILE_RE = /\.(test|spec)\.[cm]?[jt]sx?$/;
const IGNORED_DIRS = new Set([
  'node_modules',
  'dist',
  '.git',
  '.next',
  '.turbo',
  'coverage',
  'synced',
  '__mocks__',
]);

function computePercentage(linked: number, total: number): number {
  if (total === 0) return 100;
  return Math.round((linked / total) * 1000) / 10;
}

function isExcludedByPackage(relPath: string, excludedPackages: readonly string[]): boolean {
  if (excludedPackages.length === 0) return false;
  for (const pkg of excludedPackages) {
    if (!pkg) continue;
    if (relPath.includes(`packages/${pkg}/`)) return true;
  }
  return false;
}

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

export function extractSourceEntriesFromYaml(yaml: string): string[] {
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
    if (line.trim() !== '' && !line.startsWith(' ')) {
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
  return `${codePath}#${symbol ?? ''}`;
}

function parseDocFrontmatterSources(rootDir: string, docsDir: string): CodeReferenceInput[] {
  const docsRoot = join(rootDir, docsDir);
  const markdownFiles = walkFiles(docsRoot, (file) => file.endsWith('.md'));
  const refs: CodeReferenceInput[] = [];

  for (const filePath of markdownFiles) {
    const content = readFileSync(filePath, 'utf8');
    const frontmatter = extractFrontmatter(content);
    if (!frontmatter) continue;
    const docId = extractDocIdFromYaml(frontmatter.yaml);
    if (!docId) continue;

    for (const entry of extractSourceEntriesFromYaml(frontmatter.yaml)) {
      const target = parseCodeReferenceTarget(entry);
      if (!target || !target.codePath.startsWith('packages/')) continue;
      refs.push({
        codePath: target.codePath,
        docId,
        relationType: 'doc',
        sourceKind: 'doc_frontmatter',
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
      const lines = readFileSync(filePath, 'utf8').split(/\r?\n/);
      for (let index = 0; index < lines.length; index++) {
        const match = lines[index]!.match(pattern);
        if (!match) continue;
        refs.push({
          codePath: relPath,
          docId: match[2]!,
          relationType: match[1] as 'boundary' | 'doc',
          sourceKind: 'code_comment',
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
  const docsDir = options.docsDir ?? 'docs';
  const codeDirs = options.codeDirs ?? ['packages'];
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
      ref.symbol ?? '',
      ref.line ?? '',
    ].join('|');
    deduped.set(key, ref);
  }

  return [...deduped.values()];
}

export function collectCodeLinkCoverage(
  rootDir: string,
  options: CodeLinkCoverageOptions = {},
): CodeLinkCoverageResult {
  const docsDir = options.docsDir ?? 'docs';
  const codeDirs = options.codeDirs ?? ['packages'];
  const scopes = (options.scopes ?? []).map((scope) => scope.replaceAll('\\', '/'));
  const includeTests = options.includeTests ?? false;
  const includeNonSrc = options.includeNonSrc ?? false;
  // caller 가 명시적으로 `excludePackages: []` 를 주입하면 default 를 비활성화한다.
  const excludePackages = options.excludePackages ?? DEFAULT_EXCLUDE_PACKAGES;

  const linkedFiles = new Set(
    collectCodeReferences(rootDir, { docsDir, codeDirs }).map((ref) =>
      ref.codePath.replaceAll('\\', '/'),
    ),
  );

  const candidateFiles = new Set<string>();
  for (const dir of codeDirs) {
    const root = join(rootDir, dir);
    const files = walkFiles(root, (file) => CODE_FILE_RE.test(file));
    for (const filePath of files) {
      const relPath = relative(rootDir, filePath).replaceAll('\\', '/');
      if (!includeNonSrc && !relPath.includes('/src/')) continue;
      if (!includeTests && TEST_FILE_RE.test(relPath)) continue;
      if (scopes.length > 0 && !scopes.some((scope) => relPath.startsWith(scope))) continue;
      candidateFiles.add(relPath);
    }
  }

  const sortedCandidates = [...candidateFiles].toSorted();

  // raw: 제외 없이 모든 후보를 포함한 원시 수치
  const rawLinked = sortedCandidates.filter((filePath) => linkedFiles.has(filePath)).length;
  const rawTotal = sortedCandidates.length;

  // adjusted: excludePackages 에 해당하는 파일을 분모와 분자 모두에서 제거
  const adjustedCandidates = sortedCandidates.filter(
    (filePath) => !isExcludedByPackage(filePath, excludePackages),
  );
  const adjustedLinked = adjustedCandidates.filter((filePath) => linkedFiles.has(filePath)).length;
  const adjustedTotal = adjustedCandidates.length;
  const adjustedExcluded = rawTotal - adjustedTotal;

  const unlinked = adjustedCandidates.filter((filePath) => !linkedFiles.has(filePath));

  return {
    scopes,
    totalFiles: adjustedTotal,
    linkedFiles: adjustedLinked,
    unlinkedFiles: unlinked.length,
    files: unlinked,
    raw: {
      linked: rawLinked,
      total: rawTotal,
      percentage: computePercentage(rawLinked, rawTotal),
    },
    adjusted: {
      linked: adjustedLinked,
      total: adjustedTotal,
      percentage: computePercentage(adjustedLinked, adjustedTotal),
      excluded: adjustedExcluded,
    },
    excludedPackages: [...excludePackages],
  };
}
