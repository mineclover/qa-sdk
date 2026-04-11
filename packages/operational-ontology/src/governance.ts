export {
  IMPLEMENTATION_SURFACE_KINDS,
  type ImplementationSurfaceKind,
  VERIFICATION_SURFACE_KINDS,
  type VerificationSurfaceKind,
  type ConsistencyConstraintKind,
  type ConsistencyConstraintSeverity,
  type AdjustmentAction,
  type EvolutionPolicyKind,
  IMPLEMENTATION_GOVERNANCE_UNIT_KINDS,
  type ImplementationGovernanceUnitKind,
  type ImplementationGovernanceTaxonomy,
  type ImplementationGovernanceTaxonomyValidationIssue,
  type ImplementationGovernanceTaxonomyValidationResult,
  DEFAULT_IMPLEMENTATION_GOVERNANCE_TAXONOMY,
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
  validateImplementationGovernanceTaxonomy,
  evaluateImplementationGovernance,
} from './internal/implementation-governance-core.js';

import {
  evaluateImplementationGovernance,
  validateImplementationGovernanceTaxonomy,
} from './internal/implementation-governance-core.js';

export const operationalOntologyImplementationGovernancePlane = {
  validateImplementationGovernanceTaxonomy,
  evaluateImplementationGovernance,
};
