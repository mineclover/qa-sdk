export {
  IMPLEMENTATION_SURFACE_KINDS,
  type ImplementationSurfaceKind,
  VERIFICATION_SURFACE_KINDS,
  type VerificationSurfaceKind,
  type ConsistencyConstraintKind,
  type ConsistencyConstraintSeverity,
  type AdjustmentAction,
  type EvolutionPolicyKind,
  type GovernanceSurfaceRef,
  type ConsistencyConstraint,
  type AdjustmentPolicy,
  type EvolutionPolicy,
  type ImplementationBlueprint,
  type ImplementationBinding,
  type VerificationBinding,
  type ConsistencyVerdict,
  type AdjustmentSuggestion,
  type GovernanceRun,
  type ImplementationGovernanceEvaluationInput,
  type ImplementationGovernanceEvaluationResult,
  evaluateImplementationGovernance,
} from './internal/implementation-governance-core.js';

import { evaluateImplementationGovernance } from './internal/implementation-governance-core.js';

export const operationalOntologyImplementationGovernancePlane = {
  evaluateImplementationGovernance,
};
