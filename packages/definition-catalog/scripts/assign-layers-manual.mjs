/**
 * assign-layers-manual.mjs
 *
 * 자동 분류가 불가능한 문서에 수동으로 layer를 부여한다.
 * 인프라(operation) / API 계약(mediation) 등 수동 판단이 필요한 문서.
 *
 * 사용법:
 *   node scripts/assign-layers-manual.mjs [--dry-run]
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SCRIPT_DIR, "../../..");
const DRY_RUN = process.argv.includes("--dry-run");

// ── 수동 분류 맵 (id → layer) ──────────────────────────

const MANUAL_LAYERS = {
  // ── operation: 시스템이 돌아가게 한다 ──
  "ingest-system":              "operation",
  "pipeline-phase-flow":        "operation",
  "pipeline-enrichment":        "operation",
  "pipeline-metric-agg":        "operation",
  "pipeline-system":            "operation",
  "pipeline-error-handling":    "operation",
  "pipeline-monitoring":        "operation",
  "ingest-runtime-middleware":   "operation",
  "ingest-runtime-operations":   "operation",
  "ingest-infra-system":        "operation",
  "server-infrastructure-spec": "operation",

  // ── mediation: 진실을 소비 가능하게 변환 ──
  "ingest-admin-endpoints":     "mediation",
  "ingest-admin-operations":    "mediation",
  "ingest-interface-contract":  "mediation",
  "ingest-interface-pipeline":  "mediation",
  "admin-api-system":           "mediation",
  "ingest-api-system":          "mediation",
  "server-admin-spec":          "mediation",
  "ingest-query-spec":          "mediation",
  "ingest-stream-spec":         "mediation",
  "ingest-scenario-spec":       "mediation",
  "ingest-verdict-spec":        "mediation",
  "registry-events-spec":       "mediation",
  "registry-services-spec":     "mediation",
  "registry-client-spec":       "mediation",

  // ── 기존에 layer가 없는 interface scope ──
  "query-api":                  "mediation",
  "query-gate-integration":     "mediation",
  "query-rules":                "mediation",
  "query-system":               "mediation",
  "registry-api":               "mediation",
  "registry-system":            "mediation",
  "registry-version-lifecycle": "mediation",
  "decode-api":                 "mediation",
  "decode-bundle":              "mediation",
  "decode-deploy":              "mediation",
  "decode-system":              "mediation",

  // ── operation: 브라우저 런타임 ──
  "browser-runtime-system":     "operation",
  "browser-monitor-api":        "mediation",
  "browser-monitor-operations": "mediation",
  "browser-capture-contract":   "mediation",
  "browser-session-patterns":   "operation",
  "browser-lifecycle-system":   "operation",
  "browser-lifecycle-spec":     "operation",
  "browser-system":             "operation",

  // ── DKG skills: domain (비즈니스 규칙 엔진) ──
  "dkg-skill-cascade":          "domain",
  "dkg-skill-catalog":          "domain",
  "dkg-skill-decision":         "domain",
  "dkg-skill-migrator":         "domain",
  "dkg-skill-version-event":    "domain",
  "dkg-skills-system":          "domain",
  "dkg-service-topology":       "operation",

  // ── decision-flow: domain ──
  "df-system":                  "domain",
  "decision-standard-process":  "domain",
  "decision-standard-checklist":"domain",
  "df-narrative-structure":     "domain",
  "df-narrative-context":       "domain",
  "df-narrative-proofs":        "domain",
  "df-narrative-group":         "domain",
  "decision-standard-group":    "domain",
  "df-model-group":             "domain",
  "df-analysis-group":          "domain",
  "df-interface-group":         "mediation",

  // ── spec-engine: domain ──
  "spec-engine-system":         "domain",
  "spec-architecture-system":   "domain",
  "spec-architecture-stack":    "domain",
  "spec-arch-layers":           "domain",
  "spec-arch-nestjs":           "operation",
  "spec-arch-interceptors":     "mediation",
  "spec-arch-group":            "domain",
  "spec-phases-group":          "domain",
  "spec-phases-roadmap":        "domain",
  "spec-phases-runtime":        "operation",
  "spec-core-types-group":      "domain",
  "spec-core-identifiers":      "domain",
  "spec-core-registry":         "domain",
  "spec-linking-rules":         "domain",
  "spec-reference-system":      "domain",
  "spec-prop-system":           "operation",
  "spec-prop-publish":          "operation",
  "spec-prop-notify":           "operation",
  "spec-prop-codegen":          "operation",
  "spec-prop-dkg-record":       "operation",
  "spec-temporal-capture":      "operation",
  "spec-temporal-infra":        "operation",
  "convergence-layer-spec":     "domain",
  "convergence-comparators":    "domain",
  "convergence-advisors":       "domain",
  "convergence-layer-group":    "domain",
  "axis-boundary-criteria":     "domain",
  "axis-boundary-patterns":     "domain",

  // ── system: 루트/개요 ──
  "system-root":                "domain",
  "system-concepts":            "domain",
  "system-data-flow":           "operation",
  "system-infra":               "operation",
  "system-packages":            "operation",
  "system-frontend":            "experience",
  "system-libraries":           "operation",
  "system-support":             "operation",
  "system-design-tools":        "mediation",

  // ── guides ──
  "quickstart-guide":           "mediation",
  "cookbook-guide":              "mediation",
  "prefix-type-guide":          "mediation",
  "axis-decision-guide":        "mediation",
  "guides-system":              "mediation",
};

// ── frontmatter layer 삽입 ──────────────────────────────

function insertLayerInFile(filePath, layer) {
  const content = readFileSync(filePath, "utf-8");

  // 이미 layer가 있으면 건너뜀
  if (/^\s+layer:/m.test(content)) return false;

  // lifecycle 줄 다음에 삽입
  const updated = content.replace(
    /^(\s{2}lifecycle:\s*.+)$/m,
    `$1\n  layer: ${layer}`,
  );

  if (updated === content) return false; // lifecycle을 못 찾으면 건너뜀

  if (!DRY_RUN) {
    writeFileSync(filePath, updated);
  }
  return true;
}

// ── 파일 찾기 ───────────────────────────────────────────

import { readdirSync, statSync } from "node:fs";

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

function extractId(content) {
  const match = content.match(/^\s+id:\s*(.+)$/m);
  return match ? match[1].trim() : null;
}

// ── main ────────────────────────────────────────────────

const docsDir = join(ROOT, "docs");
const files = walkMarkdownFiles(docsDir);
let assigned = 0;
let notFound = 0;

for (const filePath of files) {
  const content = readFileSync(filePath, "utf-8");
  const id = extractId(content);
  if (!id) continue;

  const layer = MANUAL_LAYERS[id];
  if (!layer) continue;

  const result = insertLayerInFile(filePath, layer);
  if (result) {
    if (DRY_RUN) console.log(`[dry-run] ${id}: layer=${layer}`);
    assigned++;
  }
}

console.log(`\n${DRY_RUN ? "[dry-run] " : ""}수동 layer 부여: ${assigned}건`);
