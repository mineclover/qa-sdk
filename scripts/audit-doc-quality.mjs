#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const DEFAULT_DIRS = ["docs/specs"];
const IGNORED_DIRS = new Set([
  ".git",
  ".next",
  ".turbo",
  "coverage",
  "dist",
  "node_modules",
]);

function parseArgs(argv) {
  const options = {
    dirs: [],
    failOnWarning: false,
    json: false,
    minLines: 250,
    minParagraphChars: 140,
  };

  for (const arg of argv) {
    if (arg === "--") {
      continue;
    } else if (arg === "--json") {
      options.json = true;
    } else if (arg === "--fail-on-warning") {
      options.failOnWarning = true;
    } else if (arg.startsWith("--min-lines=")) {
      options.minLines = Number(arg.slice("--min-lines=".length));
    } else if (arg.startsWith("--min-paragraph-chars=")) {
      options.minParagraphChars = Number(arg.slice("--min-paragraph-chars=".length));
    } else if (arg.startsWith("-")) {
      throw new Error(`Unknown option: ${arg}`);
    } else {
      options.dirs.push(arg);
    }
  }

  if (options.dirs.length === 0) options.dirs = [...DEFAULT_DIRS];
  if (!Number.isFinite(options.minLines) || options.minLines < 1) {
    throw new Error("--min-lines must be a positive number");
  }
  if (!Number.isFinite(options.minParagraphChars) || options.minParagraphChars < 40) {
    throw new Error("--min-paragraph-chars must be at least 40");
  }

  return options;
}

function walkMarkdownFiles(inputPath) {
  const files = [];
  if (!existsSync(inputPath)) return files;
  const stat = statSync(inputPath);
  if (stat.isFile()) {
    if (inputPath.endsWith(".md")) files.push(inputPath);
    return files;
  }

  for (const entry of readdirSync(inputPath)) {
    if (IGNORED_DIRS.has(entry)) continue;
    files.push(...walkMarkdownFiles(path.join(inputPath, entry)));
  }
  return files;
}

function parseMarkdown(filePath) {
  const text = readFileSync(filePath, "utf8");
  const frontmatterMatch = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  const frontmatter = frontmatterMatch?.[1] ?? "";
  const body = frontmatterMatch ? text.slice(frontmatterMatch[0].length) : text;
  const relativePath = path.relative(process.cwd(), filePath).split(path.sep).join("/");
  return {
    body,
    frontmatter,
    lineCount: text.split(/\r?\n/).length,
    path: relativePath,
  };
}

function extractField(frontmatter, field) {
  const match = frontmatter.match(new RegExp(`^\\s{2}${field}:\\s*(.+?)\\s*$`, "m"));
  return match?.[1]?.replace(/^["']|["']$/g, "") ?? undefined;
}

function hasMarker(body, marker) {
  return new RegExp(`^##\\s+.*\\^${marker}\\b`, "m").test(body);
}

function stripMarkdownNoise(body) {
  return body
    .replace(/```[\s\S]*?```/g, "\n")
    .replace(/`[^`\n]+`/g, " ")
    .replace(/\[[^\]]+\]\([^)]+\)/g, " ")
    .replace(/https?:\/\/\S+/g, " ");
}

function normalizeParagraph(paragraph) {
  return paragraph
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/[#*_>|[\]()`.,;:!?{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function extractParagraphs(doc, minParagraphChars) {
  return stripMarkdownNoise(doc.body)
    .split(/\n\s*\n/g)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => {
      if (paragraph.length < minParagraphChars) return false;
      if (/^\s*[-*]\s+/m.test(paragraph)) return false;
      if (/^\s*\|/.test(paragraph)) return false;
      if (/^#{1,6}\s+/.test(paragraph)) return false;
      return true;
    })
    .map((paragraph) => ({
      normalized: normalizeParagraph(paragraph),
      preview: paragraph.replace(/\s+/g, " ").slice(0, 180),
    }))
    .filter((paragraph) => paragraph.normalized.length >= minParagraphChars);
}

function responsibilitySignals(body) {
  const headings = body
    .split(/\r?\n/)
    .filter((line) => /^##+\s+/.test(line))
    .join("\n")
    .toLowerCase();

  const signals = [];
  if (/(system|runtime|behavior|transform|adapter|sync|동작|실행|변환)/.test(headings)) {
    signals.push("system");
  }
  if (/(api|cli|event|contract|command|query|interface|인터페이스|계약)/.test(headings)) {
    signals.push("interface");
  }
  if (/(schema|state|data|evidence|validation|component|상태|데이터|검증)/.test(headings)) {
    signals.push("component");
  }
  if (/(layout|pack|bundle|rollup|조망|배치|묶음)/.test(headings)) {
    signals.push("layout-pack");
  }
  if (/(test|case|scenario|테스트|시나리오)/.test(headings)) {
    signals.push("test");
  }
  return signals;
}

function analyzeDocs(files, options) {
  const docs = files.map(parseMarkdown);
  const missingPurpose = [];
  const missingOverview = [];
  const splitCandidates = [];
  const paragraphOwners = new Map();

  for (const doc of docs) {
    const id = extractField(doc.frontmatter, "id") ?? path.basename(doc.path, ".md");
    const level = extractField(doc.frontmatter, "level") ?? "leaf";
    const lifecycle = extractField(doc.frontmatter, "lifecycle") ?? "unknown";
    const containsLinks = /^\s{6}-\s+target:|^\s{6}type:\s+contains/m.test(doc.frontmatter)
      && /^\s{6}type:\s+contains/m.test(doc.frontmatter);
    const purpose = hasMarker(doc.body, "purpose");
    const overview = hasMarker(doc.body, "overview");
    const h2Count = (doc.body.match(/^##\s+/gm) ?? []).length;
    const signals = responsibilitySignals(doc.body);

    if (!purpose) {
      missingPurpose.push({ id, path: doc.path, lifecycle });
    }
    if ((level === "group" || level === "module" || containsLinks) && !overview) {
      missingOverview.push({ id, path: doc.path, level, lifecycle });
    }
    if (doc.lineCount >= options.minLines && (signals.length >= 3 || h2Count >= 12)) {
      splitCandidates.push({
        id,
        path: doc.path,
        lineCount: doc.lineCount,
        h2Count,
        signals,
      });
    }

    for (const paragraph of extractParagraphs(doc, options.minParagraphChars)) {
      const owners = paragraphOwners.get(paragraph.normalized) ?? [];
      owners.push({ id, path: doc.path, preview: paragraph.preview });
      paragraphOwners.set(paragraph.normalized, owners);
    }
  }

  const duplicateParagraphs = [...paragraphOwners.values()]
    .filter((owners) => new Set(owners.map((owner) => owner.path)).size > 1)
    .map((owners) => ({
      count: owners.length,
      preview: owners[0].preview,
      locations: owners.map(({ id, path }) => ({ id, path })),
    }))
    .toSorted((a, b) => b.count - a.count || a.preview.localeCompare(b.preview));

  return {
    duplicateParagraphs,
    missingOverview,
    missingPurpose,
    scannedDocs: docs.length,
    splitCandidates: splitCandidates.toSorted((a, b) => b.lineCount - a.lineCount),
  };
}

function printList(title, items, render, limit = 20) {
  console.log(title);
  if (items.length === 0) {
    console.log("  none");
    return;
  }
  for (const item of items.slice(0, limit)) {
    console.log(`  ${render(item)}`);
  }
  if (items.length > limit) console.log(`  ... ${items.length - limit} more`);
}

function printReport(report, options) {
  console.log("Document Quality Audit");
  console.log(`  scope: ${options.dirs.join(", ")}`);
  console.log(`  scanned docs: ${report.scannedDocs}`);
  console.log(`  missing purpose: ${report.missingPurpose.length}`);
  console.log(`  missing overview: ${report.missingOverview.length}`);
  console.log(`  split candidates: ${report.splitCandidates.length}`);
  console.log(`  duplicate paragraphs: ${report.duplicateParagraphs.length}`);
  console.log();

  printList(
    "Missing purpose marker",
    report.missingPurpose,
    (item) => `${item.path} (${item.id}, ${item.lifecycle})`,
  );
  console.log();
  printList(
    "Missing overview marker",
    report.missingOverview,
    (item) => `${item.path} (${item.id}, level=${item.level}, ${item.lifecycle})`,
  );
  console.log();
  printList(
    "Split candidates",
    report.splitCandidates,
    (item) => `${item.path} (${item.lineCount} lines, h2=${item.h2Count}, signals=${item.signals.join(",")})`,
  );
  console.log();
  printList(
    "Exact duplicate paragraph candidates",
    report.duplicateParagraphs,
    (item) => `${item.count}x "${item.preview}" :: ${item.locations.map((loc) => loc.path).join(" | ")}`,
  );
}

try {
  const options = parseArgs(process.argv.slice(2));
  const files = options.dirs
    .flatMap((inputPath) => walkMarkdownFiles(path.resolve(process.cwd(), inputPath)))
    .toSorted((a, b) => a.localeCompare(b));
  const report = analyzeDocs(files, options);
  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printReport(report, options);
  }

  const issueCount =
    report.missingPurpose.length
    + report.missingOverview.length
    + report.splitCandidates.length
    + report.duplicateParagraphs.length;
  if (options.failOnWarning && issueCount > 0) process.exitCode = 2;
} catch (error) {
  console.error((error instanceof Error ? error.message : String(error)));
  process.exitCode = 1;
}
