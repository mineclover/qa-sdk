export const DISCOVERY_HARD_CAP_TOKENS = 100_000 as const;
export const WORKING_RESERVE_MIN_TOKENS = 100_000 as const;
export const DEFAULT_TOTAL_WINDOW_TOKENS = 200_000 as const;

export type ContextStage = 'discovery' | 'working' | 'verification';
export type ContextUsagePhase = 'discovery' | 'working';
export type ContextUsageMeasurement = 'estimated' | 'measured';
export type DiscoveryClosure = 'open' | 'planned' | 'discovery-capped' | 'frozen';
export type WorkingClosure = 'open' | 'closed' | 'blocked';
export type VerificationClosure = 'pending' | 'verified' | 'failed';
export type ClosureStatus = Exclude<WorkingClosure, 'open'>;
export type DiscoveryPlanStatus = 'planned' | 'discovery-capped';
export type DiscoveryNextAction = 'freeze' | 'decompose';
export type CyclePolicy = 'reject' | 'stop';
export type AuthorityLevel = 'projection_allowed' | 'verified' | 'authoritative';

export type StopObligationKind = 'route' | 'fact' | 'evidence';

export interface ContextStopObligation {
  readonly kind: StopObligationKind;
  readonly key: string;
}

export interface ContextStopPolicy {
  readonly obligations: readonly ContextStopObligation[];
  /** Consecutive expansion rounds without new route/fact/evidence progress. */
  readonly noProgressLimit?: number;
}

export type StopReason =
  | 'coverage-satisfied'
  | 'budget-exhausted'
  | 'route-expansion-limit'
  | 'object-limit'
  | 'relation-limit'
  | 'no-progress'
  | 'source-exhausted'
  | 'cycle-detected'
  | 'missing-required-fact'
  | 'authority-insufficient'
  | 'freshness-failed';

export type StopAction = 'freeze' | 'decompose' | 'block';

export interface StopProgress {
  readonly newRoutes: number;
  readonly newFacts: number;
  readonly newEvidenceRefs: number;
}

export interface StopDecision {
  readonly reason: StopReason;
  readonly action: StopAction;
  readonly satisfiedObligations: readonly ContextStopObligation[];
  readonly unresolvedObligations: readonly ContextStopObligation[];
  readonly progress: StopProgress;
}

export interface StopEvaluationInput {
  readonly policy: ContextStopPolicy;
  readonly selectedRouteKeys: readonly string[];
  readonly resolvedFacts?: readonly ResolvedFact[];
  readonly evidenceRefs?: readonly string[];
  readonly progress?: StopProgress;
  readonly consecutiveNoProgress?: number;
  /** True when all permitted source routes for this round have been exhausted. */
  readonly sourceExhausted?: boolean;
  /** A hard cap takes precedence over semantic coverage. */
  readonly hardStopReason?: Exclude<
    StopReason,
    | 'coverage-satisfied'
    | 'no-progress'
    | 'source-exhausted'
    | 'cycle-detected'
    | 'missing-required-fact'
    | 'authority-insufficient'
    | 'freshness-failed'
  >;
}

export interface ContextBudgetProfile {
  readonly totalWindowTokens: number;
  readonly discoveryMaxTokens: number;
  readonly workingReserveTokens: number;
  readonly systemReserveTokens: number;
  readonly outputReserveTokens: number;
  readonly maxObjects?: number;
  readonly maxRelations?: number;
  readonly maxRouteExpansions?: number;
}

export interface FreshnessRequirement {
  readonly maxAgeMs: number;
}

export interface ContextAnchor {
  readonly anchorKey: string;
  readonly ref: string;
  readonly kind: 'task' | 'entity' | 'source';
}

export interface ContextMapEntry {
  readonly routeKey: string;
  readonly purpose: string;
  readonly status: 'not_loaded' | 'summary_available' | 'pointer_available';
  readonly estimatedCostTokens: number;
}

export interface ContextMap {
  readonly anchor: ContextAnchor;
  readonly entries: readonly ContextMapEntry[];
}

export interface TaskIntent {
  readonly taskKey: string;
  readonly objective: string;
  readonly anchor: ContextAnchor;
}

export interface AuthorityRequirement {
  readonly minimum: AuthorityLevel;
}

export interface RouteBounds {
  readonly maxDepth: number;
  readonly maxFanOut: number;
  readonly maxItems: number;
  readonly cyclePolicy: CyclePolicy;
}

export interface RouteBase {
  readonly routeKey: string;
  readonly purpose: string;
  readonly fromAnchor: string;
  readonly relationPath: readonly string[];
  readonly bounds: RouteBounds;
  readonly estimatedCostTokens: number;
}

export interface DiscoveryRoute extends RouteBase {
  readonly kind: 'discovery';
  readonly representation: 'map' | 'summary' | 'pointer';
}

export interface ResolutionRoute extends RouteBase {
  readonly kind: 'resolution';
  readonly requiredFactKeys: readonly string[];
  readonly authority: AuthorityRequirement;
  readonly freshness?: FreshnessRequirement;
}

export type ContextRoute = DiscoveryRoute | ResolutionRoute;

export interface EstimatedRouteSize {
  readonly objectCount: number;
  readonly relationCount: number;
}

export interface DiscoveryCandidate {
  readonly route: ContextRoute;
  readonly priority: number;
  readonly estimatedSize: EstimatedRouteSize;
  readonly sourceRef?: string;
}

export interface DiscoveryRouteProjection {
  readonly routeKey: string;
  readonly kind: ContextRoute['kind'];
  readonly priority: number;
  readonly estimatedCostTokens: number;
  readonly costMeasurement?: ContextUsageMeasurement;
  readonly estimatedSize: EstimatedRouteSize;
  readonly authority: AuthorityLevel;
  readonly freshness?: FreshnessRequirement;
  readonly sourceRef?: string;
}

export type DiscoverySkipReason =
  | 'budget-exhausted'
  | 'route-expansion-limit'
  | 'object-limit'
  | 'relation-limit'
  | 'coverage-satisfied'
  | 'no-progress';

export interface SkippedDiscoveryRoute {
  readonly routeKey: string;
  readonly reason: DiscoverySkipReason;
  readonly estimatedCostTokens: number;
  readonly costMeasurement?: ContextUsageMeasurement;
}

export interface DiscoveryPlanInput {
  readonly intent: TaskIntent;
  readonly candidates: readonly DiscoveryCandidate[];
  readonly budget: ContextBudgetProfile;
  readonly usedTokens: number;
  /** Optional provider/model counter applied to the canonical candidate shape before selection. */
  readonly tokenCounter?: ContextTokenCounter;
  /** Optional semantic stop policy evaluated during deterministic route selection. */
  readonly stopPolicy?: ContextStopPolicy;
  /** Per-route progress reported by a source adapter for no-progress detection. */
  readonly progressByRoute?: Readonly<Record<string, StopProgress>>;
}

export interface DiscoveryPlan {
  readonly status: DiscoveryPlanStatus;
  readonly nextAction: DiscoveryNextAction;
  readonly taskKey: string;
  readonly anchorKey: string;
  readonly selectedRouteKeys: readonly string[];
  readonly projections: readonly DiscoveryRouteProjection[];
  readonly skippedRoutes: readonly SkippedDiscoveryRoute[];
  readonly usedTokens: number;
  readonly projectedDiscoveryTokens: number;
  readonly remainingDiscoveryTokens: number;
  readonly projectedObjectCount: number;
  readonly projectedRelationCount: number;
  readonly workingReserveTokens: number;
  readonly stopDecision?: StopDecision;
  readonly decomposition?: DiscoveryTaskDecomposition;
}

export type DiscoveryDecompositionReason =
  | 'budget-exhausted'
  | 'route-expansion-limit'
  | 'object-limit'
  | 'relation-limit'
  | 'mixed-cap';

export interface DiscoveryTaskSlice {
  readonly taskKey: string;
  readonly objective: string;
  readonly anchor: ContextAnchor;
  readonly routeKeys: readonly string[];
  readonly estimatedCostTokens: number;
  readonly costMeasurement?: ContextUsageMeasurement;
  readonly estimatedObjectCount: number;
  readonly estimatedRelationCount: number;
}

export interface DiscoveryTaskDecomposition {
  readonly parentTaskKey: string;
  readonly reason: DiscoveryDecompositionReason;
  readonly children: readonly DiscoveryTaskSlice[];
}

export type DiscoveryTaskChildExecutionStatus = 'completed' | 'failed' | 'skipped';
export type DiscoveryTaskExecutionStatus = 'completed' | 'partial' | 'failed';

export interface DiscoveryTaskExecutionRecord<TResult> {
  readonly task: DiscoveryTaskSlice;
  readonly status: DiscoveryTaskChildExecutionStatus;
  readonly result?: TResult;
  readonly error?: string;
}

export interface DiscoveryTaskExecutionResult<TResult> {
  readonly parentTaskKey: string;
  readonly status: DiscoveryTaskExecutionStatus;
  readonly children: readonly DiscoveryTaskExecutionRecord<TResult>[];
}

export interface DiscoveryTaskExecutionOptions {
  /** Continue independent child tasks after a child failure. Defaults to true. */
  readonly continueOnError?: boolean;
}

export interface RequiredFact {
  readonly factKey: string;
  readonly resolutionRouteKey: string;
  readonly requiredFor: readonly ContextStage[];
  readonly authority: AuthorityRequirement;
  readonly freshness?: FreshnessRequirement;
}

export interface ResolvedFact {
  readonly factKey: string;
  readonly resolutionRouteKey: string;
  readonly value: unknown;
  readonly authority: AuthorityLevel;
  readonly observedAt: string;
  readonly revision: string;
  readonly evidenceRefs: readonly string[];
}

export interface RouteSelection {
  readonly selectedRouteKeys: readonly string[];
  readonly frozenAt: string;
  readonly manifestDigest: string;
}

export interface OutputContract {
  readonly contractKey: string;
  readonly description: string;
  readonly requiredFields: readonly string[];
}

export interface WorkingContextCompileInput {
  readonly taskKey: string;
  readonly routeSelection: RouteSelection;
  readonly routes: readonly ContextRoute[];
  readonly requiredFacts: readonly RequiredFact[];
  readonly resolvedFacts: readonly ResolvedFact[];
  readonly allowedOperations: readonly string[];
  readonly outputContract: OutputContract;
  /** Resolved Fact payload usage measured or estimated by the composition root. */
  readonly workingUsageTokens?: number;
  /** Working reserve available to the compiled context. */
  readonly workingBudgetTokens?: number;
  readonly now?: string;
  readonly stopPolicy?: ContextStopPolicy;
}

export interface WorkingContext {
  readonly status: ClosureStatus;
  readonly taskKey: string;
  readonly routeSelection: RouteSelection;
  readonly facts: readonly ResolvedFact[];
  readonly allowedOperations: readonly string[];
  readonly outputContract: OutputContract;
  readonly diagnostics: readonly ClosureDiagnostic[];
  readonly stopDecision?: StopDecision;
}

export interface ManifestFactRef {
  readonly factKey: string;
  readonly revision: string;
  readonly evidenceRefs: readonly string[];
}

export interface ContextManifest {
  readonly version: 'v1';
  readonly taskKey: string;
  readonly snapshotRef: string;
  readonly selectedRouteKeys: readonly string[];
  readonly routeManifestDigest: string;
  readonly factRefs: readonly ManifestFactRef[];
  readonly allowedOperations: readonly string[];
  readonly outputContract: OutputContract;
  readonly canonicalJson: string;
  readonly digest: string;
}

export interface ContextManifestInput {
  readonly workingContext: WorkingContext;
  readonly snapshotRef: string;
}

export interface NextTask {
  readonly taskKey: string;
  readonly objective: string;
}

export interface TaskHandoffInput {
  readonly workingContext: WorkingContext;
  readonly manifest: ContextManifest;
  readonly sourceRevision: string;
  readonly resultRevision: string;
  readonly unresolvedQuestions: readonly string[];
  readonly nextTask?: NextTask;
}

/**
 * Input for a deterministic parent Handoff assembled from completed child
 * Tasks. The runtime only merges references; consumer-specific result
 * semantics remain outside this contract.
 */
export interface TaskHandoffAggregationInput {
  readonly decomposition: DiscoveryTaskDecomposition;
  readonly childHandoffs: readonly TaskHandoff[];
  readonly sourceRevision: string;
  readonly resultRevision: string;
  readonly unresolvedQuestions: readonly string[];
  readonly nextTask?: NextTask;
}

/** Options for executing child Tasks and assembling their parent Handoff. */
export interface TaskHandoffDecompositionExecutionOptions extends DiscoveryTaskExecutionOptions {
  readonly sourceRevision: string;
  readonly resultRevision: string;
  readonly unresolvedQuestions: readonly string[];
  readonly nextTask?: NextTask;
}

export interface TaskHandoff {
  readonly version: 'v1';
  readonly taskKey: string;
  readonly sourceRevision: string;
  readonly resultRevision: string;
  readonly manifestDigest: string;
  readonly factRefs: readonly ManifestFactRef[];
  readonly evidenceRefs: readonly string[];
  readonly unresolvedQuestions: readonly string[];
  /** Child Task keys are references only; child Fact values are never embedded. */
  readonly childTaskKeys?: readonly string[];
  readonly nextTask?: NextTask;
}

export interface TaskHandoffDecompositionExecutionResult {
  readonly execution: DiscoveryTaskExecutionResult<TaskHandoff>;
  /** Absent whenever one or more child Tasks did not complete. */
  readonly handoff?: TaskHandoff;
}

/**
 * Task Handoff persistence port.
 *
 * The runtime owns the typed handoff shape, but deliberately does not own
 * storage, transport, or process lifecycle. Adapters may persist multiple
 * result revisions for the same task; saving the exact same handoff again is
 * expected to be idempotent.
 */
export interface TaskHandoffStore {
  readonly save: (handoff: TaskHandoff) => Promise<void>;
  readonly findByTaskKey: (taskKey: string) => Promise<readonly TaskHandoff[]>;
}

export interface DefinitionGraphDiscoveryRequest {
  readonly taskKey: string;
  readonly anchor: ContextAnchor;
}

export interface DefinitionGraphRouteNode extends DiscoveryCandidate {
  readonly sourceRef: string;
}

export interface DefinitionGraphDiscoveryPort {
  readonly listRoutes: (
    input: DefinitionGraphDiscoveryRequest,
  ) => readonly DefinitionGraphRouteNode[];
}

export interface DefinitionGraphDiscoveryAdapter {
  readonly discover: (input: DefinitionGraphDiscoveryRequest) => readonly DiscoveryCandidate[];
}

export interface FederatedResolutionRecord {
  readonly factKey: string;
  readonly value: unknown;
  readonly authority: AuthorityLevel;
  readonly observedAt: string;
  readonly revision: string;
  readonly evidenceRefs: readonly string[];
}

export interface FederatedResolutionRequest {
  readonly taskKey: string;
  readonly snapshotRef: string;
  readonly route: ResolutionRoute;
  readonly requiredFactKeys: readonly string[];
}

export interface FederatedResolutionPort {
  readonly resolve: (input: FederatedResolutionRequest) => readonly FederatedResolutionRecord[];
}

export interface FederatedResolutionAdapter {
  readonly resolve: (input: FederatedResolutionRequest) => readonly ResolvedFact[];
}

export interface DecisionHintRequest {
  readonly taskKey: string;
  readonly anchor: ContextAnchor;
}

export interface DecisionHintRecord {
  readonly hintKey: string;
  readonly summary: string;
  readonly sourceRevision: string;
  readonly confidence?: number;
}

export interface ContextHint extends DecisionHintRecord {
  readonly provenance: 'decision-flow';
}

export interface DecisionHintPort {
  readonly listHints: (input: DecisionHintRequest) => readonly DecisionHintRecord[];
}

export interface DecisionHintAdapter {
  readonly getHints: (input: DecisionHintRequest) => readonly ContextHint[];
}

export interface ContextObservationInput {
  readonly taskKey: string;
  readonly stage: ContextStage;
  readonly status: string;
  readonly routeKeys: readonly string[];
  readonly factKeys: readonly string[];
  readonly manifestDigest?: string;
  readonly addressContext?: Readonly<Record<string, string>>;
  readonly usage?: ContextUsageSummary;
  readonly stopDecision?: StopDecision;
}

export interface ContextUsageEvent {
  readonly phase: ContextUsagePhase;
  readonly tokens: number;
  readonly measurement: ContextUsageMeasurement;
  readonly routeKey?: string;
  readonly sourceRef?: string;
  /** Provider/runtime-specific measured token breakdown, if available. */
  readonly inputTokens?: number;
  readonly outputTokens?: number;
  /** Optional representation-neutral transport/runtime measurements. */
  readonly bytes?: number;
  readonly latencyMs?: number;
  readonly provider?: string;
  /** Optional provider model identity for exact tokenizer accounting. */
  readonly model?: string;
  readonly tokenizerRevision?: string;
}

/** Phase and source identity supplied to provider-specific token serialization. */
export interface ContextTokenCountContext {
  readonly phase: ContextUsagePhase;
  readonly routeKey?: string;
  readonly factKey?: string;
}

export interface ProviderUsageSnapshot {
  readonly provider: string;
  readonly phase: ContextUsagePhase;
  readonly inputTokens?: number;
  readonly outputTokens?: number;
  readonly totalTokens?: number;
  readonly bytes?: number;
  readonly latencyMs?: number;
  readonly sourceRef?: string;
  readonly routeKey?: string;
}

export interface ContextUsageMetricSummary {
  readonly bytes?: number;
  readonly latencyMs?: number;
  readonly measurement: ContextUsageMeasurement | 'mixed';
}

export interface ContextUsageSummary {
  readonly events: readonly ContextUsageEvent[];
  readonly discoveryTokens: number;
  readonly workingTokens: number;
  readonly totalTokens: number;
  readonly measurement: ContextUsageMeasurement | 'mixed';
  readonly metrics?: ContextUsageMetricSummary;
}

export interface ContextTokenCounter {
  readonly measurement: ContextUsageMeasurement;
  /** Count a canonical value with the Discovery/Working serialization context. */
  readonly count: (value: unknown, context?: ContextTokenCountContext) => number;
}

export interface ContextUsageLedger {
  readonly record: (event: ContextUsageEvent) => void;
  readonly snapshot: () => ContextUsageSummary;
}

export interface ContextObservationRecord {
  readonly eventName: 'context_runtime_observation';
  readonly taskKey: string;
  readonly stage: ContextStage;
  readonly status: string;
  readonly routeKeys: readonly string[];
  readonly factCount: number;
  readonly manifestDigest?: string;
  readonly addressContext?: Readonly<Record<string, string>>;
  readonly usage?: ContextUsageSummary;
  readonly stopDecision?: StopDecision;
}

export interface WorkingClosureInput {
  readonly requiredFacts: readonly RequiredFact[];
  readonly resolutionRoutes: readonly ResolutionRoute[];
  readonly resolvedFacts: readonly ResolvedFact[];
  readonly now?: string;
}

export interface ClosureDiagnostic {
  readonly code:
    | 'missing-resolution-route'
    | 'missing-fact'
    | 'route-fact-mismatch'
    | 'route-not-selected'
    | 'insufficient-authority'
    | 'stale-fact'
    | 'invalid-fact-revision'
    | 'missing-evidence'
    | 'working-budget-exhausted'
    | 'stop-obligation-unresolved';
  readonly factKey: string;
  readonly message: string;
}

export interface WorkingClosureResult {
  readonly status: ClosureStatus;
  readonly diagnostics: readonly ClosureDiagnostic[];
  readonly resolvedFacts: readonly ResolvedFact[];
}

export interface ValidationIssue {
  readonly code: string;
  readonly path: string;
  readonly message: string;
}

export interface ValidationResult {
  readonly valid: boolean;
  readonly issues: readonly ValidationIssue[];
}

export type ContextRuntimeErrorCode =
  | 'invalid-context-budget'
  | 'invalid-context-route'
  | 'invalid-discovery-plan'
  | 'invalid-working-context'
  | 'invalid-context-manifest'
  | 'invalid-task-handoff'
  | 'invalid-context-adapter'
  | 'context-closure-incomplete';

export class ContextRuntimeError extends Error {
  readonly code: ContextRuntimeErrorCode;
  readonly issues: readonly ValidationIssue[];

  constructor(
    code: ContextRuntimeErrorCode,
    message: string,
    issues: readonly ValidationIssue[] = [],
  ) {
    super(message);
    this.name = 'ContextRuntimeError';
    this.code = code;
    this.issues = issues;
  }
}
