// @def.boundary context-runtime
// @def.doc context-runtime

export {
  DEFAULT_CONTEXT_BUDGET_PROFILE,
  availableDiscoveryTokens,
  assertValidContextBudgetProfile,
  createContextBudgetProfile,
  validateContextBudgetProfile,
} from './budget.js';

export { assertWorkingClosure, validateWorkingClosure } from './closure.js';

export { executeDiscoveryTaskDecomposition } from './decomposition.js';

export { assertWorkingContext, compileWorkingContext } from './working-context.js';

export {
  aggregateTaskHandoffs,
  createContextManifest,
  createTaskHandoff,
  executeAndAggregateTaskHandoffs,
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
  createDiscoveryTaskDecomposition,
  planDiscovery,
  projectDiscoveryCandidate,
  toDiscoveryTokenInput,
} from './discovery.js';

export {
  JSON_CONTEXT_TOKEN_COUNTER,
  createContextUsageLedger,
  createJsonContextTokenCounter,
  createProviderUsageEvent,
} from './usage.js';

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
  ContextTokenCounter,
  ContextTokenCountContext,
  ContextUsageEvent,
  ContextUsageMetricSummary,
  ContextUsageLedger,
  ContextUsageMeasurement,
  ContextUsagePhase,
  ContextUsageSummary,
  DiscoveryDecompositionReason,
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
  DiscoveryTaskDecomposition,
  DiscoveryTaskExecutionOptions,
  DiscoveryTaskExecutionRecord,
  DiscoveryTaskExecutionResult,
  DiscoveryTaskExecutionStatus,
  DiscoveryTaskChildExecutionStatus,
  DiscoveryTaskSlice,
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
  ProviderUsageSnapshot,
  RequiredFact,
  ResolutionRoute,
  ResolvedFact,
  RouteBase,
  RouteBounds,
  RouteSelection,
  SkippedDiscoveryRoute,
  TaskIntent,
  TaskHandoff,
  TaskHandoffAggregationInput,
  TaskHandoffDecompositionExecutionOptions,
  TaskHandoffDecompositionExecutionResult,
  TaskHandoffInput,
  TaskHandoffStore,
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
