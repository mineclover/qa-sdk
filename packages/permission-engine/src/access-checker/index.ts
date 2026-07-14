// @def.boundary permission-engine-spec
// @def.doc authorization-ontology-resource-lifecycle

export {
  AccessChecker,
  type AccessCheckerDeps,
  type AccessContext,
  type AccessResult,
  type ApiCall,
  type InstancePolicyDecision,
  type InstancePolicyEvaluation,
  type InstancePolicyEvaluator,
  type InstancePolicyResolver,
} from './checker.js';
