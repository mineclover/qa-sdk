#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const format = readOption("--format", "markdown");
const limit = Number(readOption("--limit", "40"));
const includeAll = args.includes("--all");

const EXCLUDED_DIRS = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  "coverage",
  ".turbo",
  ".next",
  ".vite",
]);

function readOption(name, fallback) {
  const index = args.indexOf(name);
  if (index === -1) return fallback;
  return args[index + 1] ?? fallback;
}

function walk(dir, predicate = () => true) {
  const result = [];
  for (const entry of readdirSync(dir)) {
    if (EXCLUDED_DIRS.has(entry)) continue;
    const absolute = join(dir, entry);
    const stats = statSync(absolute);
    if (stats.isDirectory()) {
      result.push(...walk(absolute, predicate));
    } else if (predicate(absolute)) {
      result.push(absolute);
    }
  }
  return result;
}

function readText(path) {
  return readFileSync(path, "utf8");
}

function repoPath(path) {
  return relative(repoRoot, path);
}

function parseFrontmatter(text) {
  if (!text.startsWith("---\n")) return emptyFrontmatter();
  const end = text.indexOf("\n---", 4);
  if (end === -1) return emptyFrontmatter();
  const frontmatter = text.slice(4, end);
  return {
    lifecycle: matchValue(frontmatter, "lifecycle"),
    type: matchValue(frontmatter, "type"),
    tier: matchValue(frontmatter, "tier"),
    scope: matchValue(frontmatter, "scope"),
    aspect: matchValue(frontmatter, "aspect"),
    hasSources: /^\s*sources:\s*$/m.test(frontmatter),
    sourceRefs: [...frontmatter.matchAll(/^\s*-\s+((?:packages|docs|scripts)\/[^\n#]+)/gm)]
      .map((match) => match[1].trim()),
  };
}

function emptyFrontmatter() {
  return {
    lifecycle: "",
    type: "",
    tier: "",
    scope: "",
    aspect: "",
    hasSources: false,
    sourceRefs: [],
  };
}

function matchValue(frontmatter, key) {
  return frontmatter.match(new RegExp(`^(?: {0,2})${key}:\\s*([^\\n#]+)`, "m"))?.[1]?.trim() ?? "";
}

function classifyDoc(path) {
  const text = readText(path);
  const frontmatter = parseFrontmatter(text);
  const relativePath = repoPath(path);
  const isProposal = relativePath.startsWith("docs/proposals/");
  const isSpec = relativePath.startsWith("docs/specs/");
  const isRule = relativePath.endsWith(".rule.md");
  const hasCommand = /\b(pnpm|node|tsx|qa-sdk|vitest|smoke|arch:feedback|def validate)\b/.test(text);
  const hasTestWords = /\b(test|fixture|smoke|verification|검증|validation)\b/i.test(text);
  const hasPackageRef = /\bpackages\//.test(text);
  const hasSourceRefs = frontmatter.sourceRefs.length > 0;
  const existingSourceRefs = frontmatter.sourceRefs.filter((source) => existsSync(join(repoRoot, source)));
  const missingSourceRefs = frontmatter.sourceRefs.filter((source) => !existsSync(join(repoRoot, source)));
  const evidenceScore = [
    hasSourceRefs,
    existingSourceRefs.length > 0,
    hasCommand,
    hasTestWords,
    hasPackageRef,
  ].filter(Boolean).length;

  let verdict = "prove";
  const reasons = [];

  if (evidenceScore >= 3) {
    verdict = "keep";
    reasons.push("has executable/source evidence");
  }

  if (frontmatter.lifecycle === "approved" && evidenceScore < 2 && isSpec) {
    verdict = "prove";
    reasons.push("approved spec needs execution evidence");
  }

  if (isProposal && !/status:\s*(implemented|accepted)/.test(text) && evidenceScore < 2) {
    verdict = "prove";
    reasons.push("open proposal needs execution evidence");
  }

  if (isRule && evidenceScore < 2) {
    verdict = "prove";
    reasons.push("rule needs command/source proof");
  }

  if (missingSourceRefs.length > 0) {
    verdict = "prove";
    reasons.push(`missing source refs: ${missingSourceRefs.slice(0, 3).join(", ")}`);
  }

  if (reasons.length === 0) {
    reasons.push("needs review");
  }

  return {
    path: relativePath,
    verdict,
    lifecycle: frontmatter.lifecycle || "-",
    type: frontmatter.type || "-",
    tier: frontmatter.tier || "-",
    evidenceScore,
    sourceRefs: frontmatter.sourceRefs.length,
    reasons,
  };
}

function classifyPackage(packageJsonPath) {
  const packageDir = resolve(packageJsonPath, "..");
  const manifest = JSON.parse(readText(packageJsonPath));
  const packagePath = repoPath(packageDir);
  const scripts = manifest.scripts ?? {};
  const hasSrc = existsSync(join(packageDir, "src"));
  const hasPublic = existsSync(join(packageDir, "public"));
  const hasRuntimeSurface = hasSrc || hasPublic;
  const hasReadme = existsSync(join(packageDir, "README.md"));
  const testFiles = hasSrc
    ? walk(join(packageDir, "src"), (path) => /\.(test|spec)\.[cm]?[jt]sx?$/.test(path))
    : [];
  const hasTestScript = Boolean(scripts.test);
  const hasBuildScript = Boolean(scripts.build);
  const hasRunScript = Boolean(scripts.dev || scripts.start);
  const hasBin = Boolean(manifest.bin);
  const evidenceScore = [
    hasRuntimeSurface,
    hasReadme,
    hasTestScript,
    testFiles.length > 0,
    hasBuildScript,
    hasRunScript,
    hasBin,
  ].filter(Boolean).length;

  let verdict = "prove";
  const reasons = [];

  if (evidenceScore >= 4) {
    verdict = "keep";
    reasons.push("has package source, docs, tests/build/bin evidence");
  }

  if (hasRuntimeSurface && !hasTestScript && testFiles.length === 0) {
    verdict = "prove";
    reasons.push("source package has no local test evidence");
  }

  if (!hasRuntimeSurface && !hasBin && Object.keys(scripts).length === 0) {
    verdict = "quarantine";
    reasons.push("package has no source, bin, or scripts");
  }

  if (!hasReadme) {
    reasons.push("missing README");
  }

  if (reasons.length === 0) {
    reasons.push("needs review");
  }

  return {
    path: packagePath,
    name: manifest.name ?? packagePath,
    verdict,
    evidenceScore,
    hasReadme,
    hasRuntimeSurface,
    hasTestScript,
    testFiles: testFiles.length,
    hasBuildScript,
    hasRunScript,
    hasBin,
    reasons,
  };
}

function workspacePackageJsonPaths() {
  const workspacePath = join(repoRoot, "pnpm-workspace.yaml");
  const patterns = existsSync(workspacePath)
    ? readWorkspacePackagePatterns(readText(workspacePath))
    : ["packages/*"];
  const packageJsonPaths = new Set();

  for (const pattern of patterns) {
    addWorkspacePatternPackageJsons(pattern, packageJsonPaths);
  }

  return [...packageJsonPaths].sort();
}

function readWorkspacePackagePatterns(text) {
  const patterns = [];
  let inPackages = false;

  for (const line of text.split("\n")) {
    if (/^packages:\s*$/.test(line)) {
      inPackages = true;
      continue;
    }
    if (inPackages && /^[^\s#][^:]*:\s*/.test(line)) break;
    const packageMatch = inPackages
      ? line.match(/^\s*-\s+["']?([^"'\n]+)["']?\s*$/)
      : null;
    if (packageMatch && !packageMatch[1].startsWith("!")) {
      patterns.push(packageMatch[1]);
    }
  }

  return patterns;
}

function addWorkspacePatternPackageJsons(pattern, packageJsonPaths) {
  if (!pattern.includes("*")) {
    const manifestPath = join(repoRoot, pattern, "package.json");
    if (existsSync(manifestPath)) packageJsonPaths.add(manifestPath);
    return;
  }

  if (!pattern.endsWith("/*")) return;
  const baseDir = join(repoRoot, pattern.slice(0, -2));
  if (!existsSync(baseDir)) return;

  for (const entry of readdirSync(baseDir)) {
    if (EXCLUDED_DIRS.has(entry) || entry.startsWith(".")) continue;
    const manifestPath = join(baseDir, entry, "package.json");
    if (existsSync(manifestPath) && statSync(join(baseDir, entry)).isDirectory()) {
      packageJsonPaths.add(manifestPath);
    }
  }
}

const docs = walk(join(repoRoot, "docs"), (path) => path.endsWith(".md"))
  .map(classifyDoc);
const packages = workspacePackageJsonPaths()
  .map(classifyPackage);

const report = {
  generatedAt: new Date().toISOString(),
  summary: {
    docs: summarize(docs),
    packages: summarize(packages),
  },
  docs,
  packages,
};

function summarize(items) {
  return items.reduce((acc, item) => {
    acc[item.verdict] = (acc[item.verdict] ?? 0) + 1;
    return acc;
  }, {});
}

function byPriority(left, right) {
  const rank = { quarantine: 0, prove: 1, keep: 2 };
  return (rank[left.verdict] ?? 9) - (rank[right.verdict] ?? 9)
    || left.evidenceScore - right.evidenceScore
    || left.path.localeCompare(right.path);
}

function renderMarkdown() {
  const lines = [];
  lines.push("# qa-sdk Design Usefulness Audit");
  lines.push("");
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(`- Docs: ${formatSummary(report.summary.docs)}`);
  lines.push(`- Packages: ${formatSummary(report.summary.packages)}`);
  lines.push("");
  lines.push("## Package Candidates");
  lines.push("");
  lines.push("| Verdict | Score | Package | Evidence | Reason |");
  lines.push("|---|---:|---|---|---|");
  for (const item of [...packages].sort(byPriority).slice(0, limit)) {
    lines.push(`| ${item.verdict} | ${item.evidenceScore} | \`${item.name}\`<br>\`${item.path}\` | runtime=${item.hasRuntimeSurface}, readme=${item.hasReadme}, testScript=${item.hasTestScript}, tests=${item.testFiles}, build=${item.hasBuildScript}, run=${item.hasRunScript}, bin=${item.hasBin} | ${item.reasons.join("; ")} |`);
  }
  lines.push("");
  lines.push("## Doc Candidates");
  lines.push("");
  lines.push("| Verdict | Score | Lifecycle | Doc | Sources | Reason |");
  lines.push("|---|---:|---|---|---:|---|");
  for (const item of [...docs].sort(byPriority).slice(0, limit)) {
    lines.push(`| ${item.verdict} | ${item.evidenceScore} | ${item.lifecycle} | \`${item.path}\` | ${item.sourceRefs} | ${item.reasons.join("; ")} |`);
  }
  lines.push("");
  lines.push("## Rule");
  lines.push("");
  lines.push("This report is a candidate generator, not an automatic deletion list. Use `docs/specs/system/design-usefulness-audit.rule.md` before changing lifecycle, archiving, or removing docs/packages.");
  return `${lines.join("\n")}\n`;
}

function formatSummary(summary) {
  return ["keep", "prove", "quarantine", "remove"]
    .filter((key) => summary[key])
    .map((key) => `${key}=${summary[key]}`)
    .join(", ");
}

if (format === "json") {
  console.log(JSON.stringify(renderJson(), null, 2));
} else {
  console.log(renderMarkdown());
}

function renderJson() {
  if (includeAll) return report;
  return {
    generatedAt: report.generatedAt,
    summary: report.summary,
    packageCandidates: [...packages].sort(byPriority).slice(0, limit),
    docCandidates: [...docs].sort(byPriority).slice(0, limit),
    note: "Use --all to include every scanned doc and package.",
  };
}
