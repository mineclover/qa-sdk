/**
 * dkg — Design Knowledge Graph sub-path barrel.
 *
 * DKG 타입, 그래프, 부트스트랩, 시맨틱, DSL, 스킬 전체를 하나의 진입점으로 제공.
 */

// ── Types + Graph ──────────────────────────────────
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
  FlowSchemaNode,
  FlowSchemaGateSummary,
  FlowSchemaGatePhase,
  FlowSchemaGateWeight,
  TransitionSpecNode,
  TableNode,
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
} from "./dkg.types.js";

export { GraphRegistry } from "./graph-registry.js";
export { deriveFlowSchemaEdges, attachFlowSchemaEdges } from "./flow-schema-relations.js";
export type { FlowSchemaRelationInput, GraphEdgeWriter } from "./flow-schema-relations.js";

// ── Derivation + Bootstrap ─────────────────────────
export { deriveFromCatalog } from "./catalog-derive.js";
export type { DeriveInput } from "./catalog-derive.js";
export { bootstrapDkg } from "./bootstrap.js";

// ── Doc Sync ───────────────────────────────────────
export { generateDocSyncReport } from "./doc-sync.js";
export { checkDocMarkers, applyDocMarkers, checkAllDocs } from "./doc-sync-marker.js";
export type { DocSyncCheckResult } from "./doc-sync-marker.js";
export type { DocSyncReport } from "./doc-sync.js";

// ── Semantic ───────────────────────────────────────
export { resolve } from "./resolve.js";
export {
  deriveRefEntries,
  validateRefEntries,
  recoverSemanticFromAddresses,
  findVersionForEntry,
  findRefAddress,
} from "./semantic-ref.js";
export type {
  SemanticRefEntry,
  SemanticRefEntries,
  DerivedRefEntries,
  RefValidationResult,
} from "./semantic-ref.js";
export { getAllSemanticRefs } from "./demo-semantic-refs.js";
export type { ResolveResult } from "./resolve.js";
export { defineFlow, serializeFlow, deserializeFlow } from "./flow-definition.js";
export { encodeRelationType, decodeRelationType, createRelationInstance, listRelationObjects } from "./relational-instance.js";
export type { RelationTypeAddress, RelationInstance } from "./relational-instance.js";
export type { FlowDefinition, FlowPoint, FlowDefinitionInput } from "./flow-definition.js";

// ── DSL Bundle ─────────────────────────────────────
export { defineDslBundle, DslBundleRegistry, analyzeDslCoverage, analyzeDslVersionSkew, analyzeAllVersionSkew } from "./dsl-bundle.js";
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
} from "./dsl-bundle.js";

// ── Decision Scaffold ──────────────────────────────
export { scaffoldDecision } from "./decision-scaffold.js";
export type { ScaffoldInput } from "./decision-scaffold.js";

// ── Skills ─────────────────────────────────────────
export { analyzeImpact } from "./skills/analyze-impact.js";
export { inferMigrator } from "./skills/infer-migrator.js";
export type { DiffInfo } from "./skills/infer-migrator.js";
export { versionEventFromDiff } from "./skills/version-event-derive.js";
export type { DiffInput } from "./skills/version-event-derive.js";
export { transitionPrefix, transitionDecision, resolveObservation, generateLifecycleReport } from "./skills/lifecycle-transition.js";
export type { TransitionResult, LifecycleReport } from "./skills/lifecycle-transition.js";
export { ServiceTopologyRegistry, createDemoTopology } from "./service-topology.js";
export type { ServiceOwnership, SharedContract, ServiceRegistration, TopologyReport, BreakingChange, ContractViolation, DrainPlan, ApprovalRequest, DependencyEdge, DependencyGraph, TimelineEvent } from "./service-topology.js";
export { buildDependencyGraph, buildTimeline } from "./service-topology.js";
export { auditCoverage } from "./skills/coverage-audit.js";
export type { CoverageAuditResult } from "./skills/coverage-audit.js";
export { traceFlows, validateDslInvariants } from "./skills/flow-trace.js";
export type { FlowViolation, FlowTraceResult, DslInvariantViolation, DslInvariantResult } from "./skills/flow-trace.js";
export { checkConstraints, checkAllConstraints, auditAllConstraints } from "./skills/constraint-check.js";
export type { ConstraintCheckResult, PassedConstraint } from "./skills/constraint-check.js";
export { safeEntryAdd } from "./skills/safe-entry-add.js";
export type { SafeEntryAddInput, SafeEntryAddResult } from "./skills/safe-entry-add.js";
export { checkDomainHealth, checkAllDomainsHealth } from "./skills/domain-health.js";
export type { DomainHealthResult, PrefixHealthSummary } from "./skills/domain-health.js";
export { entryAddChain, systemHealthChain } from "./skills/skill-chain.js";
export { convergeChain } from "./skills/converge-chain.js";
export type { ConvergeAction, ConvergeChainResult } from "./skills/converge-chain.js";
export type { ChainStepResult, SkillChainResult } from "./skills/skill-chain.js";
export { exploreService, explorePrefix, exploreDsl, systemOverview } from "./skills/service-explorer.js";
export { traceNode } from "./skills/trace.js";
export type { TraceResult, CompositionEntry, CausalLink, DirectDecision } from "./skills/trace.js";
export { recordDecision, recordObservation } from "./skills/record-operation.js";
export type { RecordDecisionInput, RecordDecisionResult, RecordObservationInput, RecordObservationResult } from "./skills/record-operation.js";
export { prepareClaim, prepareRelease, analyzeClaimImpact, claimKey } from "./skills/claim-operation.js";
export type { ClaimData, ClaimImpact, ClaimResult, ReleaseResult } from "./skills/claim-operation.js";
export type {
  ServiceProfile, OwnedPrefixInfo, ConsumedPrefixInfo, ServiceDependency,
  PrefixProfile, PrefixDimInfo, AxisHeadroom,
  DslProfile, DslMemberInfo,
  SystemOverview, ServiceSummary, HotSpot, DependencyGraphSummary, DomainHealthSummary,
} from "./skills/service-explorer.js";
