import { describe, expect, it } from "vitest";

import {
  buildDocumentGraphIndex,
  filterDocumentGraphRanking,
  normalizeDocumentEnvelope,
  rankDocumentGraphTraversal,
  summarizeDocumentGraphResult,
  traverseDocumentGraph,
  type DocumentEnvelope,
  type DocumentEnvelopeInput,
  type DocumentGraphEdgeKind,
  type DocumentGraphEdgeSummary,
  type TraversalAxis,
} from "./index.js";

describe("docs-control-plane graph result summary", () => {
  it("summarizes filtered graph views by kind, axis, role, follow-up, archive, and diagnostics", () => {
    const index = buildDocumentGraphIndex(summaryFixtureDocuments(), {
      edges: [
        graphEdge("role", "document:root-spec", "document:root-todo"),
        graphEdge("role", "document:root-spec", "document:root-plan"),
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
    const filtered = filterDocumentGraphRanking(ranking);

    const summary = summarizeDocumentGraphResult(traversal, filtered.filtering);

    expect(summary).toMatchObject({
      algorithm: "docs-graph-result-summary-v1",
      scope: "filtered",
      nodes: 3,
      edges: 2,
      paths: 3,
      diagnostics: 2,
      diagnosticCounts: {
        traversal: 0,
        node: 2,
        bySeverity: {
          error: 0,
          warning: 2,
          info: 0,
        },
      },
      archive: {
        included: 0,
        excluded: 1,
      },
      counts: {
        byNodeKind: {
          spec: 1,
          todo: 1,
          plan: 1,
        },
        byTraversalAxis: {
          role: 2,
        },
        byDocumentRole: {
          spec: 1,
          todo: 1,
          plan: 1,
        },
        byFollowUpCategory: {
          actionable: 1,
          deferred: 1,
        },
      },
    });

    const withArchive = filterDocumentGraphRanking(ranking, { includeArchive: true });
    const archiveSummary = summarizeDocumentGraphResult(traversal, withArchive.filtering);

    expect(archiveSummary.archive).toEqual({
      included: 1,
      excluded: 0,
    });
    expect(archiveSummary.counts.byTraversalAxis).toMatchObject({
      role: 2,
      trace: 1,
    });
    expect(archiveSummary.counts.byNodeKind).toMatchObject({
      prd: 1,
    });
  });
});

function summaryFixtureDocuments(): readonly DocumentEnvelope[] {
  return [
    document("root-spec", "spec", "docs/root/root.spec.md", {
      familyId: "docs/root/root",
    }),
    document("root-todo", "todo", "docs/root/root.todo.md", {
      familyId: "docs/root/root",
      metadata: {
        followUpCategory: "actionable",
      },
    }),
    document("root-plan", "plan", "docs/root/root.plan.md", {
      familyId: "docs/root/root",
      metadata: {
        diagnosticCount: 2,
        followUpCategory: "deferred",
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
