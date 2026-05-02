// @def.boundary docs-control-plane
// @def.doc docs-control-plane

import { describe, expect, it } from "vitest";

import {
  buildDocumentGraphIndex,
  DOCUMENT_GRAPH_RANK_FACTORS,
  normalizeDocumentEnvelope,
  rankDocumentGraphTraversal,
  traverseDocumentGraph,
  type DocumentEnvelope,
  type DocumentEnvelopeInput,
  type DocumentGraphEdgeKind,
  type DocumentGraphEdgeSummary,
  type TraversalAxis,
} from "./index.js";

describe("docs-control-plane graph ranking", () => {
  it("reranks traversal results without modifying raw traversal output", () => {
    const index = buildDocumentGraphIndex(rankingFixtureDocuments(), {
      includeContext: true,
      edges: [
        graphEdge("role", "document:root-spec", "document:root-todo"),
        graphEdge("source", "document:root-spec", "source:packages/root/index.ts"),
        graphEdge("evidence", "document:root-spec", "evidence:root-proof"),
        graphEdge("trace", "document:root-spec", "document:live-prd"),
        graphEdge("trace", "document:root-spec", "document:archived-prd"),
        graphEdge("context", "document:root-spec", "context:tag:root"),
      ],
    });
    const traversal = traverseDocumentGraph(index, {
      target: "root-spec",
      axes: ["role", "source", "evidence", "trace", "context"],
      direction: "out",
      depth: 1,
      limit: 20,
      includeContext: true,
    });
    const rawSnapshot = traversalSnapshot(traversal);

    const ranking = rankDocumentGraphTraversal(traversal);
    const rankedIds = ranking.rankedNodes.map((node) => node.nodeId);

    expect(traversalSnapshot(traversal)).toEqual(rawSnapshot);
    expect(ranking.algorithm).toBe("docs-graph-rule-rank-v1");
    expect(rankedIds[0]).toBe("document:root-spec");
    expect(orderOf(rankedIds, "document:root-todo")).toBeLessThan(
      orderOf(rankedIds, "document:live-prd"),
    );
    expect(orderOf(rankedIds, "source:packages/root/index.ts")).toBeLessThan(
      orderOf(rankedIds, "context:tag:root"),
    );
    expect(orderOf(rankedIds, "evidence:root-proof")).toBeLessThan(
      orderOf(rankedIds, "context:tag:root"),
    );
    expect(orderOf(rankedIds, "document:live-prd")).toBeLessThan(
      orderOf(rankedIds, "document:archived-prd"),
    );
    expect(rankDocumentGraphTraversal(traversal).rankedNodes.map((node) => node.nodeId)).toEqual(
      rankedIds,
    );
  });

  it("emits factor-level reasons for target, distance, axis, kind, role, archive, diagnostics, and follow-up category", () => {
    const index = buildDocumentGraphIndex(rankingFixtureDocuments(), {
      includeContext: true,
      edges: [
        graphEdge("role", "document:root-spec", "document:root-todo"),
        graphEdge("trace", "document:root-spec", "document:live-prd"),
        graphEdge("trace", "document:root-spec", "document:archived-prd"),
      ],
    });
    const traversal = traverseDocumentGraph(index, {
      target: "root-spec",
      axes: ["role", "trace"],
      direction: "out",
      depth: 1,
      limit: 20,
    });
    const ranking = rankDocumentGraphTraversal(traversal);
    const roleNode = rankedNode(ranking.rankedNodes, "document:root-todo");
    const liveTraceNode = rankedNode(ranking.rankedNodes, "document:live-prd");
    const archivedNode = rankedNode(ranking.rankedNodes, "document:archived-prd");

    expect(roleNode.factors.map((factor) => factor.factor)).toEqual([
      ...DOCUMENT_GRAPH_RANK_FACTORS,
    ]);
    expect(roleNode).toMatchObject({
      rank: expect.any(Number),
      score: expect.any(Number),
      strength: "strong",
    });
    expect(roleNode.factors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          factor: "role",
          score: expect.any(Number),
          reason: expect.stringContaining("same-family"),
        }),
        expect.objectContaining({
          factor: "follow-up-category",
          score: expect.any(Number),
          reason: "follow-up category actionable",
        }),
      ]),
    );
    expect(roleNode.reasonSummary.join("\n")).toContain("role:+34");
    expect(liveTraceNode.factors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          factor: "diagnostics",
          score: -8,
          metadata: { error: 0, warning: 1, info: 0 },
        }),
      ]),
    );
    expect(archivedNode.factors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          factor: "archive-state",
          score: -45,
          reason: "archived document",
        }),
      ]),
    );
  });
});

function rankingFixtureDocuments(): readonly DocumentEnvelope[] {
  return [
    document("root-spec", "spec", "docs/root/root.spec.md", {
      familyId: "docs/root/root",
      metadata: {
        lifecycle: "approved",
      },
    }),
    document("root-todo", "todo", "docs/root/root.todo.md", {
      familyId: "docs/root/root",
      metadata: {
        lifecycle: "draft",
        followUpCategory: "actionable",
      },
    }),
    document("live-prd", "prd", "tasks/live-prd.md", {
      familyId: "tasks/live-prd",
      metadata: {
        diagnosticCount: 1,
      },
    }),
    document("archived-prd", "prd", "tasks/archive/archived-prd.md", {
      familyId: "tasks/archive/archived-prd",
      metadata: {
        lifecycle: "archived",
      },
    }),
  ];
}

function document(
  stableId: string,
  kind: string,
  path: string,
  options: {
    readonly familyId?: string;
    readonly metadata?: Record<string, unknown>;
  } = {},
): DocumentEnvelope {
  return normalizeDocumentEnvelope({
    adapterId: "fixture",
    kind,
    stableId,
    ...(options.familyId ? { familyId: options.familyId } : {}),
    path,
    metadata: {
      documentKind: kind,
      ...(options.metadata ?? {}),
    },
    links: [],
    sources: [],
    sections: [],
    tasks: [],
    evidence: [],
    diagnostics: [],
    rawSource: {
      path,
      sourceSchema: "fixture",
    },
  } satisfies DocumentEnvelopeInput);
}

function graphEdge(
  axis: TraversalAxis,
  fromNodeId: string,
  toNodeId: string,
): DocumentGraphEdgeSummary {
  return {
    id: `fixture:${axis}:${fromNodeId}->${toNodeId}`,
    kind: edgeKind(axis),
    axis,
    fromNodeId,
    toNodeId,
    authoredType: axis,
    reasons: [
      {
        adapterId: "fixture",
        reason: `${axis} edge`,
        targetNodeId: toNodeId,
        metadata: {
          axis,
          familyId: axis === "role" ? "docs/root/root" : undefined,
        },
      },
    ],
    metadata: axis === "role" ? { familyId: "docs/root/root" } : {},
  };
}

function edgeKind(axis: TraversalAxis): DocumentGraphEdgeKind {
  if (axis === "source") return "document-source";
  if (axis === "evidence") return "document-evidence";
  if (axis === "trace") return "task-trace";
  if (axis === "role") return "role-membership";
  if (axis === "context") return "context-metadata";
  if (axis === "constraint") return "document-constraint";
  return "authored-link";
}

function rankedNode<T extends { readonly nodeId: string }>(
  nodes: readonly T[],
  nodeId: string,
): T {
  const node = nodes.find((item) => item.nodeId === nodeId);
  if (!node) throw new Error(`Missing ranked node ${nodeId}`);
  return node;
}

function orderOf(values: readonly string[], value: string): number {
  const index = values.indexOf(value);
  if (index < 0) throw new Error(`Missing value ${value}`);
  return index;
}

function traversalSnapshot(
  traversal: ReturnType<typeof traverseDocumentGraph>,
): unknown {
  return {
    nodeIds: traversal.nodes.map((node) => node.id),
    edgeIds: traversal.edges.map((edge) => edge.id),
    paths: traversal.paths,
  };
}
