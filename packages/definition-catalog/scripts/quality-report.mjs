import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = resolve(SCRIPT_DIR, "../../..");
const DOCS_DIR = join(DEFAULT_ROOT, "docs");

function walkMarkdownFiles(dir) {
  const files = [];

  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const info = statSync(fullPath);

    if (info.isDirectory()) {
      files.push(...walkMarkdownFiles(fullPath));
      continue;
    }

    if (entry.endsWith(".md")) files.push(fullPath);
  }

  return files;
}

function extractFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return null;
  return { yaml: match[1], body: match[2] };
}

function stripQuotes(value) {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}

function parseInlineArray(value) {
  const trimmed = value.trim();
  if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) return [];

  const inner = trimmed.slice(1, -1).trim();
  if (inner.length === 0) return [];

  return inner
    .split(",")
    .map(item => stripQuotes(item.trim()))
    .filter(Boolean);
}

function parseDefBlock(yaml) {
  const lines = yaml.split(/\r?\n/);
  const def = {
    id: "",
    depth: "",
    lifecycle: "",
    tags: [],
    links: [],
  };

  let inDef = false;
  let inLinks = false;
  let currentLink = null;

  for (const rawLine of lines) {
    const indent = rawLine.length - rawLine.trimStart().length;
    const line = rawLine.trim();

    if (line.length === 0 || line.startsWith("#")) continue;

    if (!inDef) {
      if (indent === 0 && line === "def:") inDef = true;
      continue;
    }

    if (indent === 0) break;

    if (indent === 2) {
      inLinks = false;

      if (line === "links:") {
        inLinks = true;
        currentLink = null;
        continue;
      }

      const field = line.match(/^(\w+):\s*(.+)$/);
      if (!field) continue;

      const [, key, value] = field;
      const parsedValue = stripQuotes(value.trim());

      if (key === "id" || key === "depth" || key === "lifecycle") {
        def[key] = parsedValue;
      }

      if (key === "tags") {
        def.tags = parseInlineArray(value);
      }

      continue;
    }

    if (!inLinks) continue;

    if (indent === 4 && line.startsWith("- ")) {
      currentLink = {};
      def.links.push(currentLink);

      const field = line.slice(2).match(/^(\w+):\s*(.+)$/);
      if (field) {
        const [, key, value] = field;
        currentLink[key] = stripQuotes(value.trim());
      }
      continue;
    }

    if (indent === 6 && currentLink) {
      const field = line.match(/^(\w+):\s*(.+)$/);
      if (!field) continue;
      const [, key, value] = field;
      currentLink[key] = stripQuotes(value.trim());
    }
  }

  return def;
}

function extractPurposeText(content) {
  const lines = content.split(/\r?\n/);
  let start = -1;

  for (let index = 0; index < lines.length; index += 1) {
    if (/^##\s+.*\^purpose\b/.test(lines[index])) {
      start = index + 1;
      break;
    }
  }

  if (start === -1) return "";

  const collected = [];
  for (let index = start; index < lines.length; index += 1) {
    if (/^##\s+/.test(lines[index])) break;
    const trimmed = lines[index].trim();
    if (trimmed) collected.push(trimmed);
  }

  return collected.join(" ").trim();
}

function toPercent(part, total) {
  if (total === 0) return "0.0";
  return ((part / total) * 100).toFixed(1);
}

function sortById(items) {
  return [...items].sort((left, right) => left.id.localeCompare(right.id));
}

export function collectQualityStats(rootDir = DEFAULT_ROOT) {
  const docsDir = join(rootDir, "docs");
  const approvedDocs = [];

  for (const filePath of walkMarkdownFiles(docsDir)) {
    const content = readFileSync(filePath, "utf-8");
    const fm = extractFrontmatter(content);
    if (!fm) continue;

    const def = parseDefBlock(fm.yaml);
    if (def.lifecycle !== "approved" || !def.id) continue;

    const hasContainsLink = def.links.some(link => link.type === "contains");
    const isGroup = def.depth === "overview" && hasContainsLink;
    const purposeText = extractPurposeText(content);
    const hasPurpose = content.includes("^purpose");
    const hasOverview = content.includes("^overview");

    approvedDocs.push({
      id: def.id,
      filePath: relative(rootDir, filePath),
      tags: def.tags,
      links: def.links,
      isGroup,
      hasPurpose,
      hasOverview,
      purposeLength: purposeText.length,
    });
  }

  const purposeCovered = approvedDocs.filter(doc => doc.hasPurpose);
  const linksMissingLeafDocs = sortById(approvedDocs.filter(doc =>
    !doc.isGroup && doc.links.length === 0 && !doc.tags.includes("generated"),
  ));
  const purposeTooShort = sortById(
    approvedDocs.filter(doc => doc.hasPurpose && doc.purposeLength < 30),
  );
  const groupsWithoutOverview = sortById(
    approvedDocs.filter(doc => doc.isGroup && !doc.hasOverview),
  );
  const tagsMissingDocs = sortById(
    approvedDocs.filter(doc => doc.tags.length === 0 && !doc.tags.includes("generated")),
  );

  return {
    scannedDir: relative(rootDir, docsDir),
    documents: sortById(approvedDocs),
    totals: {
      approved: approvedDocs.length,
      groups: approvedDocs.filter(doc => doc.isGroup).length,
      leaf: approvedDocs.filter(doc => !doc.isGroup).length,
    },
    purposeCoverage: {
      withPurpose: purposeCovered.length,
      total: approvedDocs.length,
      percent: toPercent(purposeCovered.length, approvedDocs.length),
    },
    linksMissingLeafDocs,
    purposeTooShort,
    groupsWithoutOverview,
    tagsMissingDocs,
  };
}

export function formatQualityReport(stats) {
  const lines = [
    "Definition Catalog 품질 리포트",
    `기준 경로: ${stats.scannedDir}`,
    `approved 문서: ${stats.totals.approved}건 (그룹 ${stats.totals.groups} / 리프 ${stats.totals.leaf})`,
    "",
    `^purpose 커버리지: ${stats.purposeCoverage.withPurpose}/${stats.purposeCoverage.total} (${stats.purposeCoverage.percent}%)`,
    `links 없는 리프 문서 수: ${stats.linksMissingLeafDocs.length}`,
    `tags 없는 문서 수: ${stats.tagsMissingDocs.length}`,
    "",
    `purpose 30자 미만 문서 목록 (${stats.purposeTooShort.length}건)`,
  ];

  if (stats.purposeTooShort.length === 0) {
    lines.push("- 없음");
  } else {
    for (const doc of stats.purposeTooShort) {
      lines.push(`- ${doc.id} (${doc.purposeLength}자) - ${doc.filePath}`);
    }
  }

  lines.push("");
  lines.push(`^overview 없는 그룹 문서 목록 (${stats.groupsWithoutOverview.length}건)`);

  if (stats.groupsWithoutOverview.length === 0) {
    lines.push("- 없음");
  } else {
    for (const doc of stats.groupsWithoutOverview) {
      lines.push(`- ${doc.id} - ${doc.filePath}`);
    }
  }

  return lines.join("\n");
}

function isDirectRun() {
  return process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}

if (isDirectRun()) {
  const stats = collectQualityStats();
  console.log(formatQualityReport(stats));
}
