export {
  defaultCheckpointTemplateRegistry,
  type CheckpointTemplateKind,
  CHECKPOINT_TEMPLATE_KINDS,
  type CheckpointTemplate,
  type CheckpointTemplateRegistry,
  DEFAULT_CHECKPOINT_TEMPLATES,
  type CheckpointTemplateValidationResult,
  type AddressContextBinding,
  type CheckpointDefinition,
  type CheckpointObservation,
  type CheckpointLink,
  type CheckpointLattice,
} from './internal/checkpoint-core.js';

import { projectEventRecordToOperationalOntology } from './internal/projector-core.js';
import { defaultCheckpointTemplateRegistry } from './internal/checkpoint-core.js';

export const operationalOntologyCheckpointPlane = {
  defaultCheckpointTemplateRegistry,
  projectEventRecordToOperationalOntology,
};
