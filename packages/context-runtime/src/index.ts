// @def.boundary context-runtime
// @def.doc context-runtime

export {
  DEFAULT_CONTEXT_BUDGET_PROFILE,
  availableDiscoveryTokens,
  assertValidContextBudgetProfile,
  createContextBudgetProfile,
  validateContextBudgetProfile,
} from './budget.js';

export {
  assertWorkingClosure,
  validateWorkingClosure,
} from './closure.js';

export {
  freezeRouteSelection,
  isDiscoveryRoute,
  isResolutionRoute,
  validateRoute,
  validateRouteBounds,
  validateRouteSet,
} from './routes.js';

export {
  planDiscovery,
  projectDiscoveryCandidate,
} from './discovery.js';

export type {
  AuthorityLevel,
  AuthorityRequirement,
  ClosureDiagnostic,
  ClosureStatus,
  ContextAnchor,
  ContextBudgetProfile,
  ContextRoute,
  ContextMap,
  ContextMapEntry,
  ContextRuntimeErrorCode,
  ContextStage,
  CyclePolicy,
  DiscoveryCandidate,
  DiscoveryNextAction,
  DiscoveryPlan,
  DiscoveryPlanInput,
  DiscoveryPlanStatus,
  DiscoveryRouteProjection,
  DiscoverySkipReason,
  DiscoveryRoute,
  EstimatedRouteSize,
  FreshnessRequirement,
  RequiredFact,
  ResolutionRoute,
  ResolvedFact,
  RouteBase,
  RouteBounds,
  RouteSelection,
  SkippedDiscoveryRoute,
  TaskIntent,
  ValidationIssue,
  ValidationResult,
  WorkingClosureInput,
  WorkingClosureResult,
} from './types.js';

export {
  ContextRuntimeError,
  DEFAULT_TOTAL_WINDOW_TOKENS,
  DISCOVERY_HARD_CAP_TOKENS,
  WORKING_RESERVE_MIN_TOKENS,
} from './types.js';
