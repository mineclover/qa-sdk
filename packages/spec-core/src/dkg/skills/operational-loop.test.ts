/**
 * Operational Loop — 실제 운영 시뮬레이션.
 *
 * 3일치 트래픽을 시뮬레이션하고, 매일 집계 → 저장 → 수렴 분석.
 * Day 1: 정상 트래픽
 * Day 2: payment-service가 permission v3에 머물러 있음 (스큐 발생)
 * Day 3: 새로운 흐름 패턴 발견 (co-occurrence)
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { DEMO_CATALOG, encodePrefixByValue } from "demo-snapshot";
import { DkgSqliteStore } from "../../store/dkg-sqlite-store.js";
import { bootstrapDkg } from "../bootstrap.js";
import { aggregateUsageData, type AddressContextRecord } from "../../convergence/usage-aggregator.js";
import { analyzeDeploymentSkew } from "../../convergence/deployment-skew.js";
import { convergeChain } from "./converge-chain.js";
import { systemHealthChain } from "./skill-chain.js";

let store: DkgSqliteStore;
const svcRef = () => DEMO_CATALOG.prefixes.endpoint.versions[0].refEntries!.svc_ref.values[0];

beforeAll(() => {
  store = new DkgSqliteStore(":memory:");
  const graph = bootstrapDkg();
  store.saveGraph(graph);
  store.setMeta("simulation_start", "2026-03-20");
});

afterAll(() => store.close());

describe("Operational Loop — 3일 운영 시뮬레이션", () => {

  it("Day 1: 정상 트래픽 — baseline 수집", () => {
    const records: AddressContextRecord[] = [];
    const sv = svcRef();

    // auth-service: permission v4 + endpoint
    for (let i = 0; i < 300; i++) {
      const permAddr = encodePrefixByValue(DEMO_CATALOG, "permission", "v4", {
        perm_svc: sv, role: ["admin", "developer", "operator"][i % 3],
      });
      const epAddr = encodePrefixByValue(DEMO_CATALOG, "endpoint", "v1", {
        svc_ref: sv, resource_type: "api", http_method: ["GET", "POST"][i % 2], api_version: "v1",
      });
      records.push({
        address_context: {
          permission: `permission:v4:${permAddr}`,
          endpoint: `endpoint:v1:${epAddr}`,
        },
        timestamp: new Date(2026, 2, 20, Math.floor(i / 30), i % 60, 0).toISOString(),
        session_id: "auth-service",
        trace_id: `trace-d1-${Math.floor(i / 5)}`,
        event_key: "api.request",
      });
    }

    // payment-service: permission v4 + flow_point
    for (let i = 0; i < 200; i++) {
      const permAddr = encodePrefixByValue(DEMO_CATALOG, "permission", "v4", {
        perm_svc: sv, role: "operator",
      });
      const fpAddr = encodePrefixByValue(DEMO_CATALOG, "flow_point", "v1", {
        svc_ref: sv, flow_name: "checkout", flow_step: i % 10 < 8 ? "success" : "failure", flow_variant: "default",
      });
      records.push({
        address_context: {
          permission: `permission:v4:${permAddr}`,
          flow_point: `flow_point:v1:${fpAddr}`,
        },
        timestamp: new Date(2026, 2, 20, 12 + Math.floor(i / 30), i % 60, 0).toISOString(),
        session_id: "payment-service",
        trace_id: `trace-d1-pay-${Math.floor(i / 5)}`,
        event_key: `flow.checkout.${i % 10 < 8 ? "success" : "failure"}`,
      });
    }

    const usage = aggregateUsageData(DEMO_CATALOG, records);
    store.saveUsageSnapshot(usage);

    console.log("\n══ Day 1: Baseline ══");
    console.log(`  records: ${records.length}, sessions: ${usage.sourceStats?.uniqueSessions}`);
    console.log(`  versionUsages: ${usage.versionUsages.length}`);

    const skews = analyzeDeploymentSkew(usage.versionUsages);
    const permSkew = skews.find(s => s.prefix === "permission");
    console.log(`  permission skew: ${permSkew?.hasSkew ? "있음" : "없음"} (${permSkew?.severity})`);

    // Day 1은 전부 v4 → 스큐 없음
    expect(permSkew?.hasSkew).toBe(false);
  });

  it("Day 2: payment-service가 v3에 머물러 있음 → 스큐 감지", () => {
    const records: AddressContextRecord[] = [];
    const sv = svcRef();

    // auth-service: 여전히 v4
    for (let i = 0; i < 300; i++) {
      const permAddr = encodePrefixByValue(DEMO_CATALOG, "permission", "v4", {
        perm_svc: sv, role: "admin",
      });
      records.push({
        address_context: { permission: `permission:v4:${permAddr}` },
        timestamp: new Date(2026, 2, 21, Math.floor(i / 30), i % 60, 0).toISOString(),
        session_id: "auth-service",
        trace_id: `trace-d2-${Math.floor(i / 5)}`,
      });
    }

    // payment-service: v3으로 롤백됨!
    for (let i = 0; i < 200; i++) {
      const permAddr = encodePrefixByValue(DEMO_CATALOG, "permission", "v3", {
        perm_svc: sv, role: "operator",
      });
      records.push({
        address_context: { permission: `permission:v3:${permAddr}` },
        timestamp: new Date(2026, 2, 21, 12 + Math.floor(i / 30), i % 60, 0).toISOString(),
        session_id: "payment-service",
        trace_id: `trace-d2-pay-${Math.floor(i / 5)}`,
      });
    }

    const usage = aggregateUsageData(DEMO_CATALOG, records);
    store.saveUsageSnapshot(usage);

    console.log("\n══ Day 2: 스큐 발생 ══");
    const skews = analyzeDeploymentSkew(usage.versionUsages);
    const permSkew = skews.find(s => s.prefix === "permission")!;
    console.log(`  permission: ${permSkew.severity} — ${permSkew.summary}`);
    for (const sc of permSkew.staleConsumers) {
      console.log(`    → ${sc.session}: ${sc.version} (${sc.count}건)`);
    }

    expect(permSkew.hasSkew).toBe(true);
    expect(permSkew.severity).toBe("critical");
    expect(permSkew.staleConsumers[0].session).toBe("payment-service");
  });

  it("Day 3: 새 패턴 발견 + converge 재평가", () => {
    const records: AddressContextRecord[] = [];
    const sv = svcRef();

    // checkout 흐름에서 page_view → endpoint → flow_point 패턴
    for (let i = 0; i < 500; i++) {
      const pvAddr = encodePrefixByValue(DEMO_CATALOG, "page_view", "v1", {
        svc_ref: sv, page: "checkout", locale: "ko", userType: "member",
      });
      const epAddr = encodePrefixByValue(DEMO_CATALOG, "endpoint", "v1", {
        svc_ref: sv, resource_type: "api", http_method: "POST", api_version: "v1",
      });
      const step = Math.random() < 0.85 ? "success" : "failure";
      const fpAddr = encodePrefixByValue(DEMO_CATALOG, "flow_point", "v1", {
        svc_ref: sv, flow_name: "checkout", flow_step: step, flow_variant: "default",
      });

      records.push({
        address_context: {
          page_view: `page_view:v1:${pvAddr}`,
          endpoint: `endpoint:v1:${epAddr}`,
          flow_point: `flow_point:v1:${fpAddr}`,
        },
        timestamp: new Date(2026, 2, 22, Math.floor(i / 50), (i % 50) * 1.2, 0).toISOString(),
        session_id: "web-app",
        trace_id: `trace-d3-${Math.floor(i / 3)}`,
        event_key: `flow.checkout.${step}`,
      });
    }

    const usage = aggregateUsageData(DEMO_CATALOG, records);
    store.saveUsageSnapshot(usage);

    console.log("\n══ Day 3: 패턴 발견 + 재평가 ══");
    console.log(`  records: ${records.length}`);
    console.log(`  co-occurrences: ${usage.coOccurrences.length}`);

    // converge-chain 실행
    const graph = store.loadGraph();
    const entriesMap = new Map<string, readonly string[]>();
    for (const [id, axis] of Object.entries(DEMO_CATALOG.axes)) {
      const versions = Object.keys(axis.versions);
      const latest = axis.versions[versions[versions.length - 1] as keyof typeof axis.versions] as any;
      if (latest?.entries) entriesMap.set(id, [...latest.entries]);
    }

    const converge = convergeChain(DEMO_CATALOG, graph, usage, { entriesMap, date: "2026-03-22" });

    console.log(`\n  Converge 결과:`);
    console.log(`    merge:       ${converge.summary.merges}`);
    console.log(`    deactivate:  ${converge.summary.deactivations}`);
    console.log(`    simplify:    ${converge.summary.simplifications}`);
    console.log(`    observe:     ${converge.summary.observations}`);

    // simplify: page_view에서 항상 checkout/ko/member만
    const simplifyActions = converge.actions.filter(a => a.kind === "simplify");
    if (simplifyActions.length > 0) {
      console.log(`\n  Simplify 발견:`);
      for (const s of simplifyActions.slice(0, 5)) {
        if (s.kind === "simplify") console.log(`    ✂ ${s.prefix}: ${s.suggestion}`);
      }
    }

    // observe: co-occurrence 기반 인과 후보
    const observeActions = converge.actions.filter(a => a.kind === "observe");
    if (observeActions.length > 0) {
      console.log(`\n  Observe 발견:`);
      for (const o of observeActions) {
        if (o.kind === "observe") console.log(`    👁 ${o.source}: ${o.finding.slice(0, 80)}`);
      }
    }

    expect(converge.summary.simplifications).toBeGreaterThan(0);
  });

  it("3일 누적 — 히스토리 비교", () => {
    const snapshots = store.loadRecentVersionUsages(10);

    console.log("\n══ 3일 히스토리 ══");
    console.log(`  스냅샷 ${snapshots.length}개 누적\n`);

    for (const snap of snapshots.reverse()) {
      const skews = analyzeDeploymentSkew(snap.versionUsages);
      const critical = skews.filter(s => s.severity === "critical");
      const versions = snap.versionUsages.map(v => `${v.prefix}:${v.version}(${v.count})`);

      console.log(`  #${snap.snapshotId} (${snap.collectedAt})`);
      console.log(`    versions: ${versions.slice(0, 5).join(", ")}${versions.length > 5 ? " ..." : ""}`);
      if (critical.length > 0) {
        console.log(`    🔴 스큐: ${critical.map(s => s.summary).join("; ")}`);
      } else {
        console.log(`    ✅ 스큐 없음`);
      }
    }

    expect(snapshots.length).toBe(3);

    // Day 1: 스큐 없음, Day 2: 스큐 있음
    const day1 = snapshots.find(s => s.snapshotId === 1)!;
    const day2 = snapshots.find(s => s.snapshotId === 2)!;
    const skew1 = analyzeDeploymentSkew(day1.versionUsages);
    const skew2 = analyzeDeploymentSkew(day2.versionUsages);

    expect(skew1.every(s => s.severity === "ok")).toBe(true);
    expect(skew2.some(s => s.severity === "critical")).toBe(true);
  });

  it("최종: systemHealthChain + store stats", () => {
    const graph = store.loadGraph();
    const health = systemHealthChain(graph);
    const stats = store.stats();

    console.log("\n══ 최종 상태 ══");
    console.log(`  Store: ${stats.nodes} nodes, ${stats.edges} edges, ${stats.snapshots} snapshots`);

    for (const step of health.steps) {
      const icon = step.status === "ok" ? "✅" : "⚠";
      console.log(`  ${icon} ${step.step}: ${step.message}`);
    }

    console.log(`\n  → 다음 행동:`);
    console.log(`    1. payment-service의 permission v3→v4 마이그레이션 진행`);
    console.log(`    2. page_view의 단일값 차원(항상 checkout/ko/member) — 실제 트래픽 다양화 후 재평가`);
    console.log(`    3. co-occurrence 패턴 안정화 확인 (3일 이상 누적 필요)`);
  });
});
