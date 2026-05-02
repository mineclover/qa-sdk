// @def.boundary docs-control-plane
// @def.doc docs-control-plane

import { isAbsolute, relative as relativePath } from "node:path";

import {
  TRAVERSAL_AXIS_PRIORITY,
  type DocumentGraphEdgeKind,
  type DocumentGraphEdgeReason,
  type DocumentGraphEdgeSummary,
  type DocumentGraphNodeKind,
  type TraversalAxis,
} from "./graph-types.js";
import {
  normalizeDocumentGraphEdges,
  type NormalizeDocumentGraphEdgesOptions,
} from "./graph-normalize.js";
import type {
  DocumentDiagnostic,
  DocumentEnvelope,
  DocumentEvidence,
  DocumentMetadata,
  DocumentRawSourcePointer,
  DocumentSection,
  DocumentTask,
} from "doc-envelope";

export type DocumentGraphIndexNodeKind =
  | DocumentGraphNodeKind
  | "document"
  | "task"
  | "context";

export interface DocumentGraphNodeReason {
  readonly reason: string;
  readonly adapterId?: string;
  readonly rawSource?: DocumentRawSourcePointer;
  readonly sourceDocumentId?: string;
  readonly sourceDocumentPath?: string;
  readonly metadata: DocumentMetadata;
}

export interface DocumentGraphIndexNode {
  readonly id: string;
  readonly kind: DocumentGraphIndexNodeKind;
  readonly label?: string;
  readonly stableId?: string;
  readonly familyId?: string;
  readonly path?: string;
  readonly metadata: DocumentMetadata;
  readonly reasons: readonly DocumentGraphNodeReason[];
}

export interface DocumentGraphLookupIndexes {
  readonly byStableId: ReadonlyMap<string, readonly DocumentGraphIndexNode[]>;
  readonly byFamilyId: ReadonlyMap<string, readonly DocumentGraphIndexNode[]>;
  readonly byPath: ReadonlyMap<string, readonly DocumentGraphIndexNode[]>;
  readonly bySourcePath: ReadonlyMap<string, readonly DocumentGraphIndexNode[]>;
  readonly byTaskId: ReadonlyMap<string, readonly DocumentGraphIndexNode[]>;
  readonly byArtifactId: ReadonlyMap<string, readonly DocumentGraphIndexNode[]>;
  readonly byEvidenceRef: ReadonlyMap<string, readonly DocumentGraphIndexNode[]>;
}

export type DocumentGraphTargetLookupKind =
  | "node-id"
  | "stable-id"
  | "path"
  | "source-path"
  | "task-id"
  | "artifact-id"
  | "evidence-ref"
  | "family-id"
  | "source-path-missing"
  | "missing";

export interface DocumentGraphTargetResolution {
  readonly target: string;
  readonly lookupKind: DocumentGraphTargetLookupKind;
  readonly indexed: boolean;
  readonly node?: DocumentGraphIndexNode;
  readonly nodes: readonly DocumentGraphIndexNode[];
  readonly diagnostics: readonly DocumentDiagnostic[];
}

export interface BuildDocumentGraphIndexOptions
  extends NormalizeDocumentGraphEdgesOptions {
  /**
   * Repository root used only to canonicalize absolute source path targets into
   * repository-relative source node ids. The graph still stores source-owned
   * raw pointers unchanged.
   */
  readonly rootDir?: string;
  /** Tests and future callers may pass a precomputed normalized projection. */
  readonly edges?: readonly DocumentGraphEdgeSummary[];
}

export interface DocumentGraphIndex {
  readonly nodes: readonly DocumentGraphIndexNode[];
  readonly edges: readonly DocumentGraphEdgeSummary[];
  readonly nodesById: ReadonlyMap<string, DocumentGraphIndexNode>;
  readonly edgesById: ReadonlyMap<string, DocumentGraphEdgeSummary>;
  readonly outgoingEdgesByNodeId: ReadonlyMap<string, readonly DocumentGraphEdgeSummary[]>;
  readonly incomingEdgesByNodeId: ReadonlyMap<string, readonly DocumentGraphEdgeSummary[]>;
  readonly lookup: DocumentGraphLookupIndexes;
  resolveTarget(target: string): DocumentGraphTargetResolution;
  outgoing(nodeId: string): readonly DocumentGraphEdgeSummary[];
  incoming(nodeId: string): readonly DocumentGraphEdgeSummary[];
}

interface NodeInput {
  readonly id: string;
  readonly kind: DocumentGraphIndexNodeKind;
  readonly label?: string;
  readonly stableId?: string;
  readonly familyId?: string;
  readonly path?: string;
  readonly metadata?: DocumentMetadata;
  readonly reason: DocumentGraphNodeReason;
}

interface EdgeInput {
  readonly id?: string;
  readonly kind: DocumentGraphEdgeKind;
  readonly axis: TraversalAxis;
  readonly fromNodeId: string;
  readonly toNodeId: string;
  readonly authoredType?: string;
  readonly reasons: readonly DocumentGraphEdgeReason[];
  readonly metadata: DocumentMetadata;
}

export function buildDocumentGraphIndex(
  documents: readonly DocumentEnvelope[],
  options: BuildDocumentGraphIndexOptions = {},
): DocumentGraphIndex {
  const nodeBuilder = new NodeBuilder(options.rootDir);
  const edgeBuilder = new IndexEdgeBuilder(options.rootDir);

  for (const document of documents) {
    addDocumentNodes(nodeBuilder, document);
  }

  const projectedEdges = options.edges
    ?? normalizeDocumentGraphEdges(documents, {
      includeContext: options.includeContext,
    });

  for (const projectedEdge of projectedEdges) {
    const edge = edgeBuilder.add(projectedEdge);
    nodeBuilder.ensureEndpoint(edge.fromNodeId);
    nodeBuilder.ensureEndpoint(edge.toNodeId);
  }

  const nodes = nodeBuilder.nodes();
  const edges = edgeBuilder.edges();
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const edgesById = new Map(edges.map((edge) => [edge.id, edge]));
  const outgoingEdgesByNodeId = buildAdjacencyIndex(nodes, edges, "out");
  const incomingEdgesByNodeId = buildAdjacencyIndex(nodes, edges, "in");
  const lookup = buildLookupIndexes(nodes);

  const indexCore = {
    nodes,
    edges,
    nodesById,
    edgesById,
    outgoingEdgesByNodeId,
    incomingEdgesByNodeId,
    lookup,
  };

  return {
    ...indexCore,
    resolveTarget(target: string): DocumentGraphTargetResolution {
      return resolveDocumentGraphTarget(indexCore, target, options.rootDir);
    },
    outgoing(nodeId: string): readonly DocumentGraphEdgeSummary[] {
      return outgoingEdgesByNodeId.get(canonicalizeNodeId(nodeId, options.rootDir)) ?? [];
    },
    incoming(nodeId: string): readonly DocumentGraphEdgeSummary[] {
      return incomingEdgesByNodeId.get(canonicalizeNodeId(nodeId, options.rootDir)) ?? [];
    },
  };
}

function addDocumentNodes(
  builder: NodeBuilder,
  document: DocumentEnvelope,
): void {
  builder.add({
    id: documentNodeId(document),
    kind: documentNodeKind(document),
    label: documentLabel(document),
    stableId: document.stableId,
    familyId: document.familyId,
    path: document.path,
    metadata: {
      ...document.metadata,
      adapterId: document.adapterId,
      documentKind: document.kind,
    },
    reason: documentNodeReason(document, "document-envelope"),
  });

  for (const task of document.tasks) {
    addTaskNode(builder, document, task);
  }
  for (const evidence of document.evidence) {
    addEvidenceNode(builder, document, evidence);
  }
  for (const section of document.sections) {
    addSectionNode(builder, document, section);
  }
}

function addTaskNode(
  builder: NodeBuilder,
  document: DocumentEnvelope,
  task: DocumentTask,
): void {
  builder.add({
    id: taskNodeId(document, task),
    kind: "task",
    label: task.title,
    stableId: `${document.stableId}:${task.id}`,
    familyId: document.familyId,
    path: `${document.path}#${task.id}`,
    metadata: {
      ...task.metadata,
      taskId: task.id,
      taskStatus: task.status,
      evidenceIds: [...task.evidenceIds],
      sourceDocumentId: document.stableId,
      sourceDocumentPath: document.path,
    },
    reason: {
      ...documentNodeReason(document, "document-task"),
      rawSource: task.rawSource ?? document.rawSource,
      metadata: {
        taskId: task.id,
        sourceDocumentKind: document.kind,
      },
    },
  });
}

function addEvidenceNode(
  builder: NodeBuilder,
  document: DocumentEnvelope,
  evidence: DocumentEvidence,
): void {
  builder.add({
    id: evidenceNodeId(evidence.id),
    kind: "evidence",
    label: evidence.summary ?? evidence.kind ?? evidence.id,
    stableId: evidence.id,
    familyId: document.familyId,
    path: evidence.rawSource
      ? `${evidence.rawSource.path}${evidence.rawSource.pointer ? `#${evidence.rawSource.pointer}` : ""}`
      : `${document.path}#${evidence.id}`,
    metadata: {
      ...evidence.metadata,
      evidenceId: evidence.id,
      evidenceKind: evidence.kind,
      sourceDocumentId: document.stableId,
      sourceDocumentPath: document.path,
    },
    reason: {
      ...documentNodeReason(document, "document-evidence-record"),
      rawSource: evidence.rawSource ?? document.rawSource,
      metadata: {
        evidenceId: evidence.id,
        evidenceKind: evidence.kind,
        sourceDocumentKind: document.kind,
      },
    },
  });
}

function addSectionNode(
  builder: NodeBuilder,
  document: DocumentEnvelope,
  section: DocumentSection,
): void {
  builder.add({
    id: sectionNodeId(document, section),
    kind: "section",
    label: section.title ?? section.anchor ?? section.id,
    stableId: `${document.stableId}:${section.id}`,
    familyId: document.familyId,
    path: `${document.path}#${section.anchor ?? section.id}`,
    metadata: {
      ...section.metadata,
      sectionId: section.id,
      title: section.title,
      anchor: section.anchor,
      order: section.order,
      sourceDocumentId: document.stableId,
      sourceDocumentPath: document.path,
    },
    reason: {
      ...documentNodeReason(document, "document-section"),
      rawSource: section.rawSource ?? document.rawSource,
      metadata: {
        sectionId: section.id,
        sourceDocumentKind: document.kind,
      },
    },
  });
}

function buildLookupIndexes(
  nodes: readonly DocumentGraphIndexNode[],
): DocumentGraphLookupIndexes {
  const byStableId = new Map<string, DocumentGraphIndexNode[]>();
  const byFamilyId = new Map<string, DocumentGraphIndexNode[]>();
  const byPath = new Map<string, DocumentGraphIndexNode[]>();
  const bySourcePath = new Map<string, DocumentGraphIndexNode[]>();
  const byTaskId = new Map<string, DocumentGraphIndexNode[]>();
  const byArtifactId = new Map<string, DocumentGraphIndexNode[]>();
  const byEvidenceRef = new Map<string, DocumentGraphIndexNode[]>();

  for (const node of nodes) {
    addLookup(byStableId, node.stableId, node);
    addLookup(byStableId, asString(node.metadata.defId), node);
    addLookup(byFamilyId, node.familyId, node);
    addLookup(byPath, node.path ? normalizeGraphPath(node.path) : undefined, node);

    if (node.kind === "source" && node.path) {
      addLookup(bySourcePath, normalizeSourcePath(node.path), node);
    }

    addLookup(byTaskId, asString(node.metadata.taskId), node);
    addLookup(byArtifactId, asString(node.metadata.artifactId), node);
    addLookup(byEvidenceRef, asString(node.metadata.evidenceId), node);
    addLookup(byEvidenceRef, asString(node.metadata.evidenceRef), node);
    addLookup(byEvidenceRef, asString(node.metadata.artifactId), node);

    for (const value of metadataStringValues(node.metadata.evidenceIds)) {
      addLookup(byEvidenceRef, value, node);
    }
    for (const value of metadataStringValues(node.metadata.verificationRefs)) {
      addLookup(byEvidenceRef, value, node);
    }
    for (const value of relationEvidenceRefs(node.metadata.relations)) {
      addLookup(byEvidenceRef, value, node);
    }
  }

  return {
    byStableId: finalizeLookup(byStableId),
    byFamilyId: finalizeLookup(byFamilyId),
    byPath: finalizeLookup(byPath),
    bySourcePath: finalizeLookup(bySourcePath),
    byTaskId: finalizeLookup(byTaskId),
    byArtifactId: finalizeLookup(byArtifactId),
    byEvidenceRef: finalizeLookup(byEvidenceRef),
  };
}

function resolveDocumentGraphTarget(
  index: Omit<DocumentGraphIndex, "resolveTarget" | "outgoing" | "incoming">,
  target: string,
  rootDir: string | undefined,
): DocumentGraphTargetResolution {
  const normalizedTarget = normalizeGraphPath(target, rootDir);
  const sourcePath = normalizeSourcePath(target, rootDir);
  const exactNode = index.nodesById.get(canonicalizeNodeId(target, rootDir));
  if (exactNode) return indexedResolution(target, "node-id", [exactNode]);

  const stableIdMatches = index.lookup.byStableId.get(target)
    ?? index.lookup.byStableId.get(normalizedTarget);
  if (stableIdMatches?.length) return indexedResolution(target, "stable-id", stableIdMatches);

  const taskMatches = index.lookup.byTaskId.get(target);
  if (taskMatches?.length) return indexedResolution(target, "task-id", taskMatches);

  const artifactMatches = index.lookup.byArtifactId.get(target);
  if (artifactMatches?.length) return indexedResolution(target, "artifact-id", artifactMatches);

  const evidenceMatches = index.lookup.byEvidenceRef.get(target);
  if (evidenceMatches?.length) return indexedResolution(target, "evidence-ref", evidenceMatches);

  const pathMatches = (index.lookup.byPath.get(normalizedTarget) ?? [])
    .filter((node) => node.kind !== "source");
  if (pathMatches.length) return indexedResolution(target, "path", pathMatches);

  const sourceMatches = isPathLikeRef(target)
    ? index.lookup.bySourcePath.get(sourcePath)
    : undefined;
  if (sourceMatches?.length) return indexedResolution(target, "source-path", sourceMatches);

  const familyMatches = index.lookup.byFamilyId.get(target);
  if (familyMatches?.length) return indexedResolution(target, "family-id", familyMatches);

  if (isPathLikeRef(target)) {
    const node = syntheticSourceNode(sourcePath);
    return {
      target,
      lookupKind: "source-path-missing",
      indexed: false,
      node,
      nodes: [node],
      diagnostics: [
        {
          code: "source-map-missing",
          severity: "info",
          message: `No document source-map coverage found for ${sourcePath}.`,
          metadata: {
            target,
            sourcePath,
          },
        },
      ],
    };
  }

  return {
    target,
    lookupKind: "missing",
    indexed: false,
    nodes: [],
    diagnostics: [],
  };
}

function indexedResolution(
  target: string,
  lookupKind: DocumentGraphTargetLookupKind,
  nodes: readonly DocumentGraphIndexNode[],
): DocumentGraphTargetResolution {
  const sortedNodes = nodes.toSorted(compareNodes);
  return {
    target,
    lookupKind,
    indexed: true,
    node: sortedNodes[0],
    nodes: sortedNodes,
    diagnostics: [],
  };
}

function buildAdjacencyIndex(
  nodes: readonly DocumentGraphIndexNode[],
  edges: readonly DocumentGraphEdgeSummary[],
  direction: "out" | "in",
): ReadonlyMap<string, readonly DocumentGraphEdgeSummary[]> {
  const adjacency = new Map<string, DocumentGraphEdgeSummary[]>();
  for (const node of nodes) {
    adjacency.set(node.id, []);
  }
  for (const edge of edges) {
    const key = direction === "out" ? edge.fromNodeId : edge.toNodeId;
    const bucket = adjacency.get(key) ?? [];
    bucket.push(edge);
    adjacency.set(key, bucket);
  }

  return new Map(
    [...adjacency.entries()]
      .map(([nodeId, items]) => [nodeId, items.toSorted(compareGraphEdges)] as const),
  );
}

class NodeBuilder {
  private readonly nodesById = new Map<string, DocumentGraphIndexNode>();

  constructor(private readonly rootDir: string | undefined) {}

  add(input: NodeInput): DocumentGraphIndexNode {
    const id = canonicalizeNodeId(input.id, this.rootDir);
    const path = input.kind === "source"
      ? normalizeSourcePath(input.path ?? sourcePathFromNodeId(id), this.rootDir)
      : input.path
        ? normalizeGraphPath(input.path, this.rootDir)
        : undefined;
    const existing = this.nodesById.get(id);
    if (existing) {
      const node = {
        ...existing,
        kind: preferredNodeKind(existing.kind, input.kind),
        label: existing.label ?? input.label,
        stableId: existing.stableId ?? input.stableId,
        familyId: existing.familyId ?? input.familyId,
        path: existing.path ?? path,
        metadata: mergeNodeMetadata(existing.metadata, input.metadata ?? {}),
        reasons: [...existing.reasons, input.reason],
      };
      this.nodesById.set(id, node);
      return node;
    }

    const node: DocumentGraphIndexNode = {
      id,
      kind: input.kind,
      ...(input.label ? { label: input.label } : {}),
      ...(input.stableId ? { stableId: input.stableId } : {}),
      ...(input.familyId ? { familyId: input.familyId } : {}),
      ...(path ? { path } : {}),
      metadata: input.metadata ?? {},
      reasons: [input.reason],
    };
    this.nodesById.set(id, node);
    return node;
  }

  ensureEndpoint(nodeId: string): void {
    const id = canonicalizeNodeId(nodeId, this.rootDir);
    if (this.nodesById.has(id)) return;

    if (id.startsWith("source:")) {
      const sourcePath = sourcePathFromNodeId(id);
      this.add({
        id,
        kind: "source",
        label: sourcePath,
        path: sourcePath,
        metadata: {
          sourcePath,
        },
        reason: endpointReason("edge-endpoint"),
      });
      return;
    }

    if (id.startsWith("evidence:")) {
      const evidenceId = id.slice("evidence:".length);
      this.add({
        id,
        kind: "evidence",
        label: evidenceId,
        stableId: evidenceId,
        metadata: {
          evidenceId,
        },
        reason: endpointReason("edge-endpoint"),
      });
      return;
    }

    if (id.startsWith("task:")) {
      const { documentStableId, taskId } = parseScopedNodeId(id, "task");
      this.add({
        id,
        kind: "task",
        label: taskId,
        stableId: `${documentStableId}:${taskId}`,
        metadata: {
          taskId,
          sourceDocumentId: documentStableId,
        },
        reason: endpointReason("edge-endpoint"),
      });
      return;
    }

    if (id.startsWith("section:")) {
      const { documentStableId, taskId: sectionId } = parseScopedNodeId(id, "section");
      this.add({
        id,
        kind: "section",
        label: sectionId,
        stableId: `${documentStableId}:${sectionId}`,
        metadata: {
          sectionId,
          sourceDocumentId: documentStableId,
        },
        reason: endpointReason("edge-endpoint"),
      });
      return;
    }

    if (id.startsWith("context:")) {
      const contextId = id.slice("context:".length);
      this.add({
        id,
        kind: "context",
        label: contextId,
        stableId: contextId,
        metadata: {
          contextId,
        },
        reason: endpointReason("edge-endpoint"),
      });
      return;
    }

    if (id.startsWith("document:")) {
      const stableId = id.slice("document:".length);
      this.add({
        id,
        kind: "document",
        label: stableId,
        stableId,
        metadata: {},
        reason: endpointReason("edge-endpoint"),
      });
    }
  }

  nodes(): readonly DocumentGraphIndexNode[] {
    return [...this.nodesById.values()].toSorted(compareNodes);
  }
}

class IndexEdgeBuilder {
  private readonly edgesByKey = new Map<string, DocumentGraphEdgeSummary>();

  constructor(private readonly rootDir: string | undefined) {}

  add(edge: DocumentGraphEdgeSummary): DocumentGraphEdgeSummary {
    const input = canonicalizeEdge(edge, this.rootDir);
    const key = [
      input.kind,
      input.axis,
      input.fromNodeId,
      input.toNodeId,
      input.authoredType ?? "",
    ].join("\u0000");
    const existing = this.edgesByKey.get(key);
    if (existing) {
      const merged = {
        ...existing,
        reasons: [...existing.reasons, ...input.reasons],
        metadata: {
          ...existing.metadata,
          ...input.metadata,
        },
      };
      this.edgesByKey.set(key, merged);
      return merged;
    }

    const next: DocumentGraphEdgeSummary = {
      id: edgeId(input),
      kind: input.kind,
      axis: input.axis,
      fromNodeId: input.fromNodeId,
      toNodeId: input.toNodeId,
      ...(input.authoredType ? { authoredType: input.authoredType } : {}),
      reasons: input.reasons,
      metadata: input.metadata,
    };
    this.edgesByKey.set(key, next);
    return next;
  }

  edges(): readonly DocumentGraphEdgeSummary[] {
    return [...this.edgesByKey.values()].toSorted(compareGraphEdges);
  }
}

function canonicalizeEdge(
  edge: DocumentGraphEdgeSummary,
  rootDir: string | undefined,
): EdgeInput {
  const fromNodeId = canonicalizeNodeId(edge.fromNodeId, rootDir);
  const toNodeId = canonicalizeNodeId(edge.toNodeId, rootDir);
  return {
    kind: edge.kind,
    axis: edge.axis,
    fromNodeId,
    toNodeId,
    authoredType: edge.authoredType,
    reasons: edge.reasons.map((reason) =>
      canonicalizeEdgeReason(reason, toNodeId, rootDir)
    ),
    metadata: edge.metadata,
  };
}

function canonicalizeEdgeReason(
  reason: DocumentGraphEdgeReason,
  fallbackTargetNodeId: string,
  rootDir: string | undefined,
): DocumentGraphEdgeReason {
  const targetNodeId = canonicalizeNodeId(reason.targetNodeId ?? fallbackTargetNodeId, rootDir);
  const targetNodePath = targetNodeId.startsWith("source:")
    ? sourcePathFromNodeId(targetNodeId)
    : reason.targetNodePath
      ? normalizeGraphPath(reason.targetNodePath, rootDir)
      : undefined;
  return {
    ...reason,
    targetNodeId,
    ...(targetNodePath ? { targetNodePath } : {}),
  };
}

function canonicalizeNodeId(nodeId: string, rootDir: string | undefined): string {
  if (!nodeId.startsWith("source:")) return nodeId;
  return sourceNodeId(sourcePathFromNodeId(nodeId), rootDir);
}

function documentNodeKind(document: DocumentEnvelope): DocumentGraphIndexNodeKind {
  if (document.kind === "knowledge" || document.metadata.type === "knowledge") return "knowledge";
  if (isKnownDocumentKind(document.kind)) return document.kind;
  if (
    document.kind.includes("evidence") ||
    document.kind === "quality-status" ||
    asString(document.metadata.artifactId)
  ) {
    return "evidence";
  }
  return "document";
}

function isKnownDocumentKind(value: string): value is DocumentGraphNodeKind {
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
    "ralph-session",
  ].includes(value);
}

function documentLabel(document: DocumentEnvelope): string {
  return asString(document.metadata.title)
    ?? asString(document.metadata.name)
    ?? asString(document.metadata.summary)
    ?? document.stableId;
}

function documentNodeReason(
  document: DocumentEnvelope,
  reason: string,
): DocumentGraphNodeReason {
  return {
    adapterId: document.adapterId,
    reason,
    rawSource: document.rawSource,
    sourceDocumentId: document.stableId,
    sourceDocumentPath: document.path,
    metadata: {
      sourceDocumentKind: document.kind,
    },
  };
}

function endpointReason(reason: string): DocumentGraphNodeReason {
  return {
    reason,
    metadata: {},
  };
}

function syntheticSourceNode(sourcePath: string): DocumentGraphIndexNode {
  return {
    id: sourceNodeId(sourcePath),
    kind: "source",
    label: sourcePath,
    path: sourcePath,
    metadata: {
      sourcePath,
      sourceMapCoverage: "missing",
      synthetic: true,
    },
    reasons: [
      {
        reason: "source-path target",
        metadata: {
          sourceMapCoverage: "missing",
        },
      },
    ],
  };
}

function documentNodeId(document: DocumentEnvelope): string {
  return `document:${document.stableId}`;
}

function taskNodeId(document: DocumentEnvelope, task: DocumentTask): string {
  return `task:${document.stableId}:${task.id}`;
}

function sectionNodeId(document: DocumentEnvelope, section: DocumentSection): string {
  return `section:${document.stableId}:${section.id}`;
}

function evidenceNodeId(evidenceId: string): string {
  return `evidence:${evidenceId}`;
}

function sourceNodeId(path: string, rootDir?: string): string {
  return `source:${normalizeSourcePath(path, rootDir)}`;
}

function sourcePathFromNodeId(nodeId: string): string {
  return nodeId.slice("source:".length);
}

function parseScopedNodeId(
  nodeId: string,
  prefix: "task" | "section",
): { readonly documentStableId: string; readonly taskId: string } {
  const parts = nodeId.slice(`${prefix}:`.length).split(":");
  const taskId = parts.pop() ?? "";
  return {
    documentStableId: parts.join(":"),
    taskId,
  };
}

function preferredNodeKind(
  left: DocumentGraphIndexNodeKind,
  right: DocumentGraphIndexNodeKind,
): DocumentGraphIndexNodeKind {
  return NODE_KIND_PRIORITY[left] <= NODE_KIND_PRIORITY[right] ? left : right;
}

function mergeNodeMetadata(
  existing: DocumentMetadata,
  incoming: DocumentMetadata,
): DocumentMetadata {
  const merged: Record<string, unknown> = {
    ...existing,
    ...incoming,
  };

  for (const field of [
    "evidenceIds",
    "verificationRefs",
    "verifiesRefs",
    "materializesOutputRefs",
    "sourceRefs",
  ] as const) {
    const values = unique([
      ...metadataStringValues(existing[field]),
      ...metadataStringValues(incoming[field]),
    ]);
    if (values.length > 0) merged[field] = values;
  }

  return merged;
}

const NODE_KIND_PRIORITY = {
  spec: 0,
  knowledge: 1,
  prd: 2,
  "ralph-prd-json": 3,
  "ralph-session": 4,
  todo: 5,
  plan: 6,
  rule: 7,
  cases: 8,
  test: 9,
  memo: 10,
  document: 11,
  task: 12,
  evidence: 13,
  source: 14,
  section: 15,
  context: 16,
} as const satisfies Readonly<Record<DocumentGraphIndexNodeKind, number>>;

function compareNodes(
  left: DocumentGraphIndexNode,
  right: DocumentGraphIndexNode,
): number {
  return NODE_KIND_PRIORITY[left.kind] - NODE_KIND_PRIORITY[right.kind]
    || left.id.localeCompare(right.id);
}

function compareGraphEdges(
  left: DocumentGraphEdgeSummary,
  right: DocumentGraphEdgeSummary,
): number {
  return TRAVERSAL_AXIS_PRIORITY[left.axis] - TRAVERSAL_AXIS_PRIORITY[right.axis]
    || left.kind.localeCompare(right.kind)
    || left.fromNodeId.localeCompare(right.fromNodeId)
    || left.toNodeId.localeCompare(right.toNodeId)
    || (left.authoredType ?? "").localeCompare(right.authoredType ?? "");
}

function edgeId(input: EdgeInput): string {
  return `edge:${input.axis}:${input.kind}:${input.fromNodeId}->${input.toNodeId}${input.authoredType ? `:${input.authoredType}` : ""}`;
}

function addLookup(
  lookup: Map<string, DocumentGraphIndexNode[]>,
  key: string | undefined,
  node: DocumentGraphIndexNode,
): void {
  if (!key) return;
  const bucket = lookup.get(key) ?? [];
  if (!bucket.some((candidate) => candidate.id === node.id)) {
    bucket.push(node);
  }
  lookup.set(key, bucket);
}

function finalizeLookup(
  lookup: Map<string, DocumentGraphIndexNode[]>,
): ReadonlyMap<string, readonly DocumentGraphIndexNode[]> {
  return new Map(
    [...lookup.entries()]
      .map(([key, nodes]) => [key, nodes.toSorted(compareNodes)] as const),
  );
}

function normalizeSourcePath(value: string, rootDir?: string): string {
  return normalizeGraphPath(toRepoPath(value, rootDir));
}

function normalizeGraphPath(value: string, rootDir?: string): string {
  return toRepoPath(value, rootDir).replaceAll("\\", "/").replace(/\/+/g, "/");
}

function toRepoPath(value: string, rootDir: string | undefined): string {
  const normalized = value.replaceAll("\\", "/");
  if (!rootDir || !isAbsolute(normalized)) return normalized;

  const normalizedRoot = rootDir.replaceAll("\\", "/");
  const relative = relativePath(normalizedRoot, normalized).replaceAll("\\", "/");
  return relative && !relative.startsWith("..") && !isAbsolute(relative)
    ? relative
    : normalized;
}

function isPathLikeRef(value: string): boolean {
  return (
    value.includes("/") ||
    value.includes("\\") ||
    /\.(?:json|js|jsx|ts|tsx|md|cjs|mjs|css|html|yml|yaml|toml|sql)(?::|$)/.test(value)
  );
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function metadataStringValues(value: unknown): readonly string[] {
  if (typeof value === "string") return [value].filter(Boolean);
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => typeof item === "string" ? item.trim() : "")
    .filter((item) => item.length > 0);
}

function unique(values: readonly string[]): readonly string[] {
  return [...new Set(values)];
}

function relationEvidenceRefs(value: unknown): readonly string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const evidenceRef = (item as Record<string, unknown>).evidenceRef;
    return typeof evidenceRef === "string" && evidenceRef.trim().length > 0
      ? [evidenceRef.trim()]
      : [];
  });
}
