// @def.boundary permission-engine-spec
// @def.doc authorization-ontology-resource-lifecycle

export {
  AccessChecker,
  type AccessCheckerDeps,
  type AccessContext,
  type AccessResult,
  type ApiCall,
  type InstancePolicyEvaluator,
  type InstancePolicyResolver,
} from "./checker.js";
