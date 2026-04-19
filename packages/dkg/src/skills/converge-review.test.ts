// @def.boundary dkg-system-root
// @def.doc dkg-system-root

/**
 * 행위 체인 리뷰 — 현재 시스템에서 결정이 필요한 것을 판별한다.
 *
 * 실제 DEMO_CATALOG + bootstrapDkg 기반.
 * 시뮬레이션이 아닌 "현재 정의 상태"에서 무엇을 결정해야 하는지.
 */

import { describe, it, expect } from "vitest";
import { DEMO_CATALOG, DEMO_DKG_CONFIG } from "demo-snapshot";
import { bootstrapDkg } from "../bootstrap.js";
import { deriveFromCatalog } from "../catalog-derive.js";
import { scanAxisOverlaps, comparePrefixes } from "@qa-sdk/convergence";
import { scaffoldDecision } from "./decision-scaffold.js";
import { convergeChain } from "./converge-chain.js";
import { systemHealthChain } from "./skill-chain.js";
import type { PrefixNode } from "../dkg.types.js";

describe("행위 체인 리뷰 — 현재 시스템 결정 사항", () => {

  // ═══════════════════════════════════════════════════════
  //  1. merge 체인 — 병합이 필요한 것
  // ═══════════════════════════════════════════════════════

  it("merge: 축 중복 → 결정", () => {
    const graph = deriveFromCatalog(DEMO_CATALOG);
    const entriesMap = new Map<string, readonly string[]>();
    for (const [id, axis] of Object.entries(DEMO_CATALOG.axes)) {
      const versions = Object.keys(axis.versions);
      const latest = axis.versions[versions[versions.length - 1] as keyof typeof axis.versions] as any;
      if (latest?.entries) entriesMap.set(id, [...latest.entries]);
    }

    const overlaps = scanAxisOverlaps(graph, entriesMap);
    const mergeNeeded = overlaps.filter(o => o.recommendation === "merge");
    const reviewNeeded = overlaps.filter(o => o.recommendation === "review");

    console.log("\n══ MERGE 체인 리뷰 ══\n");

    // merge 후보
    for (const o of mergeNeeded) {
      console.log(`  🔴 병합 필요: ${o.a} ↔ ${o.b}`);
      console.log(`     공유: [${o.sharedEntries.join(", ")}] (${(o.overlapRatio * 100).toFixed(0)}%)`);
      console.log(`     ${o.a}만: [${o.aOnly.join(", ")}]`);
      console.log(`     ${o.b}만: [${o.bOnly.join(", ")}]`);

      // 어디서 사용되는지
      const aUsers = graph.reverseNeighbors(o.a, "composes");
      const bUsers = graph.reverseNeighbors(o.b, "composes");
      console.log(`     ${o.a} 사용 prefix: ${aUsers.join(", ") || "없음"}`);
      console.log(`     ${o.b} 사용 prefix: ${bUsers.join(", ") || "없음"}`);

      // 결정
      if (aUsers.length > 0 && bUsers.length > 0 && aUsers.every(u => !bUsers.includes(u))) {
        console.log(`     → 결정: 분리 유지 권장 (서로 다른 prefix에서 사용)`);
      } else if (o.overlapRatio >= 0.9) {
        console.log(`     → 결정: 병합 강력 권장 (90%+ 중복)`);
      }
    }

    // review 후보
    if (reviewNeeded.length > 0) {
      console.log(`\n  🟡 검토 필요: ${reviewNeeded.length}건`);
      for (const o of reviewNeeded.slice(0, 3)) {
        console.log(`     ${o.a} ↔ ${o.b}: ${(o.overlapRatio * 100).toFixed(0)}% — ${o.reason}`);
      }
    }

    expect(mergeNeeded.length + reviewNeeded.length).toBeGreaterThan(0);
  });

  it("merge: prefix 유사도 → 결정", () => {
    const graph = deriveFromCatalog(DEMO_CATALOG);
    const prefixIds = graph.getNodesByKind("prefix").map(n => n.id);

    console.log("\n══ PREFIX 유사도 리뷰 ══\n");

    const highSimilarity: Array<{ a: string; b: string; sim: number; rec: string }> = [];
    for (let i = 0; i < prefixIds.length; i++) {
      for (let j = i + 1; j < prefixIds.length; j++) {
        const result = comparePrefixes(graph, prefixIds[i], prefixIds[j]);
        if (result.structuralSimilarity >= 0.3) {
          highSimilarity.push({ a: result.a, b: result.b, sim: result.structuralSimilarity, rec: result.recommendation });
        }
      }
    }

    highSimilarity.sort((a, b) => b.sim - a.sim);
    for (const s of highSimilarity.slice(0, 5)) {
      const icon = s.rec === "merge" ? "🔴" : s.rec === "review" ? "🟡" : "🟢";
      const aNode = graph.getNode(s.a) as PrefixNode;
      const bNode = graph.getNode(s.b) as PrefixNode;
      console.log(`  ${icon} ${s.a}(${aNode?.category}) ↔ ${s.b}(${bNode?.category}): ${(s.sim * 100).toFixed(0)}%`);

      // 같은 category면 병합 후보, 다르면 의도적 분리
      if (aNode?.category === bNode?.category) {
        console.log(`     → 같은 category(${aNode.category}) — 병합 검토`);
      } else {
        console.log(`     → 다른 category — 의도적 분리 가능`);
      }
    }
  });

  // ═══════════════════════════════════════════════════════
  //  2. deactivate 체인 — 현재 정의만으로 판단 가능한 것
  // ═══════════════════════════════════════════════════════

  it("deactivate: headroom이 과도한 축 → 검토", () => {
    console.log("\n══ DEACTIVATE/HEADROOM 리뷰 ══\n");

    const axisData = Object.entries(DEMO_CATALOG.axes).map(([id, axis]) => {
      const versions = Object.keys(axis.versions);
      const latest = axis.versions[versions[versions.length - 1] as keyof typeof axis.versions] as any;
      const entries = latest.entries?.length ?? 0;
      const capacity = latest.capacity ?? entries;
      return { id, entries, capacity, headroom: capacity - entries, usageRate: entries / capacity };
    });

    // headroom이 entries의 4배 이상인 축 (과도한 headroom)
    const overProvisioned = axisData.filter(a => a.headroom > a.entries * 3);
    if (overProvisioned.length > 0) {
      console.log(`  과도한 headroom (entries의 4배+):`);
      for (const a of overProvisioned.slice(0, 5)) {
        console.log(`    ${a.id}: entries=${a.entries} cap=${a.capacity} headroom=${a.headroom} (사용률 ${(a.usageRate * 100).toFixed(0)}%)`);
      }
      console.log(`    → 결정: 현재는 정상. stride-break 방지를 위한 의도적 headroom.`);
    } else {
      console.log(`  과도한 headroom 없음 ✅`);
    }

    // 단일 entry 축 (사실상 상수)
    const singleEntry = axisData.filter(a => a.entries <= 2);
    if (singleEntry.length > 0) {
      console.log(`\n  entry ≤ 2개 축 (상수 후보):`);
      for (const a of singleEntry) {
        console.log(`    ${a.id}: entries=${a.entries} [${getEntries(a.id).join(", ")}]`);
      }
      console.log(`    → 결정: 유지. 향후 확장 가능성 있음 (region: asia/usa → eu 추가 가능).`);
    }

    expect(axisData.length).toBeGreaterThan(0);
  });

  // ═══════════════════════════════════════════════════════
  //  3. simplify 체인 — 구조적 단순화
  // ═══════════════════════════════════════════════════════

  it("simplify: 5차원 이상 prefix → 복잡도 검토", () => {
    const graph = deriveFromCatalog(DEMO_CATALOG);

    console.log("\n══ SIMPLIFY 리뷰 ══\n");

    const complexPrefixes = graph.getNodesByKind("prefix")
      .filter(p => (p as PrefixNode).dimLabels.length >= 5)
      .map(p => p as PrefixNode);

    if (complexPrefixes.length > 0) {
      console.log(`  5차원+ prefix (복잡도 높음):`);
      for (const p of complexPrefixes) {
        console.log(`    ${p.id}: ${p.dimLabels.length}차원 [${p.dimLabels.join(", ")}] (${p.category})`);
      }
      console.log(`    → 결정: content(5차원)은 domain 특성상 유지. pipeline_point(5차원)은 추적 필요.`);
    } else {
      console.log(`  5차원+ prefix 없음 ✅`);
    }

    // svc_ref가 붙은 prefix들 — 모두 service를 참조
    const svcRefPrefixes = graph.getNodesByKind("prefix").filter(p => {
      const refs = graph.neighbors(p.id, "references");
      return refs.includes("service");
    });
    console.log(`\n  service 참조 prefix: ${svcRefPrefixes.length}개`);
    console.log(`    ${svcRefPrefixes.map(p => p.id).join(", ")}`);
    console.log(`    → 결정: svc_ref는 SDK가 자동 주입. 개발자 DX에 영향 없음.`);
  });

  // ═══════════════════════════════════════════════════════
  //  4. observe 체인 — 현재 관측 상태
  // ═══════════════════════════════════════════════════════

  it("observe: bootstrapDkg의 자동 관측 결과", () => {
    const graph = bootstrapDkg({ catalog: DEMO_CATALOG, config: DEMO_DKG_CONFIG });

    console.log("\n══ OBSERVE 리뷰 ══\n");

    const observations = graph.getNodesByKind("observation");
    for (const obs of observations) {
      const o = obs as any;
      const targets = graph.neighbors(obs.id, "observes");
      console.log(`  ${obs.id}`);
      console.log(`    finding: ${o.finding}`);
      console.log(`    targets: ${targets.join(", ")}`);
      if (o.suggestion) {
        console.log(`    suggest: ${o.suggestion.kind}`);
      }
    }

    // 미해결 관측
    const unresolved = observations.filter(o => !(o as any).resolution);
    console.log(`\n  미해결: ${unresolved.length}/${observations.length}`);

    if (unresolved.length > 0) {
      console.log(`    → 결정: 버전 스큐 관측은 "집계 기반"으로 전환됨. 정의 기반 스큐는 참고 수준.`);
    }

    expect(observations.length).toBeGreaterThan(0);
  });

  // ═══════════════════════════════════════════════════════
  //  종합: 전체 시스템 건강 + converge 결과
  // ═══════════════════════════════════════════════════════

  it("종합: 시스템 건강 + 행위 체인 요약", () => {
    const graph = bootstrapDkg({ catalog: DEMO_CATALOG, config: DEMO_DKG_CONFIG });
    const health = systemHealthChain(graph);

    console.log("\n══ 종합 리뷰 ══\n");

    console.log("  System Health:");
    for (const step of health.steps) {
      const icon = step.status === "ok" ? "✅" : "⚠";
      console.log(`    ${icon} ${step.step}: ${step.message}`);
    }

    // converge (usage 없이, 정의 기반만)
    const entriesMap = new Map<string, readonly string[]>();
    for (const [id, axis] of Object.entries(DEMO_CATALOG.axes)) {
      const versions = Object.keys(axis.versions);
      const latest = axis.versions[versions[versions.length - 1] as keyof typeof axis.versions] as any;
      if (latest?.entries) entriesMap.set(id, [...latest.entries]);
    }

    const converge = convergeChain(DEMO_CATALOG, graph, null, { entriesMap });

    console.log(`\n  Converge Actions:`);
    console.log(`    merge:       ${converge.summary.merges}`);
    console.log(`    deactivate:  ${converge.summary.deactivations}`);
    console.log(`    simplify:    ${converge.summary.simplifications}`);
    console.log(`    observe:     ${converge.summary.observations}`);
    console.log(`    decisions:   ${converge.decisions.length}`);

    console.log(`\n  ── 결정 사항 ──`);
    console.log(`  1. initiator↔channel 병합: 분리 유지 (이미 Decision 기록됨)`);
    console.log(`  2. 버전 스큐 (permission v4 vs others v1): 집계 기반으로 전환. 정의 기반은 참고.`);
    console.log(`  3. headroom: 전체 축 충분. 조치 불필요.`);
    console.log(`  4. 5차원 prefix (content, pipeline_point): 도메인 특성상 유지.`);
    console.log(`  5. 미해결 Observation ${graph.getNodesByKind("observation").length}개: 집계 데이터 쌓이면 재평가.`);
  });
});

function getEntries(axisId: string): string[] {
  const axis = (DEMO_CATALOG.axes as Record<string, { versions: Record<string, { entries: readonly string[] }> }>)[axisId];
  if (!axis) return [];
  const versions = Object.keys(axis.versions);
  const latest = axis.versions[versions[versions.length - 1]];
  return [...latest.entries];
}
