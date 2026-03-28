/**
 * qa-sdk def — definition-catalog 문서 관리 CLI.
 *
 * 데이터 소스: SQLite 직접 접근(기본) 또는 definition-service HTTP.
 *   --local:  SQLite DB 직접 (서버 불필요)
 *   --server: definition-service API (기본: localhost:3700)
 *   생략:     DB 파일 있으면 local, 없으면 server 시도
 *
 * Usage:
 *   qa-sdk def list [--scope=X] [--layer=Y] [--tag=Z] [--q=검색어]
 *   qa-sdk def get <문서ID>
 *   qa-sdk def children <문서ID>
 *   qa-sdk def parent <문서ID>
 *   qa-sdk def incoming <문서ID>
 *   qa-sdk def validate
 *   qa-sdk def stats
 *   qa-sdk def search <검색어>
 *
 * 레거시 (scanAndBuild 기반, DB 불필요):
 *   qa-sdk def scan
 *   qa-sdk def topdown <그룹ID>
 *   qa-sdk def bottomup <문서ID>
 *   qa-sdk def context <문서ID>
 *   qa-sdk def audit
 */

import { join, resolve, relative } from "node:path";
import { readFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import {
  scanAndBuild,
  extractFrontmatter,
  topdown,
  bottomup,
  context,
  validateGraph,
  extractByLevel,
  LINK_TYPE_RULES,
  type ScanResult,
  type DefDataSource,
  type DefDoc,
} from "definition-catalog";
import { createDataSource, type DataSourceOptions } from "../data-sources/index.js";

// ── 유틸 ──────────────────────────────────────────────

function getRootDir(): string {
  return process.cwd();
}

function parseFlags(args: string[]): { positional: string[]; options: DataSourceOptions; flags: Record<string, string> } {
  const positional: string[] = [];
  const flags: Record<string, string> = {};
  let mode: DataSourceOptions["mode"];

  for (const arg of args) {
    if (arg === "--local") { mode = "local"; continue; }
    if (arg === "--server") { mode = "server"; continue; }
    if (arg.startsWith("--")) {
      const [k, v] = arg.slice(2).split("=", 2);
      flags[k] = v ?? "true";
      continue;
    }
    positional.push(arg);
  }

  return { positional, options: { mode }, flags };
}

async function getSource(options: DataSourceOptions): Promise<DefDataSource> {
  return createDataSource(options);
}

// ── DataSource 기반 커맨드 ────────────────────────────

async function cmdList(source: DefDataSource, flags: Record<string, string>) {
  const limit = flags["limit"] ? Number(flags["limit"]) : 50;
  const offset = flags["offset"] ? Number(flags["offset"]) : 0;
  const filter = {
    scope: flags["scope"],
    aspect: flags["aspect"],
    depth: flags["depth"],
    lifecycle: flags["lifecycle"],
    layer: flags["layer"],
    level: flags["level"],
    svc: flags["svc"],
    tag: flags["tag"],
    q: flags["q"],
    limit,
    offset,
  };

  // 전체 건수 조회 (같은 필터, limit 없이)
  const total = (await source.list({ ...filter, limit: 100000, offset: 0 })).length;
  const docs = await source.list(filter);

  const from = offset + 1;
  const to = offset + docs.length;
  const remaining = total - to;

  console.log(`[${source.mode}] ${from}-${to} / ${total}건${remaining > 0 ? ` (미표시 ${remaining}건)` : ""}`);
  for (const d of docs) {
    const levelBadge = d.level && d.level !== "leaf" ? `[${d.level}] ` : "";
    const tags = d.tags.length > 0 ? ` [${d.tags.join(",")}]` : "";
    console.log(`  ${levelBadge}${d.docId}  ${d.scope}/${d.aspect}  ${d.lifecycle}${tags}`);
    if (d.purpose) {
      console.log(`    ${d.purpose.slice(0, 100)}`);
    }
  }

  if (remaining > 0) {
    console.log(`\n  다음 페이지: --offset=${to} --limit=${limit}`);
  }
}

async function cmdGet(source: DefDataSource, docId: string) {
  const doc = await source.get(docId);
  if (!doc) { console.log(`문서 "${docId}" 없음`); return; }
  console.log(`[${source.mode}] ${doc.docId}`);
  if (doc.level && doc.level !== "leaf") console.log(`  level:     ${doc.level}`);
  console.log(`  scope:     ${doc.scope}/${doc.aspect}`);
  console.log(`  depth:     ${doc.depth}`);
  console.log(`  lifecycle: ${doc.lifecycle}`);
  if (doc.layer) console.log(`  layer:     ${doc.layer}`);
  if (doc.svc) console.log(`  svc:       ${doc.svc}`);
  if (doc.address) console.log(`  address:   ${doc.address}`);
  if (doc.tags.length > 0) console.log(`  tags:      ${doc.tags.join(", ")}`);
  const containsLinks = doc.links.filter(l => l.type === "contains");
  const otherLinks = doc.links.filter(l => l.type !== "contains");
  if (containsLinks.length > 0) {
    console.log(`  children (${containsLinks.length}):`);
    for (const l of containsLinks) console.log(`    ├── ${l.target}`);
  }
  if (otherLinks.length > 0) {
    console.log(`  links:`);
    for (const l of otherLinks) console.log(`    → ${l.target} (${l.type})`);
  }
  if (doc.purpose) console.log(`\n  purpose: ${doc.purpose.slice(0, 200)}`);
}

async function cmdChildren(source: DefDataSource, docId: string) {
  const children = await source.getChildren(docId);
  console.log(`[${source.mode}] ${docId} → ${children.length} children`);
  for (const c of children) {
    const levelBadge = c.level && c.level !== "leaf" ? `[${c.level}] ` : "";
    console.log(`  ${levelBadge}${c.docId}  ${c.scope}/${c.aspect}  ${c.lifecycle}`);
    if (c.purpose) console.log(`    ${c.purpose.slice(0, 90)}`);
  }
}

async function cmdParent(source: DefDataSource, docId: string) {
  const parent = await source.getParent(docId);
  if (parent) console.log(`[${source.mode}] ${docId} ← ${parent.docId}`);
  else console.log(`[${source.mode}] ${docId}: 부모 없음`);
}

async function cmdIncoming(source: DefDataSource, docId: string) {
  const links = await source.getIncomingLinks(docId);
  console.log(`[${source.mode}] ${docId} ← ${links.length} incoming`);
  for (const l of links) console.log(`  ${l.source} (${l.type})`);
}

async function cmdValidate(source: DefDataSource) {
  const result = await source.validate();
  if (result.passed) {
    console.log(`[${source.mode}] ✓ 검증 통과 (경고 ${result.warnings}건)`);
  } else {
    console.log(`[${source.mode}] ✗ 에러 ${result.errors}건, 경고 ${result.warnings}건`);
  }
  const errors = result.issues.filter(i => i.severity === "error");
  const warnings = result.issues.filter(i => i.severity === "warning");
  if (errors.length > 0) {
    console.log(`\n[error]`);
    errors.slice(0, 10).forEach(i => console.log(`  ${i.docId}: ${i.message}`));
    if (errors.length > 10) console.log(`  ... 외 ${errors.length - 10}건`);
  }
  if (warnings.length > 0) {
    console.log(`\n[warning]`);
    warnings.slice(0, 5).forEach(i => console.log(`  ${i.docId}: ${i.message}`));
    if (warnings.length > 5) console.log(`  ... 외 ${warnings.length - 5}건`);
  }
}

// ── 영향 분석 + 변경 경고 ─────────────────────────────

const CHANGE_THRESHOLD = 3; // depends_on 이 수 이상이면 대규모 변경 경고

async function cmdImpact(source: DefDataSource, docId: string) {
  const doc = await source.get(docId);
  if (!doc) { console.log(`문서 "${docId}" 없음`); return; }

  const incoming = await source.getIncomingLinks(docId);
  const outgoing = await source.getOutgoingLinks(docId);
  const parent = await source.getParent(docId);
  const children = await source.getChildren(docId);

  // 주 기능 의존자 = depends_on으로 이 노드를 참조하는 문서
  const primary = incoming.filter(l => l.type === "depends_on" || l.type === "implements");
  // 제약 = constrains로 이 노드를 제한하는 문서
  const constraints = incoming.filter(l => l.type === "constrains");
  // 구조 = contains (부모/자식)
  const structural = incoming.filter(l => l.type === "contains");
  // 추적 = traces_to
  const traces = incoming.filter(l => l.type === "traces_to" || l.type === "refines");

  console.log(`[${source.mode}] ${doc.docId} 영향 분석`);
  console.log(`  scope: ${doc.scope}/${doc.aspect}  layer: ${doc.layer ?? "-"}  svc: ${doc.svc ?? "-"}`);
  if (doc.purpose) console.log(`  purpose: ${doc.purpose.slice(0, 120)}`);
  console.log();

  // 주 기능
  console.log(`  주 기능 (outgoing depends_on):`);
  const outDeps = outgoing.filter(l => l.type === "depends_on");
  if (outDeps.length === 0) console.log("    (없음 — 독립 노드)");
  for (const l of outDeps) console.log(`    → ${l.target}`);

  // 경유 수신
  console.log(`\n  이 노드를 의존하는 문서 (blast radius):`);
  if (primary.length === 0) console.log("    (없음 — 리프)");
  for (const l of primary) console.log(`    ← ${l.source} (${l.type})`);

  if (constraints.length > 0) {
    console.log(`\n  제약 (constrains):`);
    for (const l of constraints) console.log(`    ⚠ ${l.source}`);
  }

  if (traces.length > 0) {
    console.log(`\n  추적/구체화 (traces_to/refines):`);
    for (const l of traces) console.log(`    ↗ ${l.source} (${l.type})`);
  }

  // 변경 규모 판단
  console.log();
  const depCount = primary.length;
  if (depCount === 0) {
    console.log("  판단: 리프 노드 — 변경 영향 없음");
  } else if (depCount < CHANGE_THRESHOLD) {
    console.log(`  판단: 소규모 변경 (의존자 ${depCount}건) — 개별 확인으로 충분`);
  } else {
    console.log(`  ⚠ 판단: 대규모 변경 (의존자 ${depCount}건) — scope 내 일괄 검토 필요`);
    if (parent) {
      const siblings = await source.getChildren(parent.docId);
      console.log(`  scope: ${parent.docId} (${siblings.length} members)`);
      for (const s of siblings) {
        const mark = s.docId === docId ? " ← 변경 대상" : "";
        console.log(`    ${s.docId}  ${s.scope}/${s.aspect}${mark}`);
      }
    }
  }

  if (constraints.length > 0) {
    console.log(`\n  ⚠ 제약 ${constraints.length}건 존재 — 위반 여부 확인 필수`);
  }
}

async function cmdCheck(source: DefDataSource, docId: string) {
  const doc = await source.get(docId);
  if (!doc) { console.log(`문서 "${docId}" 없음`); return; }

  const incoming = await source.getIncomingLinks(docId);
  const primary = incoming.filter(l => l.type === "depends_on" || l.type === "implements");
  const constraints = incoming.filter(l => l.type === "constrains");
  const depCount = primary.length;

  const warnings: string[] = [];
  const errors: string[] = [];

  // 의존자 수 체크
  if (depCount >= CHANGE_THRESHOLD) {
    warnings.push(`의존자 ${depCount}건 — 대규모 변경. 의사결정 기록 권장 (qa-sdk flow start scope-expansion)`);
  }

  // 제약 존재 체크
  if (constraints.length > 0) {
    for (const c of constraints) {
      const constraintDoc = await source.get(c.source);
      warnings.push(`제약 "${c.source}" 위반 여부 확인: ${constraintDoc?.purpose?.slice(0, 80) ?? ""}`);
    }
  }

  // purpose 없음
  if (!doc.purpose) {
    errors.push("purpose 누락 — 변경 전 목적을 먼저 기록하세요");
  }

  // links 없음
  if (doc.links.length === 0 && incoming.length <= 1) {
    warnings.push("고립 문서 — 다른 문서와 연결이 없습니다");
  }

  // 결과
  if (errors.length === 0 && warnings.length === 0) {
    console.log(`[${source.mode}] ✓ ${docId} — 변경 안전 (의존자 ${depCount}건, 제약 ${constraints.length}건)`);
    return;
  }

  console.log(`[${source.mode}] ${docId} 변경 전 검토:`);
  for (const e of errors) console.log(`  ✗ ${e}`);
  for (const w of warnings) console.log(`  ⚠ ${w}`);
}

async function cmdSearch(source: DefDataSource, query: string) {
  const docs = await source.list({ q: query, limit: 20 });
  console.log(`[${source.mode}] "${query}" → ${docs.length}건`);
  for (const d of docs) {
    const preview = d.purpose?.slice(0, 80) ?? "";
    console.log(`  ${d.docId}  ${d.scope}/${d.aspect}  ${preview}`);
  }
}

async function cmdStats(source: DefDataSource) {
  const all = await source.list({ limit: 1000 });
  const approved = all.filter(d => d.lifecycle === "approved");
  const deprecated = all.filter(d => d.lifecycle === "deprecated");

  const byScope: Record<string, number> = {};
  const byLayer: Record<string, number> = {};
  for (const d of approved) {
    byScope[d.scope] = (byScope[d.scope] || 0) + 1;
    if (d.layer) byLayer[d.layer] = (byLayer[d.layer] || 0) + 1;
  }

  console.log(`[${source.mode}] 총 ${all.length}건 (approved ${approved.length}, deprecated ${deprecated.length})\n`);
  console.log("scope:");
  Object.entries(byScope).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${k}: ${v}`));
  console.log("\nlayer:");
  Object.entries(byLayer).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${k}: ${v}`));
}

async function cmdOverview(source: DefDataSource) {
  const all = await source.list({ limit: 10000 });
  const approved = all.filter(d => d.lifecycle === "approved");
  const deprecated = all.filter(d => d.lifecycle === "deprecated");

  // scope×aspect 매트릭스
  const matrix: Record<string, Record<string, number>> = {};
  for (const d of approved) {
    if (!matrix[d.scope]) matrix[d.scope] = {};
    matrix[d.scope][d.aspect] = (matrix[d.scope][d.aspect] || 0) + 1;
  }

  // svc별 문서 수 + scope 커버리지
  const bySvc: Record<string, { count: number; scopes: Set<string> }> = {};
  for (const d of approved) {
    const svc = d.svc || "(라이브러리)";
    if (!bySvc[svc]) bySvc[svc] = { count: 0, scopes: new Set() };
    bySvc[svc].count++;
    bySvc[svc].scopes.add(d.scope);
  }

  // links 통계
  let totalOutgoing = 0;
  let docsWithoutOutgoing = 0;
  for (const d of approved) {
    const out = await source.getOutgoingLinks(d.docId);
    totalOutgoing += out.length;
    if (out.length === 0) docsWithoutOutgoing++;
  }

  console.log(`[${source.mode}] === 시스템 전체 개요 ===`);
  console.log(`총 ${all.length}건 (approved ${approved.length}, deprecated ${deprecated.length})`);
  console.log(`edges: ${totalOutgoing}, outgoing 없는 문서: ${docsWithoutOutgoing}건`);
  console.log();

  // scope×aspect 매트릭스
  console.log("scope×aspect 분포:");
  for (const [scope, aspects] of Object.entries(matrix).sort((a, b) => Object.values(b[1]).reduce((s, v) => s + v, 0) - Object.values(a[1]).reduce((s, v) => s + v, 0))) {
    const total = Object.values(aspects).reduce((s, v) => s + v, 0);
    const detail = Object.entries(aspects).sort((a, b) => b[1] - a[1]).map(([a, c]) => `${a}(${c})`).join(", ");
    console.log(`  ${scope}: ${total} — ${detail}`);
  }
  console.log();

  // svc 커버리지
  console.log("서비스별 (scope 커버리지):");
  const svcEntries = Object.entries(bySvc).sort((a, b) => b[1].count - a[1].count);
  for (const [svc, { count, scopes }] of svcEntries.slice(0, 15)) {
    const scopeList = [...scopes].sort().join(",");
    console.log(`  ${svc.padEnd(25)} ${String(count).padStart(3)}건  scopes: ${scopeList}`);
  }
  if (svcEntries.length > 15) console.log(`  ... 외 ${svcEntries.length - 15}건`);
}

async function cmdAuditDb(source: DefDataSource) {
  const all = await source.list({ lifecycle: "approved", limit: 1000 });
  const issues: string[] = [];

  let noPurpose = 0, shortPurpose = 0, noLinks = 0, noSvc = 0;

  for (const d of all) {
    if (!d.purpose) { noPurpose++; issues.push(`[high] ${d.docId}: purpose 없음`); }
    else if (d.purpose.length < 30) { shortPurpose++; issues.push(`[medium] ${d.docId}: purpose 짧음 (${d.purpose.length}자)`); }

    const outgoing = await source.getOutgoingLinks(d.docId);
    const incoming = await source.getIncomingLinks(d.docId);
    // prefix_schema 리프는 contains 1건만 있어도 정상
    const isLeafPrefix = d.aspect === "prefix_schema" && !d.docId.endsWith("-group") && !d.docId.endsWith("-system");
    if (!isLeafPrefix && outgoing.length === 0 && incoming.length <= 1) {
      noLinks++;
      issues.push(`[medium] ${d.docId}: 고립 — outgoing 0, incoming ≤1`);
    }

    if (!d.svc && d.scope !== "data" && d.aspect !== "prefix_schema") {
      // 라이브러리/prefix 문서 제외
      if (!["user_scenario", "process_flow"].includes(d.aspect)) {
        noSvc++;
      }
    }
  }

  console.log(`[${source.mode}] === DB 품질 감사 ===`);
  console.log(`approved ${all.length}건 | purpose 없음 ${noPurpose} | 짧음 ${shortPurpose} | 고립 ${noLinks} | svc 미부여 ${noSvc}`);

  if (issues.length > 0) {
    const high = issues.filter(i => i.startsWith("[high]"));
    const medium = issues.filter(i => i.startsWith("[medium]"));
    if (high.length > 0) {
      console.log(`\n[high] ${high.length}건`);
      high.slice(0, 5).forEach(i => console.log(`  ${i}`));
    }
    if (medium.length > 0) {
      console.log(`\n[medium] ${medium.length}건`);
      medium.slice(0, 10).forEach(i => console.log(`  ${i}`));
    }
  } else {
    console.log("\n✓ 이슈 없음");
  }
}

// ── 레거시 (scanAndBuild 기반) ────────────────────────

async function scan(): Promise<ScanResult> {
  const root = getRootDir();
  return scanAndBuild(root, [join(root, "docs")]);
}

async function loadBodies(result: ScanResult, root: string): Promise<Map<string, string>> {
  const bodies = new Map<string, string>();
  for (const entry of result.registry.all()) {
    if (!entry.ref) continue;
    try {
      const content = await readFile(join(root, entry.ref), "utf-8");
      const fm = extractFrontmatter(content);
      if (fm) bodies.set(entry.id, fm.body);
    } catch { /* skip */ }
  }
  return bodies;
}

async function legacyScan() {
  const result = await scan();
  console.log(`스캔 완료: ${result.registered}건 등록, ${result.linked}건 링크`);
  if (result.errors.length > 0) {
    console.log(`\n파싱 에러 ${result.errors.length}건:`);
    result.errors.slice(0, 5).forEach(e => console.log(`  ${e.file}: ${e.error}`));
  }
}

async function legacyTopdown(groupId: string, level: "purpose" | "overview" = "purpose") {
  console.log(await topdown(getRootDir(), groupId, level));
}

async function legacyBottomup(docId: string) {
  console.log(await bottomup(getRootDir(), docId));
}

async function legacyContext(docId: string) {
  console.log(await context(getRootDir(), docId));
}

async function legacyAudit(fix = false) {
  const result = await scan();
  const root = getRootDir();
  const bodies = await loadBodies(result, root);
  const reg = result.registry;

  let total = 0, withPurpose = 0, withLinks = 0, withTags = 0;
  const issues: string[] = [];

  for (const entry of reg.all()) {
    if (entry.lifecycle === "deprecated") continue;
    total++;
    const body = bodies.get(entry.id);
    if (body) {
      const p = extractByLevel(body, "purpose");
      if (p.text.length > 0) withPurpose++;
      else issues.push(`[high] ${entry.id}: ^purpose 없음`);
    }
    const outgoing = reg.getLinks(entry.id, "outgoing");
    if (outgoing.some(l => l.linkType !== "contains")) withLinks++;
    if (entry.tags && entry.tags.length > 0) withTags++;
  }

  // 그래프 검증
  const validation = validateGraph(result.registry);

  // level 분포
  const byLevel: Record<string, number> = {};
  for (const entry of reg.all()) {
    if (entry.lifecycle === "deprecated") continue;
    const level = entry.level ?? "leaf";
    byLevel[level] = (byLevel[level] || 0) + 1;
  }

  console.log(`=== 품질 리포트 ===`);
  console.log(`문서 ${total}건 | purpose ${withPurpose} | links ${withLinks} | tags ${withTags}`);
  console.log(`level: ${Object.entries(byLevel).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}(${v})`).join(" ")}`);

  if (validation.issues.length > 0) {
    const byType: Record<string, typeof validation.issues[number][]> = {};
    for (const i of validation.issues) (byType[i.type] ??= []).push(i);

    console.log(`\n=== 그래프 검증 (errors=${validation.errors} warnings=${validation.warnings}) ===`);
    for (const [type, items] of Object.entries(byType).sort((a, b) => b[1].length - a[1].length)) {
      console.log(`\n[${items[0]!.severity}] ${type}: ${items.length}건`);
      for (const i of items) console.log(`  ${i.docId}: ${i.message}`);
    }
  } else {
    console.log(`\n그래프 검증 통과 (이슈 0건)`);
  }

  if (issues.length > 0) {
    console.log(`\n=== purpose 이슈 ${issues.length}건 ===`);
    issues.slice(0, 10).forEach(i => console.log(`  ${i}`));
    if (issues.length > 10) console.log(`  ... 외 ${issues.length - 10}건`);
  }

  // --fix: DB 동기화
  if (fix) {
    console.log("\n=== 자동 보강 ===");
    const DB_PATHS = ["data/definition-service.sqlite", "packages/definition-service/data/definition-service.sqlite"];
    let synced = 0;

    for (const dbPath of DB_PATHS) {
      const fullPath = join(getRootDir(), dbPath);
      if (!existsSync(fullPath)) continue;

      try {
        const Database = (await import("better-sqlite3")).default;
        const db = new Database(fullPath);

        // level 컬럼 확보
        try { db.exec("ALTER TABLE documents ADD COLUMN level TEXT DEFAULT 'leaf'"); } catch { /* already exists */ }

        // level 동기화
        for (const entry of reg.all()) {
          if (entry.level) {
            db.prepare("UPDATE documents SET level = ? WHERE doc_id = ?").run(entry.level, entry.id);
          }
        }

        // FTS 재구축
        db.exec("DROP TABLE IF EXISTS documents_fts");
        db.exec("CREATE VIRTUAL TABLE documents_fts USING fts5(doc_id, purpose, intent, context, caveat, content=documents, content_rowid=rowid)");
        db.exec("INSERT INTO documents_fts(documents_fts) VALUES('rebuild')");

        db.close();
        synced++;
        console.log(`  DB 동기화 완료: ${dbPath}`);
      } catch (e) {
        console.log(`  DB 동기화 실패: ${dbPath} — ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    console.log(`\n리포트: errors=${validation.errors} warnings=${validation.warnings} purpose=${withPurpose}/${total} DB=${synced}개 동기화`);
  }
}

async function legacyAuditFix() {
  return legacyAudit(true);
}

// ── 라우터 ────────────────────────────────────────────

export async function cliDef(args: string[]): Promise<void> {
  const { positional, options, flags } = parseFlags(args);
  const sub = positional[0];
  const rest = positional.slice(1);

  // DataSource 기반 커맨드
  const dsCommands = new Set(["list", "get", "children", "parent", "incoming", "validate", "search", "stats", "impact", "check", "audit-db", "overview", "find-by-file", "guide"]);
  if (dsCommands.has(sub)) {
    let source: DefDataSource;
    try {
      source = await getSource(options);
    } catch (e) {
      console.log((e as Error).message);
      return;
    }

    try {
      switch (sub) {
        case "list": return await cmdList(source, flags);
        case "get": return await cmdGet(source, rest[0]);
        case "children": return await cmdChildren(source, rest[0]);
        case "parent": return await cmdParent(source, rest[0]);
        case "incoming": return await cmdIncoming(source, rest[0]);
        case "validate": return await cmdValidate(source);
        case "search": return await cmdSearch(source, rest[0] ?? flags["q"] ?? "");
        case "stats": return await cmdStats(source);
        case "impact": return await cmdImpact(source, rest[0]);
        case "check": return await cmdCheck(source, rest[0]);
        case "audit-db": return await cmdAuditDb(source);
        case "overview": return await cmdOverview(source);
        case "find-by-file": return await cmdFindByFile(source, rest[0] ?? "");
        case "guide": return await cmdGuide(source, rest[0]);
      }
    } finally {
      if ("close" in source && typeof source.close === "function") (source as { close(): void }).close();
    }
    return;
  }

  // 레거시 (scanAndBuild 기반)
  switch (sub) {
    case "scan": return legacyScan();
    case "topdown":
      if (!rest[0]) { console.log("Usage: qa-sdk def topdown <그룹ID>"); return; }
      return legacyTopdown(rest[0], rest.includes("--overview") ? "overview" : "purpose");
    case "bottomup":
      if (!rest[0]) { console.log("Usage: qa-sdk def bottomup <문서ID>"); return; }
      return legacyBottomup(rest[0]);
    case "context":
      if (!rest[0]) { console.log("Usage: qa-sdk def context <문서ID>"); return; }
      return legacyContext(rest[0]);
    case "audit": return flags["fix"] ? legacyAuditFix() : legacyAudit();
    case "link-rules": return cmdLinkRules();
    default:
      console.log(`qa-sdk def — 문서 관리

시작하기:
  guide                       시스템 전체 구조 안내
  guide concepts              핵심 개념 (좌표, prefix, 축)
  guide classification        문서 분류 체계 (scope, level, layer)
  guide services              서비스 구조
  guide philosophy            시스템 철학

조회:
  list [--scope=X] [--level=Z] [--layer=Y] [--tag=T] [--q=검색어]
  get <ID>            단건 조회
  children <ID>       자식 문서
  parent <ID>         부모 문서
  incoming <ID>       역링크
  search <검색어>     전문 검색
  find-by-file <경로>  코드 파일 → 관련 문서

분석:
  context <ID>        작업 전 컨텍스트 (소속/의존/영향)
  impact <ID>         변경 영향 분석
  topdown <ID>        탑다운 조립
  bottomup <ID>       영향 역추적

품질:
  audit               품질 리포트 + 그래프 검증
  validate            깨진 링크/순환/고아 검증
  stats               분포 통계
  check <ID>          문서 정합성 점검
  link-rules          LinkType 사용 규칙`);
  }
}

async function cmdFindByFile(source: DefDataSource, filePath: string) {
  const root = getRootDir();
  const absPath = resolve(root, filePath);
  const relPath = relative(root, absPath);

  // 1. packages/ 디렉토리에서 패키지 이름 추출
  const match = relPath.match(/^packages\/([^/]+)\//);
  if (!match) {
    console.log(`"${relPath}"는 packages/ 디렉토리에 속하지 않습니다.`);
    return;
  }

  const pkgDir = match[1]!;
  const pkgJsonPath = join(root, "packages", pkgDir, "package.json");

  let pkgName = pkgDir;
  if (existsSync(pkgJsonPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgJsonPath, "utf-8"));
      pkgName = (pkg.name as string ?? pkgDir).replace(/^@qa-sdk\//, "");
    } catch { /* fallback to dir name */ }
  }

  console.log(`파일: ${relPath}`);
  console.log(`패키지: ${pkgDir} (${pkgName})`);
  console.log("");

  // 패키지 디렉토리 → svc 별칭 매핑 (패키지명과 svc가 다른 경우)
  const SVC_ALIASES: Record<string, string[]> = {
    "cli": ["qa-sdk-cli"],
    "shop-web": ["shopping-web"],
    "definition-catalog": ["definition-service"],
    "definition-client": ["definition-service"],
    "motion-content": ["motion-workspace-service"],
    "motion-workspace": ["motion-workspace-service"],
    "motion-workspace-client": ["motion-workspace-service"],
    "motion-content-editor": ["motion-workspace-service"],
  };

  // 2. svc 필드로 문서 검색 — 패키지 디렉토리명, 패키지 이름, 별칭 모두 시도
  const candidates = new Set([pkgDir, pkgName, ...(SVC_ALIASES[pkgDir] ?? [])]);
  let docs: DefDoc[] = [];

  for (const svc of candidates) {
    const found = await source.list({ svc, limit: 100 });
    for (const d of found) {
      if (!docs.some(existing => existing.docId === d.docId)) {
        docs.push(d);
      }
    }
  }

  if (docs.length === 0) {
    console.log(`svc="${pkgDir}" 또는 "${pkgName}"에 연결된 문서가 없습니다.`);
    console.log(`  → frontmatter에 svc: ${pkgDir} 를 추가하세요.`);
    return;
  }

  // 3. 파일 경로에서 모듈 힌트 추출
  const fileName = relPath.split("/").pop()?.replace(/\.tsx?$/, "") ?? "";
  const fileHints = fileName.split(/[-_.]/).filter(h => h.length > 2);

  // 4. 결과 출력 — 관련도 순서 (파일명과 문서 ID가 겹치는 것 우선)
  docs.sort((a, b) => {
    const aRelevance = fileHints.some(h => a.docId.includes(h)) ? 1 : 0;
    const bRelevance = fileHints.some(h => b.docId.includes(h)) ? 1 : 0;
    return bRelevance - aRelevance;
  });

  console.log(`관련 문서 ${docs.length}건:`);
  for (const d of docs) {
    const levelStr = d.level && d.level !== "leaf" ? `[${d.level}] ` : "";
    const relevance = fileHints.some(h => d.docId.includes(h)) ? " ← 파일명 매칭" : "";
    console.log(`  ${levelStr}${d.docId}  ${d.scope}/${d.aspect}  ${d.depth}${relevance}`);
    if (d.purpose) {
      console.log(`    ${d.purpose.slice(0, 100)}`);
    }
  }

  // 5. 코드 심볼 요약
  try {
    const source = readFileSync(absPath, "utf-8");
    const exports = source.match(/^export\s+(?:async\s+)?(?:function|class|interface|type|const)\s+(\w+)/gm);
    if (exports && exports.length > 0) {
      console.log(`\n코드 export (${exports.length}건):`);
      for (const exp of exports.slice(0, 10)) {
        const name = exp.replace(/^export\s+(?:async\s+)?(?:function|class|interface|type|const)\s+/, "");
        console.log(`  ${name}`);
      }
      if (exports.length > 10) console.log(`  ... 외 ${exports.length - 10}건`);
    }
  } catch { /* 파일 읽기 실패 무시 */ }
}

async function cmdGuide(source: DefDataSource, topic?: string) {
  switch (topic) {
    case "concepts": {
      const doc = await source.get("system-concepts");
      console.log("=== 핵심 개념 ===\n");
      console.log(doc?.purpose ?? "(system-concepts 문서 없음)");
      console.log("\n더 알아보기:");
      console.log("  def get system-concepts");
      console.log("  def search \"좌표\"");
      console.log("  def search \"prefix\"");
      return;
    }
    case "classification": {
      const taxonomy = await source.get("definition-taxonomy");
      const level = await source.get("definition-level");
      console.log("=== 문서 분류 체계 ===\n");
      console.log("분류 축:");
      console.log("  scope (7종)  — 무엇에 대한 정의인가 (ui/feature/flow/state/constraint/data/interface)");
      console.log("  aspect (22종) — 어떤 측면을 정의하는가 (scope별 2~5종)");
      console.log("  depth (4종)  — 얼마나 상세한가 (overview/specification/implementation/validation)");
      console.log("\n메타데이터:");
      console.log("  level (5종)  — 어떤 분해 단위인가 (system/area/unit/module/leaf)");
      console.log("  layer (4종)  — 왜 존재하는가 (domain/operation/mediation/experience)");
      console.log("  lifecycle    — 현재 상태 (draft/review/approved/deprecated/archived)");
      console.log("\n더 알아보기:");
      console.log("  def get definition-taxonomy   # 전체 분류 체계");
      console.log("  def get definition-level      # 분해 레벨 설계 근거");
      console.log("  def link-rules                # 관계 유형 규칙");
      console.log("  def stats                     # 현재 분포");
      return;
    }
    case "services": {
      const children = await source.getChildren("system-infra");
      console.log("=== 인프라 서비스 ===\n");
      for (const c of children) {
        const levelBadge = c.level && c.level !== "leaf" ? `[${c.level}] ` : "";
        console.log(`  ${levelBadge}${c.docId}`);
        if (c.purpose) console.log(`    ${c.purpose.slice(0, 90)}`);
      }
      const support = await source.getChildren("system-support");
      console.log("\n=== 보조 서비스 ===\n");
      for (const c of support) {
        const levelBadge = c.level && c.level !== "leaf" ? `[${c.level}] ` : "";
        console.log(`  ${levelBadge}${c.docId}`);
        if (c.purpose) console.log(`    ${c.purpose.slice(0, 90)}`);
      }
      console.log("\n더 알아보기:");
      console.log("  def get <서비스ID>     # 서비스 상세");
      console.log("  def topdown <서비스ID> # 서비스 내부 조립");
      return;
    }
    case "philosophy": {
      const doc = await source.get("definition-system-philosophy");
      console.log("=== 시스템 철학 ===\n");
      console.log(doc?.purpose ?? "(문서 없음)");
      console.log("\n더 알아보기:");
      console.log("  def get definition-system-philosophy");
      console.log("  def get dual-coordinate-system");
      console.log("  def search \"철학\"");
      return;
    }
    default: {
      // 전체 구조 안내
      const root = await source.get("system-root");
      const areas = await source.getChildren("system-root");
      const allDocs = await source.list({ limit: 100000 });
      const approved = allDocs.filter(d => d.lifecycle === "approved").length;
      const deprecated = allDocs.filter(d => d.lifecycle === "deprecated").length;

      const byLevel: Record<string, number> = {};
      for (const d of allDocs) byLevel[d.level ?? "leaf"] = (byLevel[d.level ?? "leaf"] ?? 0) + 1;

      console.log("=== qa-sdk 시스템 가이드 ===\n");
      console.log(root?.purpose ?? "");
      console.log(`\n문서 ${allDocs.length}건 (approved ${approved}, deprecated ${deprecated})`);
      console.log(`level: ${Object.entries(byLevel).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}(${v})`).join(" ")}`);

      console.log("\n=== 영역 구조 ===\n");
      for (const a of areas) {
        const childCount = (await source.getChildren(a.docId)).length;
        console.log(`  [area] ${a.docId} (${childCount} children)`);
        if (a.purpose) console.log(`    ${a.purpose.slice(0, 80)}`);
      }

      console.log("\n=== 다음 단계 ===\n");
      console.log("  def guide concepts        핵심 개념 (좌표, prefix, 축)");
      console.log("  def guide classification  문서 분류 체계 (scope, level, layer)");
      console.log("  def guide services        서비스 구조");
      console.log("  def guide philosophy      시스템 철학");
      console.log("  def children <area-id>    영역 내부 탐색");
      console.log("  def search <키워드>       개념 검색");
      return;
    }
  }
}

function cmdLinkRules() {
  console.log("=== LinkType 사용 규칙 ===\n");
  for (const rule of LINK_TYPE_RULES) {
    console.log(`[${rule.id}] ${rule.name} — "A가 B를 ${rule.verb}"`);
    console.log(`  ${rule.description}`);
    console.log(`  순환: ${rule.allowCycle ? "허용" : "금지"} | 다중부모: ${rule.multiParent ? "허용" : "경고 (cross-scope 태그 시 허용)"}`);
    console.log(`  사용: ${rule.when}`);
    console.log(`  주의: ${rule.notTo}`);
    console.log("");
  }
}

// 하위 호환
export { legacyScan as cliDefScan };
export { legacyTopdown as cliDefTopdown };
export { legacyBottomup as cliDefBottomup };
export { legacyContext as cliDefContext };
export { legacyAudit as cliDefAudit };
