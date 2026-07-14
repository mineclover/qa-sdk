import type {
  DataSchema,
  EventRecord,
  FieldLineage,
  NonLinearPathObservation,
  PathObservation,
  PipeGraph,
} from '@qa-sdk/core';

import type {
  AddressContextBinding,
  CheckpointDefinition,
  CheckpointLattice,
  CheckpointObservation,
  CheckpointTemplateRegistry,
} from './checkpoint-core.js';
import type {
  CorridorTemplateRegistry,
  DataFlowDefinition,
  FlowCorridor,
} from './corridor-core.js';
import type {
  BranchDecision,
  BranchDefinition,
  JunctionDefinition,
  JunctionTemplateRegistry,
  RouteDecision,
} from './junction-core.js';
import type { DataLineageLink } from './lineage-core.js';
import type {
  ControlFlowGraph,
  SemanticTransmission,
  TraversalObservation,
} from './runtime-core.js';
import type {
  ObservationTopologyTemplateKind,
  ObservationTopologyTemplateRegistry,
  ObservationTopologyTemplateValidationResult,
} from './topology-core.js';

export interface EventRecordObservationInput {
  record: EventRecord;
  addressBindings?: AddressContextBinding[];
  checkpointTemplateRegistry?: CheckpointTemplateRegistry;
  corridorTemplateRegistry?: CorridorTemplateRegistry;
}

export interface PipeGraphProjectionInput {
  graph: PipeGraph;
  schemas?: DataSchema[];
  lineages?: FieldLineage[];
  corridorTemplateRegistry?: CorridorTemplateRegistry;
  junctionTemplateRegistry?: JunctionTemplateRegistry;
}

export interface LineageProjectionInput {
  schemas?: DataSchema[];
  lineages?: FieldLineage[];
}

export interface PathObservationProjectionInput {
  observation: PathObservation | NonLinearPathObservation;
  junctionTemplateRegistry?: JunctionTemplateRegistry;
}

export interface OperationalOntologyProjectionInput {
  graph?: PipeGraph;
  record?: EventRecord;
  schemas?: DataSchema[];
  lineages?: FieldLineage[];
  pathObservation?: PathObservation | NonLinearPathObservation;
  addressBindings?: AddressContextBinding[];
  checkpointTemplateRegistry?: CheckpointTemplateRegistry;
  corridorTemplateRegistry?: CorridorTemplateRegistry;
  junctionTemplateRegistry?: JunctionTemplateRegistry;
  topologyTemplateRegistry?: ObservationTopologyTemplateRegistry;
}

export interface EventRecordProjectionResult {
  observedNodeKeys: string[];
  observedEdgeKeys: string[];
  dataFlow: DataFlowDefinition;
  transmissions: SemanticTransmission[];
  checkpoint: CheckpointObservation;
  checkpoints: CheckpointObservation[];
  checkpointDefinitions: CheckpointDefinition[];
  checkpointLattice: CheckpointLattice;
}

export interface PipeGraphProjectionResult {
  controlFlow: ControlFlowGraph;
  dataFlow: DataFlowDefinition;
  transmissions: SemanticTransmission[];
  lineageLinks: DataLineageLink[];
  branchDefinitions: BranchDefinition[];
  corridor: FlowCorridor;
  junctions: JunctionDefinition[];
}

export interface PathObservationProjectionResult {
  traversalObservations: TraversalObservation[];
  branchDecisions: BranchDecision[];
}

export interface OperationalOntologyEventRecordProjector {
  projectEventRecord(input: EventRecordObservationInput): EventRecordProjectionResult;
}

export interface OperationalOntologyPipeGraphProjector {
  projectPipeGraph(input: PipeGraphProjectionInput): PipeGraphProjectionResult;
}

export interface OperationalOntologyLineageProjector {
  projectLineage(input: LineageProjectionInput): DataLineageLink[];
}

export interface OperationalOntologyPathObservationProjector {
  projectPathObservation(input: PathObservationProjectionInput): PathObservationProjectionResult;
}

export interface OperationalOntologyRuntimePorts {
  events: OperationalOntologyEventRecordProjector;
  controlFlow: OperationalOntologyPipeGraphProjector;
  lineage: OperationalOntologyLineageProjector;
  traversal: OperationalOntologyPathObservationProjector;
}

export interface OperationalOntologySnapshot {
  topologyTemplateKind: ObservationTopologyTemplateKind;
  topologyTemplateDescription?: string;
  topologyValidation?: ObservationTopologyTemplateValidationResult;
  corridors: FlowCorridor[];
  controlFlows: ControlFlowGraph[];
  checkpoints: CheckpointObservation[];
  checkpointLattices: CheckpointLattice[];
  junctions: JunctionDefinition[];
  routeDecisions: RouteDecision[];
  traversals: TraversalObservation[];
  transmissions: SemanticTransmission[];
  lineageLinks: DataLineageLink[];
  observedNodeKeys: string[];
  observedEdgeKeys: string[];
}
