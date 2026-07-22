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
  assertWorkingContext,
  compileWorkingContext,
} from './working-context.js';

export {
  createContextManifest,
  createTaskHandoff,
} from './handoff.js';

export {
  createDecisionHintAdapter,
  createDefinitionGraphDiscoveryAdapter,
  createFederatedResolutionAdapter,
  mapContextObservation,
} from './adapters.js';

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
  ContextManifest,
  ContextManifestInput,
  ContextHint,
  ContextObservationInput,
  ContextObservationRecord,
  ContextAnchor,
  ContextBudgetProfile,
  ContextRoute,
  ContextMap,
  ContextMapEntry,
  ContextRuntimeErrorCode,
  ContextStage,
  CyclePolicy,
  DiscoveryClosure,
  DiscoveryCandidate,
  DiscoveryNextAction,
  DiscoveryPlan,
  DiscoveryPlanInput,
  DiscoveryPlanStatus,
  DiscoveryRouteProjection,
  DiscoverySkipReason,
  DiscoveryRoute,
  DecisionHintAdapter,
  DecisionHintPort,
  DecisionHintRecord,
  DecisionHintRequest,
  DefinitionGraphDiscoveryAdapter,
  DefinitionGraphDiscoveryPort,
  DefinitionGraphDiscoveryRequest,
  DefinitionGraphRouteNode,
  EstimatedRouteSize,
  FreshnessRequirement,
  FederatedResolutionAdapter,
  FederatedResolutionPort,
  FederatedResolutionRecord,
  FederatedResolutionRequest,
  ManifestFactRef,
  NextTask,
  OutputContract,
  RequiredFact,
  ResolutionRoute,
  ResolvedFact,
  RouteBase,
  RouteBounds,
  RouteSelection,
  SkippedDiscoveryRoute,
  TaskIntent,
  TaskHandoff,
  TaskHandoffInput,
  WorkingContext,
  WorkingContextCompileInput,
  WorkingClosure,
  VerificationClosure,
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
