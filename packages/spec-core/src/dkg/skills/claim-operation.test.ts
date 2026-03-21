import { describe, it, expect } from "vitest";
import { DEMO_CATALOG, DEMO_DKG_CONFIG } from "demo-snapshot";
import { bootstrapDkg } from "../bootstrap.js";
import { createDemoTopology } from "../service-topology.js";
import {
  prepareClaim,
  prepareRelease,
  analyzeClaimImpact,
  claimKey,
} from "./claim-operation.js";

const graph = bootstrapDkg({ catalog: DEMO_CATALOG, config: DEMO_DKG_CONFIG });
const topo = createDemoTopology();

describe("claimKey", () => {
  it("올바른 키 형식", () => {
    expect(claimKey("order_event")).toBe("claim:order_event");
  });
});

describe("analyzeClaimImpact", () => {
  it("prefix의 영향 범위를 분석한다", () => {
    const impact = analyzeClaimImpact(graph, topo, "order_event");
    expect(impact.owner).toBe("shopping-backend");
    expect(impact.consumers).toContain("payment");
    expect(impact.domains.length).toBeGreaterThan(0);
    expect(impact.dslBundles.length).toBeGreaterThan(0);
    expect(impact.intentLinks).toContain("IL-checkout-flow");
  });

  it("axis의 영향 범위를 분석한다", () => {
    const impact = analyzeClaimImpact(graph, topo, "role");
    expect(impact.affectedPrefixes.length).toBeGreaterThan(0);
  });

  it("존재하지 않는 노드는 빈 영향", () => {
    const impact = analyzeClaimImpact(graph, topo, "nonexistent");
    expect(impact.owner).toBeNull();
    expect(impact.consumers).toEqual([]);
  });
});

describe("prepareClaim", () => {
  it("대상 없으면 blocked", () => {
    const result = prepareClaim(graph, topo, "nonexistent", "test", null);
    expect(result.verdict).toBe("blocked");
  });

  it("이미 claim 중이면 blocked", () => {
    const existing = { by: "someone", at: "2026-01-01T00:00:00Z" };
    const result = prepareClaim(graph, topo, "order_event", "test", existing);
    expect(result.verdict).toBe("blocked");
    expect(result.reason).toContain("someone");
  });

  it("성공 시 claim + impact 반환", () => {
    const result = prepareClaim(graph, topo, "order_event", "junwoo", null);
    expect(result.verdict).toBe("ok");
    expect(result.claim).not.toBeNull();
    expect(result.claim!.by).toBe("junwoo");
    expect(result.impact).not.toBeNull();
    expect(result.impact!.owner).toBe("shopping-backend");
  });
});

describe("prepareRelease", () => {
  it("claim 없으면 blocked", () => {
    const result = prepareRelease(graph, "order_event", null);
    expect(result.verdict).toBe("blocked");
  });

  it("성공 시 observation 반환", () => {
    const claim = { by: "junwoo", at: "2026-03-20T00:00:00Z" };
    const result = prepareRelease(graph, "order_event", claim);
    expect(result.verdict).toBe("ok");
    expect(result.observation).not.toBeNull();
    expect(result.observation!.kind).toBe("observation");
    expect(result.observation!.source).toBe("manual");
    expect(result.observation!.finding).toContain("junwoo");
    expect(result.edges.length).toBe(1);
    expect(result.previousClaim).toEqual(claim);
  });
});
