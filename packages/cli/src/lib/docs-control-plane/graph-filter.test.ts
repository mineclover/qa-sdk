// @def.boundary docs-control-plane
// @def.doc docs-control-plane

import { describe, expect, it } from 'vitest';

import {
  buildDocumentGraphIndex,
  filterDocumentGraphRanking,
  normalizeDocumentEnvelope,
  rankDocumentGraphTraversal,
  traverseDocumentGraph,
  type DocumentEnvelope,
  type DocumentEnvelopeInput,
  type DocumentGraphEdgeKind,
  type DocumentGraphEdgeSummary,
  type TraversalAxis,
} from './index.js';

describe('docs-control-plane graph result filters', () => {
  it('filters ranked views by kind, role, axis, follow-up category, and archive state', () => {
    const index = buildDocumentGraphIndex(filterFixtureDocuments(), {
      includeContext: true,
      edges: [
        graphEdge('role', 'document:root-spec', 'document:root-todo'),
        graphEdge('role', 'document:root-spec', 'document:root-plan'),
        graphEdge('trace', 'document:root-spec', 'document:archived-prd'),
      ],
    });
    const traversal = traverseDocumentGraph(index, {
      target: 'root-spec',
      axes: ['role', 'trace'],
      direction: 'out',
      depth: 1,
      limit: 20,
    });
    const rawNodeIds = traversal.nodes.map((node) => node.id);
    const rawEdgeIds = traversal.edges.map((edge) => edge.id);
    const rawPaths = traversal.paths;
    const ranking = rankDocumentGraphTraversal(traversal);
    const unfilteredRanking = ranking.rankedNodes.map((node) => ({
      nodeId: node.nodeId,
      rank: node.rank,
      score: node.score,
      strength: node.strength,
    }));

    const filtered = filterDocumentGraphRanking(ranking, {
      kinds: ['todo', 'plan'],
      roles: ['todo'],
      axes: ['role'],
      followUpCategories: ['actionable'],
    });

    expect(traversal.nodes.map((node) => node.id)).toEqual(rawNodeIds);
    expect(traversal.edges.map((edge) => edge.id)).toEqual(rawEdgeIds);
    expect(traversal.paths).toBe(rawPaths);
    expect(
      ranking.rankedNodes.map((node) => ({
        nodeId: node.nodeId,
        rank: node.rank,
        score: node.score,
        strength: node.strength,
      })),
    ).toEqual(unfilteredRanking);
    expect(filtered.filtering.filters).toMatchObject({
      kinds: ['todo', 'plan'],
      roles: ['todo'],
      axes: ['role'],
      followUpCategories: ['actionable'],
      includeArchive: false,
    });
    expect(filtered.ranking.rankedNodes.map((node) => node.nodeId)).toEqual(['document:root-todo']);
    expect(filtered.ranking.rankedNodes.map((node) => node.rank)).toEqual([1]);
    expect(filtered.filtering.counts.excludedByArchive).toBe(1);
    expect(filtered.filtering.counts.excludedByFilters).toBeGreaterThan(0);

    const withArchive = filterDocumentGraphRanking(ranking, { includeArchive: true });
    expect(withArchive.ranking.rankedNodes.map((node) => node.nodeId)).toContain(
      'document:archived-prd',
    );
    expect(withArchive.filtering.counts.excludedByArchive).toBe(0);
  });
});

function filterFixtureDocuments(): readonly DocumentEnvelope[] {
  return [
    document('root-spec', 'spec', 'docs/root/root.spec.md', {
      familyId: 'docs/root/root',
    }),
    document('root-todo', 'todo', 'docs/root/root.todo.md', {
      familyId: 'docs/root/root',
      metadata: {
        followUpCategory: 'actionable',
      },
    }),
    document('root-plan', 'plan', 'docs/root/root.plan.md', {
      familyId: 'docs/root/root',
      metadata: {
        followUpCategory: 'deferred',
      },
    }),
    document('archived-prd', 'prd', 'tasks/archive/archived-prd.md', {
      familyId: 'tasks/archive/archived-prd',
      metadata: {
        lifecycle: 'archived',
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
    adapterId: 'fixture',
    kind,
    stableId,
    ...(options.familyId ? { familyId: options.familyId } : {}),
    path,
    metadata: {
      documentKind: kind,
      ...options.metadata,
    },
    links: [],
    sources: [],
    sections: [],
    tasks: [],
    evidence: [],
    diagnostics: [],
    rawSource: {
      path,
      sourceSchema: 'fixture',
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
        adapterId: 'fixture',
        reason: `${axis} edge`,
        targetNodeId: toNodeId,
        metadata: {
          axis,
        },
      },
    ],
    metadata: {},
  };
}

function edgeKind(axis: TraversalAxis): DocumentGraphEdgeKind {
  if (axis === 'source') return 'document-source';
  if (axis === 'evidence') return 'document-evidence';
  if (axis === 'trace') return 'task-trace';
  if (axis === 'role') return 'role-membership';
  if (axis === 'context') return 'context-metadata';
  if (axis === 'constraint') return 'document-constraint';
  return 'authored-link';
}
