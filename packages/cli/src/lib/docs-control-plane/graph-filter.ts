// @def.boundary docs-control-plane
// @def.doc docs-control-plane

import type {
  DocumentGraphRankedNode,
  DocumentGraphRankingResult,
  DocumentGraphRankStrength,
} from "./graph-rank.js";
import type { TraversalAxis } from "./graph-types.js";

export const DOCUMENT_GRAPH_FILTER_ALGORITHM = "docs-graph-result-filter-v1";

export interface DocumentGraphViewFilterInput {
  readonly kinds?: readonly string[];
  readonly roles?: readonly string[];
  readonly axes?: readonly TraversalAxis[];
  readonly followUpCategories?: readonly string[];
  readonly includeArchive?: boolean;
}

export interface NormalizedDocumentGraphViewFilters {
  readonly kinds: readonly string[];
  readonly roles: readonly string[];
  readonly axes: readonly TraversalAxis[];
  readonly followUpCategories: readonly string[];
  readonly includeArchive: boolean;
}

export interface DocumentGraphFilterCounts {
  readonly rawRankedNodes: number;
  readonly filteredNodes: number;
  readonly excludedByArchive: number;
  readonly excludedByFilters: number;
}

export interface DocumentGraphFilterResult {
  readonly algorithm: typeof DOCUMENT_GRAPH_FILTER_ALGORITHM;
  readonly filters: NormalizedDocumentGraphViewFilters;
  readonly filteredNodeIds: readonly string[];
  readonly filteredNodes: readonly DocumentGraphRankedNode[];
  readonly counts: DocumentGraphFilterCounts;
}

export interface FilteredDocumentGraphRanking {
  readonly ranking: DocumentGraphRankingResult;
  readonly filtering: DocumentGraphFilterResult;
}

export function filterDocumentGraphRanking(
  ranking: DocumentGraphRankingResult,
  input: DocumentGraphViewFilterInput = {},
): FilteredDocumentGraphRanking {
  const filters = normalizeDocumentGraphViewFilters(input);
  const activeNodes: DocumentGraphRankedNode[] = [];
  let excludedByArchive = 0;
  let excludedByFilters = 0;

  for (const node of ranking.rankedNodes) {
    if (!filters.includeArchive && isArchiveRankedNode(node)) {
      excludedByArchive += 1;
      continue;
    }
    if (!matchesExplicitFilters(node, filters)) {
      excludedByFilters += 1;
      continue;
    }
    activeNodes.push(node);
  }

  const filteredNodes = rerankNodes(activeNodes);
  const filteredRanking: DocumentGraphRankingResult = {
    algorithm: ranking.algorithm,
    rankedNodes: filteredNodes,
    counts: countStrengths(filteredNodes),
  };

  return {
    ranking: filteredRanking,
    filtering: {
      algorithm: DOCUMENT_GRAPH_FILTER_ALGORITHM,
      filters,
      filteredNodeIds: filteredNodes.map((node) => node.nodeId),
      filteredNodes,
      counts: {
        rawRankedNodes: ranking.rankedNodes.length,
        filteredNodes: filteredNodes.length,
        excludedByArchive,
        excludedByFilters,
      },
    },
  };
}

export function normalizeDocumentGraphViewFilters(
  input: DocumentGraphViewFilterInput = {},
): NormalizedDocumentGraphViewFilters {
  return {
    kinds: normalizeStringList(input.kinds ?? []),
    roles: normalizeStringList(input.roles ?? []),
    axes: uniqueAxes(input.axes ?? []),
    followUpCategories: normalizeStringList(input.followUpCategories ?? []),
    includeArchive: input.includeArchive === true,
  };
}

function matchesExplicitFilters(
  node: DocumentGraphRankedNode,
  filters: NormalizedDocumentGraphViewFilters,
): boolean {
  if (filters.kinds.length > 0 && !matchesAny(nodeKinds(node), filters.kinds)) {
    return false;
  }
  if (filters.roles.length > 0 && !matchesAny(nodeRoles(node), filters.roles)) {
    return false;
  }
  if (filters.axes.length > 0 && !matchesAny(nodeAxes(node), filters.axes)) {
    return false;
  }
  if (
    filters.followUpCategories.length > 0 &&
    !matchesAny(nodeFollowUpCategories(node), filters.followUpCategories)
  ) {
    return false;
  }
  return true;
}

function rerankNodes(
  nodes: readonly DocumentGraphRankedNode[],
): readonly DocumentGraphRankedNode[] {
  return nodes.map((node, index) => ({
    ...node,
    rank: index + 1,
  }));
}

function countStrengths(
  rankedNodes: readonly DocumentGraphRankedNode[],
): Readonly<Record<DocumentGraphRankStrength, number>> {
  const counts: Record<DocumentGraphRankStrength, number> = {
    strong: 0,
    medium: 0,
    weak: 0,
    penalized: 0,
  };
  for (const node of rankedNodes) {
    counts[node.strength] += 1;
  }
  return counts;
}

function isArchiveRankedNode(node: DocumentGraphRankedNode): boolean {
  const archiveState = factorStringMetadata(node, "archive-state", "archiveState");
  return archiveState === "archived" || archiveState === "historical";
}

function nodeKinds(node: DocumentGraphRankedNode): readonly string[] {
  return normalizeStringList([
    node.kind,
    factorStringMetadata(node, "node-kind", "kind"),
    factorStringMetadata(node, "node-kind", "documentKind"),
  ]);
}

function nodeRoles(node: DocumentGraphRankedNode): readonly string[] {
  return normalizeStringList([
    factorStringMetadata(node, "role", "roleType"),
    roleFromKind(node.kind),
    roleFromPath(node.path),
  ]);
}

function nodeAxes(node: DocumentGraphRankedNode): readonly string[] {
  return normalizeStringList(factorStringArrayMetadata(node, "axis", "axes"));
}

function nodeFollowUpCategories(node: DocumentGraphRankedNode): readonly string[] {
  return normalizeStringList([
    factorStringMetadata(node, "follow-up-category", "category"),
    ...factorStringArrayMetadata(node, "follow-up-category", "categories"),
  ]);
}

function factorStringMetadata(
  node: DocumentGraphRankedNode,
  factor: string,
  key: string,
): string | undefined {
  const value = node.factors.find((item) => item.factor === factor)?.metadata[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function factorStringArrayMetadata(
  node: DocumentGraphRankedNode,
  factor: string,
  key: string,
): readonly string[] {
  const value = node.factors.find((item) => item.factor === factor)?.metadata[key];
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string =>
    typeof item === "string" && item.trim().length > 0
  );
}

function roleFromKind(kind: string): string | undefined {
  return [
    "spec",
    "todo",
    "plan",
    "rule",
    "cases",
    "test",
    "memo",
    "prd",
    "ralph-prd-json",
  ].includes(kind)
    ? kind
    : undefined;
}

function roleFromPath(path: string | undefined): string | undefined {
  if (!path) return undefined;
  const match = path.match(/\.(spec|todo|plan|rule|cases|test|memo)\.md$/);
  return match?.[1];
}

function matchesAny(values: readonly string[], filters: readonly string[]): boolean {
  const normalizedValues = new Set(values.map(normalizeFilterValue));
  return filters.some((filter) => normalizedValues.has(normalizeFilterValue(filter)));
}

function normalizeStringList(values: readonly (string | undefined)[]): readonly string[] {
  return uniqueStrings(
    values
      .filter((value): value is string => typeof value === "string")
      .map((value) => value.trim())
      .filter((value) => value.length > 0),
  );
}

function uniqueAxes(values: readonly TraversalAxis[]): readonly TraversalAxis[] {
  return [...new Set(values)];
}

function uniqueStrings(values: readonly string[]): readonly string[] {
  return [...new Set(values)];
}

function normalizeFilterValue(value: string): string {
  return value.trim().toLowerCase();
}
