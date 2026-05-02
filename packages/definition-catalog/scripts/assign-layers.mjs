/**
 * assign-layers.mjs
 *
 * 명확하게 분류 가능한 문서에 layer 필드를 자동 부여한다.
 * 모호한 문서는 건드리지 않는다 (미지정 = 기존 동작 호환).
 *
 * 자동 분류 규칙:
 *   business:    constraint/*, data/*, state/domain_state, state/system_state
 *   interaction: ui/*
 *
 * 사용법:
 *   node scripts/assign-layers.mjs [--dry-run]
 */

import { readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SCRIPT_DIR, "../../..");
const DOCS_DIR = join(ROOT, "docs");
const DRY_RUN = process.argv.includes("--dry-run");

// ── 자동 분류 규칙 ──────────────────────────────────────

function classifyLayer(scope, aspect) {
  // domain: 비즈니스 본질 — "이것이 참이다"
  if (scope === "constraint") return "domain";
  if (scope === "data") return "domain";
  if (scope === "state" && (aspect === "domain_state" || aspect === "system_state")) return "domain";

  // experience: 경험 설계 — "사용자 행동을 유도한다"
  if (scope === "ui") return "experience";

  // operation, mediation: 수동 판단 필요
  return null;
}

// ── frontmatter 파싱 ────────────────────────────────────

function extractFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return null;
  return { yaml: match[1], body: match[2], full: content };
}

function parseDefFields(yaml) {
  const fields = {};
  const lines = yaml.split("\n");
  let inDef = false;

  for (const line of lines) {
    const indent = line.length - line.trimStart().length;
    const trimmed = line.trim();

    if (trimmed === "def:") { inDef = true; continue; }
    if (indent === 0 && inDef) break;

    if (inDef && indent === 2) {
      const match = trimmed.match(/^(\w+):\s*(.+)$/);
      if (match) fields[match[1]] = match[2].trim();
    }
  }
  return fields;
}

// ── layer 삽입 ──────────────────────────────────────────

function insertLayer(yaml, layer) {
  const lines = yaml.split("\n");
  const result = [];
  let inserted = false;

  for (const line of lines) {
    result.push(line);

    // lifecycle 줄 다음에 layer를 삽입
    if (!inserted && /^\s{2}lifecycle:/.test(line)) {
      result.push(`  layer: ${layer}`);
      inserted = true;
    }
  }

  return result.join("\n");
}

// ── 파일 스캔 ───────────────────────────────────────────

function walkMarkdownFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const info = statSync(fullPath);
    if (info.isDirectory()) files.push(...walkMarkdownFiles(fullPath));
    else if (entry.endsWith(".md")) files.push(fullPath);
  }
  return files;
}

// ── main ────────────────────────────────────────────────

const files = walkMarkdownFiles(DOCS_DIR);
let assigned = 0;
let skipped = 0;
let alreadyHas = 0;

for (const filePath of files) {
  const content = readFileSync(filePath, "utf-8");
  const fm = extractFrontmatter(content);
  if (!fm) continue;

  const fields = parseDefFields(fm.yaml);
  if (!fields.scope || !fields.aspect) continue;

  // 이미 layer가 있으면 건너뜀
  if (fields.layer) { alreadyHas++; continue; }

  // lifecycle이 approved가 아니면 건너뜀
  if (fields.lifecycle && fields.lifecycle !== "approved") { skipped++; continue; }

  const layer = classifyLayer(fields.scope, fields.aspect);
  if (!layer) { skipped++; continue; }

  const newYaml = insertLayer(fm.yaml, layer);
  const newContent = `---\n${newYaml}\n---\n${fm.body}`;

  if (DRY_RUN) {
    console.log(`[dry-run] ${fields.id ?? filePath}: layer=${layer}`);
  } else {
    writeFileSync(filePath, newContent);
  }
  assigned++;
}

console.log(`\n${DRY_RUN ? "[dry-run] " : ""}layer 부여: ${assigned}건, 건너뜀: ${skipped}건, 이미 있음: ${alreadyHas}건`);
