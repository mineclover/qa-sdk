/**
 * qa-sdk dkg — DKG 조회 + 자가 진단 CLI 명령어.
 *
 * bootstrapDkg()로 전체 DKG를 초기화한 후 조회/분석 수행.
 * 페이지네이션 지원.
 */

import { DEMO_CATALOG } from "demo-snapshot";
import {
  bootstrapDkg,
  GraphRegistry,
  DkgSqliteStore,
  scanAxisOverlaps,
  analyzeImpact,
  analyzeSimplification,
  scanDecisionConflicts,
  analyzeDeploymentSkew,
} from "@qa-sdk/spec-core";
import type { DkgNode, AxisNode, PrefixNode, DomainNode, ConsumerNode, PrefixSpec } from "@qa-sdk/spec-core";
import { catalogToPrefixSpecs } from "@qa-sdk/spec-core";
import { join } from "node:path";
import { mkdirSync, existsSync } from "node:fs";

// ── Shared ──────────────────────────────────────────

const STATE_DIR = join(process.env.HOME ?? ".", ".qa-sdk");
const STATE_DB = join(STATE_DIR, "state.sqlite");

let cachedStore: DkgSqliteStore | null = null;
let cachedGraph: GraphRegistry | null = null;

function getStore(): DkgSqliteStore {
  if (!cachedStore) {
    if (!existsSync(STATE_DIR)) mkdirSync(STATE_DIR, { recursive: true });
    cachedStore = new DkgSqliteStore(STATE_DB);
  }
  return cachedStore;
}

function getGraph(): GraphRegistry {
  if (!cachedGraph) {
    const store = getStore();
    const stats = store.stats();

    if (stats.nodes > 0) {
      // SQLite에서 로드
      cachedGraph = store.loadGraph();
      console.log(`  (loaded from ${STATE_DB}: ${stats.nodes} nodes, ${stats.edges} edges)`);
    } else {
      // 최초 실행 — bootstrap → save
      cachedGraph = bootstrapDkg();
      const saved = store.saveGraph(cachedGraph);
      store.setMeta("last_bootstrap", new Date().toISOString());
      console.log(`  (bootstrapped & saved: ${saved.nodesWritten} nodes, ${saved.edgesWritten} edges)`);
    }
  }
  return cachedGraph;
}

interface PageOptions {
  page?: number;
  limit?: number;
}

function paginate<T>(items: T[], opts: PageOptions): { items: T[]; page: number; totalPages: number; total: number } {
  const page = Math.max(1, opts.page ?? 1);
  const limit = Math.max(1, Math.min(100, opts.limit ?? 20));
  const total = items.length;
  const totalPages = Math.ceil(total / limit);
  const start = (page - 1) * limit;
  return {
    items: items.slice(start, start + limit),
    page,
    totalPages,
    total,
  };
}

function printPageInfo(result: { page: number; totalPages: number; total: number }): void {
  if (result.totalPages > 1) {
    console.log(`\n  page ${result.page}/${result.totalPages} (total: ${result.total})`);
  }
}

// ── dkg report ──────────────────────────────────────

export function dkgReport(): void {
  const graph = getGraph();

  const axes = graph.getNodesByKind("axis") as AxisNode[];
  const prefixes = graph.getNodesByKind("prefix") as PrefixNode[];
  const domains = graph.getNodesByKind("domain") as DomainNode[];
  const consumers = graph.getNodesByKind("consumer") as ConsumerNode[];
  const decisions = graph.getNodesByKind("decision");
  const constraints = graph.getNodesByKind("constraint");
  const observations = graph.getNodesByKind("observation");

  console.log("\n══ DKG Report ══");
  console.log(`  Axes:         ${axes.length}`);
  console.log(`  Prefixes:     ${prefixes.length}`);
  console.log(`  Domains:      ${domains.length}`);
  console.log(`  Consumers:    ${consumers.length}`);
  console.log(`  Decisions:    ${decisions.length}`);
  console.log(`  Constraints:  ${constraints.length}`);
  console.log(`  Observations: ${observations.length}`);
  console.log(`  Nodes total:  ${graph.nodeCount}`);
  console.log(`  Edges total:  ${graph.edgeCount}`);

  // headroom 요약
  const criticalAxes = axes.filter(a => {
    const catalog = DEMO_CATALOG.axes[a.id as keyof typeof DEMO_CATALOG.axes];
    if (!catalog) return false;
    const versions = Object.keys(catalog.versions);
    const latest = catalog.versions[versions[versions.length - 1] as keyof typeof catalog.versions] as any;
    return (latest.capacity ?? latest.entries.length) === latest.entries.length;
  });

  if (criticalAxes.length > 0) {
    console.log(`\n  ⚠ headroom=0 축: ${criticalAxes.map(a => a.id).join(", ")}`);
    console.log(`    (${decisions.length > 0 ? "Decision으로 확장 계획 기록됨" : "Decision 없음 — 확장 계획 필요"})`);
  }

  // 수렴 분석 요약
  const entriesMap = buildEntriesMap();
  const overlaps = scanAxisOverlaps(graph, entriesMap);
  const mergeCandidate = overlaps.filter(o => o.recommendation === "merge");
  const reviewCandidate = overlaps.filter(o => o.recommendation === "review");

  if (mergeCandidate.length > 0) {
    console.log(`\n  병합 후보: ${mergeCandidate.map(o => `${o.a}↔${o.b}`).join(", ")}`);
  }
  if (reviewCandidate.length > 0) {
    console.log(`  검토 필요: ${reviewCandidate.map(o => `${o.a}↔${o.b}`).join(", ")}`);
  }

  // 결정 충돌
  const conflicts = scanDecisionConflicts(graph);
  if (conflicts.length > 0) {
    console.log(`\n  결정 충돌: ${conflicts.length}개`);
  }

  // 영속 상태 정보
  const store = getStore();
  const storeStats = store.stats();
  const lastBootstrap = store.getMeta("last_bootstrap");
  console.log(`\n  ── 영속 상태 (${STATE_DB}) ──`);
  console.log(`  DB nodes: ${storeStats.nodes}, edges: ${storeStats.edges}`);
  console.log(`  스냅샷: ${storeStats.snapshots}개, versionUsage: ${storeStats.versionUsages}건`);
  if (lastBootstrap) console.log(`  last bootstrap: ${lastBootstrap}`);

  // 최근 배포 스큐
  const recent = store.loadRecentVersionUsages(1);
  if (recent.length > 0 && recent[0].versionUsages.length > 0) {
    const skews = analyzeDeploymentSkew(recent[0].versionUsages);
    const critical = skews.filter(s => s.severity === "critical");
    const warning = skews.filter(s => s.severity === "warning");
    if (critical.length > 0) {
      console.log(`\n  🔴 배포 스큐 critical: ${critical.map(s => s.prefix).join(", ")}`);
      for (const s of critical) console.log(`     ${s.summary}`);
    }
    if (warning.length > 0) {
      console.log(`  ⚠ 배포 스큐 warning: ${warning.map(s => s.prefix).join(", ")}`);
    }
  }
}

// ── dkg axes ────────────────────────────────────────

export function dkgAxes(opts: PageOptions): void {
  const graph = getGraph();
  const axes = graph.getNodesByKind("axis") as AxisNode[];

  const result = paginate(axes, opts);

  console.log(`\n══ Axes ══`);
  for (const axis of result.items) {
    const catalog = DEMO_CATALOG.axes[axis.id as keyof typeof DEMO_CATALOG.axes];
    let info = "";
    if (catalog) {
      const versions = Object.keys(catalog.versions);
      const latest = catalog.versions[versions[versions.length - 1] as keyof typeof catalog.versions] as any;
      const entries = latest.entries?.length ?? 0;
      const cap = latest.capacity ?? entries;
      info = ` entries=${entries} cap=${cap} headroom=${cap - entries}`;
    }
    console.log(`  ${axis.id.padEnd(15)} ${axis.name.padEnd(12)}${info}`);
  }

  printPageInfo(result);
}

// ── dkg prefixes ────────────────────────────────────

export function dkgPrefixes(opts: PageOptions): void {
  const graph = getGraph();
  const prefixes = graph.getNodesByKind("prefix") as PrefixNode[];
  const specs = catalogToPrefixSpecs(DEMO_CATALOG);
  const specMap = new Map(specs.map(s => [s.id, s]));

  const result = paginate(prefixes, opts);

  console.log(`\n══ Prefixes ══`);
  for (const prefix of result.items) {
    const edges = graph.edgesFrom(prefix.id, "composes");
    const axisDims = edges.filter(e => e.meta?.dimKind === "axis").length;
    const refDims = edges.filter(e => e.meta?.dimKind === "prefix_ref").length;
    const tblDims = edges.filter(e => e.meta?.dimKind === "table_ref").length;
    const spec = specMap.get(prefix.id);
    const cat = spec?.schema?.category ?? "?";
    const catTag = `[${cat}]`.padEnd(14);
    console.log(`  ${prefix.id.padEnd(17)} ${catTag} ${prefix.name.padEnd(15)} dims=${prefix.dimLabels.length} (axis:${axisDims} ref:${refDims} tbl:${tblDims})`);
  }

  printPageInfo(result);
}

// ── dkg domains ─────────────────────────────────────

export function dkgDomains(opts: PageOptions): void {
  const graph = getGraph();
  const domains = graph.getNodesByKind("domain") as DomainNode[];

  const result = paginate(domains, opts);

  console.log(`\n══ Domains ══`);
  for (const domain of result.items) {
    console.log(`  ${domain.id.padEnd(20)} ${domain.name}`);
    console.log(`    prefixes: ${domain.prefixes.join(", ")}`);
    console.log(`    exports:  ${domain.boundary.exports.join(", ")}`);
    if (domain.boundary.internal.length > 0) {
      console.log(`    internal: ${domain.boundary.internal.join(", ")}`);
    }
  }

  printPageInfo(result);
}

// ── dkg impact ──────────────────────────────────────

export function dkgImpact(axisId: string): void {
  const graph = getGraph();

  const cascade = graph.cascadeFromAxis(axisId);
  if (cascade.length === 0) {
    console.log(`\n  ${axisId}: 영향받는 prefix 없음`);
    return;
  }

  console.log(`\n══ Impact: ${axisId} ══`);
  for (const c of cascade) {
    console.log(`  ${"  ".repeat(c.distance - 1)}${c.reason === "composes" ? "←" : "←ref─"} ${c.id} (depth=${c.distance})`);
  }

  // consumer까지 cascade
  for (const c of cascade) {
    const { domains, consumers } = graph.cascadeFromPrefix(c.id);
    if (consumers.length > 0) {
      console.log(`\n  ${c.id} → consumers: ${consumers.map(cc => cc.id).join(", ")}`);
    }
  }
}

// ── dkg overlaps ────────────────────────────────────

export function dkgOverlaps(): void {
  const graph = getGraph();
  const entriesMap = buildEntriesMap();
  const overlaps = scanAxisOverlaps(graph, entriesMap);

  console.log(`\n══ Axis Overlaps ══`);
  if (overlaps.length === 0) {
    console.log("  중복 없음");
    return;
  }

  for (const o of overlaps) {
    const marker = o.recommendation === "merge" ? "🔴" : o.recommendation === "review" ? "🟡" : "🟢";
    console.log(`  ${marker} ${o.a} ↔ ${o.b}: [${o.sharedEntries.join(",")}] ${(o.overlapRatio * 100).toFixed(0)}% → ${o.recommendation}`);
    console.log(`     ${o.reason}`);
  }
}

// ── dkg history — 스냅샷 히스토리 ─────────────────────

export function dkgHistory(opts: { limit?: number }): void {
  const store = getStore();
  const recent = store.loadRecentVersionUsages(opts.limit ?? 10);

  console.log(`\n══ Usage 스냅샷 히스토리 (최근 ${recent.length}개) ══`);

  if (recent.length === 0) {
    console.log("  (스냅샷 없음. qa dkg collect로 수집 후 저장하세요.)");
    return;
  }

  for (const snap of recent) {
    console.log(`\n  #${snap.snapshotId} (${snap.collectedAt})`);

    // 배포 스큐
    const skews = analyzeDeploymentSkew(snap.versionUsages);
    for (const s of skews) {
      if (s.severity === "ok") continue;
      const icon = s.severity === "critical" ? "🔴" : "⚠";
      console.log(`    ${icon} ${s.summary}`);
    }

    // version 목록
    const byPrefix = new Map<string, string[]>();
    for (const vu of snap.versionUsages) {
      const list = byPrefix.get(vu.prefix) ?? [];
      list.push(`${vu.version}(${vu.count}건)`);
      byPrefix.set(vu.prefix, list);
    }
    for (const [prefix, versions] of byPrefix) {
      console.log(`    ${prefix}: ${versions.join(", ")}`);
    }
  }
}

// ── dkg export — JSON export ──────────────────────────

export function dkgExport(opts: { output?: string }): void {
  const store = getStore();
  const json = store.exportJson();

  if (opts.output) {
    const { writeFileSync, mkdirSync } = require("node:fs") as typeof import("node:fs");
    const { dirname } = require("node:path") as typeof import("node:path");
    mkdirSync(dirname(opts.output), { recursive: true });
    writeFileSync(opts.output, json, "utf-8");
    console.log(`  exported to ${opts.output}`);
  } else {
    console.log(json);
  }
}

// ── dkg import — JSON import ──────────────────────────

export function dkgImport(opts: { input: string }): void {
  const { readFileSync } = require("node:fs") as typeof import("node:fs");
  const json = readFileSync(opts.input, "utf-8");

  const store = getStore();
  const result = store.importJson(json);
  console.log(`  imported: ${result.nodesImported} nodes, ${result.edgesImported} edges`);
}

// ── dkg refresh — bootstrap 재실행 → save ─────────────

export function dkgRefresh(): void {
  const store = getStore();
  const graph = bootstrapDkg();
  const saved = store.saveGraph(graph);
  store.setMeta("last_bootstrap", new Date().toISOString());
  cachedGraph = graph;
  console.log(`  refreshed: ${saved.nodesWritten} nodes, ${saved.edgesWritten} edges`);
}

// ── dkg skew — 배포 스큐 상세 ─────────────────────────

export function dkgSkew(): void {
  const store = getStore();
  const recent = store.loadRecentVersionUsages(1);

  if (recent.length === 0 || recent[0].versionUsages.length === 0) {
    console.log("\n  (스냅샷 없음. 이벤트 수집 후 실행하세요.)");
    return;
  }

  const skews = analyzeDeploymentSkew(recent[0].versionUsages);

  console.log(`\n══ 배포 스큐 (최근 스냅샷: ${recent[0].collectedAt}) ══`);

  for (const s of skews) {
    const icon = s.severity === "ok" ? "✅" : s.severity === "warning" ? "⚠" : "🔴";
    console.log(`\n  ${icon} ${s.prefix}`);
    console.log(`     latest: ${s.latestVersion}`);
    for (const v of s.activeVersions) {
      console.log(`     ${v.version}: ${v.count}건 [${v.sessions.join(", ")}]`);
    }
    if (s.staleConsumers.length > 0) {
      console.log("     구버전 서비스:");
      for (const sc of s.staleConsumers) {
        console.log(`       → ${sc.session}: ${sc.version} (${sc.count}건)`);
      }
    }
  }
}

// ── dkg coverage ──────────────────────────────────

export function dkgCoverage(): void {
  const store = getStore();
  const recent = store.loadRecentVersionUsages(1);

  if (recent.length === 0) {
    console.log("\n  (스냅샷 없음. 이벤트 수집 후 실행하세요.)");
    return;
  }

  // prefix category별 분류
  const specs = catalogToPrefixSpecs(DEMO_CATALOG);
  const specMap = new Map(specs.map(s => [s.id, s]));

  console.log(`\n══ Entry 관측 커버리지 (스냅샷: ${recent[0].collectedAt}) ══`);

  const byCategory = new Map<string, string[]>();
  for (const [id] of Object.entries(DEMO_CATALOG.prefixes)) {
    const cat = specMap.get(id)?.schema?.category ?? "entity";
    const list = byCategory.get(cat) ?? [];
    list.push(id);
    byCategory.set(cat, list);
  }

  for (const [cat, prefixIds] of byCategory) {
    console.log(`\n  [${cat}]`);
    for (const id of prefixIds) {
      console.log(`    ${id.padEnd(17)} (coverage 분석은 이벤트 데이터 필요)`);
    }
  }

  console.log(`\n  total: ${Object.keys(DEMO_CATALOG.prefixes).length} prefixes, ${Object.keys(DEMO_CATALOG.axes).length} axes`);
}

// ── dkg skills ────────────────────────────────────

export function dkgSkills(): void {
  const skills = [
    { id: "analyze-impact", name: "영향 분석", input: "축/prefix 변경", output: "cascade 범위 + 영향 consumer" },
    { id: "infer-migrator", name: "마이그레이션 추론", input: "prefix version diff", output: "migrator 패턴 + 함수" },
    { id: "version-event", name: "버전 이벤트 파생", input: "version diff", output: "VersionEventNode" },
    { id: "decision-scaffold", name: "의사결정 스캐폴드", input: "변경 유형 + 파라미터", output: "DecisionNode 템플릿" },
    { id: "coverage-audit", name: "커버리지 감사", input: "UsageData", output: "dormant/phantom + Observation + Decision" },
    { id: "flow-trace", name: "흐름 추적", input: "address_context records", output: "IntentLink invariant 위반" },
  ];

  console.log(`\n══ DKG Skills (${skills.length}개) ══`);
  for (const s of skills) {
    console.log(`\n  ${s.id}`);
    console.log(`    ${s.name}`);
    console.log(`    input:  ${s.input}`);
    console.log(`    output: ${s.output}`);
  }

  // 현재 관측 가능 prefix category별 진입점
  const specs = catalogToPrefixSpecs(DEMO_CATALOG);
  const byCategory = new Map<string, string[]>();
  for (const s of specs) {
    const cat = s.schema?.category ?? "entity";
    const list = byCategory.get(cat) ?? [];
    list.push(s.id);
    byCategory.set(cat, list);
  }

  console.log(`\n══ Prefix 진입점 (category별) ══`);
  for (const [cat, ids] of byCategory) {
    console.log(`  [${cat}] ${ids.join(", ")}`);
  }
}

// ── dkg audit ─────────────────────────────────────

export function dkgAudit(): void {
  const graph = getGraph();

  console.log("\n══ DKG Audit ══");

  // 1. Observation 리포트
  const observations = graph.getNodesByKind("observation");
  console.log(`\n  Observations: ${observations.length}개`);
  for (const obs of observations) {
    const o = obs as any;
    const icon = o.suggestion ? "⚠" : "ℹ";
    console.log(`    ${icon} ${o.id}`);
    console.log(`      ${o.finding}`);
    // prompts → Decision 연결
    const prompted = graph.neighbors(o.id, "prompts");
    if (prompted.length > 0) {
      console.log(`      → Decision: ${prompted.join(", ")}`);
    }
  }

  // 2. Decision 리포트
  const decisions = graph.getNodesByKind("decision");
  console.log(`\n  Decisions: ${decisions.length}개`);
  for (const dec of decisions) {
    const d = dec as any;
    const governed = graph.neighbors(d.id, "governs");
    const justified = graph.neighbors(d.id, "justifies");
    const targets = [...governed, ...justified];
    console.log(`    ${d.id}: ${d.title}`);
    if (targets.length > 0) {
      console.log(`      → 대상: ${targets.join(", ")}`);
    }
    if (d.alternatives?.length > 0) {
      console.log(`      → 대안: ${d.alternatives.length}개`);
    }
  }

  // 3. Constraint 위반 체크
  const constraints = graph.getNodesByKind("constraint");
  console.log(`\n  Constraints: ${constraints.length}개`);
  for (const con of constraints) {
    const c = con as any;
    const icon = c.lifecycle === "active" ? "✅" : "⏸";
    console.log(`    ${icon} ${c.id}: ${c.rule}`);
  }

  // 4. DSL 커버리지
  const dslBundles = graph.getNodesByKind("dsl-bundle");
  console.log(`\n  DSL Bundles: ${dslBundles.length}개`);
  for (const bundle of dslBundles) {
    const b = bundle as any;
    const contains = graph.edgesFrom(b.id, "contains");
    console.log(`    ${b.id}: [${contains.map((e: any) => e.to).join(",")}]`);
  }

  // 5. IntentLink invariant
  const links = graph.getNodesByKind("intent-link");
  console.log(`\n  IntentLinks: ${links.length}개`);
  for (const link of links) {
    const l = link as any;
    console.log(`    ${l.id}: ${l.intent}`);
    if (l.invariant) console.log(`      invariant: ${l.invariant}`);
  }

  // 6. 종합
  const specs = catalogToPrefixSpecs(DEMO_CATALOG);
  const specMap = new Map(specs.map(s => [s.id, s]));
  const byCategory = new Map<string, number>();
  for (const s of specs) {
    const cat = s.schema?.category ?? "entity";
    byCategory.set(cat, (byCategory.get(cat) ?? 0) + 1);
  }

  console.log(`\n  ── 종합 ──`);
  console.log(`  ${graph.nodeCount} nodes, ${graph.edgeCount} edges`);
  console.log(`  ${Object.keys(DEMO_CATALOG.axes).length} axes, ${Object.keys(DEMO_CATALOG.prefixes).length} prefixes`);
  console.log(`  category: ${[...byCategory.entries()].map(([c, n]) => `${c}=${n}`).join(", ")}`);
}

// ── helpers ─────────────────────────────────────────

function buildEntriesMap(): Map<string, readonly string[]> {
  const map = new Map<string, readonly string[]>();
  for (const [id, axis] of Object.entries(DEMO_CATALOG.axes)) {
    const versions = Object.keys(axis.versions);
    const latestKey = versions[versions.length - 1] as keyof typeof axis.versions;
    const latest = axis.versions[latestKey];
    if (latest && "entries" in latest) {
      map.set(id, [...(latest as any).entries]);
    }
  }
  return map;
}
