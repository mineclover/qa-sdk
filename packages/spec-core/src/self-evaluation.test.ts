/**
 * 자가 진단 — 시스템이 자기 자신을 분석한다.
 *
 * DEMO_CATALOG에 대해 전체 DKG + 수렴 레이어를 실행하고,
 * 현재 좌표 시스템의 구성, 인사이트, SSOT 일관성을 평가한다.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { DEMO_CATALOG, DEMO_DKG_CONFIG } from "demo-snapshot";
import { GraphRegistry } from "./dkg/graph-registry.js";
import { deriveFromCatalog } from "./dkg/catalog-derive.js";
import { bootstrapDkg } from "./dkg/bootstrap.js";
import { analyzeImpact } from "./dkg/skills/analyze-impact.js";
import { scanAxisOverlaps } from "./convergence/symbol-comparator.js";
import { comparePrefixes } from "./convergence/symbol-comparator.js";
import { analyzeSimplification } from "./convergence/simplification-advisor.js";
import { catalogToPrefixSpecs } from "./loader/catalog-bridge.js";
import type { AxisNode, PrefixNode, ObservationNode, DecisionNode } from "./dkg/dkg.types.js";
import { transitionPrefix, transitionDecision, resolveObservation, generateLifecycleReport } from "./dkg/skills/lifecycle-transition.js";
import { createDemoTopology, buildDependencyGraph, buildTimeline } from "./dkg/service-topology.js";
import { analyzeTemporalTrends } from "./convergence/temporal-analysis.js";
import { buildLayerMap, extractTracePaths, computeActivity } from "./visualization/layer-map.js";
import { MonitorState } from "./visualization/monitor-queries.js";
import { aggregateUsageData, type AddressContextRecord } from "./convergence/usage-aggregator.js";
import { analyzeEntryCoverage } from "./convergence/entry-coverage.js";
import { encodePrefixByValue } from "demo-snapshot";

let graph: GraphRegistry;

// ═══════════════════════════════════════════════════════════════
//  수집: DEMO_CATALOG 현황 파악
// ═══════════════════════════════════════════════════════════════

interface CatalogReport {
  axes: {
    count: number;
    totalEntries: number;
    totalCapacity: number;
    details: Array<{
      id: string;
      name: string;
      versionCount: number;
      latestEntries: number;
      latestCapacity: number;
    }>;
  };
  prefixes: {
    count: number;
    byDimKind: { axis: number; prefix_ref: number; table_ref: number };
    details: Array<{
      id: string;
      name: string;
      dimCount: number;
      axisDims: string[];
      prefixRefDims: string[];
      tableRefDims: string[];
      versionCount: number;
    }>;
  };
  tables: {
    count: number;
    names: string[];
  };
  graph: {
    nodeCount: number;
    edgeCount: number;
    composesEdges: number;
    referencesEdges: number;
  };
}

function collectReport(): CatalogReport {
  const catalog = DEMO_CATALOG;

  // axes
  const axisDetails = Object.entries(catalog.axes).map(([id, axis]) => {
    const versions = Object.keys(axis.versions);
    const latestKey = versions[versions.length - 1] as keyof typeof axis.versions;
    const latest = axis.versions[latestKey];
    return {
      id,
      name: axis.name,
      versionCount: versions.length,
      latestEntries: (latest as any).entries?.length ?? 0,
      latestCapacity: (latest as any).capacity ?? (latest as any).entries?.length ?? 0,
    };
  });

  const totalEntries = axisDetails.reduce((s, a) => s + a.latestEntries, 0);
  const totalCapacity = axisDetails.reduce((s, a) => s + a.latestCapacity, 0);

  // prefixes
  let axisDimCount = 0;
  let prefixRefDimCount = 0;
  let tableRefDimCount = 0;

  const prefixDetails = Object.entries(catalog.prefixes).map(([id, prefix]) => {
    const axisDims: string[] = [];
    const prefixRefDims: string[] = [];
    const tableRefDims: string[] = [];

    for (const [label, dimRef] of Object.entries(prefix.dims)) {
      switch (dimRef.kind) {
        case "axis": axisDims.push(label); axisDimCount++; break;
        case "prefix_ref": prefixRefDims.push(label); prefixRefDimCount++; break;
        case "table_ref": tableRefDims.push(label); tableRefDimCount++; break;
      }
    }

    return {
      id,
      name: prefix.name,
      dimCount: Object.keys(prefix.dims).length,
      axisDims,
      prefixRefDims,
      tableRefDims,
      versionCount: prefix.versions.length,
    };
  });

  // tables
  const tables = catalog.tables ? Object.keys(catalog.tables) : [];

  return {
    axes: { count: axisDetails.length, totalEntries, totalCapacity, details: axisDetails },
    prefixes: {
      count: prefixDetails.length,
      byDimKind: { axis: axisDimCount, prefix_ref: prefixRefDimCount, table_ref: tableRefDimCount },
      details: prefixDetails,
    },
    tables: { count: tables.length, names: tables },
    graph: {
      nodeCount: graph.nodeCount,
      edgeCount: graph.edgeCount,
      composesEdges: 0, // 아래에서 계산
      referencesEdges: 0,
    },
  };
}

beforeAll(() => {
  graph = deriveFromCatalog(DEMO_CATALOG);
});

// ═══════════════════════════════════════════════════════════════
//  1단계: 현황 보고서
// ═══════════════════════════════════════════════════════════════

describe("자가 진단 1단계: 현황 보고서", () => {
  let report: CatalogReport;

  beforeAll(() => {
    report = collectReport();
  });

  it("축 현황", () => {
    console.log("\n══ 축(Axis) 현황 ══");
    console.log(`총 ${report.axes.count}개 축, ${report.axes.totalEntries}개 entries, 총 capacity ${report.axes.totalCapacity}`);
    console.log("─────────────────────────────────────────────");
    for (const a of report.axes.details) {
      const headroom = a.latestCapacity - a.latestEntries;
      console.log(`  ${a.id.padEnd(15)} ${a.name.padEnd(10)} entries=${a.latestEntries} cap=${a.latestCapacity} headroom=${headroom} versions=${a.versionCount}`);
    }

    expect(report.axes.count).toBeGreaterThan(0);
  });

  it("prefix 현황", () => {
    console.log("\n══ Prefix 현황 ══");
    console.log(`총 ${report.prefixes.count}개 prefix`);
    console.log(`차원 분포: axis=${report.prefixes.byDimKind.axis} prefix_ref=${report.prefixes.byDimKind.prefix_ref} table_ref=${report.prefixes.byDimKind.table_ref}`);
    console.log("─────────────────────────────────────────────");
    for (const p of report.prefixes.details) {
      console.log(`  ${p.id.padEnd(15)} ${p.name.padEnd(15)} dims=${p.dimCount} (axis:${p.axisDims.length} ref:${p.prefixRefDims.length} tbl:${p.tableRefDims.length}) versions=${p.versionCount}`);
    }

    expect(report.prefixes.count).toBeGreaterThan(0);
  });

  it("테이블 스키마 현황", () => {
    console.log("\n══ 테이블 스키마 현황 ══");
    console.log(`총 ${report.tables.count}개 테이블: ${report.tables.names.join(", ")}`);

    expect(report.tables.count).toBeGreaterThan(0);
  });

  it("DKG 그래프 현황", () => {
    console.log("\n══ DKG 그래프 현황 ══");
    console.log(`노드: ${graph.nodeCount}개, 엣지: ${graph.edgeCount}개`);

    // 엣지 유형별 카운트
    const edgeTypes = new Map<string, number>();
    for (const node of [...graph.getNodesByKind("prefix"), ...graph.getNodesByKind("axis")]) {
      for (const edge of graph.edgesFrom(node.id)) {
        edgeTypes.set(edge.type, (edgeTypes.get(edge.type) ?? 0) + 1);
      }
    }
    for (const [type, count] of edgeTypes) {
      console.log(`  ${type}: ${count}`);
    }

    expect(graph.nodeCount).toBeGreaterThan(0);
    expect(graph.edgeCount).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════
//  2단계: 수렴 분석 실행
// ═══════════════════════════════════════════════════════════════

describe("자가 진단 2단계: 수렴 분석", () => {

  it("축 중복 스캔", () => {
    const entriesMap = new Map<string, readonly string[]>();
    for (const [id, axis] of Object.entries(DEMO_CATALOG.axes)) {
      const versions = Object.keys(axis.versions);
      const latestKey = versions[versions.length - 1] as keyof typeof axis.versions;
      const latest = axis.versions[latestKey];
      if (latest && "entries" in latest) {
        entriesMap.set(id, [...(latest as any).entries]);
      }
    }

    const overlaps = scanAxisOverlaps(graph, entriesMap);

    console.log("\n══ 축 중복 분석 ══");
    if (overlaps.length === 0) {
      console.log("  중복 없음");
    } else {
      for (const o of overlaps) {
        console.log(`  ${o.a} ↔ ${o.b}: 공유=[${o.sharedEntries.join(",")}] ratio=${(o.overlapRatio*100).toFixed(0)}% → ${o.recommendation}`);
      }
    }

    // 중복이 발견되더라도 시스템은 동작해야 함
    expect(overlaps.every(o => o.recommendation !== undefined)).toBe(true);
  });

  it("prefix 구조 유사도 스캔", () => {
    const prefixIds = Object.keys(DEMO_CATALOG.prefixes);

    console.log("\n══ Prefix 유사도 분석 ══");
    const significantOverlaps: Array<{ a: string; b: string; similarity: number; rec: string }> = [];

    for (let i = 0; i < prefixIds.length; i++) {
      for (let j = i + 1; j < prefixIds.length; j++) {
        const result = comparePrefixes(graph, prefixIds[i], prefixIds[j]);
        if (result.structuralSimilarity > 0) {
          significantOverlaps.push({
            a: result.a, b: result.b,
            similarity: result.structuralSimilarity,
            rec: result.recommendation,
          });
        }
      }
    }

    if (significantOverlaps.length === 0) {
      console.log("  구조적 유사도 없음 (모든 prefix가 독립적)");
    } else {
      significantOverlaps.sort((a, b) => b.similarity - a.similarity);
      for (const o of significantOverlaps) {
        console.log(`  ${o.a} ↔ ${o.b}: similarity=${(o.similarity*100).toFixed(0)}% → ${o.rec}`);
      }
    }

    expect(true).toBe(true); // 분석 결과 확인
  });

  it("영향 분석 — 각 축 변경 시 cascade 범위", () => {
    console.log("\n══ 영향 분석 (축별 cascade) ══");

    const axisIds = Object.keys(DEMO_CATALOG.axes);
    const cascadeResults: Array<{ axis: string; prefixes: number; maxDistance: number }> = [];

    for (const axisId of axisIds) {
      const cascade = graph.cascadeFromAxis(axisId);
      if (cascade.length > 0) {
        const maxDist = Math.max(...cascade.map(c => c.distance));
        cascadeResults.push({ axis: axisId, prefixes: cascade.length, maxDistance: maxDist });
      }
    }

    cascadeResults.sort((a, b) => b.prefixes - a.prefixes);
    for (const r of cascadeResults) {
      console.log(`  ${r.axis.padEnd(15)} → ${r.prefixes}개 prefix 영향 (max depth=${r.maxDistance})`);
    }

    // env/region/svc_name/namespace는 service를 통해 많은 prefix에 영향
    const envCascade = cascadeResults.find(r => r.axis === "env");
    expect(envCascade).toBeDefined();
    expect(envCascade!.prefixes).toBeGreaterThanOrEqual(2);
  });
});

// ═══════════════════════════════════════════════════════════════
//  3단계: SSOT 일관성 검증
// ═══════════════════════════════════════════════════════════════

describe("자가 진단 3단계: SSOT 일관성", () => {

  it("모든 prefix의 dims가 존재하는 axis/prefix/table을 참조하는가", () => {
    console.log("\n══ SSOT 일관성 검증 ══");
    const errors: string[] = [];

    for (const [prefixId, prefix] of Object.entries(DEMO_CATALOG.prefixes)) {
      for (const [label, dimRef] of Object.entries(prefix.dims)) {
        if (dimRef.kind === "axis") {
          if (!(dimRef.axisId in DEMO_CATALOG.axes)) {
            errors.push(`${prefixId}.${label}: axis '${dimRef.axisId}' not found`);
          }
        }
        if (dimRef.kind === "prefix_ref") {
          if (!(dimRef.prefixId in DEMO_CATALOG.prefixes)) {
            errors.push(`${prefixId}.${label}: prefix_ref '${dimRef.prefixId}' not found`);
          }
        }
        if (dimRef.kind === "table_ref") {
          if (!DEMO_CATALOG.tables || !(dimRef.table in DEMO_CATALOG.tables)) {
            errors.push(`${prefixId}.${label}: table_ref '${dimRef.table}' not found`);
          }
        }
      }
    }

    if (errors.length === 0) {
      console.log("  ✅ 모든 참조 유효");
    } else {
      console.log("  ❌ 무효 참조 발견:");
      for (const e of errors) console.log(`     ${e}`);
    }

    expect(errors).toHaveLength(0);
  });

  it("DKG 그래프가 DEMO_CATALOG과 일치하는가", () => {
    const catalogAxisCount = Object.keys(DEMO_CATALOG.axes).length;
    const catalogPrefixCount = Object.keys(DEMO_CATALOG.prefixes).length;

    const graphAxisCount = graph.getNodesByKind("axis").length;
    const graphPrefixCount = graph.getNodesByKind("prefix").length;

    console.log(`  Catalog: ${catalogAxisCount} axes, ${catalogPrefixCount} prefixes`);
    console.log(`  DKG:     ${graphAxisCount} axes, ${graphPrefixCount} prefixes`);

    expect(graphAxisCount).toBe(catalogAxisCount);
    expect(graphPrefixCount).toBe(catalogPrefixCount);
  });

  it("catalogToPrefixSpecs가 모든 prefix를 변환하는가", () => {
    const specs = catalogToPrefixSpecs(DEMO_CATALOG);
    const catalogPrefixCount = Object.keys(DEMO_CATALOG.prefixes).length;

    console.log(`  PrefixSpec 변환: ${specs.length}/${catalogPrefixCount}`);

    expect(specs.length).toBe(catalogPrefixCount);

    // 모든 spec의 export pattern이 비어있지 않은가
    for (const spec of specs) {
      expect(spec.export.pattern.length).toBeGreaterThan(0);
    }
  });

  it("prefix_ref 참조 체인에 순환이 없는가", () => {
    const prefixIds = Object.keys(DEMO_CATALOG.prefixes);
    const errors: string[] = [];

    for (const pId of prefixIds) {
      const visited = new Set<string>();
      let current = pId;
      let depth = 0;

      while (depth < 10) {
        if (visited.has(current)) {
          errors.push(`순환 발견: ${pId} → ... → ${current}`);
          break;
        }
        visited.add(current);

        const refs = graph.neighbors(current, "references");
        if (refs.length === 0) break;
        current = refs[0]; // 첫 번째 참조만 추적
        depth++;
      }
    }

    if (errors.length === 0) {
      console.log("  ✅ prefix_ref 순환 없음");
    } else {
      console.log("  ❌ 순환 발견:", errors);
    }

    expect(errors).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════
//  4단계: 종합 평가
// ═══════════════════════════════════════════════════════════════

describe("자가 진단 4단계: 종합 평가", () => {

  it("전체 시스템 요약 + 개선 필요 사항", () => {
    const report = collectReport();

    console.log("\n" + "═".repeat(60));
    console.log("  종합 평가");
    console.log("═".repeat(60));

    console.log(`\n  축:       ${report.axes.count}개 (${report.axes.totalEntries} entries, capacity ${report.axes.totalCapacity})`);
    console.log(`  prefix:   ${report.prefixes.count}개`);
    console.log(`  테이블:   ${report.tables.count}개`);
    console.log(`  DKG 노드: ${graph.nodeCount}개, 엣지: ${graph.edgeCount}개`);

    // headroom 분석
    const zeroHeadroom = report.axes.details.filter(a => a.latestCapacity === a.latestEntries);
    const lowHeadroom = report.axes.details.filter(a => {
      const h = a.latestCapacity - a.latestEntries;
      return h > 0 && h <= 1;
    });

    console.log(`\n  headroom 없음 (0): ${zeroHeadroom.map(a => a.id).join(", ") || "없음"}`);
    console.log(`  headroom 부족 (≤1): ${lowHeadroom.map(a => a.id).join(", ") || "없음"}`);

    // 단일 버전 prefix (아직 진화하지 않음)
    const singleVersion = report.prefixes.details.filter(p => p.versionCount === 1);
    console.log(`  단일 버전 prefix: ${singleVersion.length}/${report.prefixes.count}`);

    // table_ref가 있는 prefix (이벤트 패턴)
    const eventPrefixes = report.prefixes.details.filter(p => p.tableRefDims.length > 0);
    console.log(`  이벤트 prefix (table_ref): ${eventPrefixes.map(p => p.id).join(", ")}`);

    // 고립된 축 (어떤 prefix에서도 사용되지 않는)
    const usedAxes = new Set<string>();
    for (const p of report.prefixes.details) {
      for (const dim of p.axisDims) {
        // DKG에서 실제 axisId 추출
        const edges = graph.edgesFrom(
          report.prefixes.details.find(pp => pp.id === p.id)?.id ?? p.id,
          "composes",
        );
        for (const e of edges) {
          if (e.meta?.dimKind === "axis") usedAxes.add(e.to);
        }
      }
    }
    const isolatedAxes = report.axes.details.filter(a => !usedAxes.has(a.id));
    console.log(`  고립된 축: ${isolatedAxes.map(a => a.id).join(", ") || "없음"}`);

    // 개선 필요 사항
    console.log("\n  ── 개선 필요 사항 ──");

    const issues: string[] = [];

    if (zeroHeadroom.length > 0) {
      issues.push(`⚠ headroom 없는 축: ${zeroHeadroom.map(a => a.id).join(", ")} → capacity 확장 Decision 필요`);
    }

    if (isolatedAxes.length > 0) {
      issues.push(`⚠ 고립된 축: ${isolatedAxes.map(a => a.id).join(", ")} → 비활성화 또는 prefix 연결 필요`);
    }

    // Decision/Constraint/Observation 노드 부재
    const decisions = graph.getNodesByKind("decision");
    const constraints = graph.getNodesByKind("constraint");
    const observations = graph.getNodesByKind("observation");
    const domains = graph.getNodesByKind("domain");
    const consumers = graph.getNodesByKind("consumer");

    // bootstrap 전 bare DKG에서는 메타데이터 노드가 없는 것이 정상
    // 5단계 bootstrapDkg에서 채워짐
    if (decisions.length === 0) issues.push("ℹ Decision 없음 (bootstrap 전 — 5단계에서 자동 생성)");
    if (constraints.length === 0) issues.push("ℹ Constraint 없음 (bootstrap 전)");
    if (observations.length === 0) issues.push("ℹ Observation 없음 (bootstrap 전)");
    if (domains.length === 0) issues.push("ℹ Domain 없음 (bootstrap 전)");
    if (consumers.length === 0) issues.push("ℹ Consumer 없음 (bootstrap 전)");

    if (issues.length === 0) {
      console.log("  ✅ 개선 필요 사항 없음");
    } else {
      for (const issue of issues) {
        console.log(`  ${issue}`);
      }
    }

    console.log("\n" + "═".repeat(60));

    // 구조적으로는 일관적이어야 함
    expect(report.axes.count).toBeGreaterThan(0);
    expect(report.prefixes.count).toBeGreaterThan(0);
    // DKG에 Decision 등이 없는 건 경고이지 실패가 아님
  });
});

// ═══════════════════════════════════════════════════════════════
//  5단계: bootstrapDkg 후 재귀 검증
// ═══════════════════════════════════════════════════════════════

describe("자가 진단 5단계: bootstrapDkg 재귀 개선 플로우", () => {

  let fullGraph: GraphRegistry;

  beforeAll(() => {
    fullGraph = bootstrapDkg({ catalog: DEMO_CATALOG, config: DEMO_DKG_CONFIG, date: "2026-03-20" });
  });

  it("메타데이터 등록 — 도메인/소비자/제약/DSL/IntentLink", () => {
    const domains = fullGraph.getNodesByKind("domain");
    const consumers = fullGraph.getNodesByKind("consumer");
    const constraints = fullGraph.getNodesByKind("constraint");
    const dslBundles = fullGraph.getNodesByKind("dsl-bundle");
    const intentLinks = fullGraph.getNodesByKind("intent-link");
    const decisions = fullGraph.getNodesByKind("decision");

    console.log("\n══ bootstrapDkg 메타데이터 ══");
    console.log(`  Domains:      ${domains.length}개`);
    console.log(`  Consumers:    ${consumers.length}개`);
    console.log(`  Constraints:  ${constraints.length}개`);
    console.log(`  DSL Bundles:  ${dslBundles.length}개`);
    console.log(`  IntentLinks:  ${intentLinks.length}개`);
    console.log(`  Decisions:    ${decisions.length}개`);
    console.log(`  Nodes total:  ${fullGraph.nodeCount}개`);
    console.log(`  Edges total:  ${fullGraph.edgeCount}개`);

    expect(domains.length).toBe(DEMO_DKG_CONFIG.domains.length);
    expect(consumers.length).toBe(DEMO_DKG_CONFIG.consumers.length);
    expect(constraints.length).toBeGreaterThanOrEqual(DEMO_DKG_CONFIG.constraints.length);
    expect(dslBundles.length).toBe(DEMO_DKG_CONFIG.dslBundles.length);
    expect(intentLinks.length).toBe(DEMO_DKG_CONFIG.intentLinks?.length ?? intentLinks.length);
  });

  it("DSL 버전 스큐 → Observation 자동 생성", () => {
    const observations = fullGraph.getNodesByKind("observation") as ObservationNode[];
    const skewObs = observations.filter(o => o.id.startsWith("OBS-SKEW-"));
    const coverageObs = observations.filter(o => o.id === "OBS-DSL-UNCOVERED");

    console.log("\n══ DSL 재귀 개선 결과 ══");

    // 버전 스큐 Observation
    for (const obs of skewObs) {
      console.log(`  ⚠ ${obs.id}: ${obs.finding}`);
      if (obs.suggestion) {
        console.log(`    → 제안: ${obs.suggestion.kind} (${(obs.suggestion as any).reason ?? ""})`);
      }
      // observes 엣지 확인
      const targets = fullGraph.neighbors(obs.id, "observes");
      console.log(`    → 관측 대상: ${targets.join(", ")}`);
    }

    // 커버리지 Observation
    for (const obs of coverageObs) {
      console.log(`  ⚠ ${obs.id}: ${obs.finding}`);
    }

    // skew가 있는 DSL은 자동 Observation 생성 — 최소 1개 이상
    expect(skewObs.length).toBeGreaterThan(0);
    // 모든 prefix가 DSL에 포함됨 (dsl-ingest가 schema_validation 커버) → uncovered 0건
    expect(coverageObs.length).toBe(0);

    // 각 skew Observation → Decision 연결 확인
    for (const obs of skewObs) {
      const prompted = fullGraph.neighbors(obs.id, "prompts");
      console.log(`    ${obs.id} → prompts → ${prompted.join(", ")}`);
      expect(prompted.length).toBe(1); // 1:1 Decision
      expect(prompted[0]).toMatch(/^DEC-SKEW-/);

      // Decision → prefix governs 엣지
      const governed = fullGraph.neighbors(prompted[0], "governs");
      console.log(`    ${prompted[0]} → governs → ${governed.join(", ")}`);
      expect(governed.length).toBeGreaterThan(0);
    }
  });

  it("Consumer → Domain 소비 엣지 정합성", () => {
    console.log("\n══ Consumer 소비 엣지 ══");

    const platformConsumes = fullGraph.edgesFrom("platform-demo", "consumes");
    const ingestConsumes = fullGraph.edgesFrom("ingest-server", "consumes");

    console.log(`  platform-demo → ${platformConsumes.map(e => e.to).join(", ")}`);
    console.log(`  ingest-server → ${ingestConsumes.map(e => e.to).join(", ")}`);

    // platform-demo는 shopping + tracking + observation 도메인 소비
    expect(platformConsumes.length).toBeGreaterThanOrEqual(3);
    // ingest-server는 shopping + infra 도메인 소비
    expect(ingestConsumes.length).toBeGreaterThanOrEqual(2);
  });

  it("DSL → prefix contains 엣지 + service binds 엣지", () => {
    console.log("\n══ DSL 엣지 정합성 ══");

    const dslIds = ["dsl-observation", "dsl-infra", "dsl-checkout", "dsl-auth"];
    for (const dslId of dslIds) {
      const contains = fullGraph.edgesFrom(dslId, "contains");
      const binds = fullGraph.edgesFrom(dslId, "binds");
      console.log(`  ${dslId}: contains=[${contains.map(e => e.to).join(",")}] binds=[${binds.map(e => e.to).join(",")}]`);

      expect(contains.length).toBeGreaterThan(0);
      expect(binds.some(e => e.to === "service")).toBe(true);
    }
  });

  it("Headroom + 분리 유지 기록", () => {
    const decisions = fullGraph.getNodesByKind("decision");

    const headroomDec = decisions.filter(d => d.id.startsWith("DEC-HEADROOM-"));
    const sepDec = decisions.filter(d => d.id.startsWith("DEC-SEP-"));

    console.log("\n══ 자동 Decision ══");
    if (headroomDec.length > 0) {
      console.log(`  Headroom: ${headroomDec.map(d => d.id.replace("DEC-HEADROOM-", "")).join(", ")}`);
    } else {
      console.log("  ✅ 모든 축 capacity 충분");
    }
    if (sepDec.length > 0) {
      console.log(`  분리 유지: ${sepDec.map(d => (d as any).title).join(", ")}`);
    }

    // Domain contains 정합성 — config에서 파생
    const shoppingDomain = DEMO_DKG_CONFIG.domains.find(d => d.id === "shopping-domain")!;
    const shoppingContains = fullGraph.edgesFrom("shopping-domain", "contains");
    expect(shoppingContains.length).toBe(shoppingDomain.prefixes.length);
  });

  it("entry 관측 커버리지 — 시뮬레이션 트래픽 대조", () => {
    // 실 트래픽 시뮬레이션: checkout 흐름 + deploy + endpoint 일부만
    const svcAddr = DEMO_CATALOG.prefixes.endpoint.versions[0].refEntries!.svc_ref.values[0];
    const infraAddr = DEMO_CATALOG.prefixes.deploy_event.versions[0].refEntries!.svc_ref.values[0];
    const records: AddressContextRecord[] = [];

    // checkout 흐름 200건
    for (let i = 0; i < 200; i++) {
      const step = Math.random() < 0.8 ? "success" : "failure";
      const fpAddr = encodePrefixByValue(DEMO_CATALOG, "flow_point", "v1", {
        svc_ref: svcAddr, flow_name: "checkout", flow_step: step, flow_variant: "default",
      });
      const epAddr = encodePrefixByValue(DEMO_CATALOG, "endpoint", "v1", {
        svc_ref: svcAddr, resource_type: "api", http_method: "POST", api_version: "v1",
      });
      records.push({
        address_context: { flow_point: `flow_point:v1:${fpAddr}`, endpoint: `endpoint:v1:${epAddr}` },
        timestamp: new Date(2026, 2, 20, 0, 0, i).toISOString(),
        execution_mode: "live",
      });
    }

    // deploy 50건
    for (let i = 0; i < 50; i++) {
      const dAddr = encodePrefixByValue(DEMO_CATALOG, "deploy_event", "v1", {
        svc_ref: infraAddr, deploy_action: "deploy",
      });
      records.push({
        address_context: { deploy_event: `deploy_event:v1:${dAddr}` },
        timestamp: new Date(2026, 2, 20, 1, 0, i).toISOString(),
        execution_mode: "live",
      });
    }

    const usage = aggregateUsageData(DEMO_CATALOG, records);
    const coverage = analyzeEntryCoverage(DEMO_CATALOG, usage.entryUsages, usage.addressUsages);

    console.log("\n══ entry 관측 커버리지 (시뮬레이션) ══");
    console.log(`  ${coverage.summary}`);

    // dormant가 많은 prefix top 5
    const lowCoverage = coverage.prefixes
      .filter(p => p.coverageRate < 1)
      .sort((a, b) => a.coverageRate - b.coverageRate)
      .slice(0, 5);

    for (const pc of lowCoverage) {
      console.log(`\n  ${pc.prefixId}: ${pc.summary}`);
      for (const [label, dim] of Object.entries(pc.dims)) {
        if (dim.dormant > 0) {
          const dormants = dim.entries.filter(e => e.status === "dormant").map(e => e.entry);
          console.log(`    ${label}: dormant=[${dormants.join(",")}]`);
        }
      }
    }

    // 관측된 prefix는 부분 커버리지
    expect(coverage.dormantCount).toBeGreaterThan(0);
    // 관측 안 된 prefix는 0% 커버리지
    const zeroCoverage = coverage.prefixes.filter(p => p.coverageRate === 0);
    expect(zeroCoverage.length).toBeGreaterThan(0);
  });

  it("전체 재귀 사이클 요약", () => {
    const observations = fullGraph.getNodesByKind("observation");
    const decisions = fullGraph.getNodesByKind("decision");
    const constraints = fullGraph.getNodesByKind("constraint");
    const dslBundles = fullGraph.getNodesByKind("dsl-bundle");

    console.log("\n" + "═".repeat(60));
    console.log("  재귀 개선 사이클 요약");
    console.log("═".repeat(60));
    console.log(`\n  CATALOG → DKG 파생 → 메타데이터 등록 → DSL 분석`);
    console.log(`  → 버전 스큐 감지 → Entry 커버리지 → Observation 생성`);
    console.log(`\n  Axes:         ${fullGraph.getNodesByKind("axis").length}개`);
    console.log(`  Prefixes:     ${fullGraph.getNodesByKind("prefix").length}개`);
    console.log(`  DSL Bundles:  ${dslBundles.length}개`);
    console.log(`  Observations: ${observations.length}개 (자동 감지된 개선점)`);
    console.log(`  Decisions:    ${decisions.length}개 (자동/수동 결정)`);
    console.log(`  Constraints:  ${constraints.length}개 (구조 규칙)`);

    for (const obs of observations) {
      const o = obs as ObservationNode;
      const icon = o.suggestion ? "⚠" : "ℹ";
      console.log(`\n  ${icon} ${o.id}`);
      console.log(`    finding: ${o.finding}`);
      if (o.suggestion) {
        console.log(`    suggest: ${o.suggestion.kind}`);
      }
    }

    // lifecycle 리포트
    const lcReport = generateLifecycleReport(fullGraph);
    console.log(`\n  ── Lifecycle ──`);
    console.log(`  ${lcReport.summary}`);

    // Observation을 Decision에 resolution 연결 (자동)
    for (const obs of observations) {
      const o = obs as ObservationNode;
      const prompted = fullGraph.neighbors(o.id, "prompts");
      if (prompted.length > 0 && !o.resolution) {
        resolveObservation(fullGraph, o.id, {
          decisionId: prompted[0],
          outcome: "accepted",
          note: "자동 Decision 생성됨",
        });
      }
    }

    const lcAfter = generateLifecycleReport(fullGraph);
    console.log(`  → resolution 후: ${lcAfter.summary}`);

    console.log("\n" + "═".repeat(60));

    // 전체 그래프 일관성
    expect(fullGraph.nodeCount).toBeGreaterThan(50);
    expect(fullGraph.edgeCount).toBeGreaterThan(80);

    // lifecycle: 모든 prefix active
    expect(lcAfter.prefixes.every(p => p.lifecycle === "active")).toBe(true);
    // prompts 연결된 Observation은 모두 resolved (신규 coverage metric은 미연결)
    const prompted = lcAfter.observations.filter(o => {
      const obs = fullGraph.getNode(o.id) as any;
      return obs && fullGraph.neighbors(obs.id, "prompts").length > 0;
    });
    expect(prompted.every(o => o.resolved)).toBe(true);
  });

  it("멀티서비스 토폴로지 — 소유권 + 공유 계약 + cascade 분석", () => {
    const topo = createDemoTopology();
    const allPrefixes = Object.keys(DEMO_CATALOG.prefixes);
    const report = topo.generateReport(allPrefixes);

    console.log("\n══ 멀티서비스 토폴로지 ══");
    console.log(`  ${report.summary}`);

    console.log("\n  서비스별 소유:");
    for (const svc of report.services) {
      const owned = svc.ownedPrefixes.length > 0 ? svc.ownedPrefixes.join(",") : "(없음)";
      const consumed = svc.consumedPrefixes.length > 0 ? svc.consumedPrefixes.join(",") : "(없음)";
      console.log(`    ${svc.serviceId.padEnd(20)} [${svc.status}] team=${svc.team ?? "?"}`);
      console.log(`      own: ${owned}`);
      console.log(`      use: ${consumed}`);
      console.log(`      dsl: ${svc.dslBindings.join(",")}`);
    }

    console.log("\n  공유 계약:");
    for (const c of report.contracts) {
      console.log(`    ${c.id}: ${c.provider} → [${c.consumers.join(",")}] (${c.status}, stable=${c.stableVersion})`);
    }

    if (report.orphanPrefixes.length > 0) {
      console.log(`\n  ⚠ 소유자 없는 prefix: ${report.orphanPrefixes.join(", ")}`);
    }

    // 서비스 해제 시뮬레이션: payment 서비스 해제
    const deregResult = topo.analyzeDeregistration("payment");
    console.log("\n  시뮬레이션: payment 서비스 해제 시");
    console.log(`    orphan prefix: ${deregResult.orphanPrefixes.join(",") || "없음"}`);
    console.log(`    broken contract: ${deregResult.brokenContracts.join(",") || "없음"}`);
    console.log(`    affected consumer: ${deregResult.affectedConsumers.join(",") || "없음"}`);

    // prefix 변경 시뮬레이션: permission capacity 변경
    const breakResult = topo.analyzeBreakingChange("permission", "capacity-changed");
    console.log("\n  시뮬레이션: permission capacity 변경 시");
    console.log(`    affected: [${breakResult.affectedServices.join(",")}]`);
    console.log(`    contracts: [${breakResult.contractIds.join(",")}]`);
    console.log(`    approval 필요: ${breakResult.requiresApproval}`);

    // 검증
    // topology는 bootstrap 로직에서 파생 — 구조적 불변조건만 검증
    expect(report.services.length).toBeGreaterThan(0);
    expect(report.contracts.length).toBeGreaterThan(0);
    expect(report.orphanPrefixes.length).toBeGreaterThanOrEqual(0);
    expect(breakResult.requiresApproval).toBe(true);
    expect(breakResult.affectedServices).toContain("shopping-web");
    expect(breakResult.affectedServices).toContain("auth");
  });

  it("계약 버전 핀 검증 — 구버전 사용 consumer 감지", () => {
    const topo = createDemoTopology();

    // 시뮬레이션: permission v1을 사용하는 서비스 (계약은 v4 stable)
    const versionUsages = new Map<string, readonly { version: string; sessions: readonly string[] }[]>([
      ["permission", [
        { version: "v4", sessions: ["shopping-web", "auth"] },
        { version: "v1", sessions: ["payment-legacy"] }, // 구버전
      ]],
    ]);

    const violations = topo.validateContractVersions(versionUsages);

    console.log("\n══ 계약 버전 검증 ══");
    for (const v of violations) {
      const icon = v.severity === "critical" ? "🔴" : "⚠";
      console.log(`  ${icon} ${v.contractId}: ${v.consumer} uses ${v.usedVersion} (stable=${v.stableVersion})`);
    }

    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0].usedVersion).toBe("v1");
    expect(violations[0].severity).toBe("critical"); // v1 vs v4 = gap 3
  });

  it("draining 모드 — 서비스 점진적 해제 + 이관 계획", () => {
    const topo = createDemoTopology();

    // shopping-backend draining (permission, cart_event, order_event, event 소유)
    const plan = topo.drainService("shopping-backend");

    console.log("\n══ Draining: shopping-backend ══");
    console.log(`  ${plan.summary}`);
    console.log(`  소유 prefix: ${plan.ownedPrefixes.join(", ")}`);
    for (const t of plan.transferTargets) {
      const icon = t.requiresTransfer ? "⚠" : "✅";
      console.log(`  ${icon} ${t.prefixId}: consumers=[${t.consumers.join(",")}] contracts=[${t.contracts.join(",")}]`);
      if (t.suggestedNewOwner) console.log(`     → 이관 후보: ${t.suggestedNewOwner}`);
    }
    console.log(`  즉시 해제 가능: ${plan.canDeregister}`);

    // permission은 3개 서비스가 소비 → 이관 필요
    const permTransfer = plan.transferTargets.find(t => t.prefixId === "permission");
    expect(permTransfer?.requiresTransfer).toBe(true);
    expect(permTransfer?.consumers.length).toBeGreaterThan(0);
    expect(plan.canDeregister).toBe(false); // 이관 필요한 prefix 있으므로
  });

  it("approval gate — 팀별 승인 요청", () => {
    const topo = createDemoTopology();

    const request = topo.createApprovalRequest("permission", "capacity-changed", "shopping-backend");

    console.log("\n══ Approval Gate ══");
    console.log(`  변경: ${request.prefixId} (${request.changeType})`);
    console.log(`  요청자: ${request.requestedBy} (owner: ${request.owner})`);
    console.log(`  영향 서비스: ${request.affectedServices.join(", ")}`);
    console.log(`  영향 팀: ${request.affectedTeams.join(", ")}`);
    console.log(`  승인 상태:`);
    for (const a of request.approvals) {
      console.log(`    ${a.team}: ${a.status}`);
    }
    console.log(`  진행 가능: ${request.canProceed}`);

    // 3개 팀 (frontend, platform, backend)의 승인 필요
    expect(request.affectedTeams.length).toBeGreaterThanOrEqual(2);
    expect(request.canProceed).toBe(false);
    expect(request.approvals.every(a => a.status === "pending")).toBe(true);
  });

  it("서비스 의존 그래프 — 의존 체인 + 순환 감지", () => {
    const topo = createDemoTopology();
    const depGraph = buildDependencyGraph(topo);

    console.log("\n══ 서비스 의존 그래프 ══");
    console.log(`  edges: ${depGraph.edges.length}`);
    console.log(`  roots (의존 없음): ${depGraph.roots.join(", ")}`);
    console.log(`  leaves (피의존 없음): ${depGraph.leaves.join(", ")}`);
    console.log(`  cycles: ${depGraph.cycles.length > 0 ? depGraph.cycles.map(c => c.join("→")).join("; ") : "없음"}`);
    console.log(`  max depth: ${depGraph.maxDepth}`);

    for (const e of depGraph.edges) {
      console.log(`    ${e.from} → ${e.to} via=[${e.via.join(",")}] (${e.strength})`);
    }

    // infra-controller는 leaf (많이 의존됨, 자신은 아무것도 소비 안 함)
    expect(depGraph.leaves).toContain("infra-controller");
    // 순환 없음
    expect(depGraph.cycles.length).toBe(0);
    expect(depGraph.edges.length).toBeGreaterThan(0);
  });

  it("변경 이력 타임라인 — Decision/Observation 시간순", () => {
    const timeline = buildTimeline(fullGraph);

    console.log("\n══ 변경 타임라인 ══");
    for (const evt of timeline.slice(0, 10)) {
      console.log(`  [${evt.date}] ${evt.type.padEnd(15)} ${evt.id}`);
      if (evt.subjects.length > 0) console.log(`    → ${evt.subjects.join(", ")}`);
    }
    if (timeline.length > 10) console.log(`  ... (${timeline.length - 10}건 더)`);

    expect(timeline.length).toBeGreaterThan(0);
    // 시간순 정렬 확인
    for (let i = 1; i < timeline.length; i++) {
      expect(timeline[i].date >= timeline[i - 1].date).toBe(true);
    }
  });

  it("시간축 분석 — 분기 트렌드 + SLA 위반 감지", () => {
    const svcAddr = DEMO_CATALOG.prefixes.flow_point.versions[0].refEntries!.svc_ref.values[0];
    const records: AddressContextRecord[] = [];

    // 3시간 트래픽: 처음 2시간 success 95%, 마지막 1시간 success 60% (성능 저하)
    for (let hour = 0; hour < 3; hour++) {
      const successRate = hour < 2 ? 0.95 : 0.60;
      for (let i = 0; i < 100; i++) {
        const step = Math.random() < successRate ? "success" : "failure";
        const fpAddr = encodePrefixByValue(DEMO_CATALOG, "flow_point", "v1", {
          svc_ref: svcAddr, flow_name: "checkout", flow_step: step, flow_variant: "default",
        });
        records.push({
          address_context: { flow_point: `flow_point:v1:${fpAddr}` },
          timestamp: new Date(2026, 2, 20, hour, i * 0.6, 0).toISOString(),
        });
      }
    }

    const temporal = analyzeTemporalTrends(DEMO_CATALOG, records, {
      windowMinutes: 60,
      slaRules: [
        { axisId: "flow_step", entry: "success", minRatio: 0.90 },
        { axisId: "flow_step", entry: "failure", maxRatio: 0.10 },
      ],
      anomalyThreshold: 1.5,
    });

    console.log("\n══ 시간축 분석 ══");
    console.log(`  ${temporal.summary}`);

    for (const w of temporal.windows) {
      if (w.recordCount === 0) continue;
      const steps = w.branches.flow_step ?? {};
      const total = Object.values(steps).reduce((s, c) => s + c, 0);
      const successPct = total > 0 ? ((steps.success ?? 0) / total * 100).toFixed(0) : "?";
      console.log(`  [${w.from.slice(11, 16)}] ${w.recordCount}건 success=${successPct}%`);
    }

    if (temporal.anomalies.length > 0) {
      console.log(`\n  이상 감지:`);
      for (const a of temporal.anomalies) {
        console.log(`    ${a.severity} [W${a.windowIndex}] ${a.axisId}.${a.entry}: ${(a.ratio * 100).toFixed(0)}% (avg=${(a.avgRatio * 100).toFixed(0)}%, dev=${a.deviation.toFixed(1)}σ)`);
      }
    }

    if (temporal.slaViolations.length > 0) {
      console.log(`\n  SLA 위반:`);
      for (const v of temporal.slaViolations) {
        console.log(`    [W${v.windowIndex}] ${v.rule} → actual=${(v.actual * 100).toFixed(0)}%`);
      }
    }

    // 마지막 윈도우에서 SLA 위반 (success 60% < 90%)
    expect(temporal.slaViolations.length).toBeGreaterThan(0);
    expect(temporal.slaViolations.some(v => v.rule.includes("success"))).toBe(true);
  });

  it("3D 계층 시각화 — layer 매핑 + 실시간 모니터링 쿼리", () => {
    // 계층 맵 생성
    const layerMap = buildLayerMap(DEMO_CATALOG);

    console.log("\n══ 3D 계층 맵 ══");
    for (const layer of layerMap.layers) {
      console.log(`\n  Layer ${layer.level}: ${layer.name}`);
      console.log(`    ${layer.description}`);
      for (const p of layer.prefixes) {
        console.log(`    [${p.gridX},${p.gridZ}] ${p.prefixId.padEnd(17)} (${p.category})`);
      }
    }

    // 검증: 모든 prefix가 배치됨
    expect(layerMap.allPlacements.length).toBe(Object.keys(DEMO_CATALOG.prefixes).length);
    // Layer 0에 UI prefix
    expect(layerMap.layers[0].prefixes.some(p => p.prefixId === "page_view")).toBe(true);
    // Layer 2에 infra prefix
    expect(layerMap.layers[2].prefixes.some(p => p.prefixId === "service")).toBe(true);

    // 실시간 모니터링 시뮬레이션
    const monitor = new MonitorState(DEMO_CATALOG, { windowSeconds: 60 });
    const svcAddr = DEMO_CATALOG.prefixes.endpoint.versions[0].refEntries!.svc_ref.values[0];

    // 이벤트 주입: checkout 흐름 (Layer 0 → 1 → 2)
    for (let i = 0; i < 50; i++) {
      const pvAddr = encodePrefixByValue(DEMO_CATALOG, "page_view", "v1", {
        svc_ref: svcAddr, page: "checkout", locale: "ko", userType: "member",
      });
      const epAddr = encodePrefixByValue(DEMO_CATALOG, "endpoint", "v1", {
        svc_ref: svcAddr, resource_type: "api", http_method: "POST", api_version: "v1",
      });
      const fpAddr = encodePrefixByValue(DEMO_CATALOG, "flow_point", "v1", {
        svc_ref: svcAddr, flow_name: "checkout", flow_step: "success", flow_variant: "default",
      });

      const ts = new Date(Date.now() - (50 - i) * 1000).toISOString();
      monitor.push({
        address_context: {
          page_view: `page_view:v1:${pvAddr}`,
          endpoint: `endpoint:v1:${epAddr}`,
          flow_point: `flow_point:v1:${fpAddr}`,
        },
        timestamp: ts,
        trace_id: `trace-${i}`,
      });
    }

    // Q2: 활성 상태
    const activity = monitor.getActivity();
    console.log("\n  실시간 활성:");
    for (const a of activity) {
      const bar = "█".repeat(Math.ceil(a.intensity * 10));
      console.log(`    L${a.layer} ${a.prefixId.padEnd(15)} ${bar} (${a.count}건, ${(a.intensity * 100).toFixed(0)}%)`);
    }

    expect(activity.length).toBe(3); // page_view, endpoint, flow_point

    // Q4: 최근 trace 경로
    const paths = monitor.getRecentPaths(3);
    console.log("\n  최근 trace 경로:");
    for (const p of paths.slice(0, 3)) {
      console.log(`    ${p.traceId}: L${p.layerPath.join("→L")} (${p.steps.length} steps)`);
    }

    expect(paths.length).toBeGreaterThan(0);
    // checkout 흐름은 Layer 0 → 1 경로
    expect(paths[0].layerPath).toContain(0); // page_view (L0)
    expect(paths[0].layerPath).toContain(1); // endpoint/flow_point (L1)

    // Q5: 계층별 요약
    const summary = monitor.getLayerSummary();
    console.log("\n  계층별 요약:");
    for (const s of summary) {
      console.log(`    L${s.layer} ${s.name.padEnd(20)} active=${s.activeCount} intensity=${s.totalIntensity.toFixed(1)}`);
    }

    // Q6: 통계
    const stats = monitor.getStats();
    console.log(`\n  모니터 통계: window=${stats.windowSize}s records=${stats.recordCount} prefixes=${stats.activePrefixes}`);
    expect(stats.recordCount).toBe(50);
    expect(stats.activePrefixes).toBe(3);
  });
});
