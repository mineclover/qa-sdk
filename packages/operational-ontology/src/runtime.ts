export {
  type NodeCoord,
  type RelationTypeCoord,
  type EdgeCoord,
  type TraversalCoord,
  type TraversalObservation,
  type InformationFacetKind,
  INFORMATION_FACET_KINDS,
  type InformationFacetRef,
  type TransmissionSemantic,
  TRANSMISSION_SEMANTICS,
  type TransmissionMedium,
  TRANSMISSION_MEDIA,
  type TransmissionDirection,
  type SemanticTransmission,
  type BranchCondition,
  type BranchPath,
  type BranchHandlingMode,
  type ControlFlowNodeKind,
  CONTROL_FLOW_NODE_KINDS,
  type ControlFlowEdgeKind,
  CONTROL_FLOW_EDGE_KINDS,
  type ControlFlowNode,
  type ControlFlowEdge,
  type ControlFlowGraph,
  createNodeCanonicalKey,
  createNodeCoord,
  createRelationTypeCanonicalKey,
  createRelationTypeCoord,
  createRelationTypeCoordWithResolver,
  createEdgeCanonicalKey,
  createEdgeCoord,
  createTraversalCanonicalKey,
  createInformationFacetKey,
  createInformationFacetRef,
  createSemanticTransmissionId,
} from './internal/runtime-core.js';

export {
  type BranchDefinition,
  type JunctionDefinition,
  type BranchDecision,
  type RouteDecision,
} from './internal/junction-core.js';

export {
  type CheckpointDefinition,
  type CheckpointObservation,
  type CheckpointLink,
  type CheckpointLattice,
} from './internal/checkpoint-core.js';

export { type OperationalOntologySnapshot } from './internal/projector-core.js';
