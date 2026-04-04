/**
 * qa-sdk def — definition-catalog 문서 관리 CLI.
 *
 * 데이터 소스: SQLite 직접 접근(기본) 또는 definition-service HTTP.
 *   --local:  SQLite DB 직접 (서버 불필요)
 *   --server: definition-service API (기본: localhost:3700)
 *   --scan:   docs/ frontmatter 직접 스캔 (read-only degraded mode)
 *   생략:     DB 파일 있으면 local, 없으면 server, 둘 다 없으면 scan 시도
 *
 * 모든 조회/분석 명령은 DefDataSource 기반. scan만 파일 직접 스캔.
 */

import { dirname, join, resolve, relative } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import {
  CONCERN_TAGS,
  scanAndBuild,
  LINK_TYPE_RULES,
  readDefConfig,
  detectDrift,
  extractByLevel,
  hashFrontmatter,
  computeDistribution,
  createInstance,
  createHarnessRegistry,
  deriveDocLifecycle,
  deriveSpecImplState,
  deriveConventionState,
  deriveSyncState,
  extractByMarker,
  extractFrontmatter,
  validateGraph,
  type DefDataSource,
  type DefDoc,
  type DefFeedbackRequestSummary,
  type StateMachineInstance,
} from "definition-catalog";
import { createDataSource, syncDocsToLocalDb, type DataSourceOptions } from "definition-data-source";

// ── 유틸 ──────────────────────────────────────────────

function getRootDir(): string {
  let current = process.cwd();
  while (true) {
    if (existsSync(join(current, "pnpm-workspace.yaml")) && existsSync(join(current, "docs"))) {
      return current;
    }
    const parent = dirname(current);
    if (parent === current) {
      return process.cwd();
    }
    current = parent;
  }
}

type FeedbackTraceMatch = {
  anchorDocId: string;
  request: DefFeedbackRequestSummary;
};

const CONCERN_TAG_SET = new Set<string>(CONCERN_TAGS);
const BOUNDARY_LEVELS = new Set(["group", "module"]);

function extractConcernTags(tags: readonly string[]): string[] {
  return tags.filter((tag) => CONCERN_TAG_SET.has(tag));
}

async function collectFeedbackMatches(
  source: DefDataSource,
  docIds: readonly string[],
): Promise<FeedbackTraceMatch[]> {

  const seen = new Set<string>();
  const matches: FeedbackTraceMatch[] = [];

  for (const docId of docIds) {
    const requests = await source.getFeedbackRequestsByDocId(docId, 20);
    for (const request of requests) {
      const key = `${docId}:${request.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      matches.push({ anchorDocId: docId, request });
    }
  }

  return matches.toSorted((left, right) =>
    right.request.createdAt.localeCompare(left.request.createdAt),
  );
}

function parseFlags(args: string[]): { positional: string[]; options: DataSourceOptions; flags: Record<string, string> } {
  const positional: string[] = [];
  const flags: Record<string, string> = {};
  let mode: DataSourceOptions["mode"];

  for (let index = 0; index < args.length; index++) {
    const arg = args[index]!;
    if (arg === "--local") { mode = "local"; continue; }
    if (arg === "--server") { mode = "server"; continue; }
    if (arg === "--scan") { mode = "scan"; continue; }
    if (arg.startsWith("--")) {
      const [k, inline] = arg.slice(2).split("=", 2);
      const next = args[index + 1];
      if (inline !== undefined) {
        flags[k] = inline;
      } else if (next && !next.startsWith("--")) {
        flags[k] = next;
        index += 1;
      } else {
        flags[k] = "true";
      }
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
    type: flags["type"],
    knowledgeKind: flags["knowledge-kind"],
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

  const requests = await source.getFeedbackRequestsByDocId(docId, 5);
  if (requests.length > 0) {
    console.log(`\n  feedback requests:`);
    for (const request of requests) {
      const model = request.targetModel ? ` [${request.targetModel}]` : "";
      console.log(`    - ${request.id}${model}: ${request.purpose}`);
    }
  }
}

async function cmdBody(source: DefDataSource, docId: string, flags: Record<string, string>) {
  const result = await source.getBody(docId);
  if (!result) { console.log(`문서 "${docId}" 없음`); return; }
  if (flags["json"] === "true") {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(`[${source.mode}] ${result.docId}`);
  if (result.docVersion) console.log(`  docVersion: ${result.docVersion}`);
  if (result.revision !== undefined) console.log(`  revision:   ${result.revision}`);
  if (result.bodyHash) console.log(`  bodyHash:   ${result.bodyHash}`);
  if (result.sourcePath) console.log(`  sourcePath: ${result.sourcePath}`);
  console.log("");
  process.stdout.write(result.body);
  if (!result.body.endsWith("\n")) process.stdout.write("\n");
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

  const syntheticIncoming = await source.getSyntheticIncomingLinks(docId);
  if (syntheticIncoming.length > 0) {
    console.log(`\n  feedback_request:`);
    for (const link of syntheticIncoming) {
      const model = link.targetModel ? ` [${link.targetModel}]` : "";
      console.log(`  ${link.source}${model} (${link.type})`);
    }
  }
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

const SERVICE_EXEMPT_DOC_IDS = new Set([
  "architecture-decisions",
  "automation-skill-group",
  "claude-skill-group",
  "cli-command-group",
  "coding-conventions",
  "decision-definition-bridge",
  "definition-mgmt-consistency-rules",
  "definition-mgmt-graph-links",
  "definition-mgmt-state-tracking",
  "dkg-harness-bridge",
  "dkg-skill-group",
  "error-handling-convention",
  "gate-tracker-spec",
  "harness-model-spec",
  "motion-workspace-system",
  "ralph-tui-skill-group",
  "skill-catalog-system",
  "spec-convention",
  "spec-verification-system",
  "system-packages",
]);

function isServiceExempt(doc: DefDoc): boolean {
  if (SERVICE_EXEMPT_DOC_IDS.has(doc.docId)) return true;
  if (doc.docId.startsWith("definition-mgmt-")) return true;
  if (doc.docId.startsWith("skill-")) return true;
  return false;
}

async function cmdImpact(source: DefDataSource, docId: string) {
  const doc = await source.get(docId);
  if (!doc) { console.log(`문서 "${docId}" 없음`); return; }

  const incoming = await source.getIncomingLinks(docId);
  const outgoing = await source.getOutgoingLinks(docId);
  const parent = await source.getParent(docId);
  const _children = await source.getChildren(docId);

  // 주 기능 의존자 = depends_on으로 이 노드를 참조하는 문서
  const primary = incoming.filter(l => l.type === "depends_on" || l.type === "implements");
  // 제약 = constrains로 이 노드를 제한하는 문서
  const constraints = incoming.filter(l => l.type === "constrains");
  // 구조 = contains (부모/자식)
  const _structural = incoming.filter(l => l.type === "contains");
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

  const feedbackMatches = await collectFeedbackMatches(
    source,
    [docId, ...primary.map((link) => link.source)],
  );
  if (feedbackMatches.length > 0) {
    console.log(`\n  ── Feedback Trace ──`);
    for (const match of feedbackMatches.slice(0, 10)) {
      const model = match.request.targetModel ? ` [${match.request.targetModel}]` : "";
      console.log(`    ${match.request.id}${model} ← ${match.anchorDocId}`);
      console.log(`      ${match.request.purpose}`);
    }
    if (feedbackMatches.length > 10) {
      console.log(`    ... 외 ${feedbackMatches.length - 10}건`);
    }
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

async function cmdConcepts(source: DefDataSource, flags: Record<string, string>) {
  const limit = flags["limit"] ? Number(flags["limit"]) : 200;
  const docs = await source.list({
    type: "knowledge",
    knowledgeKind: "concept",
    ...(flags["q"] ? { q: flags["q"] } : {}),
    ...(flags["tag"] ? { tag: flags["tag"] } : {}),
    limit,
  });

  console.log(`[${source.mode}] concept 문서 ${docs.length}건`);
  for (const doc of docs) {
    const tags = doc.tags.length > 0 ? ` [${doc.tags.join(",")}]` : "";
    console.log(`  ${doc.docId}  ${doc.scope}/${doc.aspect}  ${doc.lifecycle}${tags}`);
    if (doc.purpose) console.log(`    ${doc.purpose.slice(0, 120)}`);
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
  Object.entries(byScope).toSorted((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${k}: ${v}`));
  console.log("\nlayer:");
  Object.entries(byLayer).toSorted((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${k}: ${v}`));
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
  for (const [scope, aspects] of Object.entries(matrix).toSorted((a, b) => Object.values(b[1]).reduce((s, v) => s + v, 0) - Object.values(a[1]).reduce((s, v) => s + v, 0))) {
    const total = Object.values(aspects).reduce((s, v) => s + v, 0);
    const detail = Object.entries(aspects).toSorted((a, b) => b[1] - a[1]).map(([a, c]) => `${a}(${c})`).join(", ");
    console.log(`  ${scope}: ${total} — ${detail}`);
  }
  console.log();

  // svc 커버리지
  console.log("서비스별 (scope 커버리지):");
  const svcEntries = Object.entries(bySvc).toSorted((a, b) => b[1].count - a[1].count);
  for (const [svc, { count, scopes }] of svcEntries.slice(0, 15)) {
    const scopeList = [...scopes].toSorted().join(",");
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

    if (!d.svc && d.scope !== "data" && d.aspect !== "prefix_schema" && !isServiceExempt(d)) {
      // 라이브러리/prefix 문서 제외
      if (!["user_scenario", "process_flow"].includes(d.aspect)) {
        noSvc++;
      }
    }
  }

  console.log(`[${source.mode}] === DB 품질 감사 ===`);
  console.log(`approved ${all.length}건 | purpose 없음 ${noPurpose} | 짧음 ${shortPurpose} | 고립 ${noLinks}`);
  if (noSvc > 0) {
    console.log(`info | svc 미부여 ${noSvc}건 (참고 지표 — 현재는 fail 조건 아님)`);
  }

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

// ── topdown (DefDataSource 기반) ──────────────────────

async function cmdTopdown(source: DefDataSource, groupId: string, level: "purpose" | "overview" = "purpose") {
  const group = await source.get(groupId);
  if (!group) { console.log(`문서 "${groupId}" 없음`); return; }

  console.log(`# ${group.title ?? group.docId}\n`);
  if (group.purpose) console.log(`${group.purpose}\n`);
  const tags = group.tags.length > 0 ? `concerns: ${group.tags.filter(t => t !== "structural" && t !== "entry-point" && t !== "generated").join(", ")}` : "";
  if (tags) console.log(`${tags}\n`);

  const children = await source.getChildren(groupId);
  // scope 순서: constraint → data → feature → flow → interface → state → ui
  const sorted = children.toSorted((a, b) => a.scope.localeCompare(b.scope) || a.docId.localeCompare(b.docId));

  for (const child of sorted) {
    const prefix = child.level && BOUNDARY_LEVELS.has(child.level) ? `[${child.level}] ` : "";
    const scopeTag = `[${child.scope.split("/")[0]}]`;
    console.log(`## ${scopeTag} ${prefix}${child.title ?? child.docId}`);
    if (level === "purpose" && child.purpose) {
      console.log(child.purpose);
    } else if (level === "overview") {
      if (child.purpose) console.log(child.purpose);
      // overview 레벨에서는 하위 children도 간략히 표시
      const grandchildren = await source.getChildren(child.docId);
      if (grandchildren.length > 0) {
        for (const gc of grandchildren) {
          console.log(`  - ${gc.docId}: ${gc.purpose?.slice(0, 100) ?? "(purpose 없음)"}`);
        }
      }
    }
    console.log();
  }
}

// ── bottomup (DefDataSource 기반) ─────────────────────

async function cmdBottomup(source: DefDataSource, docId: string) {
  const doc = await source.get(docId);
  if (!doc) { console.log(`문서 "${docId}" 없음`); return; }

  // BFS로 영향 범위 역추적
  const visited = new Set<string>();
  const queue: Array<{ id: string; depth: number; via: string }> = [{ id: docId, depth: 0, via: "" }];
  const affected: Array<{ id: string; depth: number; via: string }> = [];
  const groups = new Set<string>();

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current.id)) continue;
    visited.add(current.id);
    if (current.depth > 0) affected.push(current);

    const incoming = await source.getIncomingLinks(current.id);
    for (const link of incoming) {
      if (visited.has(link.source)) continue;
      const srcDoc = await source.get(link.source);
      if (srcDoc && srcDoc.level && BOUNDARY_LEVELS.has(srcDoc.level)) {
        groups.add(link.source);
      }
      queue.push({ id: link.source, depth: current.depth + 1, via: `${link.type} ↑` });
    }
  }

  console.log(`# 영향 분석: ${docId}\n`);
  console.log(`blast radius: ${affected.length}건`);

  if (groups.size > 0) {
    console.log(`\n## 그룹 영향`);
    for (const g of groups) console.log(`- ${g}`);
  }

  if (affected.length > 0) {
    console.log(`\n## 영향받는 문서`);
    const sorted = affected.toSorted((a, b) => a.depth - b.depth);
    for (const a of sorted) {
      console.log(`- [${a.via}] ${a.id} (depth ${a.depth})`);
    }
  }

  const feedbackMatches = await collectFeedbackMatches(
    source,
    [docId, ...affected.map((item) => item.id)],
  );
  if (feedbackMatches.length > 0) {
    console.log(`\n## Feedback Trace`);
    for (const match of feedbackMatches.slice(0, 10)) {
      const model = match.request.targetModel ? ` [${match.request.targetModel}]` : "";
      console.log(`- ${match.request.id}${model} ← ${match.anchorDocId}`);
      console.log(`  ${match.request.purpose}`);
    }
    if (feedbackMatches.length > 10) {
      console.log(`  ... 외 ${feedbackMatches.length - 10}건`);
    }
  }
}

// ── context (DefDataSource 기반) ──────────────────────

async function cmdContext(source: DefDataSource, docId: string) {
  const doc = await source.get(docId);
  if (!doc) { console.log(`문서 "${docId}" 없음`); return; }

  const parent = await source.getParent(docId);
  const outgoing = await source.getOutgoingLinks(docId);
  const incoming = await source.getIncomingLinks(docId);

  console.log(`# 컨텍스트: ${doc.title ?? doc.docId}\n`);
  const typeLabel = doc.type === "knowledge" && doc.knowledgeKind
    ? `type: knowledge/${doc.knowledgeKind}`
    : doc.type ? `type: ${doc.type}` : "";
  console.log(`scope: ${doc.scope}/${doc.aspect}  depth: ${doc.depth}  lifecycle: ${doc.lifecycle}`);
  if (typeLabel) console.log(typeLabel);
  if (doc.layer) console.log(`layer: ${doc.layer}`);
  if (doc.svc) console.log(`svc: ${doc.svc}`);
  if (doc.address) console.log(`address: ${doc.address}`);

  // 목적
  if (doc.purpose) {
    console.log(`\n## 이 문서의 목적`);
    console.log(doc.purpose);
  }

  // 소속 (부모 그룹)
  if (parent) {
    console.log(`\n## 소속`);
    console.log(`- ${parent.docId}: ${parent.purpose?.slice(0, 120) ?? ""}`);
  }

  // 적용되는 제약
  const outgoingConstraints = outgoing.filter(l => l.type === "constrains");
  const implementedContracts = outgoing.filter(l => l.type === "implements");
  const constraintIncoming = incoming.filter(l => l.type === "constrains");
  if (outgoingConstraints.length > 0 || implementedContracts.length > 0 || constraintIncoming.length > 0) {
    console.log(`\n## 적용되는 제약`);
    for (const c of constraintIncoming) {
      const cDoc = await source.get(c.source);
      console.log(`- [${c.source}]: ${cDoc?.purpose?.slice(0, 100) ?? ""}`);
    }
    for (const c of outgoingConstraints) {
      const cDoc = await source.get(c.target);
      console.log(`- [constrains → ${c.target}]: ${cDoc?.purpose?.slice(0, 100) ?? ""}`);
    }
    for (const c of implementedContracts) {
      const cDoc = await source.get(c.target);
      console.log(`- [implements → ${c.target}]: ${cDoc?.purpose?.slice(0, 100) ?? ""}`);
    }
  }

  // 의존 대상
  const deps = outgoing.filter(l => l.type === "depends_on" || l.type === "implements" || l.type === "refines");
  if (deps.length > 0) {
    console.log(`\n## 의존 대상`);
    for (const d of deps) {
      const dDoc = await source.get(d.target);
      console.log(`- [${d.type}] ${d.target}: ${dDoc?.purpose?.slice(0, 100) ?? ""}`);
    }
  }

  // concerns (태그 기반 — 직접 + 상속)
  const directConcerns = extractConcernTags(doc.tags);
  const inheritedConcerns: string[] = [];
  for (const link of [...deps, ...(parent ? [{ target: parent.docId, type: "contains" }] : [])]) {
    const target = await source.get(link.target);
    if (!target) continue;
    const tConcerns = extractConcernTags(target.tags);
    for (const c of tConcerns) {
      inheritedConcerns.push(`${c} from ${link.target} via ${link.type}`);
    }
  }
  if (directConcerns.length > 0 || inheritedConcerns.length > 0) {
    console.log(`\n## concerns`);
    if (directConcerns.length > 0) console.log(`직접: ${directConcerns.join(", ")}`);
    if (inheritedConcerns.length > 0) {
      for (const ic of [...new Set(inheritedConcerns)]) {
        console.log(`상속: ${ic}`);
      }
    }
  }

  // 영향 범위
  const blastRadius = incoming.filter(l => l.type !== "contains");
  console.log(`\n## 영향 범위`);
  console.log(`blast radius: ${blastRadius.length}건`);
  for (const b of blastRadius.slice(0, 10)) {
    console.log(`- [${b.type}] ${b.source}`);
  }
  if (blastRadius.length > 10) console.log(`  ... 외 ${blastRadius.length - 10}건`);

  const requests = await source.getFeedbackRequestsByDocId(docId, 5);
  if (requests.length > 0) {
    console.log(`\n## 최근 Feedback Requests`);
    for (const request of requests) {
      const model = request.targetModel ? ` [${request.targetModel}]` : "";
      console.log(`- ${request.id}${model}: ${request.purpose}`);
    }
  }
}

// ── boundary (DefDataSource 기반) ─────────────────────

async function cmdBoundary(source: DefDataSource, docId: string, flags: Record<string, string>) {
  const level = flags["level"] === "purpose" ? "purpose" : "overview";
  const boundaryData = await source.getBoundary(docId, level);
  if (!boundaryData) { console.log(`문서 "${docId}" 없음`); return; }

  if (flags["json"] === "true") {
    console.log(JSON.stringify(boundaryData, null, 2));
    return;
  }

  console.log(`# 바운더리: ${boundaryData.boundary.title}\n`);
  console.log(`scope: ${boundaryData.boundary.scope}/${boundaryData.boundary.aspect}  depth: ${boundaryData.boundary.depth}  lifecycle: ${boundaryData.boundary.lifecycle}`);
  if (boundaryData.boundary.layer) console.log(`layer: ${boundaryData.boundary.layer}`);
  if (boundaryData.boundary.svc) console.log(`svc: ${boundaryData.boundary.svc}`);

  if (boundaryData.boundary.purpose) {
    console.log(`\n## 목적`);
    console.log(boundaryData.boundary.purpose);
  }

  if (level === "overview" && boundaryData.boundary.overview) {
    console.log(`\n## 개요`);
    console.log(`- ${boundaryData.boundary.overview.split("\n")[0]?.trim() || "(요약 없음)"}`);
  }

  console.log(`\n## 구조`);
  if (boundaryData.members.length === 0) {
    console.log(`- (contains 멤버 없음)`);
  } else {
    for (const child of boundaryData.members) {
      console.log(`- [${child.scope}/${child.aspect}] ${child.docId}: ${child.summary}`);
    }
  }

  console.log(`\n## 직접 결합`);
  console.log(`### outgoing`);
  if (boundaryData.couplings.outgoing.length === 0) {
    console.log(`- (없음)`);
  } else {
    for (const link of boundaryData.couplings.outgoing) {
      console.log(`- [${link.type}] ${link.target}: ${link.summary}`);
    }
  }

  console.log(`\n### incoming`);
  if (boundaryData.couplings.incoming.length === 0) {
    console.log(`- (없음)`);
  } else {
    for (const link of boundaryData.couplings.incoming) {
      console.log(`- [${link.type}] ${link.source}: ${link.summary}`);
    }
  }
}

async function cmdBoundaryContext(source: DefDataSource, docId: string, flags: Record<string, string>) {
  const level = flags["level"] === "purpose" ? "purpose" : "overview";
  const mode = flags["mode"] === "direct" ? "direct" : "transitive";
  const result = await source.getBoundaryContext(docId, level, mode);
  if (!result) { console.log(`문서 "${docId}" 없음`); return; }

  if (flags["json"] === "true") {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const boundary = result.boundary.boundary;

  console.log(`# 바운더리 컨텍스트: ${boundary.title}\n`);
  console.log(`scope: ${boundary.scope}/${boundary.aspect}  depth: ${boundary.depth}  lifecycle: ${boundary.lifecycle}`);
  console.log(`mode: ${result.mode}`);
  if (boundary.layer) console.log(`layer: ${boundary.layer}`);
  if (boundary.svc) console.log(`svc: ${boundary.svc}`);

  if (boundary.purpose) {
    console.log(`\n## 목적`);
    console.log(boundary.purpose);
  }

  if (level === "overview" && boundary.overview) {
    console.log(`\n## 개요`);
    console.log(`- ${boundary.overview.split("\n")[0]?.trim() || "(요약 없음)"}`);
  }

  console.log(`\n## 구조`);
  if (result.boundary.members.length === 0) console.log(`- (contains 멤버 없음)`);
  else for (const member of result.boundary.members) {
    console.log(`- [${member.scope}/${member.aspect}] ${member.docId}: ${member.summary}`);
  }

  console.log(`\n## 직접 결합`);
  console.log(`### outgoing`);
  if (result.boundary.couplings.outgoing.length === 0) console.log(`- (없음)`);
  else for (const link of result.boundary.couplings.outgoing) {
    console.log(`- [${link.type}] ${link.target}: ${link.summary}`);
  }

  console.log(`\n### incoming`);
  if (result.boundary.couplings.incoming.length === 0) console.log(`- (없음)`);
  else for (const link of result.boundary.couplings.incoming) {
    console.log(`- [${link.type}] ${link.source}: ${link.summary}`);
  }

  console.log(`\n## concerns`);
  console.log(`직접: ${result.concerns.direct.length > 0 ? result.concerns.direct.join(", ") : "(없음)"}`);
  if (result.concerns.inherited.length === 0) console.log(`상속: (없음)`);
  else for (const item of result.concerns.inherited) {
    console.log(`상속: ${item.tag} from ${item.source} via ${item.via}`);
  }

  console.log(`\n## impact`);
  console.log(`blast radius: ${result.impact.blastRadius}건`);
  if (result.impact.affectedGroups.length > 0) {
    console.log(`groups: ${result.impact.affectedGroups.join(", ")}`);
  }
  for (const item of result.impact.impacted.slice(0, 10)) {
    console.log(`- [${item.via}] ${item.docId} (${item.direction}, depth ${item.distance})`);
  }

  if (result.feedbackTrace.length > 0) {
    console.log(`\n## feedback trace`);
    for (const item of result.feedbackTrace.slice(0, 10)) {
      const model = item.targetModel ? ` [${item.targetModel}]` : "";
      console.log(`- ${item.id}${model}: ${item.purpose}`);
    }
  }
}

// ── audit (DefDataSource 기반, 레거시 통합) ───────────

async function cmdAudit(source: DefDataSource) {
  const all = await source.list({ limit: 2000 });
  const active = all.filter(d => d.lifecycle !== "deprecated" && d.lifecycle !== "archived");

  let withPurpose = 0, withTags = 0;
  // links 카운트: DefDoc.links 필드에 이미 outgoing links가 포함됨
  let withLinks = 0;
  for (const d of active) {
    if (d.purpose && d.purpose.length > 0) withPurpose++;
    if (d.links.some(l => l.type !== "contains")) withLinks++;
    if (d.tags.length > 0) withTags++;
  }

  // level 분포
  const byLevel: Record<string, number> = {};
  for (const d of active) {
    const level = d.level ?? "leaf";
    byLevel[level] = (byLevel[level] || 0) + 1;
  }

  console.log(`=== 품질 리포트 ===`);
  console.log(`문서 ${active.length}건 | purpose ${withPurpose} | links ${withLinks} | tags ${withTags}`);
  console.log(`level: ${Object.entries(byLevel).toSorted((a, b) => b[1] - a[1]).map(([k, v]) => `${k}(${v})`).join(" ")}`);

  // 그래프 검증
  const validation = await source.validate();
  if (validation.issues.length > 0) {
    const byType: Record<string, typeof validation.issues[number][]> = {};
    for (const i of validation.issues) (byType[i.type] ??= []).push(i);

    console.log(`\n=== 그래프 검증 (errors=${validation.errors} warnings=${validation.warnings}) ===`);
    for (const [type, items] of Object.entries(byType).toSorted((a, b) => b[1].length - a[1].length)) {
      console.log(`\n[${items[0]!.severity}] ${type}: ${items.length}건`);
      for (const i of items) console.log(`  ${i.docId}: ${i.message}`);
    }
  } else {
    console.log(`\n그래프 검증 통과 (이슈 0건)`);
  }

  // purpose 이슈
  const noPurpose = active.filter(d => !d.purpose || d.purpose.length === 0);
  if (noPurpose.length > 0) {
    console.log(`\n=== purpose 이슈 ${noPurpose.length}건 ===`);
    noPurpose.slice(0, 10).forEach(d => console.log(`  [high] ${d.docId}: ^purpose 없음`));
    if (noPurpose.length > 10) console.log(`  ... 외 ${noPurpose.length - 10}건`);
  }
}

// ── scan (파일 스캔 유틸) ──────────────────────────────

/** 파일 시스템에서 docs/ 하위 .md를 스캔하여 ScanResult 반환 */
async function scan(flags: Record<string, string> = {}) {
  const root = getRootDir();
  const docsDir = flags["docs"] ?? "docs";
  return scanAndBuild(root, [join(root, docsDir)]);
}

/** scan = sync의 alias. 파일 스캔 + DB 동기화를 한번에 수행. */
async function cmdScan(flags: Record<string, string>) {
  return cmdSync(flags);
}

async function cmdScanAudit(flags: Record<string, string>) {
  const root = getRootDir();
  const result = await scan(flags);
  const active = result.registry.all().filter(
    (entry) => entry.lifecycle !== "deprecated" && entry.lifecycle !== "archived",
  );

  let withPurpose = 0;
  let withTags = 0;
  let withLinks = 0;
  const byLevel: Record<string, number> = {};

  for (const entry of active) {
    const level = entry.level ?? "leaf";
    byLevel[level] = (byLevel[level] || 0) + 1;
    if ((entry.tags?.length ?? 0) > 0) withTags++;
    if (result.registry.getLinks(entry.id, "outgoing").some((link) => link.linkType !== "contains")) {
      withLinks++;
    }

    if (entry.ref) {
      try {
        const content = readFileSync(join(root, entry.ref), "utf8");
        const fm = extractFrontmatter(content);
        const body = fm?.body ?? content;
        const purpose = extractByMarker(body, "purpose").text || extractByLevel(body, "purpose").text;
        if (purpose.trim().length > 0) {
          withPurpose++;
        }
      } catch {
        // scan error는 별도 섹션에서 보고한다.
      }
    }
  }

  console.log("=== scan 감사 ===");
  console.log(`문서 ${active.length}건 | purpose ${withPurpose} | links ${withLinks} | tags ${withTags}`);
  console.log(`registered: ${result.registered} | linked: ${result.linked}`);
  console.log(`scan errors: ${result.errors.length} | link errors: ${result.linkErrors.length}`);
  console.log(`level: ${Object.entries(byLevel).toSorted((a, b) => b[1] - a[1]).map(([k, v]) => `${k}(${v})`).join(" ")}`);

  if (result.errors.length > 0) {
    console.log(`\n=== 스캔 에러 ${result.errors.length}건 ===`);
    for (const issue of result.errors.slice(0, 10)) {
      console.log(`  ${issue.file}: ${issue.error}`);
    }
    if (result.errors.length > 10) console.log(`  ... 외 ${result.errors.length - 10}건`);
  }

  if (result.linkErrors.length > 0) {
    console.log(`\n=== 링크 에러 ${result.linkErrors.length}건 ===`);
    for (const issue of result.linkErrors.slice(0, 10)) {
      console.log(`  ${issue.source} -> ${issue.target}: ${issue.error}`);
    }
    if (result.linkErrors.length > 10) console.log(`  ... 외 ${result.linkErrors.length - 10}건`);
  }

  const validation = validateGraph(result.registry);
  if (validation.issues.length > 0) {
    const byType: Record<string, Array<(typeof validation.issues)[number]>> = {};
    for (const issue of validation.issues) (byType[issue.type] ??= []).push(issue);

    console.log(`\n=== 그래프 검증 (errors=${validation.errors} warnings=${validation.warnings}) ===`);
    for (const [type, items] of Object.entries(byType).toSorted((a, b) => b[1].length - a[1].length)) {
      console.log(`\n[${items[0]!.severity}] ${type}: ${items.length}건`);
      for (const issue of items.slice(0, 10)) {
        console.log(`  ${issue.docId}: ${issue.message}`);
      }
      if (items.length > 10) console.log(`  ... 외 ${items.length - 10}건`);
    }
  } else {
    console.log(`\n그래프 검증 통과 (이슈 0건)`);
  }
}

async function cmdSync(flags: Record<string, string>) {
  const root = getRootDir();
  const dbPath = flags["db"] ?? flags["db-path"];
  const docsDir = flags["docs"] ?? "docs";
  const result = await syncDocsToLocalDb({
    rootDir: root,
    docsDir,
    ...(dbPath ? { dbPath } : {}),
  });
  console.log(`동기화 완료: ${result.synced}건 문서, ${result.links}건 링크`);
  console.log(`DB: ${result.dbPath}`);
}

function printDefHelp() {
  console.log(`qa-sdk def — 문서 관리

시작하기:
  help                        이 도움말
  guide                       시스템 전체 구조 안내
  guide concepts              핵심 개념 (좌표, prefix, 축)
  guide classification        문서 분류 체계 (scope, level, layer)
  guide authoring             핵심 작성 규칙 + 코드 매핑 규칙
  guide management            definition 관리 흐름
  guide services              서비스 구조
  guide philosophy            시스템 철학
  concepts                    concept 문서 목록

조회:
  list [--scope=X] [--level=Z] [--layer=Y] [--tag=T] [--q=검색어]
  get <ID>            단건 조회
  body <ID>           최신 본문 조회 (--json 가능)
  read <ID>           body의 별칭
  children <ID>       자식 문서
  parent <ID>         부모 문서
  incoming <ID>       역링크
  search <검색어>     전문 검색
  concepts            knowledge/concept 문서 조회
  find-by-file <경로[:symbol]> code_references 기준 boundary 해석

분석:
  scan-audit          raw frontmatter/link 감사 (DB 미사용)
  context <ID>        작업 전 컨텍스트 (소속/의존/영향)
  boundary <ID>       바운더리 구조 + direct coupling (--level, --json 가능)
  boundary-context <ID> 바운더리 + concerns + impact + feedback (--level, --mode, --json 가능)
  impact <ID>         변경 영향 분석
  topdown <ID>        탑다운 조립
  bottomup <ID>       영향 역추적

품질:
  sync                docs → local DB 동기화
  audit               품질 리포트 + 그래프 검증
  validate            DB 기준 그래프 + code reference 검증
  stats               분포 통계
  check <ID>          문서 정합성 점검
  link-rules          LinkType 사용 규칙

상태:
  state               전체 머신 상태 분포
  state <머신ID>      특정 머신 분포
  state <문서ID>      문서별 상태
  state --deps        머신 간 의존 관계`);
}

// ── 라우터 ────────────────────────────────────────────

export async function cliDef(args: string[]): Promise<void> {
  const { positional, options, flags } = parseFlags(args);
  const sub = positional[0];
  const rest = positional.slice(1);

  if (!sub || sub === "help") {
    printDefHelp();
    return;
  }

  // scan은 파일 스캔 전용 (DB 불필요)
  if (sub === "scan") return cmdScan(flags);
  if (sub === "scan-audit") return cmdScanAudit(flags);
  if (sub === "sync") return cmdSync(flags);
  if (sub === "link-rules") return cmdLinkRules();
  if (sub === "state") return cmdState(rest, flags);

  // DefDataSource 기반 커맨드 (전체 통합)
  const dsCommands = new Set([
    "list", "get", "body", "read", "children", "parent", "incoming", "validate", "search", "stats",
    "impact", "check", "audit", "audit-db", "overview", "find-by-file", "guide", "concepts",
    "topdown", "bottomup", "context", "boundary", "boundary-context",
  ]);
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
        case "body":
        case "read":
          if (!rest[0]) { console.log("Usage: qa-sdk def body|read <문서ID> [--json]"); return; }
          return await cmdBody(source, rest[0], flags);
        case "children": return await cmdChildren(source, rest[0]);
        case "parent": return await cmdParent(source, rest[0]);
        case "incoming": return await cmdIncoming(source, rest[0]);
        case "validate": return await cmdValidate(source);
        case "search": return await cmdSearch(source, rest[0] ?? flags["q"] ?? "");
        case "concepts": return await cmdConcepts(source, flags);
        case "stats": return await cmdStats(source);
        case "impact": return await cmdImpact(source, rest[0]);
        case "check": return await cmdCheck(source, rest[0]);
        case "audit": return await cmdAudit(source);
        case "audit-db": return await cmdAuditDb(source);
        case "overview": return await cmdOverview(source);
        case "find-by-file": return await cmdFindByFile(source, rest[0] ?? "");
        case "guide": return await cmdGuide(source, rest[0]);
        case "topdown":
          if (!rest[0]) { console.log("Usage: qa-sdk def topdown <그룹ID>"); return; }
          return await cmdTopdown(source, rest[0], flags["overview"] === "true" ? "overview" : "purpose");
        case "bottomup":
          if (!rest[0]) { console.log("Usage: qa-sdk def bottomup <문서ID>"); return; }
          return await cmdBottomup(source, rest[0]);
        case "context":
          if (!rest[0]) { console.log("Usage: qa-sdk def context <문서ID>"); return; }
          return await cmdContext(source, rest[0]);
        case "boundary":
          if (!rest[0]) { console.log("Usage: qa-sdk def boundary <문서ID> [--level purpose|overview] [--json]"); return; }
          return await cmdBoundary(source, rest[0], flags);
        case "boundary-context":
          if (!rest[0]) { console.log("Usage: qa-sdk def boundary-context <문서ID> [--level purpose|overview] [--mode direct|transitive] [--json]"); return; }
          return await cmdBoundaryContext(source, rest[0], flags);
      }
    } finally {
      if ("close" in source && typeof source.close === "function") (source as { close(): void }).close();
    }
    return;
  }

  printDefHelp();
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

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- !match 검사 통과 후 캡처 그룹 [1] 존재 보장
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

  if (source.mode === "scan") {
    console.log("find-by-file는 DB-owned code reference가 필요합니다.");
    console.log("  → qa-sdk def sync 후 local/server datasource에서 다시 실행하세요.");
    return;
  }

  const mapping = await source.resolveByFile(relPath);

  if (mapping.kind === "none") {
    console.log("구조적으로 증명 가능한 code↔doc mapping이 없습니다.");
    console.log("  → 코드 주석에 `@def.boundary <doc-id>[#symbol]` 또는 `@def.doc <doc-id>[#symbol]`를 추가하세요.");
    console.log("  → 또는 문서 frontmatter top-level에 `source: packages/.../file.ts[:symbol]`를 추가하세요.");
    console.log("  → 그런 뒤 `qa-sdk def sync`를 다시 실행하세요.");
    console.log("  → explicit source-map이 없으면 find-by-file는 결과를 주지 않습니다.");
    return;
  }

  if (mapping.kind === "ambiguous") {
    console.log("explicit source-map이 둘 이상의 boundary anchor로 갈라집니다.");
    if (mapping.references.some((ref) => ref.symbol)) {
      console.log("  → symbol별 mapping이 있으면 `<경로:심볼>`로 다시 조회하세요.");
    }
    console.log("  → 단일 authoritative boundary로 정리되기 전까지 find-by-file는 결과를 확정하지 않습니다.\n");
    for (const item of mapping.candidates) {
      console.log(`- anchor: ${item.anchor.docId}`);
      const docIds = new Set(item.supportingDocs.map((doc) => doc.docId));
      const symbols = [...new Set(
        item.references
          .filter((ref) => docIds.has(ref.docId))
          .map((ref) => ref.symbol)
          .filter(Boolean),
      )];
      if (symbols.length > 0) {
        console.log(`  symbols: ${symbols.join(", ")}`);
      }
      for (const doc of item.supportingDocs) {
        console.log(`  - doc: ${doc.docId}`);
      }
    }
    return;
  }

  console.log(`authoritative boundary: ${mapping.anchor.docId}`);
  console.log(`  scope: ${mapping.anchor.scope}/${mapping.anchor.aspect}`);
  console.log(`  depth: ${mapping.anchor.depth}`);
  if (mapping.anchor.level) console.log(`  level: ${mapping.anchor.level}`);
  if (mapping.anchor.svc) console.log(`  svc: ${mapping.anchor.svc}`);
  if (mapping.anchor.purpose) {
    console.log(`  purpose: ${mapping.anchor.purpose.slice(0, 160)}`);
  }

  console.log(`\nsource-map support (${mapping.supportingDocs.length}건):`);
  for (const doc of mapping.supportingDocs) {
    const marker = doc.docId === mapping.anchor.docId ? "  *" : "  -";
    console.log(`${marker} ${doc.docId}  ${doc.scope}/${doc.aspect}  ${doc.depth}`);
  }
}

async function cmdGuide(source: DefDataSource, topic?: string) {
  switch (topic) {
    case "authoring": {
      const doc = await source.get("definition-authoring-guide");
      console.log("=== 문서 작성 빠른 진입 ===\n");
      console.log(doc?.purpose ?? "(definition-authoring-guide 문서 없음)");
      console.log("\n핵심 체크:");
      console.log("  1. 좌표 결정: scope/aspect/depth + level/layer/lifecycle");
      console.log("  2. frontmatter: id, links, svc, tags");
      console.log("  3. 본문: ^purpose 필수, group/module은 ^overview + contains");
      console.log("  4. 코드 매핑: source: + @def.boundary/@def.doc → def sync → def find-by-file <경로[:symbol]>");
      console.log("\n바로 보기:");
      console.log("  def body definition-authoring-guide");
      console.log("  def body definition-mgmt-coordinates");
      console.log("  def body definition-mgmt-verification-loop");
      return;
    }
    case "management":
    case "workflow": {
      const doc = await source.get("definition-management");
      const children = await source.getChildren("definition-management");
      console.log("=== definition 관리 흐름 ===\n");
      console.log(doc?.purpose ?? "(definition-management 문서 없음)");
      if (children.length > 0) {
        console.log("\n관리 단계:");
        for (const child of children.toSorted((a, b) => a.docId.localeCompare(b.docId))) {
          console.log(`  - ${child.docId}`);
          if (child.purpose) console.log(`    ${child.purpose.slice(0, 100)}`);
        }
      }
      console.log("\n바로 보기:");
      console.log("  def body definition-management");
      console.log("  def children definition-management");
      console.log("  def body definition-mgmt-coordinates");
      console.log("  def body definition-mgmt-verification-loop");
      return;
    }
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
      const _taxonomy = await source.get("definition-taxonomy");
      const _level = await source.get("definition-level");
      console.log("=== 문서 분류 체계 ===\n");
      console.log("분류 축:");
      console.log("  scope (7종)  — 무엇에 대한 정의인가 (ui/feature/flow/state/constraint/data/interface)");
      console.log("  aspect (22종) — 어떤 측면을 정의하는가 (scope별 2~5종)");
      console.log("  depth (4종)  — 얼마나 상세한가 (overview/specification/implementation/validation)");
      console.log("\n메타데이터:");
      console.log("  level (3종)  — 문서의 역할 (group/module/leaf)");
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
      console.log(`level: ${Object.entries(byLevel).toSorted((a, b) => b[1] - a[1]).map(([k, v]) => `${k}(${v})`).join(" ")}`);

      console.log("\n=== 영역 구조 ===\n");
      for (const a of areas) {
        const childCount = (await source.getChildren(a.docId)).length;
        console.log(`  [area] ${a.docId} (${childCount} children)`);
        if (a.purpose) console.log(`    ${a.purpose.slice(0, 80)}`);
      }

      console.log("\n=== 다음 단계 ===\n");
      console.log("  def guide concepts        핵심 개념 (좌표, prefix, 축)");
      console.log("  def guide classification  문서 분류 체계 (scope, level, layer)");
      console.log("  def guide authoring       핵심 작성 규칙");
      console.log("  def guide management      definition 관리 흐름");
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

// ── def state — 하네스 상태 분포 ───────────────────────

async function cmdState(rest: string[], flags: Record<string, string>) {
  const root = getRootDir();
  const registry = createHarnessRegistry();

  // --deps: 의존 관계만 출력
  if (flags["deps"]) {
    printDeps(registry);
    return;
  }

  // 문서 스캔 + config 로드
  const scanResult = await scan();
  const config = await readDefConfig(root);
  const configExists = config.lastSyncedAt !== "";

  // checksum 비교 — drift 감지
  const currentChecksums: Record<string, string> = {};
  for (const entry of scanResult.registry.all()) {
    const id = entry.id;
    currentChecksums[id] = hashFrontmatter(
      `${entry.scope}:${entry.aspect}:${entry.depth}:${entry.level ?? "leaf"}:${entry.lifecycle}`,
    );
  }
  const drift = detectDrift(config, currentChecksums);
  const checksumMatch = drift.length === 0;

  // 전역 sync 상태
  const syncState = deriveSyncState({
    configExists,
    configCount: config.documentCount,
    scanCount: scanResult.registered,
    checksumMatch,
  });

  // 각 문서별 상태 파생
  const docStates: { id: string; lifecycle: string; specImpl: string; convention: string }[] = [];
  for (const entry of scanResult.registry.all()) {
    const id = entry.id;
    const lifecycle = deriveDocLifecycle(entry.lifecycle);

    const hasSvc = !!entry.serviceId;
    const svcDir = entry.serviceId ? join(root, "packages", entry.serviceId) : null;
    let hasCode = false;
    let hasTests = false;
    if (svcDir) {
      try {
        const { readdirSync } = await import("node:fs");
        const srcDir = join(svcDir, "src");
        hasCode = existsSync(srcDir) && readdirSync(srcDir).some(f => f.endsWith(".ts"));
        hasTests = existsSync(srcDir) && readdirSync(srcDir).some(f => f.endsWith(".test.ts"));
      } catch { /* 디렉토리 없음 */ }
    }

    const specImpl = deriveSpecImplState({
      hasSvc,
      hasCode,
      hasTests,
      testsPass: null,
      isSourceReferenced: entry.depth === "implementation" || entry.depth === "validation",
    });

    // convention: 현재 spec-tracker 미연동 → unverified
    const convention = deriveConventionState({
      evidenceCount: 0,
      coverage: 0,
      hasFailures: false,
    });

    docStates.push({ id, lifecycle, specImpl, convention });
  }

  const target = rest[0];

  // 특정 머신 분포
  if (target && registry.machines.has(target)) {
    printMachineDistribution(target, docStates, syncState);
    return;
  }

  // 특정 문서 상태
  if (target) {
    const doc = docStates.find(d => d.id === target);
    if (!doc) { console.log(`문서 "${target}" 없음`); return; }
    console.log(`${doc.id}`);
    console.log(`  doc-lifecycle:          ${doc.lifecycle}`);
    console.log(`  spec-impl:              ${doc.specImpl}`);
    console.log(`  convention-compliance:   ${doc.convention}`);
    console.log(`  db-sync:                ${syncState}`);
    return;
  }

  // 전체 분포
  console.log(`── 문서 계층 (${docStates.length}건) ──────────────────────`);
  printDistributionLine("doc-lifecycle", docStates.map(d => d.lifecycle));
  printDistributionLine("spec-impl", docStates.map(d => d.specImpl));
  printDistributionLine("convention", docStates.map(d => d.convention));
  console.log(`db-sync              ${syncState}`);

  console.log(`\n── 시스템 계층 ────────────────────────`);
  console.log(`address-state        (외부 서비스 연결 필요)`);
  console.log(`version-lifecycle    (외부 서비스 연결 필요)`);
  console.log(`service-status       (외부 서비스 연결 필요)`);
  console.log(`event-status         (외부 서비스 연결 필요)`);
  console.log(`metric-health        (외부 서비스 연결 필요)`);

  console.log(`\n── 프로세스 계층 ──────────────────────`);
  console.log(`decision-flow        (외부 서비스 연결 필요)`);
  console.log(`policy-candidate     (외부 서비스 연결 필요)`);
}

function printDistributionLine(label: string, states: string[]) {
  const counts = new Map<string, number>();
  for (const s of states) {
    counts.set(s, (counts.get(s) ?? 0) + 1);
  }
  const parts = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([state, count]) => `${state}(${count})`);
  console.log(`${label.padEnd(21)}${parts.join(" ")}`);
}

function printMachineDistribution(
  machineId: string,
  docStates: { id: string; lifecycle: string; specImpl: string; convention: string }[],
  syncState: string,
) {
  const docMachineField: Record<string, keyof typeof docStates[0]> = {
    "doc-lifecycle": "lifecycle",
    "spec-impl": "specImpl",
    "convention-compliance": "convention",
  };

  const field = docMachineField[machineId];
  if (field) {
    const values = docStates.map(d => d[field]);
    printDistributionLine(machineId, values);
    console.log(`\n상세:`);
    for (const d of docStates) {
      console.log(`  ${d.id.padEnd(40)} ${d[field]}`);
    }
    return;
  }

  if (machineId === "db-sync") {
    console.log(`db-sync: ${syncState}`);
    return;
  }

  console.log(`${machineId}: 외부 서비스 연결 필요`);
}

function printDeps(registry: ReturnType<typeof createHarnessRegistry>) {
  const cascade = registry.dependencies.filter(d => d.kind === "cascade");
  const guard = registry.dependencies.filter(d => d.kind === "guard");
  const notify = registry.dependencies.filter(d => d.kind === "notify");

  if (cascade.length > 0) {
    console.log("cascade:");
    for (const d of cascade) {
      console.log(`  ${d.sourceMachine}:${d.sourceState} → ${d.targetMachine}:${d.targetState}  (${d.label})`);
    }
  }
  if (guard.length > 0) {
    console.log("guard:");
    for (const d of guard) {
      console.log(`  ${d.sourceMachine}:${d.sourceState} → ${d.targetMachine}:${d.targetState}  (${d.label})`);
    }
  }
  if (notify.length > 0) {
    console.log("notify:");
    for (const d of notify) {
      console.log(`  ${d.sourceMachine}:${d.sourceState} → ${d.targetMachine}:${d.targetState}  (${d.label})`);
    }
  }
}
