// @def.boundary docs-control-plane
// @def.doc docs-control-plane

import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { createHash } from "node:crypto";

import MarkdownIt from "markdown-it";
import { extractFrontmatter, parseYaml } from "definition-catalog";

export type MarkdownLinkKind = "inline" | "image" | "definition";
export type MarkdownLinkStatus = "valid" | "missing" | "heading-missing" | "external" | "anchor" | "unsafe";
export type MarkdownLinkParserId = "markdown-it";

export interface MarkdownHeadingIdentity {
  readonly text: string;
  readonly slug: string;
  readonly baseSlug: string;
  readonly markers: readonly string[];
  readonly line: number;
}

export interface MarkdownLinkIdentity {
  readonly path: string;
  readonly title?: string;
  readonly defId?: string;
  readonly hash: string;
  readonly headings: readonly MarkdownHeadingIdentity[];
}

export interface MarkdownLinkCandidate {
  readonly path: string;
  readonly score: number;
  readonly reasons: readonly string[];
  readonly title?: string;
  readonly defId?: string;
}

export interface MarkdownLinkRootCandidate {
  readonly root: string;
  readonly path: string;
  readonly nextHref: string;
  readonly score: number;
  readonly reason: "repo-root" | "docs-root" | "candidate-root" | "stripped-parent" | "ancestor";
  readonly title?: string;
  readonly defId?: string;
  readonly heading?: MarkdownHeadingIdentity;
}

export interface MarkdownHeadingCandidate {
  readonly text: string;
  readonly slug: string;
  readonly line: number;
  readonly nextHref: string;
  readonly score: number;
  readonly reasons: readonly string[];
}

export interface MarkdownLinkRecord {
  readonly sourcePath: string;
  readonly kind: MarkdownLinkKind;
  readonly rawHref: string;
  readonly range: {
    readonly start: number;
    readonly end: number;
  };
  readonly line: number;
  readonly column: number;
  readonly status: MarkdownLinkStatus;
  readonly resolvedPath?: string;
  readonly resolvedKind?: "file" | "directory" | "markdown";
  readonly target?: MarkdownLinkIdentity;
  readonly targetHeading?: MarkdownHeadingIdentity;
  readonly candidates: readonly MarkdownLinkCandidate[];
  readonly rootCandidates: readonly MarkdownLinkRootCandidate[];
  readonly headingCandidates: readonly MarkdownHeadingCandidate[];
  readonly fragment?: string;
  readonly reason?: string;
}

export interface MarkdownLinkScanResult {
  readonly schemaVersion: 1;
  readonly parser: MarkdownLinkParserId;
  readonly rootDir: string;
  readonly docsDirs: readonly string[];
  readonly generatedAt: string;
  readonly identities: readonly MarkdownLinkIdentity[];
  readonly links: readonly MarkdownLinkRecord[];
  readonly diagnostics: readonly MarkdownLinkDiagnostic[];
  readonly counts: {
    readonly files: number;
    readonly identities: number;
    readonly links: number;
    readonly valid: number;
    readonly missing: number;
    readonly headingMissing: number;
    readonly external: number;
    readonly anchor: number;
    readonly unsafe: number;
    readonly rootResolvable: number;
    readonly duplicateHeadings: number;
    readonly repeatableHeadings: number;
    readonly unmarkedRepeatableHeadings: number;
    readonly duplicateMarkers: number;
    readonly repeatableMarkers: number;
  };
}

export interface MarkdownLinkChange {
  readonly sourcePath: string;
  readonly rawHref: string;
  readonly nextHref: string;
  readonly range: {
    readonly start: number;
    readonly end: number;
  };
  readonly line: number;
  readonly column: number;
  readonly confidence: number;
  readonly reason: string;
  readonly targetPath: string;
}

export interface MarkdownLinkRepairResult {
  readonly mode: "repair";
  readonly applied: boolean;
  readonly threshold: number;
  readonly changes: readonly MarkdownLinkChange[];
  readonly diagnostics: readonly MarkdownLinkDiagnostic[];
  readonly counts: {
    readonly missing: number;
    readonly planned: number;
    readonly applied: number;
    readonly ambiguous: number;
  };
}

export interface MarkdownLinkRebaseResult {
  readonly mode: "rebase";
  readonly applied: boolean;
  readonly fromRoot: string;
  readonly toRoot: string;
  readonly changes: readonly MarkdownLinkChange[];
  readonly diagnostics: readonly MarkdownLinkDiagnostic[];
  readonly counts: {
    readonly valid: number;
    readonly planned: number;
    readonly applied: number;
  };
}

export interface MarkdownLinkDiagnostic {
  readonly severity: "info" | "warning" | "error";
  readonly code: string;
  readonly message: string;
  readonly path?: string;
}

interface ExtractedMarkdownLink {
  readonly kind: MarkdownLinkKind;
  readonly rawHref: string;
  readonly hrefStart: number;
  readonly hrefEnd: number;
}

interface IgnoredRange {
  readonly start: number;
  readonly end: number;
}

interface RepoPathIndex {
  readonly files: ReadonlySet<string>;
  readonly directories: ReadonlySet<string>;
}

const IGNORED_DIRS = new Set([".git", ".next", ".turbo", "coverage", "dist", "node_modules"]);
const MARKDOWN_EXTENSIONS = [".md", ".mdx"] as const;
const MARKDOWN_PARSER = new MarkdownIt({ html: false, linkify: false, typographer: false });

export async function scanMarkdownLinks(options: {
  readonly rootDir: string;
  readonly docsDirs: readonly string[];
  readonly candidateRoots?: readonly string[];
  readonly ledger?: MarkdownLinkScanResult;
}): Promise<MarkdownLinkScanResult> {
  const rootDir = resolve(options.rootDir);
  const docsDirs = options.docsDirs.length > 0 ? options.docsDirs : ["docs"];
  const rootCandidateInputs = collectRootCandidateInputs(docsDirs, options.candidateRoots ?? []);
  const resolvedDocsDirs = docsDirs.map((dir) => resolve(rootDir, dir));
  const files = (await Promise.all(resolvedDocsDirs.map((dir) => findMarkdownFiles(dir)))).flat()
    .toSorted((left, right) => toRepoPath(rootDir, left).localeCompare(toRepoPath(rootDir, right)));
  const repoPaths = await collectRepoPathIndex(rootDir);
  const identities = await collectIdentities(rootDir, files);
  const diagnostics = [...collectHeadingDiagnostics(identities)];
  const identityByPath = new Map(identities.map((identity) => [identity.path, identity]));
  const ledgerLinks = options.ledger?.links ?? [];
  const links: MarkdownLinkRecord[] = [];

  for (const filePath of files) {
    const sourcePath = toRepoPath(rootDir, filePath);
    const content = await readFile(filePath, "utf8");
    for (const extracted of extractMarkdownLinks(content)) {
      links.push(resolveLink({
        rootDir,
        sourcePath,
        content,
        extracted,
        identities,
        identityByPath,
        repoPaths,
        rootCandidateInputs,
        ledgerLinks,
      }));
    }
  }
  diagnostics.push(...collectAmbiguousHeadingLinkDiagnostics(links));

  return {
    schemaVersion: 1,
    parser: "markdown-it",
    rootDir,
    docsDirs: docsDirs.map((dir) => toRepoPath(rootDir, resolve(rootDir, dir))),
    generatedAt: new Date().toISOString(),
    identities,
    links,
    diagnostics,
    counts: {
      files: files.length,
      identities: identities.length,
      links: links.length,
      valid: links.filter((link) => link.status === "valid").length,
      missing: links.filter((link) => link.status === "missing").length,
      headingMissing: links.filter((link) => link.status === "heading-missing").length,
      external: links.filter((link) => link.status === "external").length,
      anchor: links.filter((link) => link.status === "anchor").length,
      unsafe: links.filter((link) => link.status === "unsafe").length,
      rootResolvable: links.filter((link) => link.status === "missing" && link.rootCandidates.length > 0).length,
      duplicateHeadings: diagnostics.filter((diagnostic) => diagnostic.code === "duplicate-heading-anchor").length,
      repeatableHeadings: diagnostics.filter((diagnostic) => diagnostic.code === "repeatable-heading-anchor").length,
      unmarkedRepeatableHeadings: diagnostics.filter((diagnostic) => diagnostic.code === "repeatable-heading-without-marker").length,
      duplicateMarkers: diagnostics.filter((diagnostic) => diagnostic.code === "duplicate-marker-anchor").length,
      repeatableMarkers: diagnostics.filter((diagnostic) => diagnostic.code === "repeatable-contract-marker").length,
    },
  };
}

export async function loadMarkdownLinkLedger(rootDir: string, ledgerPath?: string): Promise<MarkdownLinkScanResult | undefined> {
  if (!ledgerPath) return undefined;
  const content = await readFile(resolve(rootDir, ledgerPath), "utf8");
  const parsed = JSON.parse(content) as MarkdownLinkScanResult;
  if (parsed.schemaVersion !== 1 || !Array.isArray(parsed.links)) {
    throw new Error("markdown link ledger must be a scan result with schemaVersion 1");
  }
  return parsed;
}

export async function writeMarkdownLinkLedger(rootDir: string, ledgerPath: string, result: MarkdownLinkScanResult): Promise<void> {
  const fullPath = resolve(rootDir, ledgerPath);
  await mkdir(dirname(fullPath), { recursive: true });
  await writeFile(fullPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
}

export async function buildMarkdownLinkRepair(
  scan: MarkdownLinkScanResult,
  options: {
    readonly apply: boolean;
    readonly threshold?: number;
  },
): Promise<MarkdownLinkRepairResult> {
  const threshold = options.threshold ?? 90;
  const diagnostics: MarkdownLinkDiagnostic[] = [];
  const missing = scan.links.filter((link) => link.status === "missing" || link.status === "heading-missing");
  const changes = missing.flatMap((link) => {
    const headingCandidate = selectHeadingCandidate(link);
    if (headingCandidate) {
      return [{
        sourcePath: link.sourcePath,
        rawHref: link.rawHref,
        nextHref: headingCandidate.nextHref,
        range: link.range,
        line: link.line,
        column: link.column,
        confidence: headingCandidate.score,
        reason: `heading:${headingCandidate.reasons.join(",")}`,
        targetPath: link.resolvedPath ?? link.target?.path ?? link.sourcePath,
      }];
    }

    const rootCandidate = selectRootCandidate(link);
    if (rootCandidate) {
      return [{
        sourcePath: link.sourcePath,
        rawHref: link.rawHref,
        nextHref: rootCandidate.nextHref,
        range: link.range,
        line: link.line,
        column: link.column,
        confidence: rootCandidate.score,
        reason: `root:${rootCandidate.reason}:${rootCandidate.root || "."}`,
        targetPath: rootCandidate.path,
      }];
    }

    const candidate = selectIdentityCandidate(link, threshold);
    if (!candidate) return [];
    return [{
      sourcePath: link.sourcePath,
      rawHref: link.rawHref,
      nextHref: hrefFromSourceToTarget(link.sourcePath, candidate.path, link.fragment),
      range: link.range,
      line: link.line,
      column: link.column,
      confidence: candidate.score,
      reason: candidate.reasons.join(", "),
      targetPath: candidate.path,
    }];
  });

  if (options.apply) {
    await applyMarkdownLinkChanges(scan.rootDir, changes);
  } else {
    diagnostics.push({
      severity: "info",
      code: "markdown-links-dry-run",
      message: "repair plan generated without writing files; pass --apply to update markdown hrefs",
    });
  }

  return {
    mode: "repair",
    applied: options.apply,
    threshold,
    changes,
    diagnostics,
    counts: {
      missing: missing.length,
      planned: changes.length,
      applied: options.apply ? changes.length : 0,
      ambiguous: missing.filter((link) => {
        const rootTop = link.rootCandidates[0]?.score;
        if (rootTop !== undefined && link.rootCandidates.filter((candidate) => candidate.score === rootTop).length > 1) return true;
        const top = link.candidates[0]?.score;
        return top !== undefined && link.candidates.filter((candidate) => candidate.score === top).length > 1;
      }).length,
    },
  };
}

export async function buildMarkdownLinkRebase(
  scan: MarkdownLinkScanResult,
  options: {
    readonly fromRoot: string;
    readonly toRoot: string;
    readonly apply: boolean;
  },
): Promise<MarkdownLinkRebaseResult> {
  const fromRoot = normalizeRepoPath(options.fromRoot);
  const toRoot = normalizeRepoPath(options.toRoot);
  const changes = scan.links
    .filter((link) => link.status === "valid" && link.resolvedPath)
    .flatMap((link) => {
      const resolvedPath = link.resolvedPath!;
      if (!isWithinRepoPath(resolvedPath, fromRoot)) return [];
      const rebasedTarget = joinRepoPath(toRoot, relativeRepoPath(fromRoot, resolvedPath));
      const nextHref = hrefFromSourceToTarget(link.sourcePath, rebasedTarget, link.fragment);
      if (nextHref === link.rawHref) return [];
      return [{
        sourcePath: link.sourcePath,
        rawHref: link.rawHref,
        nextHref,
        range: link.range,
        line: link.line,
        column: link.column,
        confidence: 100,
        reason: `rebase ${fromRoot || "."} -> ${toRoot || "."}`,
        targetPath: rebasedTarget,
      }];
    });

  const diagnostics: MarkdownLinkDiagnostic[] = [];
  if (options.apply) {
    await applyMarkdownLinkChanges(scan.rootDir, changes);
  } else {
    diagnostics.push({
      severity: "info",
      code: "markdown-links-dry-run",
      message: "rebase plan generated without writing files; pass --apply to update markdown hrefs",
    });
  }

  return {
    mode: "rebase",
    applied: options.apply,
    fromRoot,
    toRoot,
    changes,
    diagnostics,
    counts: {
      valid: scan.counts.valid,
      planned: changes.length,
      applied: options.apply ? changes.length : 0,
    },
  };
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
    if (IGNORED_DIRS.has(entry.name)) continue;
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await findMarkdownFiles(fullPath));
    } else if (entry.isFile() && MARKDOWN_EXTENSIONS.some((extension) => entry.name.endsWith(extension))) {
      files.push(fullPath);
    }
  }
  return files;
}

async function collectRepoPathIndex(rootDir: string): Promise<RepoPathIndex> {
  const files = new Set<string>();
  const directories = new Set<string>();
  await collectRepoPaths(rootDir, rootDir, files, directories);
  return { files, directories };
}

async function collectRepoPaths(
  rootDir: string,
  dir: string,
  files: Set<string>,
  directories: Set<string>,
): Promise<void> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (IGNORED_DIRS.has(entry.name)) continue;
    const fullPath = join(dir, entry.name);
    const repoPath = toRepoPath(rootDir, fullPath);
    if (entry.isDirectory()) {
      directories.add(repoPath);
      await collectRepoPaths(rootDir, fullPath, files, directories);
    } else if (entry.isFile()) {
      files.add(repoPath);
    }
  }
}

async function collectIdentities(rootDir: string, files: readonly string[]): Promise<readonly MarkdownLinkIdentity[]> {
  const identities: MarkdownLinkIdentity[] = [];
  for (const filePath of files) {
    const content = await readFile(filePath, "utf8");
    const frontmatter = extractFrontmatter(content);
    const body = frontmatter?.body ?? content;
    const bodyLineOffset = frontmatter ? countLines(content.slice(0, content.length - body.length)) : 0;
    const yaml = frontmatter ? parseYaml(frontmatter.yaml) : {};
    const def = isRecord(yaml.def) ? yaml.def : {};
    const headings = extractHeadings(body, bodyLineOffset);
    identities.push({
      path: toRepoPath(rootDir, filePath),
      ...(headings[0]?.text ? { title: headings[0].text } : {}),
      ...(typeof def.id === "string" && def.id.trim() ? { defId: def.id.trim() } : {}),
      hash: createHash("sha256").update(content).digest("hex"),
      headings,
    });
  }
  return identities;
}

function collectHeadingDiagnostics(identities: readonly MarkdownLinkIdentity[]): readonly MarkdownLinkDiagnostic[] {
  const diagnostics: MarkdownLinkDiagnostic[] = [];
  for (const identity of identities) {
    const bySlug = new Map<string, MarkdownHeadingIdentity[]>();
    for (const heading of identity.headings) {
      const baseSlug = slugifyHeading(stripHeadingMarkers(heading.text));
      const group = bySlug.get(baseSlug) ?? [];
      group.push(heading);
      bySlug.set(baseSlug, group);
    }
    for (const [slug, headings] of bySlug) {
      if (headings.length <= 1) continue;
      if (!hasUniqueMarkerPerHeading(headings)) {
        diagnostics.push({
          severity: "warning",
          code: "repeatable-heading-without-marker",
          message: `${identity.path} has ${headings.length} repeated headings #${slug} without unique marker anchors: ${headings.map((heading) => `line ${heading.line}`).join(", ")}`,
          path: identity.path,
        });
        continue;
      }
      diagnostics.push({
        severity: "info",
        code: "repeatable-heading-anchor",
        message: `${identity.path} has ${headings.length} repeated headings #${slug} disambiguated by markers: ${headings.map((heading) => `line ${heading.line} ^${heading.markers[0]}`).join(", ")}`,
        path: identity.path,
      });
    }

    const byMarker = new Map<string, MarkdownHeadingIdentity[]>();
    for (const heading of identity.headings) {
      for (const marker of heading.markers) {
        const group = byMarker.get(marker) ?? [];
        group.push(heading);
        byMarker.set(marker, group);
      }
    }
    for (const [marker, headings] of byMarker) {
      if (headings.length <= 1) continue;
      if (isRepeatableContractMarker(identity.path, marker)) {
        diagnostics.push({
          severity: "info",
          code: "repeatable-contract-marker",
          message: `${identity.path} has ${headings.length} repeatable contract marker ^${marker}: ${headings.map((heading) => `line ${heading.line}`).join(", ")}`,
          path: identity.path,
        });
        continue;
      }
      diagnostics.push({
        severity: "warning",
        code: "duplicate-marker-anchor",
        message: `${identity.path} has ${headings.length} headings with marker ^${marker}: ${headings.map((heading) => `line ${heading.line}`).join(", ")}`,
        path: identity.path,
      });
    }
  }
  return diagnostics;
}

function hasUniqueMarkerPerHeading(headings: readonly MarkdownHeadingIdentity[]): boolean {
  const seen = new Set<string>();
  for (const heading of headings) {
    if (heading.markers.length === 0) return false;
    const marker = heading.markers[0]!;
    if (seen.has(marker)) return false;
    seen.add(marker);
  }
  return true;
}

function collectAmbiguousHeadingLinkDiagnostics(links: readonly MarkdownLinkRecord[]): readonly MarkdownLinkDiagnostic[] {
  const diagnostics: MarkdownLinkDiagnostic[] = [];
  const seen = new Set<string>();
  for (const link of links) {
    if (!link.fragment || !link.target || !link.targetHeading) continue;
    const normalized = normalizeFragment(link.fragment);
    if (normalized !== link.targetHeading.baseSlug) continue;
    const matchingHeadings = link.target.headings.filter((heading) => heading.baseSlug === link.targetHeading?.baseSlug);
    if (matchingHeadings.length <= 1) continue;
    const key = `${link.sourcePath}:${link.line}:${link.column}:${link.rawHref}`;
    if (seen.has(key)) continue;
    seen.add(key);
    diagnostics.push({
      severity: "warning",
      code: "duplicate-heading-anchor",
      message: `${link.sourcePath}:${link.line}:${link.column} links to ambiguous heading #${normalized} in ${link.target.path}; use #${link.targetHeading.slug} or a marker anchor`,
      path: link.sourcePath,
    });
  }
  return diagnostics;
}

function extractHeadings(content: string, lineOffset = 0): readonly MarkdownHeadingIdentity[] {
  const headings: MarkdownHeadingIdentity[] = [];
  const tokens = MARKDOWN_PARSER.parse(content, {});
  const seenSlugs = new Map<string, number>();
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!token || token.type !== "heading_open") continue;
    const inline = tokens[index + 1];
    if (!inline || inline.type !== "inline") continue;
    const text = stripInlineMarkdown(inline.content).trim();
    if (!text) continue;
    const baseSlug = slugifyHeading(text);
    const slugCount = seenSlugs.get(baseSlug) ?? 0;
    seenSlugs.set(baseSlug, slugCount + 1);
    headings.push({
      text,
      slug: slugCount === 0 ? baseSlug : `${baseSlug}-${slugCount}`,
      baseSlug,
      markers: extractHeadingMarkers(text),
      line: lineOffset + (token.map?.[0] ?? 0) + 1,
    });
  }
  return headings;
}

function extractMarkdownLinks(content: string): readonly ExtractedMarkdownLink[] {
  const ignoredRanges = collectIgnoredRanges(content);
  const links: ExtractedMarkdownLink[] = [];
  links.push(...extractReferenceDefinitions(content, ignoredRanges));
  links.push(...extractMarkdownItInlineLinks(content));
  return links.toSorted((left, right) => left.hrefStart - right.hrefStart);
}

function extractMarkdownItInlineLinks(content: string): readonly ExtractedMarkdownLink[] {
  const links: ExtractedMarkdownLink[] = [];
  const tokens = MARKDOWN_PARSER.parse(content, {});
  const lineOffsets = collectLineOffsets(content);

  for (const token of tokens) {
    if (token.type !== "inline" || !token.children || !token.map) continue;
    const blockStart = lineOffsets[token.map[0]] ?? 0;
    const blockEnd = lineOffsets[token.map[1]] ?? content.length;
    const blockContent = content.slice(blockStart, blockEnd);
    let cursor = 0;

    for (const child of token.children) {
      if (child.type === "image") {
        const href = child.attrGet("src");
        if (!href) continue;
        const range = locateHrefRange(blockContent, blockStart, href, cursor, false);
        if (!range) continue;
        cursor = range.end - blockStart;
        links.push({ kind: "image", rawHref: range.rawHref, hrefStart: range.start, hrefEnd: range.end });
        continue;
      }

      if (child.type !== "link_open") continue;
      const href = child.attrGet("href");
      if (!href) continue;
      const range = locateHrefRange(blockContent, blockStart, href, cursor, child.info === "auto" || child.markup === "autolink");
      if (!range) continue;
      cursor = range.end - blockStart;
      links.push({ kind: "inline", rawHref: range.rawHref, hrefStart: range.start, hrefEnd: range.end });
    }
  }

  return links;
}

function locateHrefRange(
  blockContent: string,
  blockStart: number,
  href: string,
  cursor: number,
  allowTextFallback: boolean,
): { readonly rawHref: string; readonly start: number; readonly end: number } | undefined {
  const hrefRanges = extractInlineLinks(blockContent, []);
  for (const range of hrefRanges) {
    if (range.hrefStart < cursor) continue;
    if (hrefMatches(range.rawHref, href)) {
      return {
        rawHref: range.rawHref,
        start: blockStart + range.hrefStart,
        end: blockStart + range.hrefEnd,
      };
    }
  }
  if (!allowTextFallback) return undefined;

  const candidates = [href, encodeURI(href), decodeHrefPath(href)].filter((value, index, values) => value && values.indexOf(value) === index);
  for (const candidate of candidates) {
    const localIndex = blockContent.indexOf(candidate, cursor);
    if (localIndex >= 0) {
      return { rawHref: candidate, start: blockStart + localIndex, end: blockStart + localIndex + candidate.length };
    }
  }
  for (const candidate of candidates) {
    const localIndex = blockContent.indexOf(candidate);
    if (localIndex >= 0) {
      return { rawHref: candidate, start: blockStart + localIndex, end: blockStart + localIndex + candidate.length };
    }
  }
  return undefined;
}

function hrefMatches(sourceHref: string, parsedHref: string): boolean {
  return sourceHref === parsedHref
    || encodeURI(sourceHref) === parsedHref
    || decodeHrefPath(sourceHref) === parsedHref
    || sourceHref === decodeHrefPath(parsedHref);
}

function collectLineOffsets(content: string): readonly number[] {
  const offsets = [0];
  for (let index = 0; index < content.length; index += 1) {
    if (content[index] === "\n") offsets.push(index + 1);
  }
  offsets.push(content.length);
  return offsets;
}

function countLines(content: string): number {
  let count = 0;
  for (let index = 0; index < content.length; index += 1) {
    if (content[index] === "\n") count += 1;
  }
  return count;
}

function collectIgnoredRanges(content: string): readonly IgnoredRange[] {
  const ranges: IgnoredRange[] = [];
  const frontmatter = content.match(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/);
  if (frontmatter) ranges.push({ start: 0, end: frontmatter[0].length });

  const fenceRe = /(^|\n)( {0,3})(`{3,}|~{3,})[^\n]*(?:\n[\s\S]*?(\n\2\3[ \t]*(?=\n|$)|$))/g;
  for (const match of content.matchAll(fenceRe)) {
    ranges.push({ start: match.index ?? 0, end: (match.index ?? 0) + match[0].length });
  }

  let tickStart = -1;
  for (let index = 0; index < content.length; index += 1) {
    if (content[index] !== "`" || isEscaped(content, index) || isInRanges(index, ranges)) continue;
    if (tickStart < 0) tickStart = index;
    else {
      ranges.push({ start: tickStart, end: index + 1 });
      tickStart = -1;
    }
  }

  return ranges.toSorted((left, right) => left.start - right.start);
}

function extractReferenceDefinitions(content: string, ignoredRanges: readonly IgnoredRange[]): readonly ExtractedMarkdownLink[] {
  const links: ExtractedMarkdownLink[] = [];
  const lineRe = /(^|\n)( {0,3})\[[^\]\n]+]:[ \t]*(<[^>\n]+>|[^ \t\n]+)/g;
  for (const match of content.matchAll(lineRe)) {
    const index = match.index ?? 0;
    if (isInRanges(index, ignoredRanges)) continue;
    const full = match[0];
    const hrefToken = match[3]!;
    const tokenStart = index + full.lastIndexOf(hrefToken);
    const rawHref = unwrapAngleHref(hrefToken);
    links.push({
      kind: "definition",
      rawHref,
      hrefStart: hrefToken.startsWith("<") ? tokenStart + 1 : tokenStart,
      hrefEnd: hrefToken.startsWith("<") ? tokenStart + hrefToken.length - 1 : tokenStart + hrefToken.length,
    });
  }
  return links;
}

function extractInlineLinks(content: string, ignoredRanges: readonly IgnoredRange[]): readonly ExtractedMarkdownLink[] {
  const links: ExtractedMarkdownLink[] = [];
  for (let index = 0; index < content.length; index += 1) {
    if (content[index] !== "[" || isEscaped(content, index) || isInRanges(index, ignoredRanges)) continue;
    const image = index > 0 && content[index - 1] === "!";
    const closeLabel = findClosing(content, index, "[", "]");
    if (closeLabel < 0 || content[closeLabel + 1] !== "(") continue;
    const openHref = closeLabel + 1;
    const closeHref = findClosing(content, openHref, "(", ")");
    if (closeHref < 0) continue;
    const hrefToken = content.slice(openHref + 1, closeHref).trim();
    const parsed = parseHrefToken(hrefToken);
    if (!parsed) continue;
    const hrefStart = openHref + 1 + hrefToken.indexOf(parsed.token) + parsed.offset;
    links.push({
      kind: image ? "image" : "inline",
      rawHref: parsed.href,
      hrefStart,
      hrefEnd: hrefStart + parsed.href.length,
    });
    index = closeHref;
  }
  return links;
}

function resolveLink(input: {
  readonly rootDir: string;
  readonly sourcePath: string;
  readonly content: string;
  readonly extracted: ExtractedMarkdownLink;
  readonly identities: readonly MarkdownLinkIdentity[];
  readonly identityByPath: ReadonlyMap<string, MarkdownLinkIdentity>;
  readonly repoPaths: RepoPathIndex;
  readonly rootCandidateInputs: readonly RootCandidateInput[];
  readonly ledgerLinks: readonly MarkdownLinkRecord[];
}): MarkdownLinkRecord {
  const { href, fragment } = splitFragment(input.extracted.rawHref);
  const position = offsetToLineColumn(input.content, input.extracted.hrefStart);
  const base = {
    sourcePath: input.sourcePath,
    kind: input.extracted.kind,
    rawHref: input.extracted.rawHref,
    range: { start: input.extracted.hrefStart, end: input.extracted.hrefEnd },
    line: position.line,
    column: position.column,
    ...(fragment ? { fragment } : {}),
  };

  if (!href && fragment) {
    const source = input.identityByPath.get(input.sourcePath);
    const targetHeading = source ? findHeading(source, fragment) : undefined;
    if (targetHeading) {
      return { ...base, status: "valid", resolvedPath: input.sourcePath, resolvedKind: "markdown", target: source, targetHeading, candidates: [], rootCandidates: [], headingCandidates: [] };
    }
    return {
      ...base,
      status: "heading-missing",
      resolvedPath: input.sourcePath,
      ...(source ? { target: source } : {}),
      candidates: [],
      rootCandidates: [],
      headingCandidates: source ? suggestHeadingCandidates(input.sourcePath, source, fragment, input.extracted.rawHref) : [],
    };
  }
  if (isExternalHref(href)) {
    return { ...base, status: "external", candidates: [], rootCandidates: [], headingCandidates: [] };
  }
  if (href.includes("\0")) {
    return { ...base, status: "unsafe", reason: "href contains a null byte", candidates: [], rootCandidates: [], headingCandidates: [] };
  }

  const resolvedPath = resolveRepoHref(input.rootDir, input.sourcePath, href);
  const resolvedTarget = findHrefTarget(input.identityByPath, input.repoPaths, resolvedPath);
  if (resolvedTarget) {
    const { path: targetPath, kind, identity: target } = resolvedTarget;
    if (fragment && isLineFragment(fragment)) {
      return { ...base, status: "valid", resolvedPath: targetPath, resolvedKind: kind, ...(target ? { target } : {}), candidates: [], rootCandidates: [], headingCandidates: [] };
    }
    if (fragment && target) {
      const targetHeading = findHeading(target, fragment);
      if (targetHeading) {
        return { ...base, status: "valid", resolvedPath: targetPath, resolvedKind: kind, target, targetHeading, candidates: [], rootCandidates: [], headingCandidates: [] };
      }
      return {
        ...base,
        status: "heading-missing",
        resolvedPath: targetPath,
        resolvedKind: kind,
        target,
        candidates: [],
        rootCandidates: [],
        headingCandidates: suggestHeadingCandidates(input.sourcePath, target, fragment, input.extracted.rawHref),
      };
    }
    return { ...base, status: "valid", resolvedPath: targetPath, resolvedKind: kind, ...(target ? { target } : {}), candidates: [], rootCandidates: [], headingCandidates: [] };
  }

  return {
    ...base,
    status: "missing",
    resolvedPath,
    rootCandidates: suggestRootCandidates({
      href,
      fragment,
      sourcePath: input.sourcePath,
      identityByPath: input.identityByPath,
      repoPaths: input.repoPaths,
      rootCandidateInputs: input.rootCandidateInputs,
    }),
    headingCandidates: [],
    candidates: suggestCandidates({
      href,
      sourcePath: input.sourcePath,
      identities: input.identities,
      ledgerLinks: input.ledgerLinks,
    }),
  };
}

interface RootCandidateInput {
  readonly root: string;
  readonly reason: MarkdownLinkRootCandidate["reason"];
}

function collectRootCandidateInputs(
  docsDirs: readonly string[],
  candidateRoots: readonly string[],
): readonly RootCandidateInput[] {
  const inputs: RootCandidateInput[] = [
    { root: "", reason: "repo-root" },
    ...docsDirs.map((root) => ({ root: normalizeRepoPath(root), reason: "docs-root" as const })),
    ...candidateRoots.map((root) => ({ root: normalizeRepoPath(root), reason: "candidate-root" as const })),
  ];
  const seen = new Set<string>();
  return inputs.filter((input) => {
    const key = `${input.reason}:${input.root}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function suggestRootCandidates(input: {
  readonly href: string;
  readonly fragment?: string;
  readonly sourcePath: string;
  readonly identityByPath: ReadonlyMap<string, MarkdownLinkIdentity>;
  readonly repoPaths: RepoPathIndex;
  readonly rootCandidateInputs: readonly RootCandidateInput[];
}): readonly MarkdownLinkRootCandidate[] {
  const candidates: MarkdownLinkRootCandidate[] = [];
  const seen = new Set<string>();
  const decodedHref = decodeHrefPath(input.href);
  const hrefVariants = [
    { href: decodedHref, reason: undefined },
    { href: stripLeadingRelativeSegments(decodedHref), reason: "stripped-parent" as const },
  ].filter((variant, index, variants) => variant.href && variants.findIndex((item) => item.href === variant.href) === index);

  for (const rootInput of input.rootCandidateInputs) {
    for (const hrefVariant of hrefVariants) {
      const path = joinRepoPath(rootInput.root, hrefVariant.href);
      const candidate = buildRootCandidate({
        ...input,
        path,
        root: rootInput.root,
        reason: hrefVariant.reason ?? rootInput.reason,
        score: hrefVariant.reason ? 95 : rootInput.reason === "candidate-root" ? 110 : 100,
      });
      if (!candidate) continue;
      const key = `${candidate.path}:${candidate.nextHref}`;
      if (seen.has(key)) continue;
      seen.add(key);
      candidates.push(candidate);
    }
  }

  for (const ancestor of parentRepoDirs(dirname(input.sourcePath))) {
    for (const hrefVariant of hrefVariants) {
      const path = joinRepoPath(ancestor, hrefVariant.href);
      const candidate = buildRootCandidate({
        ...input,
        path,
        root: ancestor,
        reason: "ancestor",
        score: hrefVariant.reason ? 90 : 105,
      });
      if (!candidate) continue;
      const key = `${candidate.path}:${candidate.nextHref}`;
      if (seen.has(key)) continue;
      seen.add(key);
      candidates.push(candidate);
    }
  }

  return candidates.toSorted((left, right) => right.score - left.score || left.path.localeCompare(right.path));
}

function buildRootCandidate(input: {
  readonly fragment?: string;
  readonly sourcePath: string;
  readonly identityByPath: ReadonlyMap<string, MarkdownLinkIdentity>;
  readonly repoPaths: RepoPathIndex;
  readonly path: string;
  readonly root: string;
  readonly reason: MarkdownLinkRootCandidate["reason"];
  readonly score: number;
}): MarkdownLinkRootCandidate | undefined {
  const resolvedTarget = findHrefTarget(input.identityByPath, input.repoPaths, input.path);
  if (!resolvedTarget) return undefined;
  const { path: targetPath, identity: target } = resolvedTarget;
  if (!target && input.fragment) return undefined;
  const heading = input.fragment && target ? findHeading(target, input.fragment) : undefined;
  if (input.fragment && !heading) return undefined;
  return {
    root: input.root,
    path: targetPath,
    nextHref: hrefFromSourceToTarget(input.sourcePath, targetPath, input.fragment),
    score: input.score,
    reason: input.reason,
    ...(target?.title ? { title: target.title } : {}),
    ...(target?.defId ? { defId: target.defId } : {}),
    ...(heading ? { heading } : {}),
  };
}

function findHrefTarget(
  identityByPath: ReadonlyMap<string, MarkdownLinkIdentity>,
  repoPaths: RepoPathIndex,
  path: string,
): { readonly path: string; readonly kind: "file" | "directory" | "markdown"; readonly identity?: MarkdownLinkIdentity } | undefined {
  const normalized = normalizeRepoPath(path).replace(/\/+$/, "");
  const candidates = [
    normalized,
    `${normalized}/README.md`,
    `${normalized}/index.md`,
  ];
  for (const candidate of candidates) {
    const identity = identityByPath.get(candidate);
    if (identity) return { path: candidate, kind: "markdown", identity };
  }
  if (repoPaths.files.has(normalized)) {
    return { path: normalized, kind: "file" };
  }
  if (repoPaths.directories.has(normalized)) {
    return { path: normalized, kind: "directory" };
  }
  return undefined;
}

function findHeading(identity: MarkdownLinkIdentity, fragment: string): MarkdownHeadingIdentity | undefined {
  const marker = normalizeMarkerFragment(fragment);
  const markerHeadings = identity.headings.filter((heading) => heading.markers.includes(marker));
  if (markerHeadings.length === 1 && !isRepeatableContractMarker(identity.path, marker)) return markerHeadings[0];
  const normalized = normalizeFragment(fragment);
  return identity.headings.find((heading) => heading.slug === normalized);
}

function suggestHeadingCandidates(
  sourcePath: string,
  target: MarkdownLinkIdentity,
  fragment: string,
  rawHref: string,
): readonly MarkdownHeadingCandidate[] {
  const normalizedFragment = normalizeFragment(fragment);
  const fragmentText = normalizeText(normalizedFragment);
  return target.headings
    .map((heading) => {
      const reasons: string[] = [];
      let score = 0;
      const marker = normalizeMarkerFragment(fragment);
      let nextFragment = heading.slug;
      if (heading.markers.includes(marker)) {
        score += 100;
        reasons.push("heading-marker-exact");
      } else if (heading.markers.some((item) => item.includes(fragmentText) || fragmentText.includes(item))) {
        score += 80;
        reasons.push("heading-marker-overlap");
        nextFragment = heading.markers.find((item) => item.includes(fragmentText) || fragmentText.includes(item)) ?? heading.slug;
      } else if (normalizeText(heading.text) === fragmentText) {
        score += 95;
        reasons.push("heading-text-exact");
      } else if (heading.slug.includes(normalizedFragment) || normalizedFragment.includes(heading.slug)) {
        score += 70;
        reasons.push("heading-slug-overlap");
      } else if (normalizeText(heading.text).includes(fragmentText) || fragmentText.includes(normalizeText(heading.text))) {
        score += 60;
        reasons.push("heading-text-overlap");
      }
      return {
        text: heading.text,
        slug: heading.slug,
        line: heading.line,
        nextHref: replaceHrefFragment(rawHref, nextFragment),
        score,
        reasons,
      };
    })
    .filter((candidate) => candidate.score > 0)
    .toSorted((left, right) => right.score - left.score || left.line - right.line)
    .slice(0, 5);
}

function selectRootCandidate(link: MarkdownLinkRecord): MarkdownLinkRootCandidate | undefined {
  const candidate = link.rootCandidates[0];
  if (!candidate) return undefined;
  const tied = link.rootCandidates.filter((item) => item.score === candidate.score);
  return tied.length === 1 ? candidate : undefined;
}

function selectIdentityCandidate(
  link: MarkdownLinkRecord,
  threshold: number,
): MarkdownLinkCandidate | undefined {
  const candidate = link.candidates[0];
  if (!candidate || candidate.score < threshold) return undefined;
  const tied = link.candidates.filter((item) => item.score === candidate.score);
  return tied.length === 1 ? candidate : undefined;
}

function selectHeadingCandidate(link: MarkdownLinkRecord): MarkdownHeadingCandidate | undefined {
  const candidate = link.headingCandidates[0];
  if (!candidate) return undefined;
  const tied = link.headingCandidates.filter((item) => item.score === candidate.score);
  return tied.length === 1 && candidate.score >= 90 ? candidate : undefined;
}

function suggestCandidates(input: {
  readonly href: string;
  readonly sourcePath: string;
  readonly identities: readonly MarkdownLinkIdentity[];
  readonly ledgerLinks: readonly MarkdownLinkRecord[];
}): readonly MarkdownLinkCandidate[] {
  const hrefStem = stem(input.href);
  const ledgerTargets = input.ledgerLinks
    .filter((link) => link.sourcePath === input.sourcePath && stripFragment(link.rawHref) === input.href && link.target)
    .map((link) => link.target!);

  return input.identities
    .map((identity) => {
      const reasons: string[] = [];
      let score = 0;
      if (hrefStem && stem(identity.path) === hrefStem) {
        score += 70;
        reasons.push("path-stem");
      }
      if (hrefStem && identity.title && normalizeText(identity.title) === normalizeText(hrefStem)) {
        score += 30;
        reasons.push("title-exact");
      } else if (hrefStem && identity.title && normalizeText(identity.title).includes(normalizeText(hrefStem))) {
        score += 15;
        reasons.push("title-contains");
      }
      for (const ledgerTarget of ledgerTargets) {
        if (ledgerTarget.defId && identity.defId === ledgerTarget.defId) {
          score += 100;
          reasons.push("ledger-def-id");
        }
        if (identity.hash === ledgerTarget.hash) {
          score += 100;
          reasons.push("ledger-hash");
        }
        if (ledgerTarget.title && identity.title && normalizeText(identity.title) === normalizeText(ledgerTarget.title)) {
          score += 20;
          reasons.push("ledger-title");
        }
      }
      return {
        path: identity.path,
        score,
        reasons,
        ...(identity.title ? { title: identity.title } : {}),
        ...(identity.defId ? { defId: identity.defId } : {}),
      };
    })
    .filter((candidate) => candidate.score > 0)
    .toSorted((left, right) => right.score - left.score || left.path.localeCompare(right.path))
    .slice(0, 5);
}

async function applyMarkdownLinkChanges(rootDir: string, changes: readonly MarkdownLinkChange[]): Promise<void> {
  const byPath = new Map<string, MarkdownLinkChange[]>();
  for (const change of changes) {
    const group = byPath.get(change.sourcePath) ?? [];
    group.push(change);
    byPath.set(change.sourcePath, group);
  }

  for (const [sourcePath, pathChanges] of byPath) {
    const fullPath = resolve(rootDir, sourcePath);
    let content = await readFile(fullPath, "utf8");
    for (const change of pathChanges.toSorted((left, right) => right.range.start - left.range.start)) {
      content = `${content.slice(0, change.range.start)}${change.nextHref}${content.slice(change.range.end)}`;
    }
    await writeFile(fullPath, content, "utf8");
  }
}

function hrefFromSourceToTarget(sourcePath: string, targetPath: string, fragment?: string): string {
  const relativePath = normalizeRepoPath(relative(dirname(sourcePath), targetPath));
  const href = relativePath.startsWith(".") ? relativePath : `./${relativePath}`;
  return `${href}${fragment ? `#${fragment}` : ""}`;
}

function resolveRepoHref(rootDir: string, sourcePath: string, href: string): string {
  const cleanHref = decodeHrefPath(href);
  if (isAbsolute(cleanHref)) {
    const normalizedRoot = resolve(rootDir);
    const normalizedHref = resolve(cleanHref);
    if (normalizedHref === normalizedRoot || normalizedHref.startsWith(`${normalizedRoot}/`)) {
      return toRepoPath(rootDir, normalizedHref);
    }
    return normalizeRepoPath(cleanHref.replace(/^\/+/, ""));
  }
  if (cleanHref.startsWith("/")) return normalizeRepoPath(cleanHref.slice(1));
  const fullPath = resolve(rootDir, dirname(sourcePath), cleanHref);
  return toRepoPath(rootDir, fullPath);
}

function parseHrefToken(token: string): { readonly href: string; readonly token: string; readonly offset: number } | null {
  if (!token) return null;
  if (token.startsWith("<")) {
    const close = token.indexOf(">");
    if (close <= 0) return null;
    return { href: token.slice(1, close), token: token.slice(0, close + 1), offset: 1 };
  }
  const match = token.match(/^[^\s]+/);
  if (!match) return null;
  return { href: match[0], token: match[0], offset: 0 };
}

function findClosing(content: string, openIndex: number, open: string, close: string): number {
  let depth = 0;
  for (let index = openIndex; index < content.length; index += 1) {
    if (isEscaped(content, index)) continue;
    if (content[index] === open) depth += 1;
    if (content[index] === close) {
      depth -= 1;
      if (depth === 0) return index;
    }
    if (content[index] === "\n" && open === "[") return -1;
  }
  return -1;
}

function splitFragment(href: string): { readonly href: string; readonly fragment?: string } {
  const index = href.indexOf("#");
  if (index < 0) return { href };
  return {
    href: href.slice(0, index),
    ...(href.slice(index + 1) ? { fragment: href.slice(index + 1) } : {}),
  };
}

function stripFragment(href: string): string {
  return splitFragment(href).href;
}

function isExternalHref(href: string): boolean {
  return /^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith("//");
}

function isEscaped(content: string, index: number): boolean {
  let slashCount = 0;
  for (let cursor = index - 1; cursor >= 0 && content[cursor] === "\\"; cursor -= 1) slashCount += 1;
  return slashCount % 2 === 1;
}

function isInRanges(index: number, ranges: readonly IgnoredRange[]): boolean {
  return ranges.some((range) => index >= range.start && index < range.end);
}

function offsetToLineColumn(content: string, offset: number): { readonly line: number; readonly column: number } {
  let line = 1;
  let column = 1;
  for (let index = 0; index < offset; index += 1) {
    if (content[index] === "\n") {
      line += 1;
      column = 1;
    } else {
      column += 1;
    }
  }
  return { line, column };
}

function firstHeading(content: string): string | undefined {
  return content.match(/^#\s+(.+)$/m)?.[1]?.trim();
}

function stem(path: string): string {
  const name = path.split("/").pop() ?? path;
  return name.replace(/\.(?:mdx?|markdown)$/i, "").toLowerCase();
}

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9가-힣]+/g, "-").replace(/^-+|-+$/g, "");
}

function slugifyHeading(value: string): string {
  return stripInlineMarkdown(value)
    .trim()
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}\s_-]+/gu, "")
    .replace(/\s+/g, "-");
}

function normalizeFragment(value: string): string {
  return slugifyHeading(decodeHrefPath(value));
}

function normalizeMarkerFragment(value: string): string {
  return decodeHrefPath(value).trim().replace(/^\^+/, "").toLowerCase();
}

function extractHeadingMarkers(value: string): readonly string[] {
  const markers: string[] = [];
  let remaining = stripInlineMarkdown(value).trim();
  const markerRe = /(?:^|\s)\^([A-Za-z][A-Za-z0-9_-]*(?::[A-Za-z0-9][A-Za-z0-9._:-]*)?)\s*$/;
  while (true) {
    const match = remaining.match(markerRe);
    if (!match) break;
    markers.unshift(match[1]!.toLowerCase());
    remaining = remaining.slice(0, match.index).trimEnd();
  }
  return markers;
}

function stripHeadingMarkers(value: string): string {
  let remaining = stripInlineMarkdown(value).trim();
  const markerRe = /(?:^|\s)\^([A-Za-z][A-Za-z0-9_-]*(?::[A-Za-z0-9][A-Za-z0-9._:-]*)?)\s*$/;
  while (true) {
    const match = remaining.match(markerRe);
    if (!match) return remaining;
    remaining = remaining.slice(0, match.index).trimEnd();
  }
}

const REPEATABLE_CONTRACT_MARKERS = new Set([
  "assertions",
  "decision-point",
  "evidence",
  "failure",
  "flow-steps",
  "outputs",
  "overview",
  "postcondition",
  "precondition",
  "preconditions",
  "steps",
]);

function isRepeatableContractMarker(path: string, marker: string): boolean {
  return /\.(?:cases|test)\.md$/i.test(path) && REPEATABLE_CONTRACT_MARKERS.has(marker);
}

function stripInlineMarkdown(value: string): string {
  return value
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)]\([^)]+\)/g, "$1")
    .replace(/[*_~]/g, "")
    .trim();
}

function replaceHrefFragment(rawHref: string, nextFragment: string): string {
  const index = rawHref.indexOf("#");
  if (index < 0) return `${rawHref}#${nextFragment}`;
  return `${rawHref.slice(0, index)}#${nextFragment}`;
}

function decodeHrefPath(href: string): string {
  try {
    return decodeURI(href);
  } catch {
    return href;
  }
}

function unwrapAngleHref(value: string): string {
  return value.startsWith("<") && value.endsWith(">") ? value.slice(1, -1) : value;
}

function toRepoPath(rootDir: string, path: string): string {
  return normalizeRepoPath(relative(rootDir, isAbsolute(path) ? path : resolve(rootDir, path)));
}

function normalizeRepoPath(path: string): string {
  return path.replaceAll("\\", "/").replace(/^\.\//, "");
}

function relativeRepoPath(parent: string, child: string): string {
  const normalizedParent = normalizeRepoPath(parent);
  const normalizedChild = normalizeRepoPath(child);
  return normalizedParent ? normalizedChild.slice(normalizedParent.length).replace(/^\//, "") : normalizedChild;
}

function joinRepoPath(...parts: readonly string[]): string {
  return normalizeRepoPath(parts.filter(Boolean).join("/"));
}

function stripLeadingRelativeSegments(path: string): string {
  const parts = normalizeRepoPath(path).split("/").filter((part) => part && part !== ".");
  while (parts[0] === "..") parts.shift();
  return parts.join("/");
}

function parentRepoDirs(path: string): readonly string[] {
  const parts = normalizeRepoPath(path).split("/").filter((part) => part && part !== ".");
  const parents: string[] = [];
  for (let length = parts.length - 1; length >= 0; length -= 1) {
    parents.push(parts.slice(0, length).join("/"));
  }
  return parents;
}

function isWithinRepoPath(path: string, parent: string): boolean {
  const normalizedPath = normalizeRepoPath(path);
  const normalizedParent = normalizeRepoPath(parent);
  return !normalizedParent || normalizedPath === normalizedParent || normalizedPath.startsWith(`${normalizedParent}/`);
}

function isMarkdownPath(path: string): boolean {
  return /\.(md|mdx)$/i.test(path);
}

function isLineFragment(fragment: string): boolean {
  return /^L\d+(?:-L\d+)?$/i.test(fragment);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
