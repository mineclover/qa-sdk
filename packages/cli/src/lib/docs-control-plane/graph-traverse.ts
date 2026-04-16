import { getTraversalPreset } from "./graph-presets.js";
import {
  CANONICAL_TRAVERSAL_AXES,
  TRAVERSAL_AXIS_PRIORITY,
  type DocumentGraphEdgeReason,
  type DocumentGraphEdgeSummary,
  type TraversalAxis,
  type TraversalDirection,
  type TraversalInputSummary,
  type TraversalPresetId,
  type TraversalResultSummary,
} from "./graph-types.js";
import type {
  DocumentGraphIndex,
  DocumentGraphIndexNode,
  DocumentGraphIndexNodeKind,
  DocumentGraphNodeReason,
  DocumentGraphTargetResolution,
} from "./graph-index.js";
import type { DocumentMetadata } from "./types.js";

export const DEFAULT_DOCUMENT_GRAPH_TRAVERSAL_DEPTH = 1;
export const MAX_DOCUMENT_GRAPH_TRAVERSAL_DEPTH = 6;
export const DEFAULT_DOCUMENT_GRAPH_TRAVERSAL_LIMIT = 100;

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
  readonly direction: Exclude<TraversalDirection, "both">;
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
  readonly kind: DocumentGraphEdgeSummary["kind"];
  readonly axis: TraversalAxis;
  readonly fromNodeId: string;
  readonly toNodeId: string;
  readonly authoredType?: string;
  readonly reasons: readonly DocumentGraphEdgeReason[];
  readonly metadata: DocumentMetadata;
  readonly traversal: DocumentGraphTraversalPathStep;
}

export interface DocumentGraphTraversalResult extends TraversalResultSummary {
  readonly targetResolution: DocumentGraphTargetResolution;
  readonly nodes: readonly DocumentGraphTraversalNode[];
  readonly edges: readonly DocumentGraphTraversalEdge[];
  readonly paths: readonly DocumentGraphTraversalPath[];
}

interface VisitState {
  readonly node: DocumentGraphIndexNode;
  readonly depth: number;
  readonly path: DocumentGraphTraversalPath;
}

interface CandidateEdge {
  readonly edge: DocumentGraphEdgeSummary;
  readonly direction: Exclude<TraversalDirection, "both">;
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
  const selectedAxes = [
    ...(input.axes ?? []),
    ...(preset?.axes ?? []),
  ];
  const rawAxes = selectedAxes.length > 0
    ? selectedAxes
    : CANONICAL_TRAVERSAL_AXES;
  const axes = uniqueAxes(rawAxes)
    .filter((axis) => includeContext || axis !== "context");

  if (!includeContext && selectedAxes.includes("context")) {
    diagnostics.push("context axis omitted because includeContext is false");
  }

  const rawDepth = input.depth ?? preset?.defaultDepth ?? DEFAULT_DOCUMENT_GRAPH_TRAVERSAL_DEPTH;
  const normalizedDepth = normalizeNonNegativeInteger(rawDepth, DEFAULT_DOCUMENT_GRAPH_TRAVERSAL_DEPTH);
  const depth = Math.min(normalizedDepth, MAX_DOCUMENT_GRAPH_TRAVERSAL_DEPTH);
  if (normalizedDepth > MAX_DOCUMENT_GRAPH_TRAVERSAL_DEPTH) {
    diagnostics.push(
      `depth capped at ${MAX_DOCUMENT_GRAPH_TRAVERSAL_DEPTH} from requested ${normalizedDepth}`,
    );
  }

  const rawLimit = input.limit ?? DEFAULT_DOCUMENT_GRAPH_TRAVERSAL_LIMIT;
  const limit = normalizeNonNegativeInteger(rawLimit, DEFAULT_DOCUMENT_GRAPH_TRAVERSAL_LIMIT);

  return {
    target: input.target,
    axes,
    direction: input.direction ?? preset?.direction ?? "out",
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
    ...targetResolution.diagnostics.map((diagnostic) =>
      `${diagnostic.code}: ${diagnostic.message}`
    ),
  ];
  const rootNodes = targetResolution.nodes;

  if (rootNodes.length === 0) {
    const resultDiagnostics = [
      ...diagnostics,
      `target not found: ${normalizedInput.target}`,
    ];
    return {
      input: withoutInputDiagnostics(normalizedInput),
      targetResolution,
      nodeCount: 0,
      edgeCount: 0,
      truncated: false,
      omittedCount: 0,
      diagnostics: resultDiagnostics,
      nodes: [],
      edges: [],
      paths: [],
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

  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const current = queue[cursor]!;
    if (current.depth >= normalizedInput.depth) continue;

    for (const candidate of traversalCandidates(index, current.node.id, normalizedInput.direction)) {
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
  const omittedCount = Math.max(0, allVisited.length - included.length);
  const includedNodeIds = new Set(included.map((visit) => visit.node.id));
  const edges = [...traversedEdges.values()]
    .filter((visit) =>
      includedNodeIds.has(visit.step.fromNodeId) &&
      includedNodeIds.has(visit.step.toNodeId)
    )
    .map(toTraversalEdge);
  const paths = included.map((visit) => visit.path);
  const nodes = included.map(toTraversalNode);

  return {
    input: withoutInputDiagnostics(normalizedInput),
    targetResolution,
    targetNodeId: rootNodes[0]?.id,
    nodeCount: nodes.length,
    edgeCount: edges.length,
    truncated: omittedCount > 0,
    omittedCount,
    diagnostics,
    nodes,
    edges,
    paths,
  };
}

function traversalCandidates(
  index: DocumentGraphIndex,
  nodeId: string,
  direction: TraversalDirection,
): readonly CandidateEdge[] {
  const candidates: CandidateEdge[] = [];
  if (direction === "out" || direction === "both") {
    for (const edge of index.outgoing(nodeId)) {
      candidates.push({
        edge,
        direction: "out",
        nextNodeId: edge.toNodeId,
      });
    }
  }
  if (direction === "in" || direction === "both") {
    for (const edge of index.incoming(nodeId)) {
      candidates.push({
        edge,
        direction: "in",
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

function pathStep(
  currentNodeId: string,
  candidate: CandidateEdge,
): DocumentGraphTraversalPathStep {
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
  return [...new Set(axes)].toSorted((left, right) =>
    TRAVERSAL_AXIS_PRIORITY[left] - TRAVERSAL_AXIS_PRIORITY[right]
  );
}

function normalizeNonNegativeInteger(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, Math.trunc(value));
}

function compareCandidateEdges(left: CandidateEdge, right: CandidateEdge): number {
  return TRAVERSAL_AXIS_PRIORITY[left.edge.axis] - TRAVERSAL_AXIS_PRIORITY[right.edge.axis]
    || left.edge.kind.localeCompare(right.edge.kind)
    || traversalDirectionPriority(left.direction) - traversalDirectionPriority(right.direction)
    || left.edge.fromNodeId.localeCompare(right.edge.fromNodeId)
    || left.edge.toNodeId.localeCompare(right.edge.toNodeId)
    || left.nextNodeId.localeCompare(right.nextNodeId)
    || left.edge.id.localeCompare(right.edge.id);
}

function traversalDirectionPriority(direction: Exclude<TraversalDirection, "both">): number {
  return direction === "out" ? 0 : 1;
}
