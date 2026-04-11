export {
  type OperationalOntologyPack,
  type OperationalOntologyPackValidationSource,
  type OperationalOntologyPackValidationIssue,
  type OperationalOntologyPackBlueprintValidation,
  type OperationalOntologyPackValidationResult,
  type OperationalOntologyPacksValidationResult,
  type OperationalOntologyPackRegistry,
  InMemoryOperationalOntologyPackRegistry,
  validateOperationalOntologyPack,
  validateOperationalOntologyPacks,
} from './internal/pack-core.js';

import {
  validateOperationalOntologyPack,
  validateOperationalOntologyPacks,
} from './internal/pack-core.js';

export const operationalOntologyPackPlane = {
  validateOperationalOntologyPack,
  validateOperationalOntologyPacks,
};
