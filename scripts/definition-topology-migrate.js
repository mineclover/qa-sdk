#!/usr/bin/env node
/**
 * definition-topology-migrate
 *
 * 문서 분할/이동 이후 남아 있는 legacy doc path / doc id 참조를 찾아내고,
 * 안전한 경우 일괄 치환할 수 있도록 돕는 스크립트다.
 *
 * 기본 동작은 report-only다.
 *
 * 사용 예:
 *   node scripts/definition-topology-migrate.js
 *   node scripts/definition-topology-migrate.js report --limit=200
 *   node scripts/definition-topology-migrate.js rewrite
 *   node scripts/definition-topology-migrate.js rewrite --write
 */

const fs = require("node:fs");
const path = require("node:path");
const childProcess = require("node:child_process");

const REPO_ROOT = path.resolve(__dirname, "..");
const DOC_ROOTS = [
  path.join(REPO_ROOT, "docs", "specs"),
  path.join(REPO_ROOT, "docs", "guides"),
];
const SEARCH_ROOTS = [
  path.join(REPO_ROOT, "README.md"),
  path.join(REPO_ROOT, "docs"),
  path.join(REPO_ROOT, "packages"),
  path.join(REPO_ROOT, "scripts"),
];

const TEXT_FILE_EXTENSIONS = new Set([
  ".md",
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".json",
  ".sh",
  ".yaml",
  ".yml",
  ".d.ts",
]);

const IGNORED_DIR_NAMES = new Set([
  ".git",
  ".pnpm-store",
  "node_modules",
  "dist",
  "coverage",
  ".next",
  ".turbo",
]);

const IGNORED_RELATIVE_PATHS = new Set([
  "packages/docs-explorer/public/data.json",
  "packages/platform-demo/public/def-catalog-data.json",
  "packages/platform-demo/public/diagram-presets.js",
]);

const SOURCE_LINE_PREFIXES = ["원본:", "분할 전 원본:"];

function parseArgs(argv) {
  const args = argv.slice(2);
  const options = {
    mode: "report",
    write: false,
    limit: 120,
    json: false,
    out: null,
    strategy: "anchored",
  };

  for (const arg of args) {
    if (arg === "report" || arg === "rewrite" || arg === "move-plan") {
      options.mode = arg;
      continue;
    }
    if (arg === "--write") {
      options.write = true;
      continue;
    }
    if (arg === "--json") {
      options.json = true;
      continue;
    }
    if (arg.startsWith("--limit=")) {
      const value = Number(arg.slice("--limit=".length));
      if (Number.isFinite(value) && value > 0) {
        options.limit = value;
      }
      continue;
    }
    if (arg.startsWith("--out=")) {
      options.out = arg.slice("--out=".length);
      continue;
    }
    if (arg.startsWith("--strategy=")) {
      const value = arg.slice("--strategy=".length);
      if (value === "strict" || value === "anchored") {
        options.strategy = value;
      }
      continue;
    }
  }

  return options;
}

function toPosix(relativePath) {
  return relativePath.split(path.sep).join("/");
}

function readFileUtf8(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function collectFiles(startPath) {
  if (!fs.existsSync(startPath)) return [];

  const stat = fs.statSync(startPath);
  if (stat.isFile()) return [startPath];

  const files = [];
  for (const entry of fs.readdirSync(startPath, { withFileTypes: true })) {
    if (IGNORED_DIR_NAMES.has(entry.name)) continue;
    const fullPath = path.join(startPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(fullPath));
      continue;
    }
    if (!entry.isFile()) continue;
    const extension = path.extname(entry.name);
    if (!TEXT_FILE_EXTENSIONS.has(extension)) continue;
    const relativePath = toPosix(path.relative(REPO_ROOT, fullPath));
    if (IGNORED_RELATIVE_PATHS.has(relativePath)) continue;
    files.push(fullPath);
  }
  return files;
}

function extractDocMeta(filePath) {
  const content = readFileUtf8(filePath);
  const frontmatterMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!frontmatterMatch) return null;
  const yaml = frontmatterMatch[1];
  if (!/^\s*def:\s*$/m.test(yaml)) return null;
  const idMatch = content.match(/^\s*id:\s*(.+)$/m);
  if (!idMatch) return null;
  const levelMatch = content.match(/^\s*level:\s*(.+)$/m);
  const lifecycleMatch = content.match(/^\s*lifecycle:\s*(.+)$/m);
  const titleMatch = content.match(/^#\s+(.+)$/m);
  const contains = [];
  const lines = content.split(/\r?\n/);
  for (let index = 0; index < lines.length; index++) {
    if (!lines[index].includes("type: contains") || index === 0) continue;
    const targetMatch = lines[index - 1].match(/target:\s*(.+)$/);
    if (targetMatch) contains.push(targetMatch[1].trim());
  }
  return {
    id: idMatch ? idMatch[1].trim() : path.basename(filePath, path.extname(filePath)),
    level: levelMatch ? levelMatch[1].trim() : "leaf",
    lifecycle: lifecycleMatch ? lifecycleMatch[1].trim() : "draft",
    title: titleMatch ? titleMatch[1].trim() : path.basename(filePath, path.extname(filePath)),
    contains,
  };
}

function collectDocs() {
  const files = DOC_ROOTS.flatMap(collectFiles);
  const docs = new Map();

  for (const filePath of files) {
    const relativePath = toPosix(path.relative(REPO_ROOT, filePath));
    const meta = extractDocMeta(filePath);
    if (!meta) continue;
    docs.set(meta.id, {
      ...meta,
      filePath,
      relativePath,
      directory: toPosix(path.dirname(relativePath)),
      fileName: path.basename(relativePath),
    });
  }

  return docs;
}

function buildParentIndex(docs) {
  const parentsByChild = new Map();
  for (const doc of docs.values()) {
    for (const childId of doc.contains) {
      const parents = parentsByChild.get(childId) ?? [];
      parents.push(doc.id);
      parentsByChild.set(childId, parents);
    }
  }
  return parentsByChild;
}

function computeAncestorChain(docId, docs, parentsByChild) {
  const chain = [];
  const visited = new Set();
  let currentId = docId;

  while (currentId) {
    if (visited.has(currentId)) {
      return { status: "cycle", chain };
    }
    visited.add(currentId);
    chain.unshift(currentId);

    const parents = parentsByChild.get(currentId) ?? [];
    if (parents.length === 0) {
      return { status: "ok", chain };
    }
    if (parents.length > 1) {
      return { status: "multi-parent", chain, parents };
    }

    currentId = parents[0];
    if (!docs.has(currentId)) {
      return { status: "missing-parent", chain, parent: currentId };
    }
  }

  return { status: "ok", chain };
}

function chooseAnchor(chain, docs, strategy) {
  if (strategy === "strict") {
    return { anchorId: chain[0], anchorIndex: 0 };
  }

  const rootDoc = docs.get(chain[0]);
  const rootDirectory = rootDoc?.directory;

  for (let index = 1; index < chain.length; index++) {
    const ancestor = docs.get(chain[index]);
    if (!ancestor) continue;
    if (ancestor.directory !== rootDirectory) {
      return { anchorId: ancestor.id, anchorIndex: index };
    }
  }

  return { anchorId: chain[0], anchorIndex: 0 };
}

function computeMovePlan(docs, strategy) {
  const parentsByChild = buildParentIndex(docs);
  const moves = [];
  const roots = [];
  const blocked = [];

  for (const doc of [...docs.values()].sort((left, right) => left.relativePath.localeCompare(right.relativePath))) {
    if (doc.lifecycle === "deprecated" || doc.lifecycle === "archived") continue;

    const chainResult = computeAncestorChain(doc.id, docs, parentsByChild);
    if (chainResult.status !== "ok") {
      blocked.push({
        docId: doc.id,
        title: doc.title,
        currentPath: doc.relativePath,
        reason: chainResult.status,
        details:
          chainResult.status === "multi-parent"
            ? chainResult.parents
            : chainResult.parent
              ? [chainResult.parent]
              : chainResult.chain,
      });
      continue;
    }

    const chain = chainResult.chain;
    if (chain.length === 1) {
      roots.push({
        docId: doc.id,
        title: doc.title,
        currentPath: doc.relativePath,
        targetPath: doc.relativePath,
      });
      continue;
    }

    const { anchorId, anchorIndex } = chooseAnchor(chain, docs, strategy);
    const anchorDoc = docs.get(anchorId);
    if (!anchorDoc) {
      blocked.push({
        docId: doc.id,
        title: doc.title,
        currentPath: doc.relativePath,
        reason: "missing-anchor",
        details: chain,
      });
      continue;
    }

    const targetPath = toPosix(
      path.join(
        anchorDoc.directory,
        ...chain.slice(anchorIndex + 1, -1),
        doc.fileName,
      ),
    );

    moves.push({
      docId: doc.id,
      title: doc.title,
      level: doc.level,
      lifecycle: doc.lifecycle,
      chain,
      anchorId,
      currentPath: doc.relativePath,
      targetPath,
      changed: doc.relativePath !== targetPath,
    });
  }

  return {
    roots,
    moves,
    blocked,
  };
}

function formatMovePlanMarkdown(plan, strategy) {
  const changedMoves = plan.moves.filter((move) => move.changed);
  const lines = [
    "# Definition Topology Move Plan",
    "",
    "규칙:",
    `- 전략: \`${strategy}\``,
    strategy === "strict"
      ? "- `contains` 체인을 root부터 파일 경로 계층으로 투영한다."
      : "- 실제 subsystem bucket이 갈라지는 지점(anchor)부터 `contains` 체인을 파일 경로 계층으로 투영한다.",
    "- root 문서(contains 부모 없음)는 현재 위치를 유지한다.",
    "- active 문서만 대상으로 본다. `deprecated`/`archived`는 일단 제외한다.",
    strategy === "strict"
      ? "- child 문서는 `root-dir/<ancestor-id...>/<filename>`으로 이동시킨다."
      : "- child 문서는 `anchor-dir/<post-anchor-ancestor-id...>/<filename>`으로 이동시킨다.",
    "",
    `요약: root ${plan.roots.length}건, move 대상 ${changedMoves.length}건, blocked ${plan.blocked.length}건`,
    "",
    "## Root Documents",
    "",
  ];

  for (const root of plan.roots) {
    lines.push(`- \`${root.docId}\` → \`${root.currentPath}\``);
  }

  lines.push("", "## Proposed Moves", "");
  if (changedMoves.length === 0) {
    lines.push("- none");
  } else {
    for (const move of changedMoves) {
      lines.push(`- \`${move.docId}\``);
      lines.push(`  current: \`${move.currentPath}\``);
      lines.push(`  target: \`${move.targetPath}\``);
      lines.push(`  anchor: \`${move.anchorId}\``);
      lines.push(`  chain: \`${move.chain.join(" > ")}\``);
    }
  }

  lines.push("", "## Blocked", "");
  if (plan.blocked.length === 0) {
    lines.push("- none");
  } else {
    for (const item of plan.blocked) {
      lines.push(`- \`${item.docId}\` (\`${item.currentPath}\`)`);
      lines.push(`  reason: \`${item.reason}\``);
      lines.push(`  details: \`${(item.details ?? []).join(", ")}\``);
    }
  }

  lines.push("");
  return `${lines.join("\n")}\n`;
}

function parseOriginCandidates() {
  const candidates = [];
  const docs = DOC_ROOTS.flatMap(collectFiles);

  for (const filePath of docs) {
    const relativePath = toPosix(path.relative(REPO_ROOT, filePath));
    const meta = extractDocMeta(filePath);
    if (!meta) continue;
    const { id: newId, level } = meta;
    const content = readFileUtf8(filePath);
    const lines = content.split(/\r?\n/);

    for (const line of lines) {
      const trimmed = line.trim();
      const sourceKind = SOURCE_LINE_PREFIXES.find((prefix) => trimmed.startsWith(prefix));
      if (!sourceKind) continue;

      const pairMatches = [...trimmed.matchAll(/`([^`]+\.md)`\s*\(`([^`]+)`\)/g)];
      for (const match of pairMatches) {
        candidates.push({
          sourceKind,
          newId,
          newPath: relativePath,
          level,
          oldPath: match[1],
          oldId: match[2],
        });
      }

      // path만 적힌 경우도 root replacement 후보에 포함한다.
      if (pairMatches.length === 0) {
        const pathMatches = [...trimmed.matchAll(/`([^`]+\.md)`/g)];
        for (const match of pathMatches) {
          candidates.push({
            sourceKind,
            newId,
            newPath: relativePath,
            level,
            oldPath: match[1],
            oldId: null,
          });
        }
      }
    }
  }

  return candidates;
}

function scoreCandidate(candidate) {
  const sourceScore = candidate.sourceKind === "분할 전 원본:" ? 100 : 90;
  const levelScore =
    candidate.level === "group" ? 30 :
    candidate.level === "module" ? 20 :
    candidate.level === "leaf" ? 10 :
    0;
  return sourceScore + levelScore;
}

function dedupeCandidates(candidates) {
  const deduped = new Map();
  for (const candidate of candidates) {
    const key = `${candidate.newId}|${candidate.newPath}|${candidate.oldPath}|${candidate.oldId ?? ""}`;
    if (!deduped.has(key)) deduped.set(key, candidate);
  }
  return [...deduped.values()];
}

function chooseCanonical(candidates) {
  const uniqueCandidates = dedupeCandidates(candidates);
  if (uniqueCandidates.length === 0) return { status: "missing", candidate: null, alternatives: [] };

  const sorted = [...uniqueCandidates].sort((a, b) => scoreCandidate(b) - scoreCandidate(a));
  const bestScore = scoreCandidate(sorted[0]);
  const best = sorted.filter((candidate) => scoreCandidate(candidate) === bestScore);
  const uniqueBestTargets = new Map(best.map((candidate) => [`${candidate.newId}|${candidate.newPath}`, candidate]));

  if (uniqueBestTargets.size === 1) {
    return { status: "unique", candidate: [...uniqueBestTargets.values()][0], alternatives: sorted.slice(1) };
  }

  return { status: "ambiguous", candidate: null, alternatives: sorted };
}

function buildCanonicalMap(candidates, keyName) {
  const grouped = new Map();
  for (const candidate of candidates) {
    const key = candidate[keyName];
    if (!key) continue;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(candidate);
  }

  const canonical = new Map();
  for (const [key, group] of grouped) {
    canonical.set(key, chooseCanonical(group));
  }
  return canonical;
}

function getDeletedDocs() {
  try {
    const output = childProcess.execFileSync(
      "git",
      ["status", "--short", "--", "docs/specs"],
      { cwd: REPO_ROOT, encoding: "utf8" },
    );
    return output
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.startsWith("D ") || line.startsWith("D\t") || line.startsWith("D"))
      .map((line) => line.slice(1).trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isSourceLine(line) {
  const trimmed = line.trim();
  return SOURCE_LINE_PREFIXES.some((prefix) => trimmed.startsWith(prefix));
}

function collectStaleReferences(pathMap, idMap, options) {
  const stale = [];
  const files = SEARCH_ROOTS.flatMap(collectFiles);

  for (const filePath of files) {
    const relativePath = toPosix(path.relative(REPO_ROOT, filePath));
    const content = readFileUtf8(filePath);
    const lines = content.split(/\r?\n/);

    for (let index = 0; index < lines.length; index++) {
      const line = lines[index];
      if (isSourceLine(line)) continue;

      for (const [oldPath, resolution] of pathMap) {
        if (!line.includes(oldPath)) continue;
        stale.push({
          file: relativePath,
          line: index + 1,
          kind: "path",
          from: oldPath,
          to: resolution.status === "unique" ? resolution.candidate.newPath : null,
          resolution: resolution.status,
        });
      }

      for (const [oldId, resolution] of idMap) {
        const boundary = new RegExp(`(^|[^A-Za-z0-9_-])${escapeRegExp(oldId)}([^A-Za-z0-9_-]|$)`);
        if (!boundary.test(line)) continue;
        stale.push({
          file: relativePath,
          line: index + 1,
          kind: "id",
          from: oldId,
          to: resolution.status === "unique" ? resolution.candidate.newId : null,
          resolution: resolution.status,
        });
      }
    }
  }

  if (options.limit > 0) {
    return stale.slice(0, options.limit);
  }
  return stale;
}

function applyRewrites(pathMap, idMap) {
  const files = SEARCH_ROOTS.flatMap(collectFiles);
  let changedFiles = 0;
  let changedLines = 0;

  for (const filePath of files) {
    const relativePath = toPosix(path.relative(REPO_ROOT, filePath));
    const original = readFileUtf8(filePath);
    const lines = original.split(/\r?\n/);
    let changed = false;

    for (let index = 0; index < lines.length; index++) {
      if (isSourceLine(lines[index])) continue;

      let next = lines[index];

      for (const [oldPath, resolution] of pathMap) {
        if (resolution.status !== "unique") continue;
        if (!next.includes(oldPath)) continue;
        next = next.split(oldPath).join(resolution.candidate.newPath);
      }

      for (const [oldId, resolution] of idMap) {
        if (resolution.status !== "unique") continue;
        const pattern = new RegExp(`(^|[^A-Za-z0-9_-])(${escapeRegExp(oldId)})([^A-Za-z0-9_-]|$)`, "g");
        if (!pattern.test(next)) continue;
        next = next.replace(pattern, `$1${resolution.candidate.newId}$3`);
      }

      if (next !== lines[index]) {
        lines[index] = next;
        changed = true;
        changedLines++;
      }
    }

    if (!changed) continue;

    fs.writeFileSync(filePath, `${lines.join("\n")}\n`);
    changedFiles++;
    console.log(`  rewrote ${relativePath}`);
  }

  return { changedFiles, changedLines };
}

function formatCanonicalEntries(canonicalMap, formatter) {
  return [...canonicalMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([from, resolution]) => {
      if (resolution.status !== "unique") {
        return {
          from,
          status: resolution.status,
          to: null,
          targetPath: null,
          alternatives: resolution.alternatives.map((candidate) => ({
            id: candidate.newId,
            path: candidate.newPath,
          })),
        };
      }
      return formatter(from, resolution.candidate);
    });
}

function main() {
  const options = parseArgs(process.argv);
  const candidates = parseOriginCandidates();
  const canonicalByOldId = buildCanonicalMap(
    candidates.filter((candidate) => candidate.oldId),
    "oldId",
  );
  const canonicalByOldPath = buildCanonicalMap(candidates, "oldPath");

  const deletedDocs = getDeletedDocs();
  const deletedSummary = deletedDocs.map((deletedPath) => {
    const resolution = canonicalByOldPath.get(deletedPath) ?? { status: "missing", candidate: null };
    return {
      deletedPath,
      replacement: resolution.status === "unique" ? resolution.candidate.newPath : null,
      replacementId: resolution.status === "unique" ? resolution.candidate.newId : null,
      status: resolution.status,
    };
  });

  const stale = collectStaleReferences(canonicalByOldPath, canonicalByOldId, options);

  const report = {
    mappingsById: formatCanonicalEntries(canonicalByOldId, (from, candidate) => ({
      from,
      status: "unique",
      to: candidate.newId,
      targetPath: candidate.newPath,
      alternatives: [],
    })),
    mappingsByPath: formatCanonicalEntries(canonicalByOldPath, (from, candidate) => ({
      from,
      status: "unique",
      to: candidate.newPath,
      targetPath: candidate.newPath,
      replacementId: candidate.newId,
      alternatives: [],
    })),
    deletedDocs: deletedSummary,
    staleReferences: stale,
  };

  if (options.mode === "move-plan") {
    const docs = collectDocs();
    const movePlan = computeMovePlan(docs, options.strategy);
    const markdown = formatMovePlanMarkdown(movePlan, options.strategy);

    if (options.out) {
      const outPath = path.resolve(REPO_ROOT, options.out);
      fs.writeFileSync(outPath, markdown);
      console.log(`wrote move plan: ${toPosix(path.relative(REPO_ROOT, outPath))}`);
      return;
    }

    process.stdout.write(markdown);
    return;
  }

  if (options.mode === "rewrite") {
    const dryRun = !options.write;
    console.log(dryRun ? "Rewrite dry-run" : "Rewrite apply");
    console.log(`  stale references sampled: ${stale.length}`);
    if (dryRun) {
      console.log("  pass --write to apply unique replacements");
    } else {
      const rewritten = applyRewrites(canonicalByOldPath, canonicalByOldId);
      console.log(`  changed files: ${rewritten.changedFiles}`);
      console.log(`  changed lines: ${rewritten.changedLines}`);
    }
    return;
  }

  if (options.json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return;
  }

  console.log("Canonical old-id -> new-id mappings");
  for (const entry of report.mappingsById) {
    if (entry.status === "unique") {
      console.log(`  ${entry.from} -> ${entry.to} (${entry.targetPath})`);
      continue;
    }
    console.log(`  ${entry.from} -> [${entry.status}]`);
  }

  console.log("\nDeleted docs in working tree");
  for (const entry of report.deletedDocs) {
    const target = entry.replacement ? `${entry.replacementId} (${entry.replacement})` : `[${entry.status}]`;
    console.log(`  ${entry.deletedPath} -> ${target}`);
  }

  console.log(`\nSample stale references (limit ${options.limit})`);
  if (report.staleReferences.length === 0) {
    console.log("  none");
  } else {
    for (const entry of report.staleReferences) {
      const target = entry.to ?? `[${entry.resolution}]`;
      console.log(`  ${entry.file}:${entry.line} ${entry.kind} ${entry.from} -> ${target}`);
    }
  }
}

main();
