/**
 * analysis — DKG + convergence 통합 sub-path.
 *
 * dkg ↔ convergence 양방향 런타임 의존이 있으므로 하나의 sub-path로 합침.
 */

// ── DKG (Design Knowledge Graph) ────────────────────

// ── DKG: Types + Graph ──────────────────────────────
export type {
  DkgNode,
  DkgNodeKind,
  DkgEdge,
  DkgEdgeType,
  DslBundleNode,
  DslLifecycle,
  SkillNode,
  SkillCategory,
  SkillSpecialization,
  AxisNode,
  PrefixNode,
  PrefixLifecycle,
  SpecNode,
  SchemaNode,
  DecisionNode,
  VersionEventNode,
  VersionChange,
  ConstraintNode,
  ObservationNode,
  ObservationIntent,
  ObservationSuggestion,
  DomainNode,
  ConsumerNode,
  IntentLinkNode,
  ImpactAnalysisInput,
  ImpactAnalysisResult,
  InferredMigrator,
  MigratorPattern,
  DecisionType,
  DecisionScaffoldParams,
  CapacityParams,
  NewAxisParams,
  NewPrefixParams,
  DimAddParams,
  MergeParams,
  DeprecateParams,
} from "../dkg/dkg.types.js";

export { GraphRegistry } from "../dkg/graph-registry.js";

// ── DKG: Derivation + Bootstrap ─────────────────────
export { deriveFromCatalog } from "../dkg/catalog-derive.js";
export type { DeriveInput } from "../dkg/catalog-derive.js";
export { bootstrapDkg } from "../dkg/bootstrap.js";
// ── DKG: Doc Sync ───────────────────────────────────
export { generateDocSyncReport } from "../dkg/doc-sync.js";
export { checkDocMarkers, applyDocMarkers, checkAllDocs } from "../dkg/doc-sync-marker.js";
export type { DocSyncCheckResult } from "../dkg/doc-sync-marker.js";
export type { DocSyncReport } from "../dkg/doc-sync.js";
// ── DKG: Semantic ───────────────────────────────────
export { resolve } from "../dkg/resolve.js";
export {
  deriveRefEntries,
  validateRefEntries,
  recoverSemanticFromAddresses,
  findVersionForEntry,
  findRefAddress,
} from "../dkg/semantic-ref.js";
export type {
  SemanticRefEntry,
  SemanticRefEntries,
  DerivedRefEntries,
  RefValidationResult,
} from "../dkg/semantic-ref.js";
export { getAllSemanticRefs } from "../dkg/demo-semantic-refs.js";
export type { ResolveResult } from "../dkg/resolve.js";
export { defineFlow, serializeFlow, deserializeFlow } from "../dkg/flow-definition.js";
export { encodeRelationType, decodeRelationType, createRelationInstance, listRelationObjects } from "../dkg/relational-instance.js";
export type { RelationTypeAddress, RelationInstance } from "../dkg/relational-instance.js";
export type { FlowDefinition, FlowPoint, FlowDefinitionInput } from "../dkg/flow-definition.js";

// ── DKG: DSL Bundle ─────────────────────────────────
export { defineDslBundle, DslBundleRegistry, analyzeDslCoverage, analyzeDslVersionSkew, analyzeAllVersionSkew } from "../dkg/dsl-bundle.js";
export type {
  DslBundle,
  DslBundleInput,
  DslMember,
  DslMemberInput,
  DslMemberRole,
  ServiceBinding,
  DslCoverageReport,
  DslVersionSkewReport,
  MemberVersionInfo,
  AxisVersionConflict,
  ExecutionContext,
  ExecutionMode as DslExecutionMode,
} from "../dkg/dsl-bundle.js";

// ── DKG: Skills ─────────────────────────────────────
export { analyzeImpact } from "../dkg/skills/analyze-impact.js";
export { inferMigrator } from "../dkg/skills/infer-migrator.js";
export type { DiffInfo } from "../dkg/skills/infer-migrator.js";
export { versionEventFromDiff } from "../dkg/skills/version-event-derive.js";
export type { DiffInput } from "../dkg/skills/version-event-derive.js";
export { scaffoldDecision } from "../dkg/skills/decision-scaffold.js";
export type { ScaffoldInput } from "../dkg/skills/decision-scaffold.js";
export { transitionPrefix, transitionDecision, resolveObservation, generateLifecycleReport } from "../dkg/skills/lifecycle-transition.js";
export type { TransitionResult, LifecycleReport } from "../dkg/skills/lifecycle-transition.js";
export { ServiceTopologyRegistry, createDemoTopology } from "../dkg/service-topology.js";
export type { ServiceOwnership, SharedContract, ServiceRegistration, TopologyReport, BreakingChange, ContractViolation, DrainPlan, ApprovalRequest, DependencyEdge, DependencyGraph, TimelineEvent } from "../dkg/service-topology.js";
export { buildDependencyGraph, buildTimeline } from "../dkg/service-topology.js";
export { auditCoverage } from "../dkg/skills/coverage-audit.js";
export type { CoverageAuditResult } from "../dkg/skills/coverage-audit.js";
export { traceFlows } from "../dkg/skills/flow-trace.js";
export type { FlowViolation, FlowTraceResult } from "../dkg/skills/flow-trace.js";
export { checkConstraints, checkAllConstraints, auditAllConstraints } from "../dkg/skills/constraint-check.js";
export type { ConstraintCheckResult, ConstraintViolation as ConstraintViolationDetail, PassedConstraint } from "../dkg/skills/constraint-check.js";
export { safeEntryAdd } from "../dkg/skills/safe-entry-add.js";
export type { SafeEntryAddInput, SafeEntryAddResult } from "../dkg/skills/safe-entry-add.js";
export { checkDomainHealth, checkAllDomainsHealth } from "../dkg/skills/domain-health.js";
export type { DomainHealthResult, PrefixHealthSummary } from "../dkg/skills/domain-health.js";
export { entryAddChain, systemHealthChain } from "../dkg/skills/skill-chain.js";
export { convergeChain } from "../dkg/skills/converge-chain.js";
export type { ConvergeAction, ConvergeChainResult } from "../dkg/skills/converge-chain.js";
export type { ChainStepResult, SkillChainResult } from "../dkg/skills/skill-chain.js";
export { exploreService, explorePrefix, exploreDsl, systemOverview } from "../dkg/skills/service-explorer.js";
export { traceNode } from "../dkg/skills/trace.js";
export type { TraceResult, CompositionEntry, CausalLink, DirectDecision } from "../dkg/skills/trace.js";
export { recordDecision, recordObservation } from "../dkg/skills/record-operation.js";
export type { RecordDecisionInput, RecordDecisionResult, RecordObservationInput, RecordObservationResult } from "../dkg/skills/record-operation.js";
export { prepareClaim, prepareRelease, analyzeClaimImpact, claimKey } from "../dkg/skills/claim-operation.js";
export type { ClaimData, ClaimImpact, ClaimResult, ReleaseResult } from "../dkg/skills/claim-operation.js";
export type {
  ServiceProfile, OwnedPrefixInfo, ConsumedPrefixInfo, ServiceDependency,
  PrefixProfile, PrefixDimInfo, AxisHeadroom,
  DslProfile, DslMemberInfo,
  SystemOverview, ServiceSummary, HotSpot, DependencyGraphSummary, DomainHealthSummary,
} from "../dkg/skills/service-explorer.js";

// ── Convergence ─────────────────────────────────────
export type {
  EntryUsage,
  AddressUsage,
  CoOccurrence,
  UsageData,
  AxisOverlap,
  PrefixOverlap,
  DecisionConflict,
  CausalCandidate,
  SimplificationCandidate,
  SimplificationSuggestion,
  BoundaryRecommendation,
  CollectionHealthReport,
  OrphanAddress,
  StaleVersionUsage,
} from "../convergence/convergence.types.js";

// ── Convergence: 집계 (Aggregation) ──────────────────
export { aggregateUsageData, analyzeCollectionHealth } from "../convergence/usage-aggregator.js";
export { aggregateByDsl, aggregateByCategory, aggregateByService } from "../convergence/scoped-aggregator.js";
export type { ScopedUsage, BranchDistribution, ScopedReport } from "../convergence/scoped-aggregator.js";
export type { AddressContextRecord } from "../convergence/usage-aggregator.js";

// ── Convergence: 측정 (Measurement) ─────────────────
export { analyzeDeploymentSkew } from "../convergence/deployment-skew.js";
export type { DeploymentSkew } from "../convergence/deployment-skew.js";
export { analyzeEntryCoverage } from "../convergence/entry-coverage.js";
export type { EntryState, PrefixCoverage, DimCoverage, CoverageReport } from "../convergence/entry-coverage.js";
export { analyzeTemporalTrends } from "../convergence/temporal-analysis.js";
export type { TimeWindow, TrendPoint, Anomaly, SlaViolation, SlaRule, TemporalReport } from "../convergence/temporal-analysis.js";

// ── Convergence: 비교 (Comparison) ──────────────────
export { compareAxes, comparePrefixes, scanAxisOverlaps } from "../convergence/symbol-comparator.js";
export { compareDecisions, scanDecisionConflicts } from "../convergence/decision-comparator.js";
export { discoverCausality } from "../convergence/causal-discovery.js";

// ── Convergence: 추천 (Recommendation) ──────────────
export { analyzeSimplification } from "../convergence/simplification-advisor.js";
export { recommendFromSimplification, recommendFromObservation } from "../convergence/boundary-recommender.js";
export { analyzeHeadroom, applyHeadroomDecisions } from "../convergence/headroom-advisor.js";
export type { HeadroomIssue, HeadroomReport } from "../convergence/headroom-advisor.js";
export { optimalCapacity, optimizeCapacities, optimizeWithImpact } from "../convergence/capacity-optimizer.js";
export type { CapacityRecommendation, CapacityOptimizationReport } from "../convergence/capacity-optimizer.js";

// ── Convergence: 기록 (Recording) ───────────────────
export { recordSeparation, applySeparationRecord } from "../convergence/separation-record.js";
export type { SeparationRecord } from "../convergence/separation-record.js";

// ── Convergence: 필터 (Filtering) ───────────────────
export { filterUsageByCategory, groupUsageByCategory, summarizeByCategory } from "../convergence/category-filter.js";

// ── Convergence: Metric 체계 ────────────────────────
export type {
  MetricStatus,
  MetricValue,
  MetricThreshold,
  MetricDef,
  IngestFlowInput,
  RegistryFlowInput,
  GateFlowInput,
  DataFlowInput,
} from "../convergence/metric.types.js";
export { METRIC_DEFS, collectMetrics, metricsToObservations } from "../convergence/metric-registry.js";
