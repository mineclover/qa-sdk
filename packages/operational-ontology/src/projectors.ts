export {
  defaultOperationalOntologyRuntimePorts,
  createDefaultOperationalOntologyRuntimePorts,
  type EventRecordObservationInput,
  type PipeGraphProjectionInput,
  type LineageProjectionInput,
  type PathObservationProjectionInput,
  type OperationalOntologyProjectionInput,
  type EventRecordProjectionResult,
  type PipeGraphProjectionResult,
  type PathObservationProjectionResult,
  type OperationalOntologyEventRecordProjector,
  type OperationalOntologyPipeGraphProjector,
  type OperationalOntologyLineageProjector,
  type OperationalOntologyPathObservationProjector,
  type OperationalOntologyRuntimePorts,
  projectEventRecordToOperationalOntology,
  projectPipeGraphToOperationalOntology,
  projectLineageToOperationalOntology,
  projectPathObservationToOperationalOntology,
  projectOperationalOntologySnapshot,
} from "./internal/projector-core.js";

export { type AddressContextBinding } from "./internal/checkpoint-core.js";

import {
  defaultOperationalOntologyRuntimePorts,
  createDefaultOperationalOntologyRuntimePorts,
  projectEventRecordToOperationalOntology,
  projectPipeGraphToOperationalOntology,
  projectLineageToOperationalOntology,
  projectPathObservationToOperationalOntology,
  projectOperationalOntologySnapshot,
} from "./internal/projector-core.js";

export const operationalOntologyProjectors = {
  projectEventRecordToOperationalOntology,
  projectPipeGraphToOperationalOntology,
  projectLineageToOperationalOntology,
  projectPathObservationToOperationalOntology,
  projectOperationalOntologySnapshot,
  createDefaultOperationalOntologyRuntimePorts,
  defaultOperationalOntologyRuntimePorts,
};
