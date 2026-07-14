export {
  defaultJunctionTemplateRegistry,
  type JunctionTemplateKind,
  JUNCTION_TEMPLATE_KINDS,
  type JunctionTemplate,
  type JunctionTemplateRegistry,
  DEFAULT_JUNCTION_TEMPLATES,
  type JunctionTemplateValidationResult,
  type BranchDefinition,
  type JunctionDefinition,
  type BranchDecision,
  type RouteDecision,
} from './internal/junction-core.js';

export {
  type BranchCondition,
  type BranchPath,
  type BranchHandlingMode,
} from './internal/runtime-core.js';

import { projectPathObservationToOperationalOntology } from './internal/projector-core.js';
import { defaultJunctionTemplateRegistry } from './internal/junction-core.js';

export const operationalOntologyJunctionPlane = {
  defaultJunctionTemplateRegistry,
  projectPathObservationToOperationalOntology,
};
