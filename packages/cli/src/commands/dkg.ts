/**
 * qa-sdk dkg — DKG 조회 + 자가 진단 CLI 명령어.
 *
 * bootstrapDkg()로 전체 DKG를 초기화한 후 조회/분석 수행.
 * 페이지네이션 지원.
 */

import { DEMO_CATALOG, encodePrefixByValue } from "demo-snapshot";
import { CatalogRegistry } from "@qa-sdk/core";
import type { Catalog } from "@qa-sdk/core";
import { catalogToPrefixSpecs, catalogToSchemaSnapshot } from "@qa-sdk/spec-core";
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
  collectMetrics,
  metricsToObservations,
  resolveRecoveredMetrics,
  METRIC_DEFS,
  aggregateUsageData,
  analyzeCollectionHealth,
  analyzeEntryCoverage,
  classifyPattern,
  DEMO_PATTERN_RULES,
  buildPatternHealthReport,
  scanPromotionCandidates,
} from "@qa-sdk/spec-core/analysis";
import {
  executeEntryAdd,
  EntryAddError,
} from "@qa-sdk/spec-core/propagation";
import type { AddressContextRecord } from "@qa-sdk/spec-core/analysis";
import type { DkgNode, AxisNode, PrefixNode, DomainNode, ConsumerNode, DslBundleNode, DecisionType, ClaimData, ObservationNode, DecisionNode, SkillNode, MetricValue } from "@qa-sdk/spec-core/analysis";
import { DkgSqliteStore } from "@qa-sdk/spec-core/store";
import { join, dirname } from "node:path";
import { mkdirSync, existsSync, writeFileSync, readFileSync } from "node:fs";
import { execSync } from "node:child_process";

// ── Catalog Context ──────────────────────────────────
// CLI에서 --catalog 옵션으로 주입된 카탈로그.
// setCatalogContext()로 설정하면 DKG 명령어가 해당 카탈로그를 사용.

const registry = new CatalogRegistry();
let activeCatalogId = "demo";
let _configOverride: unknown | undefined;

export function setCatalogContext(catalog?: unknown, config?: unknown): void {
  if (catalog) {
    const cat = catalog as Catalog;
    registry.register(cat);
    activeCatalogId = cat.id;
    registry.setDefault(activeCatalogId);
    graphCache.delete(activeCatalogId);
  }
  _configOverride = config;
}

/** 등록된 카탈로그 레지스트리 접근 (catalog list/info에서 사용). */
export function getCatalogRegistry(): CatalogRegistry {
  return registry;
}

// ── Shared ──────────────────────────────────────────

const STATE_DIR = join(process.env.HOME ?? ".", ".qa-sdk");
const STATE_DB = join(STATE_DIR, "state.sqlite");

const storeCache = new Map<string, DkgSqliteStore>();
const graphCache = new Map<string, GraphRegistry>();

function getStore(catalogId?: string): DkgSqliteStore {
  const id = catalogId ?? activeCatalogId;
  if (!storeCache.has(id)) {
    if (!existsSync(STATE_DIR)) mkdirSync(STATE_DIR, { recursive: true });
    storeCache.set(id, new DkgSqliteStore(STATE_DB, id));
  }
  return storeCache.get(id)!;
}

function getGraph(catalogId?: string): GraphRegistry {
  const id = catalogId ?? activeCatalogId;
  if (!graphCache.has(id)) {
    if (registry.has(id) && id !== "demo") {
      const graph = bootstrapDkg({
        catalog: registry.getCatalog(id) as any,
        config: _configOverride as any,
      });
      graphCache.set(id, graph);
      console.log(`  (bootstrapped with custom catalog: ${id})`);
      return graph;
    }

    const store = getStore(id);
    const stats = store.stats();

    if (stats.nodes > 0) {
      const graph = store.loadGraph();
      graphCache.set(id, graph);
      console.log(`  (loaded from ${STATE_DB} [${id}]: ${stats.nodes} nodes, ${stats.edges} edges)`);
    } else {
      const graph = bootstrapDkg(
        registry.has(id)
          ? { catalog: registry.getCatalog(id) as any, config: _configOverride as any }
          : undefined,
      );
      const saved = store.saveGraph(graph);
      store.setMeta("last_bootstrap", new Date().toISOString());
      graphCache.set(id, graph);
      console.log(`  (bootstrapped & saved [${id}]: ${saved.nodesWritten} nodes, ${saved.edgesWritten} edges)`);
    }
  }
  return graphCache.get(id)!;
}

// ── CLI 완전 관측 ──────────────────────────────────────
// 모든 CLI 명령 실행을 cli_event prefix로 기록한다.
// 명령어 이름은 교체 가능한 UI. 좌표(intent × domain × subject)가 안정 식별자.

const CLI_COMMAND_MAP: Record<string, { intent: string; domain: string; subject: string }> = {
  // dkg query
  "dkg report":    { intent: "query", domain: "dkg-graph", subject: "system" },
  "dkg axes":      { intent: "query", domain: "dkg-graph", subject: "axis" },
  "dkg prefixes":  { intent: "query", domain: "dkg-graph", subject: "prefix" },
  "dkg domains":   { intent: "query", domain: "dkg-graph", subject: "domain" },
  "dkg dsl":       { intent: "query", domain: "dkg-graph", subject: "dsl-bundle" },
  "dkg service":   { intent: "query", domain: "dkg-graph", subject: "prefix" },
  "dkg prefix":    { intent: "query", domain: "dkg-graph", subject: "prefix" },
  "dkg overview":  { intent: "query", domain: "dkg-graph", subject: "system" },
  "dkg trace":     { intent: "query", domain: "dkg-graph", subject: "prefix" },
  "dkg claims":    { intent: "query", domain: "dkg-graph", subject: "prefix" },
  "dkg timeline":  { intent: "query", domain: "dkg-graph", subject: "observation" },
  "dkg skills":    { intent: "query", domain: "dkg-skill", subject: "skill" },
  "dkg history":   { intent: "query", domain: "convergence", subject: "system" },
  "dkg skew":      { intent: "query", domain: "convergence", subject: "version" },
  "dkg coverage":  { intent: "query", domain: "convergence", subject: "prefix" },
  "dkg metrics":   { intent: "query", domain: "convergence", subject: "system" },
  "dkg patterns":  { intent: "query", domain: "convergence", subject: "prefix" },
  "dkg pattern-stats": { intent: "query", domain: "convergence", subject: "prefix" },
  "dkg decisions list": { intent: "query", domain: "dkg-graph", subject: "decision" },
  // dkg analyze
  "dkg impact":    { intent: "analyze", domain: "dkg-graph", subject: "axis" },
  "dkg overlaps":  { intent: "analyze", domain: "convergence", subject: "axis" },
  "dkg self-check": { intent: "analyze", domain: "self-ref", subject: "system" },
  "dkg converge":  { intent: "analyze", domain: "convergence", subject: "system" },
  "dkg promote":   { intent: "analyze", domain: "self-ref", subject: "axis" },
  // dkg mutate
  "dkg decide":    { intent: "mutate", domain: "dkg-graph", subject: "decision" },
  "dkg observe":   { intent: "mutate", domain: "dkg-graph", subject: "observation" },
  "dkg claim":     { intent: "mutate", domain: "dkg-graph", subject: "prefix" },
  "dkg release":   { intent: "mutate", domain: "dkg-graph", subject: "prefix" },
  "dkg resolve":   { intent: "mutate", domain: "dkg-graph", subject: "observation" },
  "dkg link":      { intent: "mutate", domain: "dkg-graph", subject: "observation" },
  "dkg refresh":   { intent: "mutate", domain: "dkg-graph", subject: "system" },
  // dkg lifecycle
  "dkg version":   { intent: "lifecycle", domain: "registry", subject: "version" },
  "dkg publish":   { intent: "publish", domain: "registry", subject: "catalog" },
  // dkg backup
  "dkg export":    { intent: "backup", domain: "system", subject: "system" },
  "dkg import":    { intent: "backup", domain: "system", subject: "system" },
  "dkg decisions export": { intent: "backup", domain: "dkg-graph", subject: "decision" },
  "dkg decisions import": { intent: "backup", domain: "dkg-graph", subject: "decision" },
  // dkg run
  "dkg run":       { intent: "analyze", domain: "dkg-skill", subject: "skill" },
  // coordinate
  "encode":        { intent: "query", domain: "coordinate", subject: "prefix" },
  "decode":        { intent: "query", domain: "coordinate", subject: "prefix" },
  "resolve":       { intent: "query", domain: "coordinate", subject: "prefix" },
  "find-version":  { intent: "query", domain: "coordinate", subject: "version" },
  "list-prefixes": { intent: "query", domain: "coordinate", subject: "prefix" },
  "list-axes":     { intent: "query", domain: "coordinate", subject: "axis" },
  "derive-refs":   { intent: "analyze", domain: "coordinate", subject: "prefix" },
  "impact":        { intent: "analyze", domain: "coordinate", subject: "axis" },
  // spec
  "spec list":     { intent: "query", domain: "spec", subject: "spec" },
  "spec resolve":  { intent: "query", domain: "spec", subject: "prefix" },
  "spec validate": { intent: "analyze", domain: "spec", subject: "schema" },
  "spec trace":    { intent: "query", domain: "spec", subject: "spec" },
  "spec decode":   { intent: "query", domain: "spec", subject: "prefix" },
  "spec codegen":  { intent: "publish", domain: "spec", subject: "schema" },
  // system
  "init":          { intent: "init", domain: "system", subject: "catalog" },
  "scan git":      { intent: "init", domain: "system", subject: "schema" },
  "register":      { intent: "publish", domain: "registry", subject: "schema" },
  "dry-run":       { intent: "analyze", domain: "system", subject: "prefix" },
  "codegen":       { intent: "publish", domain: "system", subject: "schema" },
  "inspect":       { intent: "query", domain: "registry", subject: "schema" },
  "catalog list":  { intent: "query", domain: "catalog", subject: "catalog" },
  "catalog info":  { intent: "query", domain: "catalog", subject: "catalog" },
  "sync-obsidian": { intent: "publish", domain: "system", subject: "catalog" },
  // 추가된 명령어
  "dkg add-entry": { intent: "mutate", domain: "dkg-graph", subject: "axis" },
  "dkg reset":     { intent: "mutate", domain: "system", subject: "system" },
  "obs read":      { intent: "query", domain: "system", subject: "spec" },
  "obs search":    { intent: "query", domain: "system", subject: "spec" },
  "obs append":    { intent: "mutate", domain: "system", subject: "spec" },
  "obs backlinks": { intent: "query", domain: "system", subject: "spec" },
  "obs list":      { intent: "query", domain: "system", subject: "spec" },
  "obs stats":     { intent: "query", domain: "system", subject: "system" },
};

/**
 * CLI 명령 실행을 cli_event 좌표로 기록한다.
 * 명령어 이름이 아닌 의도(intent × domain × subject)가 좌표.
 */
export function emitCliEvent(command: string): void {
  const mapping = CLI_COMMAND_MAP[command];
  if (!mapping) return;
  try {
    const now = new Date().toISOString();
    const session = `cli-${process.env.USER ?? "unknown"}`;
    const address = encodePrefixByValue(DEMO_CATALOG, "cli_event", "v1", {
      cli_intent: mapping.intent,
      cli_domain: mapping.domain,
      cli_subject: mapping.subject,
    });
    const store = getStore();
    store.saveUsageSnapshot({
      entryUsages: [
        { axisId: "cli_intent", entry: mapping.intent, count: 1, lastSeen: now },
        { axisId: "cli_domain", entry: mapping.domain, count: 1, lastSeen: now },
        { axisId: "cli_subject", entry: mapping.subject, count: 1, lastSeen: now },
      ],
      addressUsages: [
        { prefix: "cli_event", version: "v1", address, count: 1 },
      ],
      coOccurrences: [],
      versionUsages: [{ prefix: "cli_event", version: "v1", count: 1, lastSeen: now, sessions: [session] }],
      collectionPeriod: { from: now, to: now },
    } as any);
  } catch {
    // 인코딩 실패 시 무시
  }
}

/**
 * CLI 커버리지 분석 — 관측된 좌표 vs 전체 좌표.
 * dormant 좌표 = 한 번도 실행되지 않은 CLI 기능 경로.
 */
export function analyzeCliCoverage(): {
  totalCoords: number;
  observedCoords: number;
  dormantCoords: Array<{ coord: string; commands: string[] }>;
  coverageRate: number;
} {
  // 전체 고유 좌표 수집
  const allCoords = new Map<string, string[]>();
  for (const [cmd, m] of Object.entries(CLI_COMMAND_MAP)) {
    const key = `${m.intent}:${m.domain}:${m.subject}`;
    const list = allCoords.get(key) ?? [];
    list.push(cmd);
    allCoords.set(key, list);
  }

  // store의 usage_snapshots data JSON에서 cli_* entryUsage 직접 스캔
  const observedIntents = new Set<string>();
  const observedDomains = new Set<string>();
  const observedSubjects = new Set<string>();
  try {
    const s = getStore();
    // DkgSqliteStore 내부의 db에 접근하여 raw data 쿼리
    const rows = (s as any).db.prepare(
      "SELECT data FROM usage_snapshots ORDER BY id DESC LIMIT 500",
    ).all() as Array<{ data: string }>;
    for (const row of rows) {
      try {
        const d = JSON.parse(row.data);
        for (const eu of d.entryUsages ?? []) {
          if (eu.axisId === "cli_intent") observedIntents.add(eu.entry);
          if (eu.axisId === "cli_domain") observedDomains.add(eu.entry);
          if (eu.axisId === "cli_subject") observedSubjects.add(eu.entry);
        }
      } catch { /* 개별 파싱 실패 무시 */ }
    }
  } catch { /* store 접근 실패 */ }

  // 관측된 좌표 조합 판별
  const observed = new Set<string>();
  for (const [key] of allCoords) {
    const [intent, domain, subject] = key.split(":");
    if (observedIntents.has(intent) && observedDomains.has(domain) && observedSubjects.has(subject)) {
      observed.add(key);
    }
  }

  const dormant = [...allCoords.entries()]
    .filter(([key]) => !observed.has(key))
    .map(([key, cmds]) => ({ coord: key, commands: cmds }));

  return {
    totalCoords: allCoords.size,
    observedCoords: observed.size,
    dormantCoords: dormant,
    coverageRate: allCoords.size > 0 ? observed.size / allCoords.size : 1,
  };
}

// ── DKG 이벤트 기록 (write 명령 상세) ──────────────────
// cli_event의 subset. mutate intent 명령의 상세 정보 기록.

function emitDkgEvent(
  op: string,
  targetKind: string,
  targetId: string,
  extra?: { decisionType?: string; obsSource?: string; nodeSource?: string; lifecycleState?: string },
): void {
  try {
    const now = new Date().toISOString();
    const session = `cli-${process.env.USER ?? "unknown"}`;
    const versionUsages: Array<{ prefix: string; version: string; count: number; lastSeen: string; sessions: string[] }> = [];

    // 기본 dkg_event
    const baseAddr = encodePrefixByValue(DEMO_CATALOG, "dkg_event", "v1", {
      dkg_op: op,
      dkg_target_kind: targetKind,
    });
    versionUsages.push({ prefix: "dkg_event", version: "v1", count: 1, lastSeen: now, sessions: [session] });

    // 승격된 prefix: dkg_decision_event (decide 시)
    if (extra?.decisionType) {
      try {
        encodePrefixByValue(DEMO_CATALOG, "dkg_decision_event", "v1", {
          decision_type: extra.decisionType,
          dkg_target_kind: targetKind,
          node_source: extra.nodeSource ?? "manual",
        });
        versionUsages.push({ prefix: "dkg_decision_event", version: "v1", count: 1, lastSeen: now, sessions: [session] });
      } catch { /* 값이 축에 없으면 건너뜀 */ }
    }

    // 승격된 prefix: dkg_observation_event (observe 시)
    if (extra?.obsSource) {
      try {
        encodePrefixByValue(DEMO_CATALOG, "dkg_observation_event", "v1", {
          obs_source: extra.obsSource,
          dkg_target_kind: targetKind,
          lifecycle_state: extra.lifecycleState ?? "active",
        });
        versionUsages.push({ prefix: "dkg_observation_event", version: "v1", count: 1, lastSeen: now, sessions: [session] });
      } catch { /* 값이 축에 없으면 건너뜀 */ }
    }

    const store = getStore();
    store.saveUsageSnapshot({
      entryUsages: [],
      addressUsages: [],
      coOccurrences: [],
      versionUsages,
      collectionPeriod: { from: now, to: now },
    } as any);
  } catch {
    // 인코딩 실패 시 무시 (운영에 영향 없음)
  }
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
    mkdirSync(dirname(opts.output), { recursive: true });
    writeFileSync(opts.output, json, "utf-8");
    console.log(`  exported to ${opts.output}`);
  } else {
    console.log(json);
  }
}

// ── dkg import — JSON import ──────────────────────────

export function dkgImport(opts: { input: string }): void {
  const json = readFileSync(opts.input, "utf-8");

  const store = getStore();
  const result = store.importJson(json);
  console.log(`  imported: ${result.nodesImported} nodes, ${result.edgesImported} edges`);
}

// ── dkg decisions — 의사결정 백업/복원/조회 ───────────

export function dkgDecisionsExport(opts: { output?: string }): void {
  const store = getStore();
  const json = store.exportDecisions();
  const parsed = JSON.parse(json);

  if (opts.output) {
    mkdirSync(dirname(opts.output), { recursive: true });
    writeFileSync(opts.output, json, "utf-8");
    console.log(`  decisions exported to ${opts.output}`);
  } else {
    console.log(json);
  }

  console.log(`  summary: ${parsed.summary.decisions} decisions, ${parsed.summary.observations} observations, ${parsed.summary.versionEvents} version-events, ${parsed.summary.edges} edges`);
}

export function dkgDecisionsImport(opts: { input: string }): void {
  const json = readFileSync(opts.input, "utf-8");

  const store = getStore();
  const result = store.importDecisions(json);
  graphCache.delete(activeCatalogId);
  console.log(`  decisions imported: ${result.nodesImported} nodes, ${result.edgesImported} edges`);
  console.log(`  (DKG 그래프 캐시 무효화됨. 다음 명령에서 자동 리로드)`);
}

export function dkgDecisionsList(opts: { limit?: number; kind?: string }): void {
  const store = getStore();
  const kinds = opts.kind ? [opts.kind] : ["decision", "observation"];
  const rows = store.listRecentDecisions(opts.limit ?? 20, kinds);

  if (rows.length === 0) {
    console.log("\n  (의사결정/관측 기록 없음)");
    return;
  }

  console.log(`\n══ 최근 의사결정 (${rows.length}건) ══\n`);
  for (const r of rows) {
    const data = r.data as Record<string, unknown>;
    const icon = r.kind === "decision" ? "📋" : r.kind === "observation" ? "👁" : "📦";
    const title = (data.title as string) ?? (data.finding as string) ?? r.id;
    const lifecycle = (data.lifecycle as string) ?? (data.resolution ? "resolved" : "open");
    console.log(`  ${icon} [${r.date.slice(0, 10)}] ${r.id}`);
    console.log(`     ${title}`);
    console.log(`     source=${r.source} lifecycle=${lifecycle}`);
  }
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
  const fullGraph = store.loadGraph();

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

  emitDkgEvent("decide", graph.getNode(opts.target)?.kind ?? "prefix", opts.target, {
    decisionType: opts.type === "capacity" ? "capacity" : opts.type === "merge" ? "merge" : opts.type === "deprecate" ? "deprecate" : opts.type === "new-axis" ? "new-axis" : opts.type === "new-prefix" ? "new-prefix" : opts.type === "dim-add" ? "dim-add" : undefined,
    nodeSource: "manual",
  });

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

  emitDkgEvent("observe", graph.getNode(opts.target)?.kind ?? "prefix", opts.target, {
    obsSource: "manual",
    lifecycleState: "active",
  });

  console.log(`\n══ Observation 기록 완료 ══`);
  console.log(`  id:      ${obs.id}`);
  console.log(`  target:  ${opts.target}`);
  console.log(`  finding: ${obs.finding}`);
  if (obs.suggestion) console.log(`  suggestion: ${JSON.stringify(obs.suggestion)}`);
  console.log(`  (source: manual — refresh 시 보존됨)`);
}

// ── dkg claim ───────────────────────────────────────

export function dkgClaim(opts: { target: string; by: string; reason?: string }): void {
  const graph = getGraph();
  const store = getStore();
  const topo = createDemoTopology();

  const existing = store.getMeta(claimKey(opts.target));
  const existingClaim: ClaimData | null = existing ? JSON.parse(existing) : null;

  const result = prepareClaim(graph, topo, opts.target, opts.by, existingClaim, opts.reason);

  if (result.verdict === "blocked") {
    console.error(`  ${result.reason}`);
    if (existingClaim) {
      if (existingClaim.reason) console.error(`  사유: ${existingClaim.reason}`);
      console.error(`  해제하려면: qa-sdk dkg release ${opts.target}`);
    }
    return;
  }

  // claim 저장
  store.setMeta(claimKey(opts.target), JSON.stringify(result.claim));

  emitDkgEvent("claim", graph.getNode(opts.target)?.kind ?? "prefix", opts.target);

  console.log(`\n══ Claim: ${opts.target} ══`);
  console.log(`  by:     ${result.claim!.by}`);
  console.log(`  at:     ${result.claim!.at}`);
  if (result.claim!.reason) console.log(`  reason: ${result.claim!.reason}`);

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

  emitDkgEvent("release", graph.getNode(target)?.kind ?? "prefix", target);

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

  emitDkgEvent("resolve", "observation", opts.obsId);

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

  emitDkgEvent("link", "observation", opts.obsId);

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
    if (claim.reason) console.log(`    사유: ${claim.reason}`);
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

      // ── metric 통합 출력 ──
      const chainMetrics = collectMetrics(DEMO_CATALOG, graph, null);
      const relevantMetrics = chainMetrics.filter(m =>
        m.id.startsWith("metric:health") ||
        m.id.startsWith("metric:conflict") ||
        m.id.startsWith("metric:overlap") ||
        m.id.startsWith("metric:headroom"),
      );
      if (relevantMetrics.length > 0) {
        const warn = relevantMetrics.filter(m => m.status !== "ok");
        console.log(`\n  ── Metrics (${relevantMetrics.length}건, ${warn.length} issues) ──`);
        for (const m of relevantMetrics.filter(m => m.status !== "ok")) {
          const icon = m.status === "warning" ? "⚠" : "🔴";
          console.log(`    ${icon} ${m.id}: ${m.detail ?? `value=${m.value}`}`);
        }
        if (warn.length === 0) console.log(`    ✅ 모든 metric 정상`);
      }
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

// ── dkg metrics ─────────────────────────────────────

export function dkgMetrics(): void {
  const graph = getGraph();
  const store = getStore();

  // usage data 로드 (있으면)
  const recent = store.loadRecentVersionUsages(1);
  const usage = recent.length > 0 && recent[0].versionUsages.length > 0
    ? (() => {
        // minimal UsageData 구성
        return {
          entryUsages: [] as any[],
          addressUsages: [] as any[],
          coOccurrences: [] as any[],
          versionUsages: recent[0].versionUsages,
          collectionPeriod: { from: recent[0].collectedAt, to: recent[0].collectedAt },
        } as any;
      })()
    : null;

  const metrics = collectMetrics(DEMO_CATALOG, graph, usage);

  console.log(`\n══ Metrics Dashboard ══`);
  console.log(`  정의: ${METRIC_DEFS.length}종, 측정: ${metrics.length}건\n`);

  // status별 카운트
  const ok = metrics.filter(m => m.status === "ok").length;
  const warning = metrics.filter(m => m.status === "warning").length;
  const critical = metrics.filter(m => m.status === "critical").length;

  console.log(`  ✅ ok: ${ok}  ⚠ warning: ${warning}  🔴 critical: ${critical}\n`);

  // category별 그룹핑
  const byCategory = new Map<string, MetricValue[]>();
  for (const m of metrics) {
    const cat = m.id.split(":")[1] ?? "unknown";
    const list = byCategory.get(cat) ?? [];
    list.push(m);
    byCategory.set(cat, list);
  }

  for (const [cat, catMetrics] of byCategory) {
    console.log(`  ── ${cat} ──`);
    for (const m of catMetrics) {
      const icon = m.status === "ok" ? "✅" : m.status === "warning" ? "⚠" : "🔴";
      const target = m.target ? ` (${m.target})` : "";
      console.log(`    ${icon} ${m.id.padEnd(35)} value=${String(m.value).padEnd(5)} ${m.detail ?? ""}${target}`);
    }
    console.log("");
  }

  // 자동 Observation 후보
  const autoObs = metricsToObservations(metrics);
  if (autoObs.length > 0) {
    console.log(`  ── 자동 Observation 후보 (${autoObs.length}건) ──`);
    for (const obs of autoObs) {
      console.log(`    ${obs.id}: ${obs.finding}`);
    }
    console.log(`\n  이 Observation을 DKG에 기록하려면 각각 dkg observe로 수동 등록하세요.`);
  }
}

// ── dkg converge ────────────────────────────────────

/**
 * 통합 convergence 파이프라인.
 * metrics + convergeChain + systemHealthChain을 순차 실행하고
 * --persist 시 결과를 DKG store에 자동 저장.
 */
export function dkgConverge(opts: { persist?: boolean; verbose?: boolean }): void {
  const graph = getGraph();
  const store = getStore();
  const catalog = (registry.has(activeCatalogId) ? registry.getCatalog(activeCatalogId) : DEMO_CATALOG) as any;

  console.log(`\n══ Convergence Pipeline ══`);

  // 1. Usage data 로드
  const recent = store.loadRecentVersionUsages(5);
  const usage = recent.length > 0 && recent[0].versionUsages.length > 0
    ? {
        entryUsages: [] as any[],
        addressUsages: [] as any[],
        coOccurrences: [] as any[],
        versionUsages: recent.flatMap(s => s.versionUsages),
        collectionPeriod: {
          from: recent[recent.length - 1]?.collectedAt ?? new Date().toISOString(),
          to: recent[0]?.collectedAt ?? new Date().toISOString(),
        },
      } as any
    : null;

  console.log(`  usage snapshots: ${recent.length}개 로드${usage ? ` (${usage.versionUsages.length} version usages)` : " (없음)"}`);

  // 2. Metrics 수집
  const metrics = collectMetrics(catalog, graph, usage) as MetricValue[];
  const ok = metrics.filter(m => m.status === "ok").length;
  const warning = metrics.filter(m => m.status === "warning").length;
  const critical = metrics.filter(m => m.status === "critical").length;
  console.log(`\n  metrics: ${metrics.length}건 (ok=${ok}, warning=${warning}, critical=${critical})`);

  // 3. 자동 Observation 생성 + ok 복귀 시 자동 해소
  const autoObs = metricsToObservations(metrics);
  const existingObs = graph.getNodesByKind("observation") as ObservationNode[];
  const autoResolved = resolveRecoveredMetrics(metrics, existingObs);

  if (autoObs.length > 0) {
    console.log(`  auto observations: ${autoObs.length}건`);
    if (opts.verbose) {
      for (const obs of autoObs) console.log(`    ${obs.id}: ${obs.finding.slice(0, 80)}`);
    }
  }
  if (autoResolved.length > 0) {
    console.log(`  auto-resolved: ${autoResolved.length}건 (metric ok 복귀)`);
    if (opts.verbose) {
      for (const obs of autoResolved) console.log(`    ✅ ${obs.id}`);
    }
  }

  // 4. Converge Chain
  const entriesMap = buildEntriesMap(catalog);
  const convergeResult = convergeChain(catalog, graph, usage, { entriesMap });
  console.log(`\n  converge chain:`);
  console.log(`    actions: ${convergeResult.actions.length}건`);
  console.log(`    merges=${convergeResult.summary.merges}, deactivations=${convergeResult.summary.deactivations}, simplifications=${convergeResult.summary.simplifications}, observations=${convergeResult.summary.observations}`);
  if (opts.verbose) {
    for (const action of convergeResult.actions) {
      const a = action as any;
      const target = a.targets?.join("↔") ?? a.axis ?? a.prefix ?? a.source ?? "?";
      console.log(`      [${a.kind}] ${target}`);
    }
  }

  // 5. System Health Chain
  const healthResult = systemHealthChain(graph);
  console.log(`\n  system health:`);
  console.log(`    steps: ${healthResult.steps.length}건`);
  for (const step of healthResult.steps) {
    const s = step as any;
    const icon = s.status === "ok" ? "✅" : s.status === "warning" ? "⚠" : "🔴";
    console.log(`    ${icon} ${s.step}: ${s.message}`);
  }

  // 6. Persist (--persist)
  if (opts.persist) {
    console.log(`\n  ── 저장 ──`);

    // Stale timestamp 기반 observation 정리 (결정적 ID 전환 후)
    const cleaned = store.cleanStaleMetricObservations();
    if (cleaned > 0) {
      console.log(`    stale observation ${cleaned}건 정리 (timestamp→결정적 ID 전환)`);
    }

    // Usage snapshot + auto observations
    if (usage) {
      const snapResult = store.saveUsageSnapshotWithObservations(usage, autoObs);
      console.log(`    usage snapshot #${snapResult.snapshotId} 저장 (observations: ${snapResult.observationsWritten})`);
    } else if (autoObs.length > 0) {
      // usage 없어도 observation은 저장
      const edges = autoObs.flatMap((obs: any) =>
        (obs.subjects ?? []).map((s: string) => ({ type: "observes" as const, from: obs.id, to: s })),
      );
      store.saveNodes(autoObs, edges, "auto");
      console.log(`    observations ${autoObs.length}건 저장 (usage 없음)`);
    }

    // Converge chain 결과 저장
    const allNodes = [
      ...convergeResult.observations,
      ...convergeResult.decisions,
    ] as any[];
    if (allNodes.length > 0) {
      const edges = allNodes.flatMap((n: any) => {
        if (n.kind === "observation" && n.subjects) {
          return n.subjects.map((s: string) => ({ type: "observes" as const, from: n.id, to: s }));
        }
        if (n.kind === "decision" && n.targets) {
          return n.targets.map((t: string) => ({ type: "justifies" as const, from: n.id, to: t }));
        }
        return [];
      });
      store.saveNodes(allNodes, edges, "auto");
      console.log(`    converge 결과 ${allNodes.length}건 저장`);
    }

    // Auto-resolved observations 영속화
    if (autoResolved.length > 0) {
      for (const obs of autoResolved) {
        store.updateNode(obs as any);
      }
      console.log(`    auto-resolved ${autoResolved.length}건 영속화`);
    }

    store.setMeta("last_convergence", new Date().toISOString());
    console.log(`    last_convergence 메타 업데이트`);
  }

  // 요약 + 미해결 observation 가이드
  const total = autoObs.length + convergeResult.observations.length + convergeResult.decisions.length;
  console.log(`\n  총 ${metrics.length} metrics, ${total} observations/decisions 생성, ${autoResolved.length} auto-resolved${opts.persist ? " (저장됨)" : " (--persist로 저장)"}`);

  // 미해결 observation 안내
  const unresolvedObs = existingObs.filter((o: any) => !o.resolution);
  if (unresolvedObs.length > 0) {
    console.log(`\n  ── 미해결 observation (${unresolvedObs.length}건) ──`);
    const top = unresolvedObs.slice(0, 3);
    for (const obs of top) {
      console.log(`    ${obs.id}: ${(obs as any).finding?.slice(0, 70) ?? "?"}`);
    }
    if (unresolvedObs.length > 3) {
      console.log(`    ... 외 ${unresolvedObs.length - 3}건`);
    }
    console.log(`\n  해소 방법: qa-sdk dkg resolve <obsId> --decision <decId> --outcome accepted`);
  }
}

// ── dkg patterns — 패턴 규칙 조회 ──────────────────────

export function dkgPatterns(): void {
  console.log(`\n══ 패턴 분류 규칙 (${DEMO_PATTERN_RULES.length}개) ══\n`);
  for (const rule of DEMO_PATTERN_RULES) {
    const icon = rule.identificationMode === "service" ? "🤖" : rule.identificationMode === "anonymous" ? "👤" : "🔑";
    console.log(`  ${icon} ${rule.id}`);
    console.log(`     mode=${rule.identificationMode} pattern=${rule.behaviorPattern} confidence=${rule.defaultConfidence} priority=${rule.priority ?? 0}`);
    if (rule.description) console.log(`     ${rule.description}`);
    const m = rule.match;
    if (m.requiredKeys?.length) console.log(`     required: [${m.requiredKeys.join(", ")}]`);
    if (m.excludedKeys?.length) console.log(`     excluded: [${m.excludedKeys.join(", ")}]`);
    if (m.requiredSequence?.length) console.log(`     sequence: [${m.requiredSequence.join(" → ")}]`);
  }
}

// ── dkg pattern-stats — 패턴 건전성 ────────────────────

export function dkgPatternStats(): void {
  // 현재 저장된 스냅샷에서 패턴 데이터를 조회하는 것은 수집이 활성화된 후에 가능
  // 여기서는 규칙 기반 시뮬레이션 출력
  console.log(`\n══ 패턴 통계 ══\n`);
  console.log(`  (패턴 수집이 활성화되면 여기에 실시간 통계가 표시됩니다)`);
  console.log(`  활성화: PATTERN_CLASSIFICATION_ENABLED=true`);
  console.log(`\n  등록된 규칙: ${DEMO_PATTERN_RULES.length}개`);

  const byMode = new Map<string, number>();
  for (const r of DEMO_PATTERN_RULES) {
    byMode.set(r.identificationMode, (byMode.get(r.identificationMode) ?? 0) + 1);
  }
  console.log(`\n  식별 모드별 규칙 수:`);
  for (const [mode, count] of byMode) {
    console.log(`    ${mode}: ${count}개`);
  }
}

// ── dkg publish ─────────────────────────────────────

export async function dkgPublish(opts: { registry?: string; versionId?: string }): Promise<void> {
  const catalog = (registry.has(activeCatalogId) ? registry.getCatalog(activeCatalogId) : DEMO_CATALOG) as any;
  const registryUrl = opts.registry ?? process.env.QA_REGISTRY_URL ?? "http://localhost:3100";
  const versionId = opts.versionId ?? "v1";

  console.log(`\n══ Publish to Registry ══`);
  console.log(`  catalog: ${activeCatalogId}`);
  console.log(`  registry: ${registryUrl}`);
  console.log(`  versionId: ${versionId}\n`);

  // 1. catalog → SchemaSnapshot
  const snapshot = catalogToSchemaSnapshot(catalog, { id: activeCatalogId });
  console.log(`  axes: ${snapshot.axes.length}`);
  console.log(`  composites: ${snapshot.composites.length}`);

  // 2. registry-service에 import
  try {
    const res = await fetch(`${registryUrl}/schema/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ snapshot, versionId }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.error(`  registry 오류 (${res.status}): ${errBody}`);
      return;
    }

    const result = await res.json() as {
      imported: { axes: number; composites: number; versionId: string };
      analysis: { ready: boolean; diagnostics: Array<{ level: string; prefix: string; message: string }>; releaseOrder: string[] };
    };

    console.log(`\n  imported: axes=${result.imported.axes}, composites=${result.imported.composites}`);
    console.log(`  ready: ${result.analysis.ready}`);

    if (result.analysis.diagnostics.length > 0) {
      console.log(`  diagnostics:`);
      for (const d of result.analysis.diagnostics) {
        const icon = d.level === "error" ? "🔴" : d.level === "warn" ? "⚠" : "ℹ";
        console.log(`    ${icon} ${d.prefix}: ${d.message}`);
      }
    }

    if (result.analysis.releaseOrder.length > 0) {
      console.log(`  release order: ${result.analysis.releaseOrder.join(" → ")}`);
    }

    emitDkgEvent("promote", "system", "publish");
  } catch (err: any) {
    console.error(`  연결 실패: ${err.message}`);
    console.error(`  registry-service가 ${registryUrl}에서 실행 중인지 확인하세요.`);
  }
}

// ── dkg version ─────────────────────────────────────

export async function dkgVersion(action: string, prefix: string, versionId: string, opts: { registry?: string }): Promise<void> {
  const registryUrl = opts.registry ?? process.env.QA_REGISTRY_URL ?? "http://localhost:3100";

  if (action === "list") {
    try {
      const res = await fetch(`${registryUrl}/prefixes/${prefix}/versions`);
      if (!res.ok) { console.error(`오류: ${res.status}`); return; }
      const versions = await res.json() as Array<{ versionId: string; status: string; capacity: number; shape?: number[]; stride?: number[] }>;
      console.log(`\n══ Versions: ${prefix} ══`);
      for (const v of versions) {
        const icon = v.status === "active" ? "✅" : v.status === "draft" ? "📝" : v.status === "locked" ? "🔒" : "⏸";
        console.log(`  ${icon} ${v.versionId.padEnd(8)} [${v.status}] cap=${v.capacity}${v.shape ? ` shape=[${v.shape}]` : ""}${v.stride ? ` stride=[${v.stride}]` : ""}`);
      }
    } catch (err: any) {
      console.error(`연결 실패: ${err.message}`);
    }
    return;
  }

  const endpoints: Record<string, string> = {
    lock: "lock", unlock: "unlock", release: "release", activate: "activate", deprecate: "deprecate",
  };
  const endpoint = endpoints[action];
  if (!endpoint) {
    console.error(`알 수 없는 action: ${action}. (list|lock|release|activate|deprecate)`);
    return;
  }

  try {
    const res = await fetch(`${registryUrl}/prefixes/${prefix}/versions/${versionId}/${endpoint}`, { method: "POST" });
    if (!res.ok) {
      const body = await res.text();
      console.error(`오류 (${res.status}): ${body}`);
      return;
    }
    const result = await res.json();
    console.log(`\n  ${prefix}:${versionId} → ${action} 완료`);
    if (action === "activate" && result) {
      console.log(`  결과:`, JSON.stringify(result, null, 2).slice(0, 200));
    }
  } catch (err: any) {
    console.error(`연결 실패: ${err.message}`);
  }
}

// ── dkg reset ───────────────────────────────────────

export function dkgReset(target: string, opts: { catalogId?: string; confirm?: boolean }): void {
  const store = getStore(opts.catalogId);

  if (!opts.confirm) {
    console.log(`\n══ Reset: ${target} ══`);
    console.log(`  catalog: ${store.catalogId}`);
    console.log(`  대상: ${target}`);
    console.log(`\n  현재 상태:`);
    const stats = store.stats();
    console.log(`    nodes: ${stats.nodes} (bootstrap: ${stats.bootstrapNodes}, manual: ${stats.manualNodes})`);
    console.log(`    edges: ${stats.edges}`);
    console.log(`    snapshots: ${stats.snapshots}`);
    console.log(`\n  --confirm 플래그로 실행을 확인하세요.`);
    return;
  }

  console.log(`\n══ Reset: ${target} (--confirm) ══`);

  switch (target) {
    case "bootstrap": {
      const result = store.clearBootstrap();
      console.log(`  bootstrap 삭제: ${result.nodesDeleted} nodes, ${result.edgesDeleted} edges`);
      console.log(`  → dkg refresh로 재부트스트랩하세요.`);
      break;
    }
    case "operational": {
      const result = store.clearOperational();
      console.log(`  운영 데이터 삭제: ${result.nodesDeleted} nodes, ${result.edgesDeleted} edges`);
      console.log(`  (observation, decision, claim 등 manual/auto/metric 데이터)`);
      break;
    }
    case "snapshots": {
      const result = store.clearSnapshots();
      console.log(`  스냅샷 삭제: ${result.snapshotsDeleted} snapshots, ${result.versionUsagesDeleted} version usages`);
      break;
    }
    case "auto": {
      const result = store.clearBySource("auto");
      console.log(`  auto 데이터 삭제: ${result.nodesDeleted} nodes, ${result.edgesDeleted} edges`);
      break;
    }
    case "catalog": {
      const catId = opts.catalogId ?? "demo";
      const result = store.deleteCatalog(catId);
      console.log(`  카탈로그 '${catId}' 삭제: ${result.nodesDeleted} nodes, ${result.edgesDeleted} edges`);
      break;
    }
    case "all": {
      const snapResult = store.clearSnapshots();
      const catResult = store.deleteCatalog(store.catalogId);
      console.log(`  전체 초기화:`);
      console.log(`    nodes: ${catResult.nodesDeleted}, edges: ${catResult.edgesDeleted}`);
      console.log(`    snapshots: ${snapResult.snapshotsDeleted}, versionUsages: ${snapResult.versionUsagesDeleted}`);
      console.log(`  → dkg refresh로 재부트스트랩하세요.`);
      break;
    }
    default:
      console.error(`  알 수 없는 대상: ${target}`);
      console.error(`  사용 가능: bootstrap, operational, snapshots, auto, catalog, all`);
  }

  emitCliEvent("dkg reset");
}

// ── dkg promote ─────────────────────────────────────

export function dkgPromoteScan(): void {
  const graph = getGraph();
  const catalog = (registry.has(activeCatalogId) ? registry.getCatalog(activeCatalogId) : DEMO_CATALOG) as any;

  emitDkgEvent("promote", "system", "scan");

  // 기존 축 이름 수집
  const existingAxes = new Set(Object.keys(catalog.axes ?? {}));

  const candidates = scanPromotionCandidates(graph, { existingAxes });

  console.log(`\n══ Coordinate Promotion Scan ══`);
  console.log(`  후보: ${candidates.length}건\n`);

  const promote = candidates.filter(c => c.verdict === "promote");
  const review = candidates.filter(c => c.verdict === "review");
  const keep = candidates.filter(c => c.verdict === "keep");

  if (promote.length > 0) {
    console.log(`  ── 승격 권장 (${promote.length}건) ──`);
    for (const c of promote) {
      console.log(`    ${c.field.padEnd(30)} [${c.source}]`);
      console.log(`      values: [${c.values.slice(0, 6).join(", ")}${c.values.length > 6 ? ", ..." : ""}] (${c.values.length}개)`);
      console.log(`      5Q: finite=${c.q1_finite} decision=${c.q2_decision} shared=${c.q3_shared} stable=${c.q4_stable} cap=${c.q5_capacity}`);
      console.log(`      → ${c.reason}`);
    }
  }

  if (review.length > 0) {
    console.log(`\n  ── 검토 필요 (${review.length}건) ──`);
    for (const c of review) {
      console.log(`    ${c.field.padEnd(30)} [${c.source}]`);
      console.log(`      values: [${c.values.slice(0, 6).join(", ")}${c.values.length > 6 ? ", ..." : ""}] (${c.values.length}개)`);
      console.log(`      → ${c.reason}`);
    }
  }

  if (keep.length > 0) {
    console.log(`\n  ── 유지 (${keep.length}건) ──`);
    for (const c of keep) {
      const tag = c.alreadyAxis ? " [이미 축]" : "";
      console.log(`    ${c.field.padEnd(30)} ${c.reason}${tag}`);
    }
  }

  console.log(`\n  승격=${promote.length}, 검토=${review.length}, 유지=${keep.length}`);
}

// ── dkg self-check ──────────────────────────────────

const SELF_CHECK_PKGS = [
  // 기존 12개
  { name: "spec-core", filter: "@qa-sdk/spec-core", hasTest: true, hasBuild: true },
  { name: "cli", filter: "@qa-sdk/cli", hasTest: true, hasBuild: true },
  { name: "sdk", filter: "@qa-sdk/sdk", hasTest: true, hasBuild: true },
  { name: "demo-snapshot", filter: "demo-snapshot", hasTest: true, hasBuild: true },
  { name: "weighted-index", filter: "weighted-index", hasTest: true, hasBuild: true },
  { name: "bit-index", filter: "bit-index", hasTest: true, hasBuild: true },
  { name: "permission-engine", filter: "permission-engine", hasTest: true, hasBuild: true },
  { name: "index-meta", filter: "index-meta", hasTest: true, hasBuild: true },
  { name: "platform-demo", filter: "platform-demo", hasTest: false, hasBuild: true },
  { name: "ingest-server", filter: "@qa-sdk/ingest-server", hasTest: true, hasBuild: true },
  { name: "registry-service", filter: "@qa-sdk/registry-service", hasTest: true, hasBuild: true },
  { name: "e2e", filter: "@qa-sdk/e2e", hasTest: true, hasBuild: false },
  // 서비스 + 코어 8개 추가
  { name: "core", filter: "@qa-sdk/core", hasTest: true, hasBuild: true },
  { name: "engine", filter: "@qa-sdk/engine", hasTest: true, hasBuild: true },
  { name: "store", filter: "@qa-sdk/store", hasTest: true, hasBuild: true },
  { name: "gate-service", filter: "gate-service", hasTest: true, hasBuild: true },
  { name: "query-service", filter: "query-service", hasTest: true, hasBuild: true },
  { name: "decode-service", filter: "@qa-sdk/decode-service", hasTest: true, hasBuild: true },
  { name: "registry-server", filter: "@qa-sdk/registry-server", hasTest: true, hasBuild: true },
  { name: "registry-client", filter: "@qa-sdk/registry-client", hasTest: true, hasBuild: true },
];

/**
 * 테스트 파일명 → api_surface 매핑.
 * vitest 출력에서 파일명을 파싱하여 해당 인터페이스 영역을 결정한다.
 */
const FILE_TO_SURFACE: Record<string, string> = {
  // encode-decode: 라운드트립
  "weighted-index.test": "encode-decode", "weighted-index-big.test": "encode-decode",
  "bit-index.test": "encode-decode", "bridge.test": "encode-decode",
  "meta-codec.test": "encode-decode", "meta-codec-big.test": "encode-decode",
  "prefix-registry.test": "encode-decode", "label-registry.test": "encode-decode",
  "prefix-decoder.test": "encode-decode",
  // stride-calc
  "calc.test": "stride-calc", "layout-fit.test": "stride-calc", "layout-fit-bigint.test": "stride-calc",
  "capacity-planner.test": "stride-calc", "capacity-guard.test": "stride-calc",
  // bitmask-ops
  "bitmask.test": "bitmask-ops", "bit-field-layout.test": "bitmask-ops",
  "bit-mask-set.test": "bitmask-ops", "bit-width.test": "bitmask-ops",
  // dim-extract
  "partial-binder.test": "dim-extract",
  // perm-grant
  "permission-set.test": "perm-grant", "permission-view-cache.test": "perm-grant",
  "scoped-engine.test": "perm-grant", "ternary-mask.test": "perm-grant",
  // protocol-codec
  "permission-codec.test": "protocol-codec", "composite-address.test": "protocol-codec",
  "semantic-address.test": "protocol-codec", "pack-format.test": "protocol-codec",
  "format-adapter.test": "protocol-codec",
  // state-lifecycle
  "migration.test": "state-lifecycle", "migrate-address.test": "state-lifecycle",
  "version-lifecycle.test": "state-lifecycle", "entry-metadata-store.test": "state-lifecycle",
  "sql-entry-flag-store.test": "state-lifecycle", "memory-store.test": "state-lifecycle",
  "sql-store.test": "state-lifecycle", "address-protocol-manager.test": "state-lifecycle",
  "lifecycle.test": "state-lifecycle", "activation-gate.test": "state-lifecycle",
  // query-resolve
  "cross-index-query.test": "query-resolve", "gate-aware-query.test": "query-resolve",
  "version-query.test": "query-resolve", "address-resolver.test": "query-resolve",
  "meta-resolver.test": "query-resolve", "address-range-cache.test": "query-resolve",
  // schema-validate
  "schema.test": "schema-validate", "category-rules.test": "schema-validate",
  "validate-entry.test": "schema-validate", "compile-schema.test": "schema-validate",
  "spec-loader.test": "schema-validate", "table-def.test": "schema-validate",
  // convergence-analysis
  "convergence.test": "convergence-analysis", "deployment-skew.test": "convergence-analysis",
  "capacity-optimizer.test": "convergence-analysis", "category-filter.test": "convergence-analysis",
  "pipeline-e2e.test": "convergence-analysis", "observation-lifecycle.test": "convergence-analysis",
  "ref-entries-sync.test": "convergence-analysis",
  // dkg-graph
  "dkg.test": "dkg-graph", "dkg-sqlite-store.test": "dkg-graph",
  "claim-operation.test": "dkg-graph", "record-operation.test": "dkg-graph",
  "skills-suite.test": "dkg-graph", "trace-demo.test": "dkg-graph",
  "service-explorer.test": "dkg-graph", "doc-sync.test": "dkg-graph",
  "semantic-ref.test": "dkg-graph", "converge-chain.test": "dkg-graph",
  "converge-review.test": "dkg-graph",
  // integration
  "self-evaluation.test": "integration", "lifecycle-e2e.test": "integration",
  "cli-query.test": "integration", "operational-loop.test": "integration",
  "dsl-e2e.test": "integration", "shopping-flow.test": "integration",
  "demo-run.test": "integration", "scenarios.test": "integration",
};

/** E2E 시나리오 → qa_module 매핑 */
const E2E_SCENARIOS = [
  "shopping-flow", "event-pipeline", "iframe-integration",
  "scenario-selector", "shop-ingest-integration",
] as const;

interface SelfCheckResult {
  pkg: string;
  kind: "build" | "test";
  result: string;
  /** qa_module 값 (E2E 시나리오명 또는 "_all") */
  module?: string;
  tests?: number;
  passed?: number;
  failed?: number;
  durationMs?: number;
}

/**
 * dkg self-check — 빌드/테스트 실행 + 좌표 인코딩 + convergence 분석 + invariant 검증.
 *
 * 기본(dry-run): 분석 결과를 출력만. DKG 상태 변경 없음.
 * --apply: snapshot 저장 + observation 생성/해소를 수행.
 *
 * DEC-CAPACITY-dsl-dev-mmzyw4go: CLI는 데이터 공급/탐색 인터페이스.
 */
export function dkgSelfCheck(opts: { apply?: boolean } = {}): void {
  const apply = opts.apply ?? false;
  const graph = getGraph();
  const store = apply ? getStore() : null;

  const now = new Date().toISOString();
  const runId = `self-check-${Date.now()}`;
  const results: SelfCheckResult[] = [];
  const cwd = process.env.HOME ? join(process.env.HOME, "workflow/qa-sdk") : ".";

  console.log(`\n══ Self-Check${apply ? " (--apply)" : ""} ══`);
  console.log(`  run: ${runId}\n`);

  // ════════════════════════════════════════════════════════════
  //  Step 1: 빌드/테스트 실행
  // ════════════════════════════════════════════════════════════

  console.log(`  ── Build ──`);
  for (const pkg of SELF_CHECK_PKGS) {
    if (!pkg.hasBuild) {
      results.push({ pkg: pkg.name, kind: "build", module: "_all", result: "skipped", durationMs: 0 });
      console.log(`    ⏭ ${pkg.name.padEnd(20)} (no build script)`);
      continue;
    }
    const t0 = Date.now();
    let result: string;
    try {
      execSync(`pnpm --filter ${pkg.filter} build`, { cwd, stdio: "pipe", timeout: 60000 });
      result = "success";
    } catch (err: any) {
      const stderr = (err.stderr?.toString() ?? "") + (err.stdout?.toString() ?? "");
      result = stderr.includes("TS") ? "type-error" : "failure";
    }
    const dur = Date.now() - t0;
    results.push({ pkg: pkg.name, kind: "build", module: "_all", result, durationMs: dur });
    const icon = result === "success" ? "✅" : result === "type-error" ? "🔴" : "⚠";
    console.log(`    ${icon} ${pkg.name.padEnd(20)} ${result} (${dur}ms)`);
  }

  console.log(`\n  ── Test ──`);
  const fileContracts: Array<{ pkg: string; surface: string; result: string }> = [];
  for (const pkg of SELF_CHECK_PKGS) {
    if (!pkg.hasTest) {
      console.log(`    ⏭ ${pkg.name.padEnd(20)} (no tests)`);
      continue;
    }

    // E2E 패키지: 시나리오별로 분리 실행
    if (pkg.name === "e2e") {
      console.log(`    📋 ${pkg.name.padEnd(20)} (시나리오별 실행)`);
      for (const scenario of E2E_SCENARIOS) {
        const t0 = Date.now();
        let result: string;
        let tests = 0, passed = 0, failed = 0;
        try {
          const output = execSync(
            `pnpm --filter ${pkg.filter} exec playwright test tests/${scenario}.spec.ts 2>&1`,
            { cwd, stdio: "pipe", timeout: 180000 },
          ).toString();
          const passedMatch = output.match(/(\d+)\s+passed/);
          const failedMatch = output.match(/(\d+)\s+failed/);
          passed = passedMatch ? parseInt(passedMatch[1]) : 0;
          failed = failedMatch ? parseInt(failedMatch[1]) : 0;
          tests = passed + failed;
          result = failed > 0 ? "failed" : passed > 0 ? "passed" : "skipped";
        } catch {
          result = "error";
        }
        const dur = Date.now() - t0;
        results.push({ pkg: pkg.name, kind: "test", module: scenario, result, tests, passed, failed, durationMs: dur });
        const icon = result === "passed" ? "✅" : result === "failed" ? "⚠" : "🔴";
        const detail = result === "error" ? "실행 실패" : `${passed}/${tests} (${dur}ms)`;
        console.log(`      ${icon} ${scenario.padEnd(28)} ${result} ${detail}`);
      }
      continue;
    }

    const t0 = Date.now();
    let result: string;
    let tests = 0, passed = 0, failed = 0;
    let output = "";
    try {
      output = execSync(`pnpm --filter ${pkg.filter} test 2>&1`, { cwd, stdio: "pipe", timeout: 120000 }).toString();
      const testsMatch = output.match(/Tests\s+(\d+)\s+passed/);
      const altPassMatch = output.match(/(\d+)\s+passed\s+\((\d+)\)/);
      const failMatch = output.match(/(\d+)\s+failed/);
      passed = testsMatch ? parseInt(testsMatch[1])
        : altPassMatch ? parseInt(altPassMatch[1])
        : parseInt(output.match(/(\d+) passed/)?.[1] ?? "0");
      failed = failMatch ? parseInt(failMatch[1]) : 0;
      tests = passed + failed;
      result = failed > 0 ? "failed" : "passed";
    } catch {
      result = "error";
    }
    const dur = Date.now() - t0;
    results.push({ pkg: pkg.name, kind: "test", module: "_all", result, tests, passed, failed, durationMs: dur });
    const icon = result === "passed" ? "✅" : result === "failed" ? "⚠" : "🔴";
    const detail = result === "error" ? "실행 실패" : `${passed}/${tests} (${dur}ms)`;
    console.log(`    ${icon} ${pkg.name.padEnd(20)} ${result} ${detail}`);

    // 파일별 결과 파싱 → contract_check 기록
    // vitest 출력: " ✓ src/path/file.test.ts  (N tests) Xms" 또는 " × src/path/file.test.ts"
    if (output) {
      const fileLines = output.split("\n").filter(l => l.match(/[✓×✗]\s+\S+\.test\.ts/));
      for (const line of fileLines) {
        const fileMatch = line.match(/([✓×✗])\s+\S*?(\w[\w-]*?)\.test\.ts/);
        if (!fileMatch) continue;
        const fileStatus = fileMatch[1] === "✓" ? "passed" : "failed";
        const fileName = fileMatch[2];
        const surface = FILE_TO_SURFACE[`${fileName}.test`];
        if (surface) {
          fileContracts.push({ pkg: pkg.name, surface, result: fileStatus });
        }
      }
    }
  }

  // ════════════════════════════════════════════════════════════
  //  Phase A: AddressContextRecord 생성 → aggregateUsageData
  // ════════════════════════════════════════════════════════════

  console.log(`\n  ── Phase A: aggregate ──`);
  const records: AddressContextRecord[] = [];

  for (const r of results) {
    const prefixId = r.kind === "build" ? "build_event" : "test_event";
    const resultAxis = r.kind === "build" ? "build_result" : "test_result";
    const qaModule = r.module ?? "_all";
    try {
      const address = encodePrefixByValue(DEMO_CATALOG, prefixId, "v2", {
        qa_pkg: r.pkg,
        qa_module: qaModule,
        [resultAxis]: r.result,
      });
      records.push({
        address_context: { [prefixId]: `${prefixId}:v2:${address}` },
        timestamp: now,
        session_id: runId,
        event_key: `${r.kind}:${r.pkg}:${qaModule}`,
        execution_mode: "live" as const,
        execution_id: runId,
      });
    } catch {
      // entry가 카탈로그에 없으면 건너뜀 (예: type-error는 build_result에 있음)
    }
  }

  // contract_check records (파일별 인터페이스 계약)
  for (const c of fileContracts) {
    try {
      const address = encodePrefixByValue(DEMO_CATALOG, "contract_check", "v1", {
        qa_pkg: c.pkg,
        api_surface: c.surface,
        test_result: c.result,
      });
      records.push({
        address_context: { contract_check: `contract_check:v1:${address}` },
        timestamp: now,
        session_id: runId,
        event_key: `contract:${c.pkg}:${c.surface}`,
        execution_mode: "live" as const,
        execution_id: runId,
      });
    } catch {
      // qa_pkg v2에 없는 패키지 등은 건너뜀
    }
  }

  const usage = aggregateUsageData(DEMO_CATALOG, records);
  console.log(`    records: ${records.length}건 (build/test ${results.length} + contract ${fileContracts.length})`);
  console.log(`    entryUsage: ${usage.entryUsages.length}, addressUsage: ${usage.addressUsages.length}`);

  // ════════════════════════════════════════════════════════════
  //  Phase B: convergence 분석
  // ════════════════════════════════════════════════════════════

  console.log(`\n  ── Phase B: convergence ──`);

  // B-1: collection health
  const health = analyzeCollectionHealth(DEMO_CATALOG, records);
  const healthIcon = health.healthRate >= 0.9 ? "✅" : health.healthRate >= 0.5 ? "⚠" : "🔴";
  console.log(`    ${healthIcon} 건전성: ${health.summary}`);

  // B-2: entry coverage
  const coverage = analyzeEntryCoverage(DEMO_CATALOG, usage.entryUsages, usage.addressUsages);
  const buildCov = coverage.prefixes.find(p => p.prefixId === "build_event");
  const testCov = coverage.prefixes.find(p => p.prefixId === "test_event");
  if (buildCov) console.log(`    build_event: ${buildCov.summary}`);
  if (testCov) console.log(`    test_event:  ${testCov.summary}`);
  console.log(`    전체: ${coverage.summary}`);

  // B-3: metrics with usage data
  const metrics = collectMetrics(DEMO_CATALOG, graph, usage);
  const metricIssues = metrics.filter(m => m.status !== "ok");
  console.log(`    metrics: ${metrics.length}건, ${metricIssues.length} issues`);

  // B-4: schema health (metric에 포함되지만 명시 출력)
  const schemaMetric = metrics.find(m => m.id === "metric:schema:violations");
  if (schemaMetric) {
    const sIcon = schemaMetric.status === "ok" ? "✅" : "⚠";
    console.log(`    ${sIcon} schema: ${schemaMetric.detail}`);
  }

  // ════════════════════════════════════════════════════════════
  //  Phase C: 관측 자동 해소
  // ════════════════════════════════════════════════════════════

  // ── observation 해소/생성 후보 탐색 (읽기 전용) ──
  const existingObs = graph.getNodesByKind("observation") as any[];
  const resolveTargets: Array<{ obs: any; reason: string }> = [];

  for (const obs of existingObs.filter(o => o.id.startsWith("OBS-SELF-BUILD-") && !o.resolution)) {
    const prevFailed = (obs.subjects as string[]) ?? [];
    const stillFailing = prevFailed.filter(pkg => results.some(r => r.kind === "build" && r.pkg === pkg && r.result !== "success" && r.result !== "skipped"));
    if (stillFailing.length === 0 && prevFailed.length > 0) resolveTargets.push({ obs, reason: `${prevFailed.join(",")}: 성공` });
  }
  for (const obs of existingObs.filter(o => o.id.startsWith("OBS-SELF-TEST-") && !o.resolution)) {
    const prevFailed = (obs.subjects as string[]) ?? [];
    const stillFailing = prevFailed.filter(pkg => results.some(r => r.kind === "test" && r.pkg === pkg && r.result !== "passed"));
    if (stillFailing.length === 0 && prevFailed.length > 0) resolveTargets.push({ obs, reason: "전부 통과" });
  }
  for (const obs of existingObs.filter(o => o.id.startsWith("OBS-SELF-METRIC-") && !o.resolution)) {
    if (metricIssues.filter(m => m.status === "critical").length === 0) resolveTargets.push({ obs, reason: "critical 해소" });
  }

  // ════════════════════════════════════════════════════════════
  //  Phase D: DSL 불변조건 검증
  // ════════════════════════════════════════════════════════════

  console.log(`\n  ── Phase D: invariant ──`);
  const invariantViolations: string[] = [];

  // dsl-dev 불변조건 1: "빌드 실패 후 테스트 금지" (skipped 제외)
  for (const r of results) {
    if (r.kind !== "build" || r.result === "success" || r.result === "skipped") continue;
    // 이 패키지에 테스트가 실행됐는가?
    const testRan = results.find(t => t.kind === "test" && t.pkg === r.pkg);
    if (testRan) {
      invariantViolations.push(`${r.pkg}: 빌드 ${r.result}인데 테스트 실행됨 (${testRan.result})`);
    }
  }

  // dsl-dev 불변조건 2: "테스트 실패 시 해당 패키지의 빌드 성공이 선행" (hasBuild=false 제외)
  for (const r of results) {
    if (r.kind !== "test" || r.result === "passed") continue;
    const pkgDef = SELF_CHECK_PKGS.find(p => p.name === r.pkg);
    if (!pkgDef?.hasBuild) continue; // 빌드 스크립트 없는 패키지는 제외
    const buildResult = results.find(b => b.kind === "build" && b.pkg === r.pkg);
    if (!buildResult || buildResult.result !== "success") {
      invariantViolations.push(`${r.pkg}: 테스트 ${r.result}인데 빌드 성공이 선행되지 않음`);
    }
  }

  const newObsCandidates: Array<{ id: string; finding: string; subjects: string[] }> = [];

  if (invariantViolations.length > 0) {
    console.log(`    🔴 dsl-dev invariant 위반 ${invariantViolations.length}건:`);
    for (const v of invariantViolations) console.log(`      ${v}`);
    if (!existingObs.some(o => o.id.startsWith("OBS-SELF-INVARIANT-") && !o.resolution)) {
      newObsCandidates.push({ id: `OBS-SELF-INVARIANT-${runId}`, finding: `dsl-dev invariant 위반: ${invariantViolations.join("; ")}`, subjects: ["dsl-dev"] });
    }
  } else {
    console.log(`    ✅ dsl-dev 불변조건 통과`);
  }

  // ════════════════════════════════════════════════════════════
  //  저장 + 새 Observation 생성
  // ════════════════════════════════════════════════════════════

  // 빌드/테스트 실패 observation 후보
  const failedBuilds = results.filter(r => r.kind === "build" && r.result !== "success" && r.result !== "skipped");
  if (failedBuilds.length > 0 && !existingObs.some(o => o.id.startsWith("OBS-SELF-BUILD-") && !o.resolution)) {
    newObsCandidates.push({ id: `OBS-SELF-BUILD-${runId}`, finding: `빌드 실패 ${failedBuilds.length}건: ${failedBuilds.map(r => `${r.pkg}(${r.result})`).join(", ")}`, subjects: failedBuilds.map(r => r.pkg) });
  }
  const failedTests = results.filter(r => r.kind === "test" && r.result !== "passed");
  if (failedTests.length > 0 && !existingObs.some(o => o.id.startsWith("OBS-SELF-TEST-") && !o.resolution)) {
    newObsCandidates.push({ id: `OBS-SELF-TEST-${runId}`, finding: `테스트 실패 ${failedTests.length}건: ${failedTests.map(r => `${r.pkg}(${r.result})`).join(", ")}`, subjects: failedTests.map(r => r.pkg) });
  }

  // ════════════════════════════════════════════════════════════
  //  --apply: DKG 상태 변경 (옵트인)
  // ════════════════════════════════════════════════════════════

  if (apply && store) {
    console.log(`\n  ── Apply ──`);
    const snapshotId = store.saveUsageSnapshot(usage);
    console.log(`    snapshot #${snapshotId} 저장`);

    for (const { obs, reason } of resolveTargets) {
      const resolved = { ...obs, resolution: { decisionId: "auto", outcome: "accepted", note: `${runId}: ${reason}` } };
      store.saveNodes([resolved], [], "auto");
      graph.replaceNode(resolved);
      console.log(`    resolved: ${obs.id} (${reason})`);
    }
    for (const cand of newObsCandidates) {
      const obs = { kind: "observation" as const, id: cand.id, date: now.slice(0, 10), source: "metric" as const, intent: "action-needed" as const, subjects: cand.subjects, finding: cand.finding };
      store.saveNodes([obs as any], [{ type: "observes", from: obs.id, to: cand.subjects[0] ?? "build_event" }], "auto");
      console.log(`    created: ${cand.id}`);
    }
  } else if (resolveTargets.length > 0 || newObsCandidates.length > 0) {
    console.log(`\n  ── Pending (--apply로 반영) ──`);
    for (const { obs, reason } of resolveTargets) console.log(`    해소 후보: ${obs.id} (${reason})`);
    for (const cand of newObsCandidates) console.log(`    생성 후보: ${cand.id}: ${cand.finding}`);
  }

  // ════════════════════════════════════════════════════════════
  //  종합
  // ════════════════════════════════════════════════════════════

  const buildSummary = { success: 0, failure: 0, skipped: 0, total: 0 };
  const testSummary = { passed: 0, failed: 0, tests: 0, total: 0 };
  for (const r of results) {
    if (r.kind === "build") {
      buildSummary.total++;
      if (r.result === "success") buildSummary.success++;
      else if (r.result === "skipped") buildSummary.skipped++;
      else buildSummary.failure++;
    } else {
      testSummary.total++;
      testSummary.tests += r.tests ?? 0;
      testSummary.passed += r.passed ?? 0;
      testSummary.failed += r.failed ?? 0;
    }
  }

  const buildCount = buildSummary.total - buildSummary.skipped;
  console.log(`\n  ── 종합 ──`);
  console.log(`  build:      ${buildSummary.success}/${buildCount} success${buildSummary.failure > 0 ? ` (${buildSummary.failure} failed)` : ""}${buildSummary.skipped > 0 ? ` (${buildSummary.skipped} skipped)` : ""}`);
  console.log(`  test:       ${testSummary.passed}/${testSummary.tests} passed${testSummary.failed > 0 ? ` (${testSummary.failed} failed)` : ""}`);
  console.log(`  coverage:   build_event ${buildCov ? Math.round(buildCov.coverageRate * 100) : "?"}%, test_event ${testCov ? Math.round(testCov.coverageRate * 100) : "?"}%`);
  console.log(`  health:     건전성 ${Math.round(health.healthRate * 100)}%`);
  console.log(`  invariant:  ${invariantViolations.length === 0 ? "통과" : `${invariantViolations.length}건 위반`}`);

  // contract 요약
  if (fileContracts.length > 0) {
    const bySurface = new Map<string, { passed: number; failed: number }>();
    for (const c of fileContracts) {
      const s = bySurface.get(c.surface) ?? { passed: 0, failed: 0 };
      if (c.result === "passed") s.passed++; else s.failed++;
      bySurface.set(c.surface, s);
    }
    const failedSurfaces = [...bySurface.entries()].filter(([, s]) => s.failed > 0);
    console.log(`  contracts:  ${fileContracts.length}건 (${bySurface.size} surfaces)${failedSurfaces.length > 0 ? ` — ${failedSurfaces.map(([k, v]) => `${k}:${v.failed}F`).join(", ")}` : ""}`);
  }
  // cli_event 커버리지 + dormant 명령 감지
  const cliCov = analyzeCliCoverage();
  const dormantList = cliCov.dormantCoords.slice(0, 5);
  console.log(`  cli_event:  ${Math.round(cliCov.coverageRate * 100)}% (${cliCov.observedCoords}/${cliCov.totalCoords} 좌표, ${Object.keys(CLI_COMMAND_MAP).length}개 명령)`);
  if (dormantList.length > 0) {
    console.log(`  dormant:    ${cliCov.dormantCoords.length}개 미사용 좌표`);
    for (const d of dormantList) {
      console.log(`    ${d.coord.padEnd(35)} → ${d.commands.join(", ")}`);
    }
    if (cliCov.dormantCoords.length > 5) console.log(`    ... +${cliCov.dormantCoords.length - 5}개`);
  }

  if (!apply && (resolveTargets.length > 0 || newObsCandidates.length > 0)) {
    console.log(`  pending:    ${resolveTargets.length} resolve, ${newObsCandidates.length} new obs (--apply로 반영)`);
  }

  const hasProblem = buildSummary.failure > 0 || testSummary.failed > 0 || invariantViolations.length > 0;
  console.log(hasProblem ? `\n  ⚠ 문제 감지` : `\n  ✅ 전체 정상`);
}

function findArg(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx >= 0 ? args[idx + 1] : undefined;
}

// ── helpers ─────────────────────────────────────────

function buildEntriesMap(catalog?: any): Map<string, readonly string[]> {
  const cat = catalog ?? DEMO_CATALOG;
  const map = new Map<string, readonly string[]>();
  for (const [id, axis] of Object.entries((cat as any).axes) as [string, any][]) {
    const versions = Object.keys(axis.versions);
    const latestKey = versions[versions.length - 1];
    const latest = axis.versions[latestKey];
    if (latest && "entries" in latest) {
      map.set(id, [...(latest as any).entries]);
    }
  }
  return map;
}

// ═══════════════════════════════════════════════════════════════
// dkg add-entry — 축 entry 추가 (check → mutate → record)
// ═══════════════════════════════════════════════════════════════

/**
 * 축에 entry를 추가한다.
 *
 * --dry-run: 검사 + 변이 계산만, 그래프/스토어 반영 안 함 (기본)
 * --apply:   실제 반영 (DKG 그래프 + SQLite 저장)
 */
export function dkgAddEntry(opts: {
  axisId: string;
  entry: string;
  apply?: boolean;
  expandCapacity?: boolean;
}): void {
  const graph = getGraph();
  const catalog = registry.has(activeCatalogId)
    ? registry.getCatalog(activeCatalogId)
    : DEMO_CATALOG;
  const dryRun = !(opts.apply ?? false);
  const store = dryRun ? undefined : getStore();

  const flags = [
    dryRun ? "dry-run" : "apply",
    opts.expandCapacity ? "expand-capacity" : "",
  ].filter(Boolean).join(", ");

  console.log(`\n══ Add Entry: ${opts.entry} → ${opts.axisId} (${flags}) ══`);

  try {
    const result = executeEntryAdd(catalog as any, graph, opts.axisId, opts.entry, {
      dryRun,
      expandCapacity: opts.expandCapacity,
      store,
    });

    // ── 검사 결과 ──
    const { check, mutation, versionEvent, capacityExpanded, warnings } = result;
    const icon = check.verdict === "safe" ? "✅" : "⚠";
    console.log(`\n  ${icon} verdict: ${check.verdict}`);
    console.log(`  headroom: ${check.headroom.remaining}/${check.headroom.capacity} → ${check.headroom.remaining - 1}/${check.headroom.capacity}`);

    if (capacityExpanded && mutation.capacityChange) {
      console.log(`  ⚠ capacity 확장: ${mutation.capacityChange.from} → ${mutation.capacityChange.to} (stride-break)`);
    }

    // ── 축 버전 ──
    console.log(`\n  ── 축 버전 ──`);
    console.log(`  ${opts.axisId}: ${mutation.oldVersion} → ${mutation.newVersion}`);
    console.log(`  entries: +${opts.entry} (append-only, position ${check.headroom.current})`);

    // ── 영향 prefix ──
    if (mutation.affectedPrefixes.length > 0) {
      console.log(`\n  ── 영향 prefix (${mutation.affectedPrefixes.length}개) ──`);
      for (const pv of mutation.updatedPrefixVersions) {
        console.log(`    ${pv.prefixId}: ${pv.oldVersion} → ${pv.newVersion}`);
      }
    }

    // ── VersionEvent ──
    console.log(`\n  ── VersionEvent ──`);
    console.log(`  id: ${versionEvent.id}`);
    console.log(`  ${versionEvent.fromVersion} → ${versionEvent.toVersion}`);
    for (const ch of versionEvent.changes) {
      console.log(`    [${ch.kind}] ${ch.detail}`);
    }
    console.log(`  impact: ${versionEvent.impact}`);

    // ── 경고 ──
    if (warnings.length > 0) {
      console.log(`\n  ── 경고 (${warnings.length}건) ──`);
      for (const w of warnings) {
        console.log(`    ${w}`);
      }
    }

    // ── 저장 상태 ──
    if (result.graphUpdated) {
      const saved = store!.saveGraph(graph);
      console.log(`\n  ✅ 저장 완료 (${saved.nodesWritten} nodes, ${saved.edgesWritten} edges)`);
    } else {
      console.log(`\n  ℹ dry-run — --apply 플래그로 실제 반영`);
    }
  } catch (error) {
    if (error instanceof EntryAddError) {
      console.log(`\n  ✗ ${error.verdict}: ${error.message}`);
    } else {
      console.error(`\n  ✗ ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
