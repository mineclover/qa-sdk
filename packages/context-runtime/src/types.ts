export const DISCOVERY_HARD_CAP_TOKENS = 100_000 as const;
export const WORKING_RESERVE_MIN_TOKENS = 100_000 as const;
export const DEFAULT_TOTAL_WINDOW_TOKENS = 200_000 as const;

export type ContextStage = 'discovery' | 'working' | 'verification';
export type DiscoveryClosure = 'open' | 'planned' | 'discovery-capped' | 'frozen';
export type WorkingClosure = 'open' | 'closed' | 'blocked';
export type VerificationClosure = 'pending' | 'verified' | 'failed';
export type ClosureStatus = Exclude<WorkingClosure, 'open'>;
export type DiscoveryPlanStatus = 'planned' | 'discovery-capped';
export type DiscoveryNextAction = 'freeze' | 'decompose';
export type CyclePolicy = 'reject' | 'stop';
export type AuthorityLevel = 'projection_allowed' | 'verified' | 'authoritative';

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
  readonly estimatedSize: EstimatedRouteSize;
  readonly authority: AuthorityLevel;
  readonly freshness?: FreshnessRequirement;
  readonly sourceRef?: string;
}

export type DiscoverySkipReason = 'budget-exhausted' | 'route-expansion-limit';

export interface SkippedDiscoveryRoute {
  readonly routeKey: string;
  readonly reason: DiscoverySkipReason;
  readonly estimatedCostTokens: number;
}

export interface DiscoveryPlanInput {
  readonly intent: TaskIntent;
  readonly candidates: readonly DiscoveryCandidate[];
  readonly budget: ContextBudgetProfile;
  readonly usedTokens: number;
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
  readonly workingReserveTokens: number;
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
  readonly now?: string;
}

export interface WorkingContext {
  readonly status: ClosureStatus;
  readonly taskKey: string;
  readonly routeSelection: RouteSelection;
  readonly facts: readonly ResolvedFact[];
  readonly allowedOperations: readonly string[];
  readonly outputContract: OutputContract;
  readonly diagnostics: readonly ClosureDiagnostic[];
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

export interface TaskHandoff {
  readonly version: 'v1';
  readonly taskKey: string;
  readonly sourceRevision: string;
  readonly resultRevision: string;
  readonly manifestDigest: string;
  readonly factRefs: readonly ManifestFactRef[];
  readonly evidenceRefs: readonly string[];
  readonly unresolvedQuestions: readonly string[];
  readonly nextTask?: NextTask;
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
  readonly discover: (
    input: DefinitionGraphDiscoveryRequest,
  ) => readonly DiscoveryCandidate[];
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
  readonly resolve: (
    input: FederatedResolutionRequest,
  ) => readonly FederatedResolutionRecord[];
}

export interface FederatedResolutionAdapter {
  readonly resolve: (
    input: FederatedResolutionRequest,
  ) => readonly ResolvedFact[];
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
    | 'missing-evidence';
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
