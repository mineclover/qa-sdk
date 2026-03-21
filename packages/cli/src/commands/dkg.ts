/**
 * qa-sdk dkg — DKG 조회 + 자가 진단 CLI 명령어.
 *
 * bootstrapDkg()로 전체 DKG를 초기화한 후 조회/분석 수행.
 * 페이지네이션 지원.
 */

import { DEMO_CATALOG } from "demo-snapshot";
import { catalogToPrefixSpecs } from "@qa-sdk/spec-core";
import type { PrefixSpec } from "@qa-sdk/spec-core";
import {
  bootstrapDkg,
  GraphRegistry,
  scanAxisOverlaps,
  analyzeImpact,
  analyzeSimplification,
  scanDecisionConflicts,
  analyzeDeploymentSkew,
  createDemoTopology,
  exploreService,
  explorePrefix,
  exploreDsl,
  systemOverview,
  traceNode,
  recordDecision,
  recordObservation,
  prepareClaim,
  prepareRelease,
  claimKey,
  resolveObservation,
  safeEntryAdd,
  checkConstraints,
  auditAllConstraints,
  checkDomainHealth,
  checkAllDomainsHealth,
  entryAddChain,
  systemHealthChain,
  convergeChain,
} from "@qa-sdk/spec-core/analysis";
import type { DkgNode, AxisNode, PrefixNode, DomainNode, ConsumerNode, DslBundleNode, DecisionType, ClaimData, ObservationNode, DecisionNode, SkillNode } from "@qa-sdk/spec-core/analysis";
import { DkgSqliteStore } from "@qa-sdk/spec-core/store";
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
  console.log(`  DB nodes: ${storeStats.nodes} (bootstrap: ${storeStats.bootstrapNodes}, manual: ${storeStats.manualNodes})`);
  console.log(`  DB edges: ${storeStats.edges} (bootstrap: ${storeStats.bootstrapEdges}, manual: ${storeStats.manualEdges})`);
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

  // 1. bootstrap 데이터만 삭제 (운영 데이터 보존)
  const cleared = store.clearBootstrap();

  // 2. 새 bootstrap 그래프 생성 → 저장
  const graph = bootstrapDkg();
  const saved = store.saveGraph(graph, "bootstrap");
  store.setMeta("last_bootstrap", new Date().toISOString());

  // 3. 전체 그래프 로드 (bootstrap + 보존된 manual)
  cachedGraph = store.loadGraph();

  const stats = store.stats();
  console.log(`  refreshed: ${saved.nodesWritten} bootstrap nodes, ${saved.edgesWritten} bootstrap edges`);
  console.log(`  보존: ${stats.manualNodes} manual nodes, ${stats.manualEdges} manual edges`);
  console.log(`  합계: ${stats.nodes} nodes, ${stats.edges} edges`);
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
  const graph = getGraph();
  const skillNodes = graph.getNodesByKind("skill") as any[];

  if (skillNodes.length === 0) {
    console.log("\n  (skill 노드 없음. dkg refresh로 재부트스트랩하세요.)");
    return;
  }

  // category별 그룹핑
  const byCategory = new Map<string, typeof skillNodes>();
  for (const s of skillNodes) {
    const list = byCategory.get(s.category) ?? [];
    list.push(s);
    byCategory.set(s.category, list);
  }

  console.log(`\n══ DKG Skills (${skillNodes.length}개) ══`);

  for (const [cat, skills] of byCategory) {
    console.log(`\n  [${cat}]`);
    for (const s of skills) {
      const deps = s.depends?.length ? ` depends=[${s.depends.join(",")}]` : "";
      console.log(`    ${s.id.padEnd(30)} ${s.name}`);
      console.log(`      ${s.description.slice(0, 90)}`);
      console.log(`      input: ${s.input} → output: ${s.output}${deps}`);
      // specialization 상세
      const spec = s.specialization;
      if (spec) {
        const parts: string[] = [];
        if (spec.dslBundles?.length) parts.push(`DSL: ${spec.dslBundles.join(",")}`);
        if (spec.domains?.length) parts.push(`domain: ${spec.domains.join(",")}`);
        if (spec.prefixes?.length) parts.push(`prefix: ${spec.prefixes.join(",")}`);
        if (spec.constraints?.length) parts.push(`제약: ${spec.constraints.join(",")}`);
        if (spec.intentLinks?.length) parts.push(`intent: ${spec.intentLinks.join(",")}`);
        if (spec.invariants?.length) parts.push(`invariant: ${spec.invariants.length}개`);
        console.log(`      소비: ${parts.join(" | ")}`);
      }
    }
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

// ── dkg service ─────────────────────────────────────

export function dkgService(serviceId?: string): void {
  const graph = getGraph();
  const topo = createDemoTopology();

  if (!serviceId) {
    // 목록 모드
    const services = topo.listServices();
    console.log(`\n══ Services (${services.length}) ══`);
    for (const svc of services) {
      const owned = svc.ownedPrefixes.length;
      const consumed = svc.consumedPrefixes.length;
      const icon = svc.status === "active" ? "✅" : svc.status === "draining" ? "⏸" : "❌";
      console.log(`  ${icon} ${svc.serviceId.padEnd(20)} ${svc.name.padEnd(12)} team=${svc.team ?? "-"} owned=${owned} consumed=${consumed}`);
    }
    return;
  }

  // 프로파일 모드
  const profile = exploreService(graph, topo, DEMO_CATALOG, serviceId);
  if (!profile) {
    console.error(`  서비스를 찾을 수 없음: ${serviceId}`);
    return;
  }

  console.log(`\n══ Service: ${profile.serviceId} ══`);
  console.log(`  name:   ${profile.name}`);
  console.log(`  team:   ${profile.team ?? "-"}`);
  console.log(`  status: ${profile.status}`);

  // owned prefixes
  console.log(`\n  ── Owned Prefixes (${profile.ownedPrefixes.length}) ──`);
  for (const p of profile.ownedPrefixes) {
    const hr = p.minHeadroom ? ` headroom=${p.minHeadroom.headroom}(${p.minHeadroom.axis})` : "";
    console.log(`    ${p.id.padEnd(17)} [${p.category}] dims=${p.dimCount}${hr}`);
  }

  // consumed prefixes
  console.log(`\n  ── Consumed Prefixes (${profile.consumedPrefixes.length}) ──`);
  for (const p of profile.consumedPrefixes) {
    const contract = p.contract ? ` via ${p.contract}` : "";
    console.log(`    ${p.id.padEnd(17)}${contract}`);
  }

  // contracts
  if (profile.contracts.length > 0) {
    console.log(`\n  ── Contracts (${profile.contracts.length}) ──`);
    for (const c of profile.contracts) {
      const role = c.provider === serviceId ? "provider" : "consumer";
      console.log(`    ${c.id.padEnd(17)} [${role}] prefix=${c.prefixId} stable=${c.stableVersion}`);
    }
  }

  // DSL bindings
  if (profile.dslBindings.length > 0) {
    console.log(`\n  ── DSL Bindings ──`);
    console.log(`    ${profile.dslBindings.join(", ")}`);
  }

  // dependencies
  if (profile.dependencies.length > 0) {
    console.log(`\n  ── Dependencies (${profile.dependencies.length}) ──`);
    for (const d of profile.dependencies) {
      const arrow = d.direction === "depends-on" ? "→" : "←";
      console.log(`    ${arrow} ${d.serviceId} via [${d.via.join(", ")}]`);
    }
  }

  // observations
  if (profile.observations.length > 0) {
    console.log(`\n  ── Observations (${profile.observations.length}) ──`);
    for (const o of profile.observations) {
      console.log(`    ${o.id}: ${o.finding.slice(0, 70)}`);
    }
  }

  // decisions
  if (profile.decisions.length > 0) {
    console.log(`\n  ── Decisions (${profile.decisions.length}) ──`);
    for (const d of profile.decisions) {
      console.log(`    ${d.id}: ${d.title}`);
    }
  }
}

// ── dkg prefix (exploration) ────────────────────────

export function dkgPrefix(prefixId: string): void {
  const graph = getGraph();
  const topo = createDemoTopology();

  const profile = explorePrefix(graph, topo, DEMO_CATALOG, prefixId);
  if (!profile) {
    console.error(`  prefix를 찾을 수 없음: ${prefixId}`);
    return;
  }

  console.log(`\n══ Prefix: ${profile.id} ══`);
  console.log(`  name:      ${profile.name}`);
  console.log(`  category:  ${profile.category}`);
  console.log(`  lifecycle: ${profile.lifecycle}`);
  console.log(`  owner:     ${profile.owner ?? "-"}`);

  // dimensions
  console.log(`\n  ── Dimensions (${profile.dimensions.length}) ──`);
  for (const d of profile.dimensions) {
    console.log(`    ${d.label.padEnd(17)} [${d.kind}] → ${d.ref}`);
  }

  // headroom
  if (profile.headroom.length > 0) {
    console.log(`\n  ── Axis Headroom ──`);
    for (const h of profile.headroom) {
      const bar = h.headroom === 0 ? " ⚠" : "";
      console.log(`    ${h.axisId.padEnd(17)} entries=${h.entries} cap=${h.capacity} headroom=${h.headroom}${bar}`);
    }
  }

  // consumers
  if (profile.consumers.length > 0) {
    console.log(`\n  ── Consumers ──`);
    console.log(`    ${profile.consumers.join(", ")}`);
  }

  // domains + DSL bundles
  if (profile.domains.length > 0) {
    console.log(`\n  ── Domains ──`);
    console.log(`    ${profile.domains.join(", ")}`);
  }
  if (profile.dslBundles.length > 0) {
    console.log(`\n  ── DSL Bundles ──`);
    console.log(`    ${profile.dslBundles.join(", ")}`);
  }

  // constraints
  if (profile.constraints.length > 0) {
    console.log(`\n  ── Constraints (${profile.constraints.length}) ──`);
    for (const c of profile.constraints) {
      console.log(`    ${c.id}: ${c.rule}`);
    }
  }

  // observations
  if (profile.observations.length > 0) {
    console.log(`\n  ── Observations (${profile.observations.length}) ──`);
    for (const o of profile.observations) {
      console.log(`    ${o.id}: ${o.finding.slice(0, 70)}`);
    }
  }

  // decisions
  if (profile.decisions.length > 0) {
    console.log(`\n  ── Decisions (${profile.decisions.length}) ──`);
    for (const d of profile.decisions) {
      console.log(`    ${d.id}: ${d.title}`);
    }
  }

  // intent-links
  if (profile.intentLinks.length > 0) {
    console.log(`\n  ── Intent Links (${profile.intentLinks.length}) ──`);
    for (const l of profile.intentLinks) {
      console.log(`    ${l.id}: ${l.intent.slice(0, 70)}`);
    }
  }
}

// ── dkg dsl ─────────────────────────────────────────

export function dkgDsl(dslId?: string): void {
  const graph = getGraph();

  if (!dslId) {
    // 목록 모드
    const bundles = graph.getNodesByKind("dsl-bundle") as DslBundleNode[];
    console.log(`\n══ DSL Bundles (${bundles.length}) ══`);
    for (const b of bundles) {
      const members = graph.neighbors(b.id, "contains");
      console.log(`  ${b.id.padEnd(22)} ${b.name.padEnd(14)} members=${members.length} binding=${b.serviceBindingPrefix}`);
    }
    return;
  }

  // 프로파일 모드
  const profile = exploreDsl(graph, DEMO_CATALOG, dslId);
  if (!profile) {
    console.error(`  DSL을 찾을 수 없음: ${dslId}`);
    return;
  }

  console.log(`\n══ DSL: ${profile.id} ══`);
  console.log(`  name:        ${profile.name}`);
  console.log(`  description: ${profile.description}`);

  // members
  console.log(`\n  ── Members (${profile.members.length}) ──`);
  for (const m of profile.members) {
    const ref = m.svcRefLabel ? ` svcRef=${m.svcRefLabel}` : "";
    console.log(`    ${m.prefixId.padEnd(17)} [${m.role}]${ref}`);
  }

  // service binding
  console.log(`\n  ── Service Binding ──`);
  console.log(`    prefix:    ${profile.serviceBinding.prefixId}`);
  console.log(`    fixedDims: ${profile.serviceBinding.fixedDims.join(", ")}`);

  // invariants
  if (profile.invariants.length > 0) {
    console.log(`\n  ── Invariants (${profile.invariants.length}) ──`);
    for (const inv of profile.invariants) {
      console.log(`    - ${inv}`);
    }
  }

  // version skew
  const sk = profile.versionSkew;
  const skIcon = sk.severity === "ok" ? "✅" : sk.severity === "minor" ? "⚠" : "🔴";
  console.log(`\n  ── Version Skew ──`);
  console.log(`    ${skIcon} ${sk.summary}`);
  if (sk.axisConflicts.length > 0) {
    for (const c of sk.axisConflicts) {
      console.log(`      ${c.axisId}: spread=${c.spread}`);
    }
  }
}

// ── dkg overview ────────────────────────────────────

export function dkgOverview(): void {
  const graph = getGraph();
  const topo = createDemoTopology();

  const overview = systemOverview(graph, topo, DEMO_CATALOG);

  console.log(`\n══ System Overview ══`);
  console.log(`  nodes: ${overview.nodeCount}, edges: ${overview.edgeCount}`);

  // services
  console.log(`\n  ── Services (${overview.services.length}) ──`);
  for (const svc of overview.services) {
    const icon = svc.status === "active" ? "✅" : "⏸";
    console.log(`    ${icon} ${svc.serviceId.padEnd(20)} owned=${svc.ownedCount} consumed=${svc.consumedCount}`);
  }

  // dependency graph
  const dg = overview.dependencyGraph;
  console.log(`\n  ── Dependency Graph ──`);
  console.log(`    edges: ${dg.edgeCount}, maxDepth: ${dg.maxDepth}`);
  console.log(`    roots:  ${dg.roots.join(", ") || "-"}`);
  console.log(`    leaves: ${dg.leaves.join(", ") || "-"}`);
  if (dg.cycles.length > 0) {
    console.log(`    ⚠ cycles: ${dg.cycles.map(c => c.join("→")).join("; ")}`);
  }

  // domain health
  console.log(`\n  ── Domain Health ──`);
  for (const dh of overview.domainHealth) {
    const icon = dh.health === "healthy" ? "✅" : dh.health === "warning" ? "⚠" : "🔴";
    console.log(`    ${icon} ${dh.domainId.padEnd(22)} issues=${dh.issueCount}`);
  }

  // hot spots
  if (overview.hotSpots.length > 0) {
    console.log(`\n  ── Hot Spots (${overview.hotSpots.length}) ──`);
    for (const hs of overview.hotSpots) {
      const icon = hs.type === "headroom-zero" ? "🔴" : hs.type === "constraint-violation" ? "⚠" : "ℹ";
      console.log(`    ${icon} [${hs.type}] ${hs.target}: ${hs.detail.slice(0, 60)}`);
    }
  }
}

// ── dkg trace ───────────────────────────────────────

export function dkgTrace(nodeId: string): void {
  const graph = getGraph();
  const topo = createDemoTopology();

  const result = traceNode(graph, DEMO_CATALOG, nodeId, {
    topo,
    getClaim: (id) => {
      const store = getStore();
      const raw = store.getMeta(`claim:${id}`);
      return raw ? JSON.parse(raw) : null;
    },
  });

  if (!result) {
    console.error(`  노드를 찾을 수 없음: ${nodeId}`);
    return;
  }

  console.log(`\n═══ Trace: ${result.id} [${result.kind}] ═══`);
  console.log(`  name: ${result.name}`);

  // claim
  if (result.claim) {
    console.log(`  ⚠ 작업중: ${result.claim.by} (${result.claim.at})`);
  }

  // kind-specific details
  if (result.kind === "prefix") {
    const d = result.details as any;
    console.log(`  category:  ${d.category ?? "unknown"}`);
    console.log(`  lifecycle: ${d.lifecycle ?? "active"}`);
    console.log(`  dims:      ${(d.dimLabels ?? []).join(", ")}`);
  } else if (result.kind === "axis") {
    const d = result.details as any;
    console.log(`  versions: ${(d.currentVersions ?? []).join(", ")}`);
  } else if (result.kind === "decision") {
    const d = result.details as any;
    console.log(`  lifecycle: ${d.lifecycle}`);
    console.log(`  context:   ${d.context}`);
    console.log(`  rationale: ${d.rationale}`);
  } else if (result.kind === "observation") {
    const d = result.details as any;
    console.log(`  finding: ${d.finding}`);
    console.log(`  source:  ${d.source}`);
    if (d.resolution) console.log(`  resolved: ${d.resolution.outcome} → ${d.resolution.decisionId}`);
  }

  // composition
  if (result.composition.length > 0) {
    console.log(`\n  ── 구성 ──`);
    for (const c of result.composition) {
      const entries = c.entries ? ` [${c.entries.join(",")}] cap=${c.capacity}` : "";
      console.log(`    ${c.label.padEnd(17)} → ${c.targetId} [${c.dimKind}]${entries}`);
    }
  }

  // references
  if (result.references.length > 0) {
    console.log(`\n  ── 참조 ──`);
    for (const r of result.references) console.log(`    → ${r}`);
  }

  // membership
  if (result.membership.length > 0) {
    console.log(`\n  ── 소속 ──`);
    for (const m of result.membership) {
      console.log(`    ${m.id} [${m.kind}] — ${m.name}`);
    }
  }

  // constraints
  if (result.constraints.length > 0) {
    console.log(`\n  ── 제약 ──`);
    for (const c of result.constraints) {
      console.log(`    ${c.id}: ${c.rule}`);
    }
  }

  // causal chain (observation → decision)
  if (result.causalChain.length > 0) {
    console.log(`\n  ── 관측 → 의사결정 체인 ──`);
    for (const link of result.causalChain) {
      console.log(`    ${link.observation.id}: ${link.observation.finding}`);
      for (const dec of link.decisions) {
        console.log(`      → ${dec.id}: ${dec.title}`);
        console.log(`        rationale: ${dec.rationale.slice(0, 100)}`);
      }
    }
  }

  // direct decisions
  if (result.directDecisions.length > 0) {
    console.log(`\n  ── 의사결정 ──`);
    for (const d of result.directDecisions) {
      console.log(`    [${d.edgeType}] ${d.id}: ${d.title}`);
      console.log(`      context:   ${d.context}`);
      console.log(`      rationale: ${d.rationale.slice(0, 120)}`);
    }
  }

  // intent links
  if (result.intentLinks.length > 0) {
    console.log(`\n  ── 의도 링크 ──`);
    for (const l of result.intentLinks) {
      console.log(`    ${l.id}: ${l.intent}`);
      if (l.invariant) console.log(`      invariant: ${l.invariant}`);
    }
  }

  // topology
  if (result.topology) {
    console.log(`\n  ── 서비스 토폴로지 ──`);
    console.log(`    owner:     ${result.topology.owner ?? "-"}`);
    console.log(`    consumers: ${result.topology.consumers.join(", ") || "-"}`);
  }

  // cascade
  if (result.cascade) {
    console.log(`\n  ── cascade (변경 시 영향) ──`);
    if (result.cascade.domains.length > 0) console.log(`    domains:   ${result.cascade.domains.join(", ")}`);
    if (result.cascade.consumers.length > 0) console.log(`    consumers: ${result.cascade.consumers.join(", ")}`);
    if (result.cascade.affectedPrefixes && result.cascade.affectedPrefixes.length > 0) {
      console.log(`    prefixes:  ${result.cascade.affectedPrefixes.join(", ")}`);
    }
  }

  // summary tree
  console.log(`\n  ── 종합 ──`);
  console.log(`    ${result.id}`);
  if (result.composition.length > 0) console.log(`      ├── 구성: ${result.composition.map(c => c.targetId).join(", ")}`);
  if (result.references.length > 0) console.log(`      ├── 참조: ${result.references.join(", ")}`);
  const domains = result.membership.filter(m => m.kind === "domain").map(m => m.id);
  const dsls = result.membership.filter(m => m.kind === "dsl-bundle").map(m => m.id);
  if (domains.length > 0) console.log(`      ├── domain:     ${domains.join(", ")}`);
  if (dsls.length > 0) console.log(`      ├── DSL:        ${dsls.join(", ")}`);
  if (result.constraints.length > 0) console.log(`      ├── 제약:       ${result.constraints.map(c => c.id).join(", ")}`);
  if (result.intentLinks.length > 0) console.log(`      ├── intent:     ${result.intentLinks.map(l => l.id).join(", ")}`);
  if (result.topology) {
    console.log(`      ├── owner:      ${result.topology.owner ?? "-"}`);
    console.log(`      └── consumers:  ${result.topology.consumers.join(", ") || "-"}`);
  }
  const allObs = result.causalChain.map(c => c.observation.id);
  const allDecs = [
    ...result.directDecisions.map(d => d.id),
    ...result.causalChain.flatMap(c => c.decisions.map(d => d.id)),
  ];
  const uniqueDecs = [...new Set(allDecs)];
  if (allObs.length > 0) console.log(`      Observations: ${allObs.join(", ")}`);
  if (uniqueDecs.length > 0) console.log(`      Decisions:    ${uniqueDecs.join(", ")}`);

  // applicable skills
  if (result.applicableSkills.length > 0) {
    const specialized = result.applicableSkills.filter(s => s.specialized);
    const generic = result.applicableSkills.filter(s => !s.specialized);

    if (specialized.length > 0) {
      console.log(`\n  ── 전문 Skill (${specialized.length}) ──`);
      for (const s of specialized) {
        console.log(`    ${s.id.padEnd(30)} ${s.name}`);
      }
    }
    if (generic.length > 0) {
      console.log(`\n  ── 범용 Skill (${generic.length}) ──`);
      const byCategory = new Map<string, typeof generic[number][]>();
      for (const s of generic) {
        const list = byCategory.get(s.category) ?? [];
        list.push(s);
        byCategory.set(s.category, list);
      }
      for (const [cat, skills] of byCategory) {
        console.log(`    [${cat}] ${skills.map(s => s.name).join(", ")}`);
      }
    }
  }
}

// ── dkg decide ──────────────────────────────────────

export function dkgDecide(opts: {
  target: string;
  type: string;
  title: string;
  rationale: string;
}): void {
  const graph = getGraph();
  const store = getStore();

  const result = recordDecision(graph, {
    targetId: opts.target,
    type: opts.type as DecisionType,
    title: opts.title,
    rationale: opts.rationale,
  });

  if (result.verdict === "blocked") {
    console.error(`  ${result.reason}`);
    return;
  }

  // skill이 반환한 노드/엣지를 그래프 + SQLite에 적용
  const dec = result.decision!;
  graph.addNode(dec);
  for (const edge of result.edges) graph.addEdge(edge.type, edge.from, edge.to);
  store.saveNodes([dec], result.edges, "manual");
  store.setMeta("last_decision", dec.id);

  console.log(`\n══ Decision 기록 완료 ══`);
  console.log(`  id:        ${dec.id}`);
  console.log(`  type:      ${opts.type}`);
  console.log(`  target:    ${opts.target}`);
  console.log(`  title:     ${dec.title}`);
  console.log(`  rationale: ${dec.rationale}`);
  console.log(`  lifecycle: ${dec.lifecycle}`);
  if (dec.alternatives && dec.alternatives.length > 0) {
    console.log(`  alternatives:`);
    for (const alt of dec.alternatives) console.log(`    - ${alt}`);
  }
  console.log(`  (source: manual — refresh 시 보존됨)`);
}

// ── dkg observe ─────────────────────────────────────

export function dkgObserve(opts: {
  target: string;
  finding: string;
  suggestion?: string;
}): void {
  const graph = getGraph();
  const store = getStore();

  let suggestion: any;
  if (opts.suggestion) {
    try { suggestion = JSON.parse(opts.suggestion); }
    catch { console.error("  --suggestion JSON 파싱 실패"); return; }
  }

  const result = recordObservation(graph, {
    targetId: opts.target,
    finding: opts.finding,
    suggestion,
  });

  if (result.verdict === "blocked") {
    console.error(`  ${result.reason}`);
    return;
  }

  // skill이 반환한 노드/엣지를 그래프 + SQLite에 적용
  const obs = result.observation!;
  graph.addNode(obs);
  for (const edge of result.edges) graph.addEdge(edge.type, edge.from, edge.to);
  store.saveNodes([obs], result.edges, "manual");

  console.log(`\n══ Observation 기록 완료 ══`);
  console.log(`  id:      ${obs.id}`);
  console.log(`  target:  ${opts.target}`);
  console.log(`  finding: ${obs.finding}`);
  if (obs.suggestion) console.log(`  suggestion: ${JSON.stringify(obs.suggestion)}`);
  console.log(`  (source: manual — refresh 시 보존됨)`);
}

// ── dkg claim ───────────────────────────────────────

export function dkgClaim(opts: { target: string; by: string }): void {
  const graph = getGraph();
  const store = getStore();
  const topo = createDemoTopology();

  const existing = store.getMeta(claimKey(opts.target));
  const existingClaim: ClaimData | null = existing ? JSON.parse(existing) : null;

  const result = prepareClaim(graph, topo, opts.target, opts.by, existingClaim);

  if (result.verdict === "blocked") {
    console.error(`  ${result.reason}`);
    if (existingClaim) console.error(`  해제하려면: qa-sdk dkg release ${opts.target}`);
    return;
  }

  // claim 저장
  store.setMeta(claimKey(opts.target), JSON.stringify(result.claim));

  console.log(`\n══ Claim: ${opts.target} ══`);
  console.log(`  by:   ${result.claim!.by}`);
  console.log(`  at:   ${result.claim!.at}`);

  // skill이 분석한 영향 범위 출력
  const impact = result.impact!;
  const hasImpact = impact.owner || impact.consumers.length || impact.domains.length ||
    impact.dslBundles.length || impact.intentLinks.length || impact.affectedPrefixes.length;

  if (hasImpact) {
    console.log(`\n  ── 전파 대상 ──`);
    if (impact.owner) console.log(`    owner:     ${impact.owner}`);
    if (impact.consumers.length > 0) console.log(`    consumers: ${impact.consumers.join(", ")}`);
    if (impact.domains.length > 0) console.log(`    domains:   ${impact.domains.join(", ")}`);
    if (impact.dslBundles.length > 0) console.log(`    DSL:       ${impact.dslBundles.join(", ")}`);
    if (impact.intentLinks.length > 0) console.log(`    intents:   ${impact.intentLinks.join(", ")}`);
    if (impact.affectedPrefixes.length > 0) {
      console.log(`    prefixes:  ${impact.affectedPrefixes.join(", ")}`);
    }
  }
}

// ── dkg release ─────────────────────────────────────

export function dkgRelease(target: string): void {
  const graph = getGraph();
  const store = getStore();

  const existing = store.getMeta(claimKey(target));
  const existingClaim: ClaimData | null = existing ? JSON.parse(existing) : null;

  const result = prepareRelease(graph, target, existingClaim);

  if (result.verdict === "blocked") {
    console.error(`  ${result.reason}`);
    return;
  }

  // claim 해제 + observation 적용
  store.setMeta(claimKey(target), "");
  graph.addNode(result.observation!);
  for (const edge of result.edges) graph.addEdge(edge.type, edge.from, edge.to);
  store.saveNodes([result.observation!], result.edges, "manual");

  console.log(`\n══ Release: ${target} ══`);
  console.log(`  was:  ${result.previousClaim!.by} (${result.previousClaim!.at})`);
  console.log(`  obs:  ${result.observation!.id}`);
  console.log(`  작업 완료 observation이 DKG에 기록됨`);
}

// ── dkg resolve ─────────────────────────────────────

export function dkgResolve(opts: { obsId: string; decisionId: string; outcome: string; note?: string }): void {
  const graph = getGraph();
  const store = getStore();

  const validOutcomes = ["accepted", "deferred", "rejected"];
  if (!validOutcomes.includes(opts.outcome)) {
    console.error(`  유효하지 않은 outcome: ${opts.outcome} (가능: ${validOutcomes.join(", ")})`);
    return;
  }

  // decision 존재 확인
  const dec = graph.getNode(opts.decisionId);
  if (!dec || dec.kind !== "decision") {
    console.error(`  Decision을 찾을 수 없음: ${opts.decisionId}`);
    return;
  }

  const result = resolveObservation(graph, opts.obsId, {
    decisionId: opts.decisionId,
    outcome: opts.outcome as "accepted" | "deferred" | "rejected",
    note: opts.note,
  });

  if (!result.success) {
    console.error(`  resolve 실패: ${result.reason}`);
    return;
  }

  // prompts 엣지 추가 (observation → decision)
  graph.addEdge("prompts", opts.obsId, opts.decisionId);

  // SQLite에 변경 저장 — resolveObservation이 graph를 직접 변경했으므로 해당 노드만 저장
  const updatedObs = graph.getNode(opts.obsId)!;
  store.saveNodes(
    [updatedObs],
    [{ type: "prompts", from: opts.obsId, to: opts.decisionId }],
    "manual",
  );

  console.log(`\n══ Resolve ══`);
  console.log(`  observation: ${opts.obsId}`);
  console.log(`  → decision:  ${opts.decisionId} (${(dec as DecisionNode).title})`);
  console.log(`  outcome:     ${opts.outcome}`);
  if (opts.note) console.log(`  note:        ${opts.note}`);
  console.log(`  루프 닫힘`);
}

// ── dkg link ────────────────────────────────────────

export function dkgLink(opts: { obsId: string; decisionId: string }): void {
  const graph = getGraph();
  const store = getStore();

  const obs = graph.getNode(opts.obsId);
  if (!obs || obs.kind !== "observation") {
    console.error(`  Observation을 찾을 수 없음: ${opts.obsId}`);
    return;
  }

  const dec = graph.getNode(opts.decisionId);
  if (!dec || dec.kind !== "decision") {
    console.error(`  Decision을 찾을 수 없음: ${opts.decisionId}`);
    return;
  }

  graph.addEdge("prompts", opts.obsId, opts.decisionId);
  store.saveNodes([], [{ type: "prompts", from: opts.obsId, to: opts.decisionId }], "manual");

  console.log(`\n══ Link ══`);
  console.log(`  ${opts.obsId} → prompts → ${opts.decisionId}`);
  console.log(`  "${(obs as ObservationNode).finding.slice(0, 50)}"`);
  console.log(`  → "${(dec as DecisionNode).title}"`);
}

// ── dkg timeline ────────────────────────────────────

export function dkgTimeline(opts: { open?: boolean }): void {
  const graph = getGraph();

  // 시간 정보가 있는 노드 수집
  const events: { date: string; kind: string; id: string; summary: string; open: boolean }[] = [];

  for (const node of graph.getNodesByKind("observation")) {
    const o = node as ObservationNode;
    events.push({
      date: o.date,
      kind: "observation",
      id: o.id,
      summary: o.finding.slice(0, 60),
      open: !o.resolution,
    });
  }

  for (const node of graph.getNodesByKind("decision")) {
    const d = node as DecisionNode;
    events.push({
      date: d.date,
      kind: "decision",
      id: d.id,
      summary: d.title,
      open: d.lifecycle === "active",
    });
  }

  // 정렬
  events.sort((a, b) => a.date.localeCompare(b.date));

  // 필터
  const filtered = opts.open ? events.filter(e => e.open) : events;

  const label = opts.open ? "열린 시나리오" : "전체 타임라인";
  console.log(`\n══ ${label} (${filtered.length}개) ══`);

  // 날짜별 그룹
  let lastDate = "";
  for (const e of filtered) {
    if (e.date !== lastDate) {
      lastDate = e.date;
      console.log(`\n  ${e.date}`);
    }

    const icon = e.kind === "observation"
      ? (e.open ? "○" : "●")
      : (e.open ? "◇" : "◆");
    const status = e.open ? "" : " [closed]";
    console.log(`    ${icon} ${e.id.padEnd(40)} ${e.summary}${status}`);
  }

  // 요약
  const openObs = events.filter(e => e.kind === "observation" && e.open).length;
  const closedObs = events.filter(e => e.kind === "observation" && !e.open).length;
  const activeDec = events.filter(e => e.kind === "decision" && e.open).length;
  console.log(`\n  관측: ${openObs} open / ${closedObs} resolved`);
  console.log(`  결정: ${activeDec} active`);
}

// ── dkg claims ──────────────────────────────────────

export function dkgClaims(): void {
  const store = getStore();
  const graph = getGraph();

  // dkg_meta에서 claim: 키 조회
  const allMeta = (store as any).db.prepare("SELECT key, value FROM dkg_meta WHERE key LIKE 'claim:%' AND value != ''").all() as Array<{ key: string; value: string }>;

  if (allMeta.length === 0) {
    console.log("\n  활성 claim 없음");
    return;
  }

  console.log(`\n══ 활성 Claims (${allMeta.length}개) ══`);
  for (const row of allMeta) {
    const target = row.key.replace("claim:", "");
    const claim = JSON.parse(row.value) as ClaimData;
    const node = graph.getNode(target);
    const name = node ? ((node as any).name ?? target) : target;
    console.log(`  ${target.padEnd(20)} by ${claim.by} (${claim.at})`);
    console.log(`    [${node?.kind ?? "?"}] ${name}`);
  }
}

// ── dkg run ─────────────────────────────────────────

export function dkgRun(skillId: string, args: string[]): void {
  const graph = getGraph();
  const store = getStore();

  // skill 노드 확인
  const skillNode = graph.getNode(skillId) as SkillNode | undefined;
  if (!skillNode || skillNode.kind !== "skill") {
    console.error(`  skill을 찾을 수 없음: ${skillId}`);
    console.error(`  qa-sdk dkg skills 로 목록을 확인하세요`);
    return;
  }

  console.log(`\n══ Run: ${skillNode.name} (${skillId}) ══`);
  if (skillNode.specialization) {
    const spec = skillNode.specialization;
    if (spec.dslBundles?.length) console.log(`  DSL: ${spec.dslBundles.join(", ")}`);
    if (spec.prefixes?.length) console.log(`  prefix: ${spec.prefixes.join(", ")}`);
    if (spec.constraints?.length) console.log(`  제약: ${spec.constraints.join(", ")}`);
  }
  console.log("");

  // skill별 실행 라우팅
  switch (skillId) {
    case "skill-safe-entry-add": {
      const axisId = args[0] || findArg(args, "--axis");
      const entry = args[1] || findArg(args, "--entry");
      if (!axisId || !entry) { console.error("  Usage: dkg run skill-safe-entry-add <axis> <entry>"); return; }
      const result = safeEntryAdd(DEMO_CATALOG, graph, { axisId, entry });
      const icon = result.verdict === "safe" ? "✅" : result.verdict === "already-exists" ? "ℹ" : "⚠";
      console.log(`  ${icon} verdict: ${result.verdict}`);
      console.log(`  ${result.summary}`);
      if (result.headroom) {
        console.log(`  headroom: ${result.headroom.remaining}/${result.headroom.capacity} (sufficient: ${result.headroom.sufficient})`);
      }
      if (result.affectedPrefixes.length > 0) {
        console.log(`  영향 prefix: ${result.affectedPrefixes.map(p => p.id).join(", ")}`);
      }
      break;
    }

    case "skill-constraint-check":
    case "skill-event-action-check":
    case "skill-svc-binding-check": {
      const targetId = args[0];
      if (!targetId) { console.error("  Usage: dkg run " + skillId + " <targetId>"); return; }
      const result = checkConstraints(graph, targetId);
      if (result.violations.length === 0) {
        console.log(`  ✅ ${targetId}: 위반 없음 (${result.passed.length} passed)`);
      } else {
        console.log(`  ⚠ ${targetId}: ${result.violations.length} violation(s)`);
        for (const v of result.violations) {
          console.log(`    ${v.constraintId} [${v.severity}]: ${v.rule}`);
        }
      }
      break;
    }

    case "skill-domain-health": {
      const domainId = args[0];
      if (domainId) {
        const result = checkDomainHealth(graph, domainId);
        const icon = result.overallHealth === "healthy" ? "✅" : result.overallHealth === "warning" ? "⚠" : "🔴";
        console.log(`  ${icon} ${result.domainName}: ${result.overallHealth}`);
        if (result.issues.length > 0) {
          for (const i of result.issues) console.log(`    - ${i}`);
        }
        console.log(`  prefixes: ${result.prefixes.map(p => p.id).join(", ")}`);
      } else {
        const results = checkAllDomainsHealth(graph);
        for (const r of results) {
          const icon = r.overallHealth === "healthy" ? "✅" : r.overallHealth === "warning" ? "⚠" : "🔴";
          console.log(`  ${icon} ${r.domainId.padEnd(22)} ${r.overallHealth} (issues: ${r.issues.length})`);
        }
      }
      break;
    }

    case "skill-entry-add-chain": {
      const axisId = args[0] || findArg(args, "--axis");
      const entry = args[1] || findArg(args, "--entry");
      if (!axisId || !entry) { console.error("  Usage: dkg run skill-entry-add-chain <axis> <entry>"); return; }
      const result = entryAddChain(DEMO_CATALOG, graph, axisId, entry);
      console.log(`  overall: ${result.overallStatus}`);
      console.log(`  steps: ${result.steps.length}`);
      for (const step of result.steps) {
        const icon = step.status === "ok" ? "✅" : step.status === "skipped" ? "⏭" : step.status === "warning" ? "⚠" : "🔴";
        console.log(`    ${icon} ${step.step}: ${step.message}`);
      }
      console.log(`\n  ${result.summary}`);
      break;
    }

    case "skill-system-health-chain": {
      const result = systemHealthChain(graph);
      console.log(`  overall: ${result.overallStatus}`);
      for (const step of result.steps) {
        const icon = step.status === "ok" ? "✅" : step.status === "warning" ? "⚠" : "🔴";
        console.log(`    ${icon} ${step.step}: ${step.message}`);
      }
      console.log(`\n  ${result.summary}`);
      break;
    }

    case "skill-converge-chain": {
      const result = convergeChain(DEMO_CATALOG, graph, null, { entriesMap: buildEntriesMap() });
      console.log(`  actions: ${result.actions.length}`);
      for (const action of result.actions) {
        const a = action as any;
        const target = a.targets?.join("↔") ?? a.axis ?? a.prefix ?? a.source ?? "?";
        console.log(`    [${a.kind}] ${target}`);
      }
      console.log(`\n  merges: ${result.summary.merges}, deactivations: ${result.summary.deactivations}, simplifications: ${result.summary.simplifications}, observations: ${result.summary.observations}`);
      if (result.observations.length > 0) {
        console.log(`  생성된 Observation:`);
        for (const o of result.observations) console.log(`    ${o.id}: ${o.finding.slice(0, 60)}`);
      }
      if (result.decisions.length > 0) {
        console.log(`  생성된 Decision:`);
        for (const d of result.decisions) console.log(`    ${d.id}: ${d.title}`);
      }
      break;
    }

    case "skill-analyze-impact": {
      const targetId = args[0];
      if (!targetId) { console.error("  Usage: dkg run skill-analyze-impact <axis|prefix>"); return; }
      const node = graph.getNode(targetId);
      if (!node) { console.error(`  노드 없음: ${targetId}`); return; }
      const input = node.kind === "axis"
        ? { type: "capacity-changed" as const, target: { axis: targetId } }
        : { type: "version-bump" as const, target: { prefix: targetId } };
      const result = analyzeImpact(graph, input);
      console.log(`  strideBreak: ${result.strideBreak}`);
      console.log(`  migrationRequired: ${result.migrationRequired}`);
      console.log(`  affectedPrefixes: ${result.affectedPrefixes.map(p => p.id).join(", ") || "(없음)"}`);
      console.log(`  affectedDomains: ${result.affectedDomains.map(d => d.id).join(", ") || "(없음)"}`);
      console.log(`  affectedConsumers: ${result.affectedConsumers.map(c => c.id).join(", ") || "(없음)"}`);
      if (result.constraintViolations.length > 0) {
        console.log(`  ⚠ constraint violations: ${result.constraintViolations.map(v => v.constraintId).join(", ")}`);
      }
      break;
    }

    default:
      console.log(`  ${skillId}는 아직 CLI 실행을 지원하지 않음`);
      console.log(`  input:  ${skillNode.input}`);
      console.log(`  output: ${skillNode.output}`);
      break;
  }
}

function findArg(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx >= 0 ? args[idx + 1] : undefined;
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
