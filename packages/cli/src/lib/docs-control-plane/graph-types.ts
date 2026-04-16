import type { DocumentMetadata, DocumentRawSourcePointer } from "./types.js";

export const CANONICAL_TRAVERSAL_AXES = [
  "composition",
  "refinement",
  "dependency",
  "constraint",
  "trace",
  "source",
  "evidence",
  "role",
  "context",
] as const;

export type TraversalAxis = (typeof CANONICAL_TRAVERSAL_AXES)[number];

export const TRAVERSAL_DIRECTIONS = ["out", "in", "both"] as const;

export type TraversalDirection = (typeof TRAVERSAL_DIRECTIONS)[number];

export const DOCUMENT_GRAPH_NODE_KINDS = [
  "spec",
  "todo",
  "plan",
  "rule",
  "cases",
  "test",
  "memo",
  "knowledge",
  "prd",
  "ralph-prd-json",
  "ralph-session",
  "source",
  "evidence",
  "section",
] as const;

export type DocumentGraphNodeKind = (typeof DOCUMENT_GRAPH_NODE_KINDS)[number];

export const DOCUMENT_GRAPH_FAMILY_ROLE_TYPES = [
  "spec",
  "todo",
  "plan",
  "rule",
  "cases",
  "test",
  "memo",
  "knowledge",
] as const;

export type DocumentGraphFamilyRoleType =
  (typeof DOCUMENT_GRAPH_FAMILY_ROLE_TYPES)[number];

export const DOCUMENT_GRAPH_EDGE_KINDS = [
  "authored-link",
  "document-constraint",
  "document-source",
  "document-evidence",
  "task-trace",
  "task-evidence",
  "section-membership",
  "role-membership",
  "context-metadata",
] as const;

export type DocumentGraphEdgeKind = (typeof DOCUMENT_GRAPH_EDGE_KINDS)[number];

export const TRAVERSAL_PRESET_IDS = [
  "family",
  "implementation",
  "review",
  "impact",
  "prd-completion",
] as const;

export type TraversalPresetId = (typeof TRAVERSAL_PRESET_IDS)[number];

export interface TraversalPresetDefinition {
  readonly id: TraversalPresetId;
  readonly label: string;
  readonly axes: readonly TraversalAxis[];
  readonly direction: TraversalDirection;
  readonly defaultDepth: number;
  readonly includeContext: boolean;
  readonly description: string;
}

export const TRAVERSAL_AXIS_PRIORITY = {
  composition: 0,
  refinement: 1,
  dependency: 2,
  constraint: 3,
  trace: 4,
  source: 5,
  evidence: 6,
  role: 7,
  context: 8,
} as const satisfies Readonly<Record<TraversalAxis, number>>;

export interface DocumentGraphNodeSummary {
  readonly id: string;
  readonly kind: DocumentGraphNodeKind;
  readonly label?: string;
  readonly stableId?: string;
  readonly familyId?: string;
  readonly path?: string;
  readonly metadata: DocumentMetadata;
}

export interface DocumentGraphEdgeReason {
  readonly adapterId: string;
  readonly reason: string;
  readonly rawSource?: DocumentRawSourcePointer;
  readonly sourceDocumentId?: string;
  readonly sourceDocumentPath?: string;
  readonly targetNodeId?: string;
  readonly targetNodePath?: string;
  readonly metadata: DocumentMetadata;
}

export interface DocumentGraphEdgeSummary {
  readonly id: string;
  readonly kind: DocumentGraphEdgeKind;
  readonly axis: TraversalAxis;
  readonly fromNodeId: string;
  readonly toNodeId: string;
  readonly authoredType?: string;
  readonly reasons: readonly DocumentGraphEdgeReason[];
  readonly metadata: DocumentMetadata;
}

export interface TraversalInputSummary {
  readonly target: string;
  readonly axes: readonly TraversalAxis[];
  readonly direction: TraversalDirection;
  readonly depth: number;
  readonly limit: number;
  readonly includeContext: boolean;
  readonly preset?: TraversalPresetId;
}

export interface TraversalOmittedCounts {
  /** Returned node cap omissions after traversal ordering is applied. */
  readonly nodes: number;
  /** Traversed or frontier edges hidden because node/depth caps were hit. */
  readonly edges: number;
  /** Unique frontier nodes reachable beyond the enforced depth cap. */
  readonly depth: number;
}

export interface TraversalResultSummary {
  readonly input: TraversalInputSummary;
  readonly targetNodeId?: string;
  readonly nodeCount: number;
  readonly edgeCount: number;
  readonly truncated: boolean;
  readonly omittedCounts: TraversalOmittedCounts;
  readonly omittedCount: number;
  readonly diagnostics: readonly string[];
}

export const AUTHORED_LINK_AXIS_MAP = {
  contains: "composition",
  refines: "refinement",
  depends_on: "dependency",
  constrains: "constraint",
  traces_to: "trace",
  implements: "trace",
  evolves_from: "trace",
  supersedes: "trace",
  verifies: "evidence",
  materializes_output: "evidence",
} as const satisfies Readonly<Record<string, TraversalAxis>>;

export type AuthoredLinkType = keyof typeof AUTHORED_LINK_AXIS_MAP;

export const ENVELOPE_FIELD_AXIS_MAP = {
  sources: "source",
  source: "source",
  sourceRefs: "source",
  codeReferences: "source",
  verifiesRefs: "evidence",
  materializesOutputRefs: "evidence",
  verificationRefs: "evidence",
  evidence: "evidence",
  tasks: "trace",
  familyId: "role",
  kind: "role",
  tags: "context",
  scope: "context",
  aspect: "context",
  layer: "context",
  knowledgeKind: "context",
} as const satisfies Readonly<Record<string, TraversalAxis>>;

export type EnvelopeFieldAxisKey = keyof typeof ENVELOPE_FIELD_AXIS_MAP;

const traversalAxisSet = new Set<string>(CANONICAL_TRAVERSAL_AXES);
const traversalDirectionSet = new Set<string>(TRAVERSAL_DIRECTIONS);
const documentGraphNodeKindSet = new Set<string>(DOCUMENT_GRAPH_NODE_KINDS);
const traversalPresetIdSet = new Set<string>(TRAVERSAL_PRESET_IDS);

export function isTraversalAxis(value: string): value is TraversalAxis {
  return traversalAxisSet.has(value);
}

export function isTraversalDirection(value: string): value is TraversalDirection {
  return traversalDirectionSet.has(value);
}

export function isDocumentGraphNodeKind(value: string): value is DocumentGraphNodeKind {
  return documentGraphNodeKindSet.has(value);
}

export function isTraversalPresetId(value: string): value is TraversalPresetId {
  return traversalPresetIdSet.has(value);
}
