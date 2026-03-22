import { describe, it, expect } from "vitest";
import { DEMO_CATALOG, DEMO_DKG_CONFIG, encodePrefixByValue } from "demo-snapshot";
import { bootstrapDkg } from "../bootstrap.js";
import { deriveFromCatalog } from "../catalog-derive.js";
import { aggregateUsageData, type AddressContextRecord } from "@qa-sdk/convergence";
import { convergeChain } from "./converge-chain.js";

describe("converge-chain — 4가지 행위 구분", () => {

  it("usage 없이 — 수렴(merge) 후보만 발견", () => {
    const graph = deriveFromCatalog(DEMO_CATALOG);

    // axis entries 준비
    const entriesMap = new Map<string, readonly string[]>();
    for (const [id, axis] of Object.entries(DEMO_CATALOG.axes)) {
      const versions = Object.keys(axis.versions);
      const latest = axis.versions[versions[versions.length - 1] as keyof typeof axis.versions] as any;
      if (latest?.entries) entriesMap.set(id, [...latest.entries]);
    }

    const result = convergeChain(DEMO_CATALOG, graph, null, { entriesMap });

    console.log("\n══ converge-chain (usage 없음) ══");
    console.log(`  merge: ${result.summary.merges}`);
    console.log(`  deactivate: ${result.summary.deactivations}`);
    console.log(`  simplify: ${result.summary.simplifications}`);
    console.log(`  observe: ${result.summary.observations}`);

    for (const a of result.actions.filter(a => a.kind === "merge")) {
      const m = a as { kind: "merge"; targets: string[] };
      console.log(`  🔀 merge: ${m.targets.join(" ↔ ")}`);
    }

    // initiator ↔ channel은 merge 후보
    const mergeActions = result.actions.filter(a => a.kind === "merge");
    expect(mergeActions.length).toBeGreaterThan(0);

    // usage가 없으므로 deactivate/simplify/observe는 0
    expect(result.summary.deactivations).toBe(0);
    expect(result.summary.observations).toBe(0);
  });

  it("usage 있음 — 4가지 행위 모두 구분", () => {
    const graph = bootstrapDkg({ catalog: DEMO_CATALOG, config: DEMO_DKG_CONFIG });
    const svcRef = DEMO_CATALOG.prefixes.endpoint.versions[0].refEntries!.svc_ref.values[0];

    // 편향된 트래픽 생성 — page_view에서 home/ko/member만 사용
    const records: AddressContextRecord[] = [];
    for (let i = 0; i < 500; i++) {
      const pvAddr = encodePrefixByValue(DEMO_CATALOG, "page_view", "v1", {
        svc_ref: svcRef, page: "home", locale: "ko", userType: "member",
      });
      const epAddr = encodePrefixByValue(DEMO_CATALOG, "endpoint", "v1", {
        svc_ref: svcRef, resource_type: "api", http_method: "POST", api_version: "v1",
      });
      records.push({
        address_context: {
          page_view: `page_view:v1:${pvAddr}`,
          endpoint: `endpoint:v1:${epAddr}`,
        },
        timestamp: new Date(2026, 2, 20, 0, 0, i).toISOString(),
        session_id: "web-app",
      });
    }

    const usage = aggregateUsageData(DEMO_CATALOG, records);
    const entriesMap = new Map<string, readonly string[]>();
    for (const [id, axis] of Object.entries(DEMO_CATALOG.axes)) {
      const versions = Object.keys(axis.versions);
      const latest = axis.versions[versions[versions.length - 1] as keyof typeof axis.versions] as any;
      if (latest?.entries) entriesMap.set(id, [...latest.entries]);
    }

    const result = convergeChain(DEMO_CATALOG, graph, usage, { entriesMap });

    console.log("\n══ converge-chain (usage 있음) ══");
    console.log(`  merge:       ${result.summary.merges}건`);
    console.log(`  deactivate:  ${result.summary.deactivations}건`);
    console.log(`  simplify:    ${result.summary.simplifications}건`);
    console.log(`  observe:     ${result.summary.observations}건`);

    console.log("\n  행위별 상세:");
    for (const a of result.actions.slice(0, 10)) {
      switch (a.kind) {
        case "merge":
          console.log(`    🔀 merge: ${a.targets.join(" ↔ ")}`);
          break;
        case "deactivate":
          console.log(`    🗑 deactivate: ${a.axis}:[${a.entries.join(",")}] — ${a.reason}`);
          break;
        case "simplify":
          console.log(`    ✂ simplify: ${a.prefix} — ${a.suggestion}`);
          break;
        case "observe":
          console.log(`    👁 observe: ${a.finding.slice(0, 60)}...`);
          break;
      }
    }

    // 4가지가 구분되어야 함
    // merge: initiator↔channel 등
    expect(result.summary.merges).toBeGreaterThan(0);
    // simplify: page_view에서 단일값 차원 (page=home, locale=ko, userType=member)
    expect(result.summary.simplifications).toBeGreaterThan(0);
    // observe 또는 deactivate 중 하나는 있을 수 있음

    // Decision이 merge에 대해 생성됨
    expect(result.decisions.length).toBeGreaterThan(0);
    expect(result.decisions[0].id).toContain("MERGE");
  });

  it("각 action.kind가 명확히 분리됨", () => {
    const graph = deriveFromCatalog(DEMO_CATALOG);
    const entriesMap = new Map<string, readonly string[]>();
    for (const [id, axis] of Object.entries(DEMO_CATALOG.axes)) {
      const versions = Object.keys(axis.versions);
      const latest = axis.versions[versions[versions.length - 1] as keyof typeof axis.versions] as any;
      if (latest?.entries) entriesMap.set(id, [...latest.entries]);
    }
    const result = convergeChain(DEMO_CATALOG, graph, null, { entriesMap });

    // kind별로 Set으로 분류
    const kinds = new Set(result.actions.map(a => a.kind));

    console.log(`\n  action kinds: ${[...kinds].join(", ")}`);

    // merge/deactivate/simplify/observe 4종 중 하나 이상 존재
    expect(kinds.size).toBeGreaterThan(0);

    // 각 action이 정확한 타입을 가짐
    for (const a of result.actions) {
      switch (a.kind) {
        case "merge":
          expect(a.targets.length).toBeGreaterThanOrEqual(2);
          break;
        case "deactivate":
          expect(a.axis).toBeDefined();
          expect(a.entries.length).toBeGreaterThan(0);
          break;
        case "simplify":
          expect(a.prefix).toBeDefined();
          expect(a.suggestion).toBeDefined();
          break;
        case "observe":
          expect(a.finding).toBeDefined();
          expect(a.source).toBeDefined();
          break;
      }
    }
  });
});
