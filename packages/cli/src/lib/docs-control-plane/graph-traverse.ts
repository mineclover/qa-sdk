// @def.boundary docs-control-plane
// @def.doc docs-control-plane

import { getTraversalPreset } from './graph-presets.js';
import {
  CANONICAL_TRAVERSAL_AXES,
  DOCUMENT_GRAPH_FAMILY_ROLE_TYPES,
  TRAVERSAL_AXIS_PRIORITY,
  type DocumentGraphEdgeReason,
  type DocumentGraphEdgeSummary,
  type DocumentGraphFamilyRoleType,
  type TraversalAxis,
  type TraversalDirection,
  type TraversalInputSummary,
  type TraversalOmittedCounts,
  type TraversalPresetId,
  type TraversalResultSummary,
} from './graph-types.js';
import type {
  DocumentGraphIndex,
  DocumentGraphIndexNode,
  DocumentGraphIndexNodeKind,
  DocumentGraphNodeReason,
  DocumentGraphTargetResolution,
} from './graph-index.js';
import type { DocumentMetadata } from 'doc-envelope';

export const DEFAULT_DOCUMENT_GRAPH_TRAVERSAL_DEPTH = 1;
export const MAX_DOCUMENT_GRAPH_TRAVERSAL_DEPTH = 6;
export const DEFAULT_DOCUMENT_GRAPH_TRAVERSAL_LIMIT = 100;
export const MAX_DOCUMENT_GRAPH_TRAVERSAL_LIMIT = 500;
export const BROAD_DOCUMENT_GRAPH_TRAVERSAL_WARNING =
  'warning: context/search traversal is broad; keep --depth and --limit tight or choose a stricter preset';

export interface DocumentGraphTraversalInput {
  readonly target: string;
  readonly axes?: readonly TraversalAxis[];
  readonly direction?: TraversalDirection;
  readonly depth?: number;
  readonly limit?: number;
  readonly includeContext?: boolean;
  readonly preset?: TraversalPresetId;
}

export interface NormalizedDocumentGraphTraversalInput extends TraversalInputSummary {
  readonly diagnostics: readonly string[];
}

export interface DocumentGraphTraversalPathStep {
  readonly edgeId: string;
  readonly axis: TraversalAxis;
  readonly direction: Exclude<TraversalDirection, 'both'>;
  readonly fromNodeId: string;
  readonly toNodeId: string;
  readonly canonicalFromNodeId: string;
  readonly canonicalToNodeId: string;
}

export interface DocumentGraphTraversalPath {
  readonly targetNodeId: string;
  readonly nodeId: string;
  readonly depth: number;
  readonly nodeIds: readonly string[];
  readonly edgeIds: readonly string[];
  readonly steps: readonly DocumentGraphTraversalPathStep[];
}

export interface DocumentGraphTraversalNode {
  readonly id: string;
  readonly kind: DocumentGraphIndexNodeKind;
  readonly label?: string;
  readonly stableId?: string;
  readonly familyId?: string;
  readonly path?: string;
  readonly metadata: DocumentMetadata;
  readonly reasons: readonly DocumentGraphNodeReason[];
  readonly depth: number;
  readonly pathFromTarget: DocumentGraphTraversalPath;
}

export interface DocumentGraphTraversalEdge {
  readonly id: string;
  readonly kind: DocumentGraphEdgeSummary['kind'];
  readonly axis: TraversalAxis;
  readonly fromNodeId: string;
  readonly toNodeId: string;
  readonly authoredType?: string;
  readonly reasons: readonly DocumentGraphEdgeReason[];
  readonly metadata: DocumentMetadata;
  readonly traversal: DocumentGraphTraversalPathStep;
}

export interface DocumentGraphTraversalRoleNode {
  readonly id: string;
  readonly roleType: DocumentGraphFamilyRoleType;
  readonly kind: DocumentGraphIndexNodeKind;
  readonly label?: string;
  readonly stableId?: string;
  readonly familyId?: string;
  readonly familyIds: readonly string[];
  readonly path?: string;
  readonly documentKind?: string;
  readonly extension?: string;
  readonly depth: number;
}

export interface DocumentGraphTraversalMissingRole {
  readonly familyId: string;
  readonly roleType: DocumentGraphFamilyRoleType;
  readonly optional: true;
  readonly reason: 'optional-absence';
}

export interface DocumentGraphTraversalMissingRoleSummary {
  readonly familyId: string;
  readonly roleTypes: readonly DocumentGraphFamilyRoleType[];
  readonly optionalCount: number;
}

export interface DocumentGraphTraversalRoleGroup {
  readonly roleType: DocumentGraphFamilyRoleType;
  readonly nodes: readonly DocumentGraphTraversalRoleNode[];
  readonly missing: readonly DocumentGraphTraversalMissingRole[];
}

export interface DocumentGraphTraversalResult extends TraversalResultSummary {
  readonly targetResolution: DocumentGraphTargetResolution;
  readonly nodes: readonly DocumentGraphTraversalNode[];
  readonly edges: readonly DocumentGraphTraversalEdge[];
  readonly paths: readonly DocumentGraphTraversalPath[];
  readonly roleGroups: readonly DocumentGraphTraversalRoleGroup[];
  readonly missingRoles: readonly DocumentGraphTraversalMissingRole[];
}

interface VisitState {
  readonly node: DocumentGraphIndexNode;
  readonly depth: number;
  readonly path: DocumentGraphTraversalPath;
}

interface CandidateEdge {
  readonly edge: DocumentGraphEdgeSummary;
  readonly direction: Exclude<TraversalDirection, 'both'>;
  readonly nextNodeId: string;
}

interface EdgeVisit {
  readonly edge: DocumentGraphEdgeSummary;
  readonly step: DocumentGraphTraversalPathStep;
}

export function normalizeDocumentGraphTraversalInput(
  input: DocumentGraphTraversalInput,
): NormalizedDocumentGraphTraversalInput {
  const preset = input.preset ? getTraversalPreset(input.preset) : undefined;
  const includeContext = input.includeContext ?? preset?.includeContext ?? false;
  const diagnostics: string[] = [];
  const selectedAxes = [...(input.axes ?? []), ...(preset?.axes ?? [])];
  const rawAxes = selectedAxes.length > 0 ? selectedAxes : CANONICAL_TRAVERSAL_AXES;
  const axes = uniqueAxes(rawAxes).filter((axis) => includeContext || axis !== 'context');

  if (!includeContext && selectedAxes.includes('context')) {
    diagnostics.push('context axis omitted because includeContext is false');
  }

  const rawDepth = input.depth ?? preset?.defaultDepth ?? DEFAULT_DOCUMENT_GRAPH_TRAVERSAL_DEPTH;
  const normalizedDepth = normalizeNonNegativeInteger(
    rawDepth,
    DEFAULT_DOCUMENT_GRAPH_TRAVERSAL_DEPTH,
  );
  const depth = Math.min(normalizedDepth, MAX_DOCUMENT_GRAPH_TRAVERSAL_DEPTH);
  if (normalizedDepth > MAX_DOCUMENT_GRAPH_TRAVERSAL_DEPTH) {
    diagnostics.push(
      `depth capped at ${MAX_DOCUMENT_GRAPH_TRAVERSAL_DEPTH} from requested ${normalizedDepth}`,
    );
  }

  const rawLimit = input.limit ?? DEFAULT_DOCUMENT_GRAPH_TRAVERSAL_LIMIT;
  const normalizedLimit = normalizeNonNegativeInteger(
    rawLimit,
    DEFAULT_DOCUMENT_GRAPH_TRAVERSAL_LIMIT,
  );
  const limit = Math.min(normalizedLimit, MAX_DOCUMENT_GRAPH_TRAVERSAL_LIMIT);
  if (normalizedLimit > MAX_DOCUMENT_GRAPH_TRAVERSAL_LIMIT) {
    diagnostics.push(
      `limit capped at ${MAX_DOCUMENT_GRAPH_TRAVERSAL_LIMIT} from requested ${normalizedLimit}`,
    );
  }

  if (axes.includes('context')) {
    diagnostics.push(BROAD_DOCUMENT_GRAPH_TRAVERSAL_WARNING);
  }

  return {
    target: input.target,
    axes,
    direction: input.direction ?? preset?.direction ?? 'out',
    depth,
    limit,
    includeContext,
    ...(input.preset ? { preset: input.preset } : {}),
    diagnostics,
  };
}

export function traverseDocumentGraph(
  index: DocumentGraphIndex,
  input: DocumentGraphTraversalInput,
): DocumentGraphTraversalResult {
  const normalizedInput = normalizeDocumentGraphTraversalInput(input);
  const targetResolution = index.resolveTarget(normalizedInput.target);
  const diagnostics = [
    ...normalizedInput.diagnostics,
    ...targetResolution.diagnostics.map(
      (diagnostic) => `${diagnostic.code}: ${diagnostic.message}`,
    ),
  ];
  const rootNodes = targetResolution.nodes;

  if (rootNodes.length === 0) {
    const resultDiagnostics = [...diagnostics, `target not found: ${normalizedInput.target}`];
    return {
      input: withoutInputDiagnostics(normalizedInput),
      targetResolution,
      nodeCount: 0,
      edgeCount: 0,
      truncated: false,
      omittedCounts: emptyOmittedCounts(),
      omittedCount: 0,
      diagnostics: resultDiagnostics,
      nodes: [],
      edges: [],
      paths: [],
      roleGroups: [],
      missingRoles: [],
    };
  }

  const axes = new Set(normalizedInput.axes);
  const visits = new Map<string, VisitState>();
  const queue: VisitState[] = [];

  for (const root of rootNodes) {
    if (visits.has(root.id)) continue;
    const path = rootPath(root.id);
    const visit = { node: root, depth: 0, path };
    visits.set(root.id, visit);
    queue.push(visit);
  }

  const traversedEdges = new Map<string, EdgeVisit>();
  const depthOmittedNodeIds = new Set<string>();
  const depthOmittedEdgeIds = new Set<string>();

  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const current = queue[cursor];
    if (!current) continue;
    if (current.depth >= normalizedInput.depth) {
      recordDepthOmissions(
        index,
        current.node.id,
        normalizedInput.direction,
        axes,
        visits,
        depthOmittedNodeIds,
        depthOmittedEdgeIds,
      );
      continue;
    }

    for (const candidate of traversalCandidates(
      index,
      current.node.id,
      normalizedInput.direction,
    )) {
      if (!axes.has(candidate.edge.axis)) continue;

      const nextNode = index.nodesById.get(candidate.nextNodeId);
      if (!nextNode) continue;

      const step = pathStep(current.node.id, candidate);
      if (!traversedEdges.has(candidate.edge.id)) {
        traversedEdges.set(candidate.edge.id, {
          edge: candidate.edge,
          step,
        });
      }

      if (visits.has(nextNode.id)) continue;

      const path = appendPath(current.path, nextNode.id, step);
      const nextVisit = {
        node: nextNode,
        depth: current.depth + 1,
        path,
      };
      visits.set(nextNode.id, nextVisit);
      queue.push(nextVisit);
    }
  }

  const allVisited = [...visits.values()];
  const included = allVisited.slice(0, normalizedInput.limit);
  const omittedNodeCount = Math.max(0, allVisited.length - included.length);
  const includedNodeIds = new Set(included.map((visit) => visit.node.id));
  const allTraversedEdges = [...traversedEdges.values()];
  const includedEdgeVisits = allTraversedEdges.filter(
    (visit) =>
      includedNodeIds.has(visit.step.fromNodeId) && includedNodeIds.has(visit.step.toNodeId),
  );
  const edges = includedEdgeVisits.map(toTraversalEdge);
  const omittedCounts: TraversalOmittedCounts = {
    nodes: omittedNodeCount,
    edges:
      Math.max(0, allTraversedEdges.length - includedEdgeVisits.length) + depthOmittedEdgeIds.size,
    depth: depthOmittedNodeIds.size,
  };
  const paths = included.map((visit) => visit.path);
  const nodes = included.map(toTraversalNode);
  const roleSummary = buildTraversalRoleSummary(
    nodes,
    edges,
    withoutInputDiagnostics(normalizedInput),
  );

  return {
    input: withoutInputDiagnostics(normalizedInput),
    targetResolution,
    targetNodeId: rootNodes[0]?.id,
    nodeCount: nodes.length,
    edgeCount: edges.length,
    truncated: isTraversalTruncated(omittedCounts),
    omittedCounts,
    omittedCount: omittedCounts.nodes,
    diagnostics,
    nodes,
    edges,
    paths,
    roleGroups: roleSummary.roleGroups,
    missingRoles: roleSummary.missingRoles,
  };
}

function recordDepthOmissions(
  index: DocumentGraphIndex,
  nodeId: string,
  direction: TraversalDirection,
  axes: ReadonlySet<TraversalAxis>,
  visits: ReadonlyMap<string, VisitState>,
  depthOmittedNodeIds: Set<string>,
  depthOmittedEdgeIds: Set<string>,
): void {
  for (const candidate of traversalCandidates(index, nodeId, direction)) {
    if (!axes.has(candidate.edge.axis)) continue;
    if (!index.nodesById.has(candidate.nextNodeId)) continue;
    if (!visits.has(candidate.nextNodeId)) {
      depthOmittedNodeIds.add(candidate.nextNodeId);
    }
    depthOmittedEdgeIds.add(candidate.edge.id);
  }
}

function emptyOmittedCounts(): TraversalOmittedCounts {
  return {
    nodes: 0,
    edges: 0,
    depth: 0,
  };
}

function isTraversalTruncated(omittedCounts: TraversalOmittedCounts): boolean {
  return omittedCounts.nodes > 0 || omittedCounts.edges > 0 || omittedCounts.depth > 0;
}

export function formatDocumentGraphTraversalRoleGroups(
  result: Pick<DocumentGraphTraversalResult, 'roleGroups' | 'missingRoles'>,
): readonly string[] {
  if (result.roleGroups.length === 0 && result.missingRoles.length === 0) return [];

  const lines = ['role groups:'];
  for (const group of result.roleGroups) {
    lines.push(`  ${group.roleType} (${group.nodes.length}):`);
    for (const node of group.nodes) {
      const extension = node.extension ? ` ${node.extension}` : '';
      const documentKind =
        node.documentKind && node.documentKind !== node.roleType
          ? ` documentKind=${node.documentKind}`
          : '';
      const familyIds = node.familyIds.length > 0 ? ` family=${node.familyIds.join(',')}` : '';
      lines.push(`    - ${node.stableId ?? node.id}${extension}${documentKind}${familyIds}`);
    }
  }

  const missingSummaries = summarizeDocumentGraphTraversalMissingRoles(result);
  if (missingSummaries.length > 0) {
    lines.push('  optional missing roles:');
    for (const summary of missingSummaries) {
      lines.push(`    - ${summary.familyId}: ${summary.roleTypes.join(', ')}`);
    }
  }
  return lines;
}

export function summarizeDocumentGraphTraversalMissingRoles(
  result: Pick<DocumentGraphTraversalResult, 'missingRoles'>,
): readonly DocumentGraphTraversalMissingRoleSummary[] {
  const byFamily = new Map<string, Set<DocumentGraphFamilyRoleType>>();
  for (const missing of result.missingRoles) {
    const bucket = byFamily.get(missing.familyId) ?? new Set<DocumentGraphFamilyRoleType>();
    bucket.add(missing.roleType);
    byFamily.set(missing.familyId, bucket);
  }

  return [...byFamily.entries()]
    .map(([familyId, roleTypes]) => {
      const sortedRoleTypes = [...roleTypes].toSorted(
        (left, right) => roleTypePriority(left) - roleTypePriority(right),
      );
      return {
        familyId,
        roleTypes: sortedRoleTypes,
        optionalCount: sortedRoleTypes.length,
      } satisfies DocumentGraphTraversalMissingRoleSummary;
    })
    .toSorted((left, right) => left.familyId.localeCompare(right.familyId));
}

function traversalCandidates(
  index: DocumentGraphIndex,
  nodeId: string,
  direction: TraversalDirection,
): readonly CandidateEdge[] {
  const candidates: CandidateEdge[] = [];
  if (direction === 'out' || direction === 'both') {
    for (const edge of index.outgoing(nodeId)) {
      candidates.push({
        edge,
        direction: 'out',
        nextNodeId: edge.toNodeId,
      });
    }
  }
  if (direction === 'in' || direction === 'both') {
    for (const edge of index.incoming(nodeId)) {
      candidates.push({
        edge,
        direction: 'in',
        nextNodeId: edge.fromNodeId,
      });
    }
  }
  return candidates.toSorted(compareCandidateEdges);
}

function rootPath(nodeId: string): DocumentGraphTraversalPath {
  return {
    targetNodeId: nodeId,
    nodeId,
    depth: 0,
    nodeIds: [nodeId],
    edgeIds: [],
    steps: [],
  };
}

function appendPath(
  current: DocumentGraphTraversalPath,
  nodeId: string,
  step: DocumentGraphTraversalPathStep,
): DocumentGraphTraversalPath {
  return {
    targetNodeId: current.targetNodeId,
    nodeId,
    depth: current.depth + 1,
    nodeIds: [...current.nodeIds, nodeId],
    edgeIds: [...current.edgeIds, step.edgeId],
    steps: [...current.steps, step],
  };
}

function pathStep(currentNodeId: string, candidate: CandidateEdge): DocumentGraphTraversalPathStep {
  return {
    edgeId: candidate.edge.id,
    axis: candidate.edge.axis,
    direction: candidate.direction,
    fromNodeId: currentNodeId,
    toNodeId: candidate.nextNodeId,
    canonicalFromNodeId: candidate.edge.fromNodeId,
    canonicalToNodeId: candidate.edge.toNodeId,
  };
}

function toTraversalNode(visit: VisitState): DocumentGraphTraversalNode {
  return {
    id: visit.node.id,
    kind: visit.node.kind,
    ...(visit.node.label ? { label: visit.node.label } : {}),
    ...(visit.node.stableId ? { stableId: visit.node.stableId } : {}),
    ...(visit.node.familyId ? { familyId: visit.node.familyId } : {}),
    ...(visit.node.path ? { path: visit.node.path } : {}),
    metadata: visit.node.metadata,
    reasons: visit.node.reasons,
    depth: visit.depth,
    pathFromTarget: visit.path,
  };
}

function toTraversalEdge(visit: EdgeVisit): DocumentGraphTraversalEdge {
  return {
    id: visit.edge.id,
    kind: visit.edge.kind,
    axis: visit.edge.axis,
    fromNodeId: visit.edge.fromNodeId,
    toNodeId: visit.edge.toNodeId,
    ...(visit.edge.authoredType ? { authoredType: visit.edge.authoredType } : {}),
    reasons: visit.edge.reasons,
    metadata: visit.edge.metadata,
    traversal: visit.step,
  };
}

function buildTraversalRoleSummary(
  nodes: readonly DocumentGraphTraversalNode[],
  edges: readonly DocumentGraphTraversalEdge[],
  input: TraversalInputSummary,
): {
  readonly roleGroups: readonly DocumentGraphTraversalRoleGroup[];
  readonly missingRoles: readonly DocumentGraphTraversalMissingRole[];
} {
  if (!input.axes.includes('role')) {
    return {
      roleGroups: [],
      missingRoles: [],
    };
  }

  const roleFamilyIdsByNodeId = roleFamilyIdsByNodeIdFromEdges(edges);
  const roleNodes = nodes
    .map((node) => toRoleNode(node, roleFamilyIdsByNodeId.get(node.id) ?? []))
    .filter((node): node is DocumentGraphTraversalRoleNode => node !== null);
  const familyIds = traversalRoleFamilyIds(roleNodes, edges);
  const missingRoles = missingFamilyRoles(roleNodes, familyIds);
  const roleTypes = uniqueRoleTypes([
    ...roleNodes.map((node) => node.roleType),
    ...missingRoles.map((missing) => missing.roleType),
  ]);

  return {
    roleGroups: roleTypes.map((roleType) => ({
      roleType,
      nodes: roleNodes.filter((node) => node.roleType === roleType).toSorted(compareRoleNodes),
      missing: missingRoles
        .filter((missing) => missing.roleType === roleType)
        .toSorted(compareMissingRoles),
    })),
    missingRoles,
  };
}

function roleFamilyIdsByNodeIdFromEdges(
  edges: readonly DocumentGraphTraversalEdge[],
): ReadonlyMap<string, readonly string[]> {
  const byNodeId = new Map<string, Set<string>>();
  for (const edge of edges) {
    if (edge.axis !== 'role') continue;
    const familyId = roleEdgeFamilyId(edge);
    if (!familyId) continue;
    addRoleFamilyId(byNodeId, edge.fromNodeId, familyId);
    addRoleFamilyId(byNodeId, edge.toNodeId, familyId);
  }
  return new Map(
    [...byNodeId.entries()].map(
      ([nodeId, familyIds]) => [nodeId, [...familyIds].toSorted()] as const,
    ),
  );
}

function toRoleNode(
  node: DocumentGraphTraversalNode,
  edgeFamilyIds: readonly string[],
): DocumentGraphTraversalRoleNode | null {
  const roleType = roleTypeForNode(node);
  if (!roleType) return null;
  const familyIds = uniqueStrings([node.familyId, ...edgeFamilyIds]);
  const documentKind = asString(node.metadata.documentKind);
  const extension = roleExtensionForPath(node.path);
  return {
    id: node.id,
    roleType,
    kind: node.kind,
    ...(node.label ? { label: node.label } : {}),
    ...(node.stableId ? { stableId: node.stableId } : {}),
    ...(node.familyId ? { familyId: node.familyId } : {}),
    familyIds,
    ...(node.path ? { path: node.path } : {}),
    ...(documentKind ? { documentKind } : {}),
    ...(extension ? { extension } : {}),
    depth: node.depth,
  };
}

function traversalRoleFamilyIds(
  roleNodes: readonly DocumentGraphTraversalRoleNode[],
  edges: readonly DocumentGraphTraversalEdge[],
): readonly string[] {
  return uniqueStrings([
    ...roleNodes.flatMap((node) => node.familyIds),
    ...edges.map(roleEdgeFamilyId),
  ]);
}

function missingFamilyRoles(
  roleNodes: readonly DocumentGraphTraversalRoleNode[],
  familyIds: readonly string[],
): readonly DocumentGraphTraversalMissingRole[] {
  const missing: DocumentGraphTraversalMissingRole[] = [];
  for (const familyId of familyIds) {
    const present = new Set(
      roleNodes.filter((node) => node.familyIds.includes(familyId)).map((node) => node.roleType),
    );
    for (const roleType of DOCUMENT_GRAPH_FAMILY_ROLE_TYPES) {
      if (present.has(roleType)) continue;
      missing.push({
        familyId,
        roleType,
        optional: true,
        reason: 'optional-absence',
      });
    }
  }
  return missing.toSorted(compareMissingRoles);
}

function roleTypeForNode(
  node: DocumentGraphTraversalNode,
): DocumentGraphFamilyRoleType | undefined {
  if (node.kind !== 'spec' && isFamilyRoleType(node.kind)) return node.kind;

  const documentKind = asString(node.metadata.documentKind);
  if (documentKind && documentKind !== 'spec' && isFamilyRoleType(documentKind))
    return documentKind;

  const extensionRole = roleTypeFromPath(node.path);
  if (extensionRole && extensionRole !== 'spec') return extensionRole;

  if (isFamilyRoleType(node.kind)) return node.kind;
  if (documentKind && isFamilyRoleType(documentKind)) return documentKind;
  return extensionRole;
}

function roleTypeFromPath(path: string | undefined): DocumentGraphFamilyRoleType | undefined {
  if (!path) return undefined;
  const match = path.match(/\.(spec|todo|plan|rule|cases|test|memo)\.md$/);
  return match && isFamilyRoleType(match[1]) ? match[1] : undefined;
}

function roleExtensionForPath(path: string | undefined): string | undefined {
  return path?.match(/\.(spec|todo|plan|rule|cases|test|memo)\.md$/)?.[0];
}

function roleEdgeFamilyId(edge: DocumentGraphTraversalEdge): string | undefined {
  return (
    asString(edge.metadata.familyId) ??
    edge.reasons.map((reason) => asString(reason.metadata.familyId)).find(Boolean)
  );
}

function addRoleFamilyId(
  byNodeId: Map<string, Set<string>>,
  nodeId: string,
  familyId: string,
): void {
  const familyIds = byNodeId.get(nodeId) ?? new Set<string>();
  familyIds.add(familyId);
  byNodeId.set(nodeId, familyIds);
}

function isFamilyRoleType(value: string): value is DocumentGraphFamilyRoleType {
  return (DOCUMENT_GRAPH_FAMILY_ROLE_TYPES as readonly string[]).includes(value);
}

function uniqueRoleTypes(
  values: readonly DocumentGraphFamilyRoleType[],
): readonly DocumentGraphFamilyRoleType[] {
  return [...new Set(values)].toSorted(
    (left, right) => roleTypePriority(left) - roleTypePriority(right),
  );
}

function uniqueStrings(values: readonly (string | undefined)[]): readonly string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))].toSorted();
}

function compareRoleNodes(
  left: DocumentGraphTraversalRoleNode,
  right: DocumentGraphTraversalRoleNode,
): number {
  return (
    (left.familyIds[0] ?? '').localeCompare(right.familyIds[0] ?? '') ||
    left.depth - right.depth ||
    (left.stableId ?? left.id).localeCompare(right.stableId ?? right.id) ||
    left.id.localeCompare(right.id)
  );
}

function compareMissingRoles(
  left: DocumentGraphTraversalMissingRole,
  right: DocumentGraphTraversalMissingRole,
): number {
  return (
    left.familyId.localeCompare(right.familyId) ||
    roleTypePriority(left.roleType) - roleTypePriority(right.roleType)
  );
}

function roleTypePriority(roleType: DocumentGraphFamilyRoleType): number {
  return DOCUMENT_GRAPH_FAMILY_ROLE_TYPES.indexOf(roleType);
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function withoutInputDiagnostics(
  input: NormalizedDocumentGraphTraversalInput,
): TraversalInputSummary {
  return {
    target: input.target,
    axes: input.axes,
    direction: input.direction,
    depth: input.depth,
    limit: input.limit,
    includeContext: input.includeContext,
    ...(input.preset ? { preset: input.preset } : {}),
  };
}

function uniqueAxes(axes: readonly TraversalAxis[]): readonly TraversalAxis[] {
  return [...new Set(axes)].toSorted(
    (left, right) => TRAVERSAL_AXIS_PRIORITY[left] - TRAVERSAL_AXIS_PRIORITY[right],
  );
}

function normalizeNonNegativeInteger(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, Math.trunc(value));
}

function compareCandidateEdges(left: CandidateEdge, right: CandidateEdge): number {
  return (
    TRAVERSAL_AXIS_PRIORITY[left.edge.axis] - TRAVERSAL_AXIS_PRIORITY[right.edge.axis] ||
    left.edge.kind.localeCompare(right.edge.kind) ||
    traversalDirectionPriority(left.direction) - traversalDirectionPriority(right.direction) ||
    left.edge.fromNodeId.localeCompare(right.edge.fromNodeId) ||
    left.edge.toNodeId.localeCompare(right.edge.toNodeId) ||
    left.nextNodeId.localeCompare(right.nextNodeId) ||
    left.edge.id.localeCompare(right.edge.id)
  );
}

function traversalDirectionPriority(direction: Exclude<TraversalDirection, 'both'>): number {
  return direction === 'out' ? 0 : 1;
}
