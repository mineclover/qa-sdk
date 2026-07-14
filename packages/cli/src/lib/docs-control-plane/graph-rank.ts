// @def.boundary docs-control-plane
// @def.doc docs-control-plane

import {
  DOCUMENT_GRAPH_FAMILY_ROLE_TYPES,
  TRAVERSAL_AXIS_PRIORITY,
  type DocumentGraphFamilyRoleType,
  type TraversalAxis,
} from './graph-types.js';
import type { DocumentGraphTraversalResult } from './graph-traverse.js';
import type { DocumentMetadata } from 'doc-envelope';

export const DOCUMENT_GRAPH_RANK_ALGORITHM = 'docs-graph-rule-rank-v1';

export const DOCUMENT_GRAPH_RANK_FACTORS = [
  'target',
  'distance',
  'axis',
  'node-kind',
  'role',
  'archive-state',
  'diagnostics',
  'follow-up-category',
] as const;

export type DocumentGraphRankFactorName = (typeof DOCUMENT_GRAPH_RANK_FACTORS)[number];

export type DocumentGraphRankStrength = 'strong' | 'medium' | 'weak' | 'penalized';

export interface DocumentGraphRankFactor {
  readonly factor: DocumentGraphRankFactorName;
  readonly score: number;
  readonly reason: string;
  readonly metadata: DocumentMetadata;
}

export interface DocumentGraphRankedNode {
  readonly nodeId: string;
  readonly kind: DocumentGraphTraversalResult['nodes'][number]['kind'];
  readonly rank: number;
  readonly score: number;
  readonly strength: DocumentGraphRankStrength;
  readonly factors: readonly DocumentGraphRankFactor[];
  readonly reasonSummary: readonly string[];
  readonly stableId?: string;
  readonly familyId?: string;
  readonly path?: string;
}

export interface DocumentGraphRankingResult {
  readonly algorithm: typeof DOCUMENT_GRAPH_RANK_ALGORITHM;
  readonly rankedNodes: readonly DocumentGraphRankedNode[];
  readonly counts: Readonly<Record<DocumentGraphRankStrength, number>>;
}

type TraversalNode = DocumentGraphTraversalResult['nodes'][number];

interface ScoredNode {
  readonly node: TraversalNode;
  readonly score: number;
  readonly factors: readonly DocumentGraphRankFactor[];
}

interface RankingContext {
  readonly targetNodeIds: ReadonlySet<string>;
  readonly targetFamilyIds: ReadonlySet<string>;
}

const AXIS_RANK_SCORE = {
  composition: 18,
  refinement: 18,
  dependency: 16,
  constraint: 16,
  trace: 6,
  source: 26,
  evidence: 28,
  role: 30,
  context: -22,
} as const satisfies Readonly<Record<TraversalAxis, number>>;

const NODE_KIND_RANK_SCORE = {
  spec: 12,
  knowledge: 12,
  rule: 10,
  plan: 9,
  todo: 8,
  test: 7,
  cases: 7,
  memo: 5,
  prd: 6,
  'ralph-prd-json': 6,
  'ralph-session': -2,
  source: 8,
  evidence: 9,
  section: -4,
  document: 0,
  task: 1,
  context: -16,
} as const satisfies Readonly<Record<TraversalNode['kind'], number>>;

const FOLLOW_UP_CATEGORY_SCORE = {
  actionable: 18,
  uncategorized: 3,
  deferred: -6,
  'parking-lot': -12,
  completed: -14,
} as const;

export function rankDocumentGraphTraversal(
  traversal: DocumentGraphTraversalResult,
): DocumentGraphRankingResult {
  const context = buildRankingContext(traversal);
  const scored = traversal.nodes
    .map((node): ScoredNode => {
      const factors = rankFactorsForNode(node, context);
      return {
        node,
        factors,
        score: factors.reduce((sum, factor) => sum + factor.score, 0),
      };
    })
    .toSorted(compareScoredNodes);

  const rankedNodes = scored.map((item, index) => toRankedNode(item, index + 1));

  return {
    algorithm: DOCUMENT_GRAPH_RANK_ALGORITHM,
    rankedNodes,
    counts: countStrengths(rankedNodes),
  };
}

function buildRankingContext(traversal: DocumentGraphTraversalResult): RankingContext {
  const targetNodeIds = new Set<string>();
  if (traversal.targetNodeId) targetNodeIds.add(traversal.targetNodeId);
  for (const node of traversal.targetResolution.nodes) {
    targetNodeIds.add(node.id);
  }

  const targetFamilyIds = new Set<string>();
  for (const node of traversal.targetResolution.nodes) {
    if (node.familyId) targetFamilyIds.add(node.familyId);
  }
  for (const node of traversal.nodes) {
    if (targetNodeIds.has(node.id) && node.familyId) {
      targetFamilyIds.add(node.familyId);
    }
  }

  return {
    targetNodeIds,
    targetFamilyIds,
  };
}

function rankFactorsForNode(
  node: TraversalNode,
  context: RankingContext,
): readonly DocumentGraphRankFactor[] {
  return [
    targetFactor(node, context),
    distanceFactor(node),
    axisFactor(node),
    nodeKindFactor(node),
    roleFactor(node, context),
    archiveStateFactor(node),
    diagnosticsFactor(node),
    followUpCategoryFactor(node),
  ];
}

function targetFactor(node: TraversalNode, context: RankingContext): DocumentGraphRankFactor {
  const isTarget = context.targetNodeIds.has(node.id) || node.depth === 0;
  return {
    factor: 'target',
    score: isTarget ? 80 : 0,
    reason: isTarget ? 'target node' : 'not target node',
    metadata: {
      nodeId: node.id,
      target: isTarget,
    },
  };
}

function distanceFactor(node: TraversalNode): DocumentGraphRankFactor {
  const score = node.depth === 0 ? 30 : Math.max(0, 24 - node.depth * 6);
  return {
    factor: 'distance',
    score,
    reason: `path distance ${node.depth}`,
    metadata: {
      depth: node.depth,
      pathLength: node.pathFromTarget.steps.length,
    },
  };
}

function axisFactor(node: TraversalNode): DocumentGraphRankFactor {
  const axes = pathAxes(node);
  if (axes.length === 0) {
    return {
      factor: 'axis',
      score: 0,
      reason: 'target or synthetic node has no traversal axis',
      metadata: {
        axes: [],
      },
    };
  }

  const axisScores = axes.map((axis) => ({
    axis,
    score: AXIS_RANK_SCORE[axis],
  }));
  const best = axisScores.toSorted(
    (left, right) =>
      right.score - left.score ||
      TRAVERSAL_AXIS_PRIORITY[left.axis] - TRAVERSAL_AXIS_PRIORITY[right.axis],
  )[0]!;

  return {
    factor: 'axis',
    score: best.score,
    reason: `strongest path axis ${best.axis}`,
    metadata: {
      axes,
      primaryAxis: axes[axes.length - 1],
      axisScores,
    },
  };
}

function nodeKindFactor(node: TraversalNode): DocumentGraphRankFactor {
  return {
    factor: 'node-kind',
    score: NODE_KIND_RANK_SCORE[node.kind],
    reason: `node kind ${node.kind}`,
    metadata: {
      kind: node.kind,
      documentKind: asString(node.metadata.documentKind),
      type: asString(node.metadata.type),
    },
  };
}

function roleFactor(node: TraversalNode, context: RankingContext): DocumentGraphRankFactor {
  const roleType = roleTypeForNode(node);
  const sameFamily = Boolean(node.familyId && context.targetFamilyIds.has(node.familyId));
  const hasRoleAxis = pathAxes(node).includes('role');
  const score =
    roleType && sameFamily
      ? 34
      : roleType && hasRoleAxis
        ? 22
        : roleType
          ? 10
          : hasRoleAxis
            ? 8
            : 0;

  return {
    factor: 'role',
    score,
    reason: roleType
      ? sameFamily
        ? `same-family ${roleType} role`
        : `${roleType} role`
      : hasRoleAxis
        ? 'role-axis traversal'
        : 'no role metadata',
    metadata: {
      roleType,
      sameFamily,
      familyId: node.familyId,
    },
  };
}

function archiveStateFactor(node: TraversalNode): DocumentGraphRankFactor {
  const archiveState = archiveStateForNode(node);
  const score =
    archiveState === 'archived'
      ? -45
      : archiveState === 'historical'
        ? -30
        : archiveState === 'deprecated'
          ? -18
          : 0;
  return {
    factor: 'archive-state',
    score,
    reason: archiveState === 'active' ? 'active document' : `${archiveState} document`,
    metadata: {
      archiveState,
      lifecycle: asString(node.metadata.lifecycle),
      path: node.path,
    },
  };
}

function diagnosticsFactor(node: TraversalNode): DocumentGraphRankFactor {
  const counts = diagnosticCountsForNode(node);
  const score = -(counts.error * 18 + counts.warning * 8 + counts.info * 2);
  const total = counts.error + counts.warning + counts.info;
  return {
    factor: 'diagnostics',
    score,
    reason: total > 0 ? 'diagnostic metadata present' : 'no diagnostic metadata',
    metadata: counts,
  };
}

function followUpCategoryFactor(node: TraversalNode): DocumentGraphRankFactor {
  const categories = followUpCategoriesForNode(node);
  const category = categories[0];
  const score = category ? followUpCategoryScore(category) : 0;
  return {
    factor: 'follow-up-category',
    score,
    reason: category ? `follow-up category ${category}` : 'no follow-up category metadata',
    metadata: {
      category,
      categories,
    },
  };
}

function followUpCategoryScore(category: string): number {
  if (category in FOLLOW_UP_CATEGORY_SCORE) {
    return FOLLOW_UP_CATEGORY_SCORE[category as keyof typeof FOLLOW_UP_CATEGORY_SCORE];
  }
  return 0;
}

function toRankedNode(item: ScoredNode, rank: number): DocumentGraphRankedNode {
  const strength = strengthForScore(item.score);
  return {
    nodeId: item.node.id,
    kind: item.node.kind,
    rank,
    score: item.score,
    strength,
    factors: item.factors,
    reasonSummary: item.factors
      .filter((factor) => factor.score !== 0)
      .map((factor) => `${factor.factor}:${formatSignedScore(factor.score)} ${factor.reason}`),
    ...(item.node.stableId ? { stableId: item.node.stableId } : {}),
    ...(item.node.familyId ? { familyId: item.node.familyId } : {}),
    ...(item.node.path ? { path: item.node.path } : {}),
  };
}

function strengthForScore(score: number): DocumentGraphRankStrength {
  if (score >= 80) return 'strong';
  if (score >= 45) return 'medium';
  if (score >= 15) return 'weak';
  return 'penalized';
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

function compareScoredNodes(left: ScoredNode, right: ScoredNode): number {
  return (
    right.score - left.score ||
    left.node.depth - right.node.depth ||
    bestAxisPriority(left.node) - bestAxisPriority(right.node) ||
    (left.node.stableId ?? '').localeCompare(right.node.stableId ?? '') ||
    (left.node.path ?? '').localeCompare(right.node.path ?? '') ||
    left.node.id.localeCompare(right.node.id)
  );
}

function bestAxisPriority(node: TraversalNode): number {
  const axes = pathAxes(node);
  if (axes.length === 0) return -1;
  return Math.min(...axes.map((axis) => TRAVERSAL_AXIS_PRIORITY[axis]));
}

function pathAxes(node: TraversalNode): readonly TraversalAxis[] {
  return node.pathFromTarget.steps.map((step) => step.axis);
}

function roleTypeForNode(node: TraversalNode): DocumentGraphFamilyRoleType | undefined {
  if (node.kind !== 'spec' && isFamilyRoleType(node.kind)) return node.kind;

  const documentKind = asString(node.metadata.documentKind);
  if (documentKind && documentKind !== 'spec' && isFamilyRoleType(documentKind))
    return documentKind;

  const pathRole = roleTypeFromPath(node.path);
  if (pathRole && pathRole !== 'spec') return pathRole;

  if (isFamilyRoleType(node.kind)) return node.kind;
  if (documentKind && isFamilyRoleType(documentKind)) return documentKind;
  return pathRole;
}

function roleTypeFromPath(path: string | undefined): DocumentGraphFamilyRoleType | undefined {
  if (!path) return undefined;
  const match = path.match(/\.(spec|todo|plan|rule|cases|test|memo)\.md$/);
  return match && isFamilyRoleType(match[1]) ? match[1] : undefined;
}

function isFamilyRoleType(value: string): value is DocumentGraphFamilyRoleType {
  return (DOCUMENT_GRAPH_FAMILY_ROLE_TYPES as readonly string[]).includes(value);
}

function archiveStateForNode(
  node: TraversalNode,
): 'active' | 'archived' | 'historical' | 'deprecated' {
  const lifecycle = asString(node.metadata.lifecycle)?.toLowerCase();
  if (lifecycle === 'archived') return 'archived';
  if (lifecycle === 'historical') return 'historical';
  if (lifecycle === 'deprecated') return 'deprecated';

  const status = asString(node.metadata.status)?.toLowerCase();
  if (status === 'archived') return 'archived';
  if (status === 'historical') return 'historical';
  if (status === 'deprecated') return 'deprecated';

  const path = normalizePath(node.path ?? asString(node.metadata.sourcePath) ?? '');
  if (path.split('/').includes('archive')) return 'archived';
  if (path.split('/').includes('historical')) return 'historical';
  return 'active';
}

function diagnosticCountsForNode(node: TraversalNode): {
  readonly error: number;
  readonly warning: number;
  readonly info: number;
} {
  const explicit = diagnosticSeverityCounts(node.metadata.diagnosticSeverityCounts);
  if (explicit) return explicit;

  const severities = [
    ...diagnosticSeveritiesFromList(node.metadata.diagnostics),
    asString(node.metadata.diagnosticSeverity),
    asString(node.metadata.severity),
  ].filter((value): value is string => Boolean(value));

  const counts = {
    error: 0,
    warning: 0,
    info: 0,
  };
  for (const severity of severities) {
    const normalized = severity.toLowerCase();
    if (normalized === 'error') counts.error += 1;
    else if (normalized === 'warning' || normalized === 'warn') counts.warning += 1;
    else counts.info += 1;
  }

  if (severities.length === 0) {
    const diagnosticCount =
      asNumber(node.metadata.diagnosticCount) ??
      asNumber(node.metadata.diagnosticsCount) ??
      asNumber(node.metadata.validationIssueCount);
    if (diagnosticCount && diagnosticCount > 0) {
      counts.warning = diagnosticCount;
    }
  }

  return counts;
}

function diagnosticSeverityCounts(
  value: unknown,
): { readonly error: number; readonly warning: number; readonly info: number } | null {
  if (!isRecord(value)) return null;
  return {
    error: asNumber(value.error) ?? 0,
    warning: asNumber(value.warning) ?? asNumber(value.warn) ?? 0,
    info: asNumber(value.info) ?? 0,
  };
}

function diagnosticSeveritiesFromList(value: unknown): readonly string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (typeof item === 'string') return [item];
    if (!isRecord(item)) return [];
    const severity = asString(item.severity);
    return severity ? [severity] : [];
  });
}

function followUpCategoriesForNode(node: TraversalNode): readonly string[] {
  const categories: string[] = [];
  for (const key of [
    'followUpCategory',
    'nextFollowUpCategory',
    'todoCategory',
    'category',
  ] as const) {
    const value = asString(node.metadata[key]);
    if (value) categories.push(value);
  }
  for (const key of ['followUpCategories', 'todoCategories'] as const) {
    const value = node.metadata[key];
    if (!Array.isArray(value)) continue;
    for (const item of value) {
      const category = asString(item);
      if (category) categories.push(category);
    }
  }
  return [...new Set(categories)];
}

function formatSignedScore(score: number): string {
  return score > 0 ? `+${score}` : String(score);
}

function normalizePath(value: string): string {
  return value.replaceAll('\\', '/').replace(/\/+/g, '/');
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
