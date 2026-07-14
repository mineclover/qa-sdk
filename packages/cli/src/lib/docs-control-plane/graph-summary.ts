// @def.boundary docs-control-plane
// @def.doc docs-control-plane

import type { DocumentGraphFilterResult } from './graph-filter.js';
import type { DocumentGraphRankedNode } from './graph-rank.js';
import type { DocumentGraphTraversalResult } from './graph-traverse.js';
import {
  CANONICAL_TRAVERSAL_AXES,
  DOCUMENT_GRAPH_FAMILY_ROLE_TYPES,
  DOCUMENT_GRAPH_NODE_KINDS,
  TRAVERSAL_AXIS_PRIORITY,
  type TraversalAxis,
} from './graph-types.js';

export const DOCUMENT_GRAPH_SUMMARY_ALGORITHM = 'docs-graph-result-summary-v1';

export interface DocumentGraphSummaryArchiveCounts {
  readonly included: number;
  readonly excluded: number;
}

export interface DocumentGraphSummaryDiagnosticCounts {
  readonly traversal: number;
  readonly node: number;
  readonly bySeverity: {
    readonly error: number;
    readonly warning: number;
    readonly info: number;
  };
}

export interface DocumentGraphResultSummary {
  readonly algorithm: typeof DOCUMENT_GRAPH_SUMMARY_ALGORITHM;
  readonly scope: 'filtered';
  readonly nodes: number;
  readonly edges: number;
  readonly paths: number;
  readonly diagnostics: number;
  readonly diagnosticCounts: DocumentGraphSummaryDiagnosticCounts;
  readonly archive: DocumentGraphSummaryArchiveCounts;
  readonly counts: {
    readonly byNodeKind: Readonly<Record<string, number>>;
    readonly byTraversalAxis: Readonly<Record<string, number>>;
    readonly byDocumentRole: Readonly<Record<string, number>>;
    readonly bySemanticType: Readonly<Record<string, number>>;
    readonly byFollowUpCategory: Readonly<Record<string, number>>;
  };
}

export function summarizeDocumentGraphResult(
  traversal: DocumentGraphTraversalResult,
  filtering: DocumentGraphFilterResult,
): DocumentGraphResultSummary {
  const nodes = filtering.filteredNodes;
  const includedNodeIds = new Set(nodes.map((node) => node.nodeId));
  const diagnostics = countDiagnostics(traversal, nodes);
  const nodeDiagnosticTotal =
    diagnostics.bySeverity.error + diagnostics.bySeverity.warning + diagnostics.bySeverity.info;

  return {
    algorithm: DOCUMENT_GRAPH_SUMMARY_ALGORITHM,
    scope: 'filtered',
    nodes: nodes.length,
    edges: traversal.edges.filter(
      (edge) => includedNodeIds.has(edge.fromNodeId) && includedNodeIds.has(edge.toNodeId),
    ).length,
    paths: traversal.paths.filter((path) => includedNodeIds.has(path.nodeId)).length,
    diagnostics: diagnostics.traversal + nodeDiagnosticTotal,
    diagnosticCounts: {
      ...diagnostics,
      node: nodeDiagnosticTotal,
    },
    archive: {
      included: nodes.filter(isArchiveRankedNode).length,
      excluded: filtering.counts.excludedByArchive,
    },
    counts: {
      byNodeKind: countByNodeKind(nodes),
      byTraversalAxis: countByTraversalAxis(nodes),
      byDocumentRole: countByDocumentRole(nodes),
      bySemanticType: countBySemanticType(nodes),
      byFollowUpCategory: countByFollowUpCategory(nodes),
    },
  };
}

function countByNodeKind(
  nodes: readonly DocumentGraphRankedNode[],
): Readonly<Record<string, number>> {
  const counts = new Map<string, number>();
  for (const node of nodes) {
    increment(counts, node.kind);
  }
  return toSortedRecord(counts, DOCUMENT_GRAPH_NODE_KINDS);
}

function countByTraversalAxis(
  nodes: readonly DocumentGraphRankedNode[],
): Readonly<Record<string, number>> {
  const counts = new Map<string, number>();
  for (const node of nodes) {
    for (const axis of uniqueStrings(factorStringArrayMetadata(node, 'axis', 'axes'))) {
      increment(counts, axis);
    }
  }
  return toSortedRecord(counts, CANONICAL_TRAVERSAL_AXES);
}

function countByDocumentRole(
  nodes: readonly DocumentGraphRankedNode[],
): Readonly<Record<string, number>> {
  const counts = new Map<string, number>();
  for (const node of nodes) {
    const role = factorStringMetadata(node, 'role', 'roleType');
    if (role) increment(counts, role);
  }
  return toSortedRecord(counts, DOCUMENT_GRAPH_FAMILY_ROLE_TYPES);
}

function countBySemanticType(
  nodes: readonly DocumentGraphRankedNode[],
): Readonly<Record<string, number>> {
  const counts = new Map<string, number>();
  for (const node of nodes) {
    const type = factorStringMetadata(node, 'node-kind', 'type');
    if (type) increment(counts, type);
  }
  return toSortedRecord(counts, ['design', 'knowledge', 'spec']);
}

function countByFollowUpCategory(
  nodes: readonly DocumentGraphRankedNode[],
): Readonly<Record<string, number>> {
  const counts = new Map<string, number>();
  for (const node of nodes) {
    const categories = uniqueStrings([
      factorStringMetadata(node, 'follow-up-category', 'category'),
      ...factorStringArrayMetadata(node, 'follow-up-category', 'categories'),
    ]);
    for (const category of categories) {
      increment(counts, category);
    }
  }
  return toSortedRecord(counts, [
    'actionable',
    'deferred',
    'parking-lot',
    'completed',
    'uncategorized',
  ]);
}

function countDiagnostics(
  traversal: DocumentGraphTraversalResult,
  nodes: readonly DocumentGraphRankedNode[],
): Omit<DocumentGraphSummaryDiagnosticCounts, 'node'> {
  const bySeverity = {
    error: 0,
    warning: 0,
    info: 0,
  };
  for (const node of nodes) {
    const metadata = node.factors.find((factor) => factor.factor === 'diagnostics')?.metadata;
    bySeverity.error += metadataNumber(metadata, 'error');
    bySeverity.warning += metadataNumber(metadata, 'warning');
    bySeverity.info += metadataNumber(metadata, 'info');
  }
  for (const diagnostic of traversal.diagnostics) {
    const severity = traversalDiagnosticSeverity(diagnostic);
    bySeverity[severity] += 1;
  }
  return {
    traversal: traversal.diagnostics.length,
    bySeverity,
  };
}

function traversalDiagnosticSeverity(
  diagnostic: string,
): keyof DocumentGraphSummaryDiagnosticCounts['bySeverity'] {
  const normalized = diagnostic.trim().toLowerCase();
  if (normalized.startsWith('error:')) return 'error';
  if (normalized.startsWith('warning:') || normalized.startsWith('warn:')) return 'warning';
  return 'info';
}

function isArchiveRankedNode(node: DocumentGraphRankedNode): boolean {
  const archiveState = factorStringMetadata(node, 'archive-state', 'archiveState');
  return archiveState === 'archived' || archiveState === 'historical';
}

function factorStringMetadata(
  node: DocumentGraphRankedNode,
  factor: string,
  key: string,
): string | undefined {
  const value = node.factors.find((item) => item.factor === factor)?.metadata[key];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function factorStringArrayMetadata(
  node: DocumentGraphRankedNode,
  factor: string,
  key: string,
): readonly string[] {
  const value = node.factors.find((item) => item.factor === factor)?.metadata[key];
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

function metadataNumber(metadata: unknown, key: string): number {
  if (!metadata || typeof metadata !== 'object') return 0;
  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function increment(counts: Map<string, number>, value: string): void {
  counts.set(value, (counts.get(value) ?? 0) + 1);
}

function toSortedRecord(
  counts: ReadonlyMap<string, number>,
  preferredOrder: readonly string[],
): Readonly<Record<string, number>> {
  const priority = new Map(preferredOrder.map((value, index) => [value, index] as const));
  return Object.fromEntries(
    [...counts.entries()].toSorted(([left], [right]) => {
      const leftPriority = priority.get(left) ?? Number.MAX_SAFE_INTEGER;
      const rightPriority = priority.get(right) ?? Number.MAX_SAFE_INTEGER;
      if (leftPriority !== rightPriority) return leftPriority - rightPriority;
      if (isTraversalAxisValue(left) && isTraversalAxisValue(right)) {
        return TRAVERSAL_AXIS_PRIORITY[left] - TRAVERSAL_AXIS_PRIORITY[right];
      }
      return left.localeCompare(right);
    }),
  );
}

function isTraversalAxisValue(value: string): value is TraversalAxis {
  return (CANONICAL_TRAVERSAL_AXES as readonly string[]).includes(value);
}

function uniqueStrings(values: readonly (string | undefined)[]): readonly string[] {
  return [
    ...new Set(
      values
        .filter((value): value is string => typeof value === 'string')
        .map((value) => value.trim())
        .filter((value) => value.length > 0),
    ),
  ];
}
