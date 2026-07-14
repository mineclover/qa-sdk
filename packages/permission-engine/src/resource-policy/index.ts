// @def.boundary permission-engine-spec
// @def.doc authorization-ontology-resource-lifecycle

export {
  InvalidTransitionError,
  canAccessUnregistered,
  canTransition,
  createUnregistered,
  delegate,
  register,
  type CreateArgs,
  type DelegateArgs,
  type RegisterArgs,
  type ResourcePolicy,
  type ResourcePolicyState,
} from './state.js';

export {
  DuplicatePolicyError,
  InMemoryResourcePolicyRegistry,
  PolicyNotFoundError,
  type ResourcePolicyRegistry,
} from './registry.js';
