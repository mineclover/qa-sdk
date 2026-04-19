// @def.boundary spec-engine-system
// @def.doc spec-engine-system

import { describe, it, expect } from "vitest";
import { DEMO_CATALOG, encodePrefixByValue } from "demo-snapshot";
import { deriveFromCatalog, bootstrapDkg } from "dkg";
import { aggregateUsageData, filterUsageByCategory, groupUsageByCategory, summarizeByCategory, type AddressContextRecord, type PrefixNode } from "@qa-sdk/convergence";

describe("Category 기반 질의", () => {

  it("PrefixNode에 category가 설정된다", () => {
    const graph = deriveFromCatalog(DEMO_CATALOG);
    const groups = graph.groupPrefixesByCategory();

    console.log("\n══ Category별 prefix ══");
    for (const [cat, prefixes] of Object.entries(groups)) {
      console.log(`  [${cat}] ${prefixes.map(p => p.id).join(", ")}`);
    }

    // 6종 카테고리 중 최소 4종 존재
    expect(Object.keys(groups).length).toBeGreaterThanOrEqual(4);

    // event category에 *_event prefix들
    expect(groups.event?.some(p => p.id === "cart_event")).toBe(true);
    expect(groups.event?.some(p => p.id === "deploy_event")).toBe(true);

    // observation category
    expect(groups.observation?.some(p => p.id === "endpoint")).toBe(true);
    expect(groups.observation?.some(p => p.id === "page_view")).toBe(true);

    // policy category
    expect(groups.policy?.some(p => p.id === "permission")).toBe(true);
  });

  it("getPrefixesByCategory로 특정 category 필터", () => {
    const graph = deriveFromCatalog(DEMO_CATALOG);

    const events = graph.getPrefixesByCategory("event");
    const observations = graph.getPrefixesByCategory("observation");
    const policies = graph.getPrefixesByCategory("policy");

    console.log(`\n  events: ${events.map(p => p.id).join(", ")}`);
    console.log(`  observations: ${observations.map(p => p.id).join(", ")}`);
    console.log(`  policies: ${policies.map(p => p.id).join(", ")}`);

    expect(events.length).toBeGreaterThan(0);
    expect(observations.length).toBeGreaterThan(0);
    expect(policies.length).toBeGreaterThan(0);
  });

  it("UsageData를 category별로 슬라이싱", () => {
    const graph = deriveFromCatalog(DEMO_CATALOG);
    const svcRef = DEMO_CATALOG.prefixes.endpoint.versions[0].refEntries!.svc_ref.values[0];

    // 혼합 이벤트 생성 — observation + event prefix
    const records: AddressContextRecord[] = [];
    for (let i = 0; i < 100; i++) {
      // observation: endpoint
      const epAddr = encodePrefixByValue(DEMO_CATALOG, "endpoint", "v1", {
        svc_ref: svcRef, resource_type: "api", http_method: "POST", api_version: "v1",
      });
      records.push({
        address_context: { endpoint: `endpoint:v1:${epAddr}` },
        timestamp: new Date(2026, 2, 20, 0, 0, i).toISOString(),
      });
    }
    for (let i = 0; i < 50; i++) {
      // event: deploy_event
      const deAddr = encodePrefixByValue(DEMO_CATALOG, "deploy_event", "v1", {
        svc_ref: DEMO_CATALOG.prefixes.deploy_event.versions[0].refEntries!.svc_ref.values[0],
        deploy_action: "deploy",
      });
      records.push({
        address_context: { deploy_event: `deploy_event:v1:${deAddr}` },
        timestamp: new Date(2026, 2, 20, 1, 0, i).toISOString(),
      });
    }

    const usage = aggregateUsageData(DEMO_CATALOG, records);

    // observation만 필터
    const obsUsage = filterUsageByCategory(usage, graph, "observation");
    expect(obsUsage.addressUsages.every(a => a.prefix === "endpoint")).toBe(true);

    // event만 필터
    const evtUsage = filterUsageByCategory(usage, graph, "event");
    expect(evtUsage.addressUsages.every(a => a.prefix === "deploy_event")).toBe(true);

    // category별 요약
    const summary = summarizeByCategory(usage, graph);
    console.log("\n══ Category별 요약 ══");
    for (const s of summary) {
      console.log(`  [${s.category}] ${s.prefixCount} prefixes, ${s.totalHits} hits`);
    }

    expect(summary.some(s => s.category === "observation" && s.totalHits === 100)).toBe(true);
    expect(summary.some(s => s.category === "event" && s.totalHits === 50)).toBe(true);
  });
});
