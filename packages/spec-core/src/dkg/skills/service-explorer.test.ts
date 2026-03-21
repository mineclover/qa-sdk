/**
 * service-explorer — 탐색 skill 테스트.
 */

import { describe, it, expect } from "vitest";
import { DEMO_CATALOG } from "demo-snapshot";
import { bootstrapDkg } from "../bootstrap.js";
import { createDemoTopology } from "../service-topology.js";
import {
  exploreService,
  explorePrefix,
  exploreDsl,
  systemOverview,
} from "./service-explorer.js";

const graph = bootstrapDkg();
const topo = createDemoTopology();

describe("exploreService", () => {
  it("returns null for unknown service", () => {
    expect(exploreService(graph, topo, DEMO_CATALOG, "nonexistent")).toBeNull();
  });

  it("returns profile for shopping-backend", () => {
    const profile = exploreService(graph, topo, DEMO_CATALOG, "shopping-backend");
    expect(profile).not.toBeNull();
    expect(profile!.serviceId).toBe("shopping-backend");
    expect(profile!.name).toBe("쇼핑 백엔드");
    expect(profile!.team).toBe("backend");
    expect(profile!.status).toBe("active");

    // owned prefixes
    expect(profile!.ownedPrefixes.length).toBeGreaterThan(0);
    const permOwned = profile!.ownedPrefixes.find(p => p.id === "permission");
    expect(permOwned).toBeDefined();
    expect(permOwned!.dimCount).toBeGreaterThan(0);

    // consumed prefixes
    expect(profile!.consumedPrefixes.length).toBeGreaterThan(0);

    // contracts (provider of SC-permission)
    expect(profile!.contracts.some(c => c.id === "SC-permission")).toBe(true);

    // DSL bindings
    expect(profile!.dslBindings).toContain("dsl-checkout");

    // dependencies
    expect(profile!.dependencies.length).toBeGreaterThan(0);
  });

  it("returns profile for infra-controller with many owned prefixes", () => {
    const profile = exploreService(graph, topo, DEMO_CATALOG, "infra-controller");
    expect(profile).not.toBeNull();
    expect(profile!.ownedPrefixes.length).toBeGreaterThanOrEqual(5);
    // infra-controller has no consumed prefixes
    expect(profile!.consumedPrefixes.length).toBe(0);
  });
});

describe("explorePrefix", () => {
  it("returns null for unknown prefix", () => {
    expect(explorePrefix(graph, topo, DEMO_CATALOG, "nonexistent")).toBeNull();
  });

  it("returns profile for permission prefix", () => {
    const profile = explorePrefix(graph, topo, DEMO_CATALOG, "permission");
    expect(profile).not.toBeNull();
    expect(profile!.id).toBe("permission");
    expect(profile!.name).toBeTruthy();

    // dimensions
    expect(profile!.dimensions.length).toBeGreaterThan(0);
    const axisDims = profile!.dimensions.filter(d => d.kind === "axis");
    expect(axisDims.length).toBeGreaterThan(0);

    // headroom — at least one axis dimension
    expect(profile!.headroom.length).toBeGreaterThan(0);
    for (const hr of profile!.headroom) {
      expect(hr.capacity).toBeGreaterThanOrEqual(hr.entries);
    }

    // owner
    expect(profile!.owner).toBe("shopping-backend");

    // consumers
    expect(profile!.consumers.length).toBeGreaterThan(0);

    // domains
    expect(profile!.domains.length).toBeGreaterThan(0);
  });

  it("returns profile for deploy_event with intent-links", () => {
    const profile = explorePrefix(graph, topo, DEMO_CATALOG, "deploy_event");
    expect(profile).not.toBeNull();
    // deploy_event is in IL-infra-impact intent link
    expect(profile!.intentLinks.some(l => l.id === "IL-infra-impact")).toBe(true);
  });
});

describe("exploreDsl", () => {
  it("returns null for unknown DSL", () => {
    expect(exploreDsl(graph, DEMO_CATALOG, "nonexistent")).toBeNull();
  });

  it("returns profile for dsl-observation", () => {
    const profile = exploreDsl(graph, DEMO_CATALOG, "dsl-observation");
    expect(profile).not.toBeNull();
    expect(profile!.id).toBe("dsl-observation");
    expect(profile!.name).toBe("관측 DSL");

    // members
    expect(profile!.members.length).toBeGreaterThan(0);
    expect(profile!.members.some(m => m.prefixId === "page_view")).toBe(true);

    // service binding
    expect(profile!.serviceBinding.prefixId).toBe("service");
    expect(profile!.serviceBinding.fixedDims).toContain("env");

    // invariants
    expect(profile!.invariants.length).toBeGreaterThan(0);
  });

  it("returns version skew analysis for dsl-checkout", () => {
    const profile = exploreDsl(graph, DEMO_CATALOG, "dsl-checkout");
    expect(profile).not.toBeNull();
    expect(profile!.versionSkew).toBeDefined();
    expect(["ok", "minor", "major"]).toContain(profile!.versionSkew.severity);
  });
});

describe("systemOverview", () => {
  it("returns comprehensive overview", () => {
    const overview = systemOverview(graph, topo, DEMO_CATALOG);

    // services
    expect(overview.services.length).toBeGreaterThanOrEqual(5);
    for (const svc of overview.services) {
      expect(svc.serviceId).toBeTruthy();
      expect(svc.name).toBeTruthy();
    }

    // dependency graph
    expect(overview.dependencyGraph.edgeCount).toBeGreaterThan(0);

    // domain health
    expect(overview.domainHealth.length).toBeGreaterThan(0);

    // node/edge count
    expect(overview.nodeCount).toBeGreaterThan(0);
    expect(overview.edgeCount).toBeGreaterThan(0);
  });
});
