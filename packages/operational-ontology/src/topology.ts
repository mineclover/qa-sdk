export {
  type ObservationTopologyTemplateKind,
  OBSERVATION_TOPOLOGY_TEMPLATE_KINDS,
  type ObservationTopologyTemplate,
  type ObservationTopologyTemplateRegistry,
  DEFAULT_OBSERVATION_TOPOLOGY_TEMPLATES,
  defaultObservationTopologyTemplateRegistry,
  type ObservationTopologyTemplateValidationResult,
  validateObservationTopologyAgainstTemplate,
} from './internal/topology-core.js';

export { type OperationalOntologySnapshot } from './internal/projector-core.js';

import {
  defaultObservationTopologyTemplateRegistry,
  validateObservationTopologyAgainstTemplate,
} from './internal/topology-core.js';
import { projectOperationalOntologySnapshot } from './internal/projector-core.js';

export const operationalOntologyTopologyPlane = {
  defaultObservationTopologyTemplateRegistry,
  validateObservationTopologyAgainstTemplate,
  projectOperationalOntologySnapshot,
};
