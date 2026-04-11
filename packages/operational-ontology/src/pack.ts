export {
  type OperationalOntologyPack,
  type OperationalOntologyPackValidationSource,
  type OperationalOntologyPackValidationIssue,
  type OperationalOntologyPackBlueprintValidation,
  type OperationalOntologyPackValidationResult,
  validateOperationalOntologyPack,
} from './internal/pack-core.js';

import { validateOperationalOntologyPack } from './internal/pack-core.js';

export const operationalOntologyPackPlane = {
  validateOperationalOntologyPack,
};
