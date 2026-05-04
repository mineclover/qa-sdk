import type { CoordAxes, RelationCategoryResolver, RelationCategorySchema } from "./schema-core.js";

export interface NodeCoord {
  realm: string;
  space: string;
  anchor: string;
  taxonomies: CoordAxes;
  canonicalKey: string;
}

export interface RelationTypeCoord {
  category: string;
  axes: CoordAxes;
  canonicalKey: string;
}

export interface EdgeCoord {
  start: string;
  relationType: string;
  end: string;
  canonicalKey: string;
}

export interface TraversalCoord {
  purpose: string;
  start: string;
  edges: string[];
  end: string;
  canonicalKey?: string;
}

export interface TraversalObservation {
  traversal: TraversalCoord;
  reachedGoalIds: string[];
  unreachableGoalIds: string[];
  loopDetected: boolean;
  recoveryUsed: boolean;
  terminalNodeId: string | null;
  terminalReason: string | null;
}

export const INFORMATION_FACET_KINDS = [
  "definition",
  "management",
  "production",
  "consumption",
  "storage",
] as const;

export type InformationFacetKind = (typeof INFORMATION_FACET_KINDS)[number];

export interface InformationFacetRef {
  nodeId: string;
  facetKind: InformationFacetKind;
  key: string;
}

export const TRANSMISSION_SEMANTICS = [
  "contract_descent",
  "production_to_consumption",
  "storage_projection",
  "observation_emission",
] as const;

export type TransmissionSemantic = (typeof TRANSMISSION_SEMANTICS)[number];

export const TRANSMISSION_MEDIA = [
  "direct",
  "event",
  "state",
  "projection",
  "observation",
] as const;

export type TransmissionMedium = (typeof TRANSMISSION_MEDIA)[number];

export type TransmissionDirection = "forward" | "reverse" | "bidirectional";

export interface SemanticTransmission {
  transmissionId: string;
  source: InformationFacetRef;
  target: InformationFacetRef;
  semantic: TransmissionSemantic;
  medium: TransmissionMedium;
  direction: TransmissionDirection;
  relationType?: string;
  contractRefs?: string[];
}

export interface BranchCondition {
  conditionId: string;
  expression: string;
}

export type BranchHandlingMode =
  | "first_match"
  | "all_matches"
  | "fallback"
  | "optional";

export interface BranchPath {
  pathId: string;
  when?: BranchCondition;
  nextNodeIds: string[];
  priority?: number;
}

export const CONTROL_FLOW_NODE_KINDS = [
  "step",
  "sequence",
  "branch",
  "optional",
  "parallel",
  "join",
  "retry",
  "feedback",
  "emit",
  "transition_scope",
] as const;

export type ControlFlowNodeKind = (typeof CONTROL_FLOW_NODE_KINDS)[number];

export const CONTROL_FLOW_EDGE_KINDS = [
  "next",
  "conditional",
  "event",
  "error",
  "fan_out",
  "join",
  "feedback",
] as const;

export type ControlFlowEdgeKind = (typeof CONTROL_FLOW_EDGE_KINDS)[number];

export interface ControlFlowNode {
  nodeId: string;
  kind: ControlFlowNodeKind;
  facet?: InformationFacetKind;
  entryCondition?: string;
  exitCondition?: string;
  sourceKind?: string;
}

export interface ControlFlowEdge {
  from: string;
  to: string;
  kind: ControlFlowEdgeKind;
  condition?: string;
  sourceKind?: string;
}

export interface ControlFlowGraph {
  graphId: string;
  entryNodeId: string;
  nodes: ControlFlowNode[];
  edges: ControlFlowEdge[];
  version?: string;
  description?: string;
}

function encodeAxes(axes: CoordAxes): string {
  return Object.entries(axes)
    .toSorted(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
}

export function createNodeCanonicalKey(input: Omit<NodeCoord, "canonicalKey">): string {
  const axes = encodeAxes(input.taxonomies);
  return axes.length === 0
    ? `node:${input.realm}/${input.space}/${input.anchor}`
    : `node:${input.realm}/${input.space}/${input.anchor}?${axes}`;
}

export function createNodeCoord(input: Omit<NodeCoord, "canonicalKey">): NodeCoord {
  return {
    ...input,
    canonicalKey: createNodeCanonicalKey(input),
  };
}

export function createRelationTypeCanonicalKey(
  input: Omit<RelationTypeCoord, "canonicalKey">,
): string {
  const axes = encodeAxes(input.axes);
  return axes.length === 0
    ? `relation-type:${input.category}`
    : `relation-type:${input.category}?${axes}`;
}

export function createRelationTypeCoord(
  definition: RelationCategorySchema,
  input: Omit<RelationTypeCoord, "canonicalKey" | "axes"> & { axes?: CoordAxes },
): RelationTypeCoord {
  const axes = {
    ...definition.defaultValues,
    ...input.axes,
  };

  return {
    category: input.category,
    axes,
    canonicalKey: createRelationTypeCanonicalKey({
      category: input.category,
      axes,
    }),
  };
}

function resolveRelationCategory(
  resolver: RelationCategoryResolver,
  category: string,
): RelationCategorySchema | undefined {
  if (typeof resolver === "function") {
    return resolver(category);
  }

  return resolver.get(category);
}

export function createRelationTypeCoordWithResolver(
  resolver: RelationCategoryResolver,
  input: Omit<RelationTypeCoord, "canonicalKey" | "axes"> & { axes?: CoordAxes },
): RelationTypeCoord {
  const definition = resolveRelationCategory(resolver, input.category);

  if (!definition) {
    throw new Error(`Unknown relation category "${input.category}"`);
  }

  return createRelationTypeCoord(definition, input);
}

export function createEdgeCanonicalKey(input: Omit<EdgeCoord, "canonicalKey">): string {
  return `edge:${input.start}->${input.relationType}->${input.end}`;
}

export function createEdgeCoord(input: Omit<EdgeCoord, "canonicalKey">): EdgeCoord {
  return {
    ...input,
    canonicalKey: createEdgeCanonicalKey(input),
  };
}

export function createTraversalCanonicalKey(input: TraversalCoord): string {
  return `traversal:${input.purpose}:${input.start}->${input.edges.join("/")}->${input.end}`;
}

export function createInformationFacetKey(input: Omit<InformationFacetRef, "key">): string {
  return `facet:${input.nodeId}:${input.facetKind}`;
}

export function createInformationFacetRef(
  input: Omit<InformationFacetRef, "key">,
): InformationFacetRef {
  return {
    ...input,
    key: createInformationFacetKey(input),
  };
}

export function createSemanticTransmissionId(input: {
  source: InformationFacetRef;
  target: InformationFacetRef;
  semantic: TransmissionSemantic;
}): string {
  return `transmission:${input.semantic}:${input.source.key}->${input.target.key}`;
}
