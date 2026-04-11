import { describe, expect, it } from "vitest";

import {
  authorizationGraphToOntologyView,
  layoutOntologyGraph,
  operationalStoreToOntologyView,
  renderOntologyGraphSvg,
} from "./ontology-graph.js";

describe("ontology graph view model", () => {
  it("converts operational store records into lane nodes and metrics", () => {
    const model = operationalStoreToOntologyView({
      objects: [
        {
          objectId: "governance-run:one",
          objectKind: "governance_run",
          canonicalKey: "governance:one",
          schemaVersion: "v1",
          lifecycle: "active",
          createdAt: "2026-04-12T00:00:00.000Z",
          updatedAt: "2026-04-12T00:00:00.000Z",
        },
      ],
      facets: [
        {
          objectId: "governance-run:one",
          facetKind: "status",
          payloadJson: { state: "passed" },
        },
      ],
      observations: [
        {
          observationId: "obs:one",
          targetObjectId: "governance-run:one",
          observationKind: "governance_evaluated",
          observedAt: "2026-04-12T00:01:00.000Z",
        },
      ],
      projections: [
        {
          projectionId: "snapshot:one",
          projectionKind: "runtime_snapshot",
          targetScope: "demo",
          payloadJson: {},
          builtFrom: [],
          builtAt: "2026-04-12T00:00:30.000Z",
        },
      ],
    });

    expect(model.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "snapshot:one", lane: "snapshot" }),
        expect.objectContaining({ id: "governance-run:one", lane: "governance", status: "passed" }),
      ]),
    );
    expect(model.metrics).toEqual(
      expect.objectContaining({ objects: 1, projections: 1, observations: 1, governanceRuns: 1 }),
    );
  });

  it("converts authorization graph nodes into semantic lanes", () => {
    const model = authorizationGraphToOntologyView({
      nodes: [
        {
          nodeId: "policy:one",
          kind: "policy",
          coord: { anchor: "policy-one", taxonomies: { node_kind: "policy" } },
        },
        {
          nodeId: "route:one",
          kind: "resource",
          coord: { anchor: "route-one", taxonomies: { resource_kind: "proxy_route" } },
        },
      ],
      relations: [
        {
          relationId: "edge:one",
          kind: "protects",
          fromNodeId: "policy:one",
          toNodeId: "route:one",
        },
      ],
    });

    expect(model.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "policy:one", lane: "policy" }),
        expect.objectContaining({ id: "route:one", lane: "proxy" }),
      ]),
    );
    expect(model.edges).toEqual([
      expect.objectContaining({ from: "policy:one", to: "route:one", label: "protects" }),
    ]);
  });

  it("lays out and renders an ontology graph as SVG", () => {
    const layout = layoutOntologyGraph({
      nodes: [
        { id: "snapshot:one", label: "snapshot", kind: "runtime_snapshot", lane: "snapshot" },
        { id: "corridor:one", label: "corridor", kind: "corridor", lane: "corridor" },
      ],
      edges: [{ from: "snapshot:one", to: "corridor:one", label: "contains" }],
    });

    const svg = renderOntologyGraphSvg(layout);

    expect(layout.nodes[0].x).toBeLessThan(layout.nodes[1].x);
    expect(svg).toContain("ontology-graph-svg");
    expect(svg).toContain("snapshot:one");
    expect(svg).toContain("corridor:one");
  });
});
