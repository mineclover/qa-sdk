// ── Export Surface ───────────────────────────────────
export type { ExportSurface } from "./export-surface/export-surface.types.js";
export { ExportSurfaceRegistry } from "./export-surface/export-surface.registry.js";

// ── Schema (Layer 2) ────────────────────────────────
export type {
  SchemaCategory,
  SchemaValueType,
  SchemaAxis,
  SchemaDef,
  SchemaFragment,
  SchemaConstraint,
} from "./schema/schema.types.js";
export { SchemaRegistry } from "./schema/schema.registry.js";
export { CATEGORY_RULES, validatePrefixCategory, validateAllCategories } from "./schema/category-rules.js";
export type { CategoryRule, CategoryValidationResult } from "./schema/category-rules.js";
export { SchemaValidator } from "./schema/schema.validator.js";
export {
  registerPresets,
  DEFAULT_SCHEMAS,
  DEFAULT_FRAGMENTS,
  SCHEMA_EVENT_BASE,
  SCHEMA_ENTITY_BASE,
  SCHEMA_RELATION_BASE,
  SCHEMA_STATE_BASE,
  SCHEMA_POLICY_BASE,
  SCHEMA_OBSERVATION_BASE,
  FRAGMENT_HAS_ACTOR,
  FRAGMENT_HAS_TARGET,
  FRAGMENT_HAS_OUTCOME,
  FRAGMENT_IDENTIFIED,
} from "./schema/presets.js";
export type { ValidationResult } from "./schema/schema.validator.js";

// ── Spec Document ───────────────────────────────────
export type {
  SpecType,
  SpecId,
  SpecLifecycle,
  SpecRelation,
  SpecDocument,
} from "./spec/spec.types.js";
export { SpecDocumentRegistry } from "./spec/spec-document.registry.js";

// ── PrefixSpec ──────────────────────────────────────
export type { DimRef, PrefixSpec } from "./spec/prefix-spec.types.js";

// ── Loader ──────────────────────────────────────────
export { catalogToPrefixSpecs, prefixToPrefixSpec } from "./loader/catalog-bridge.js";
export type { CatalogInput, CatalogPrefix } from "./loader/catalog-bridge.js";
export { loadSpecs, parseSpecFile } from "./loader/spec-loader.js";
export { mergeCatalogs, extractServiceCatalog } from "./loader/catalog-merge.js";
export type { PartialCatalog, MergeResult, MergeConflict } from "./loader/catalog-merge.js";
export type { LoadResult, LoadError, ParseResult } from "./loader/spec-loader.js";

// ── Codegen IR ──────────────────────────────────────
export type { IRModule, IREnum, IREnumValue, IRStruct, IRField } from "./codegen/ir.js";
export { buildIR } from "./codegen/ir-builder.js";
export type { BuildIROptions } from "./codegen/ir-builder.js";

// ── Codegen TypeScript ──────────────────────────────
export {
  generateAxisType,
  generateExportInterface,
  generateTypescriptFile,
  generateFromIR,
} from "./codegen/ts-generator.js";
export type { AxisInput, GenerateOptions } from "./codegen/ts-generator.js";

// ── Codegen JavaScript ──────────────────────────────
export { generateJSFromIR, generateCJSFromIR } from "./codegen/js-generator.js";
export type { JSFormat } from "./codegen/js-generator.js";

// ── Codegen Protobuf ────────────────────────────────
export { generateProtoFromIR } from "./codegen/proto-generator.js";
export type { ProtoOptions } from "./codegen/proto-generator.js";

// ── Codegen JSON Schema ─────────────────────────────
export { generateJsonSchemaFromIR } from "./codegen/json-schema-generator.js";

// ── DKG (Design Knowledge Graph) ────────────────────
export type {
  DkgNode,
  DkgNodeKind,
  DkgEdge,
  DkgEdgeType,
  DslBundleNode,
  DslLifecycle,
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
} from "./dkg/dkg.types.js";

export { GraphRegistry } from "./dkg/graph-registry.js";
export { deriveFromCatalog } from "./dkg/catalog-derive.js";
export type { DeriveInput } from "./dkg/catalog-derive.js";
export { bootstrapDkg } from "./dkg/bootstrap.js";
export { generateDocSyncReport } from "./dkg/doc-sync.js";
export { checkDocMarkers, applyDocMarkers, checkAllDocs } from "./dkg/doc-sync-marker.js";
export type { DocSyncCheckResult } from "./dkg/doc-sync-marker.js";
export type { DocSyncReport } from "./dkg/doc-sync.js";
export { resolve } from "./dkg/resolve.js";
export {
  deriveRefEntries,
  validateRefEntries,
  recoverSemanticFromAddresses,
  findVersionForEntry,
  findRefAddress,
} from "./dkg/semantic-ref.js";
export type {
  SemanticRefEntry,
  SemanticRefEntries,
  DerivedRefEntries,
  RefValidationResult,
} from "./dkg/semantic-ref.js";
export { getAllSemanticRefs } from "./dkg/demo-semantic-refs.js";
export type { ResolveResult } from "./dkg/resolve.js";
export { defineFlow, serializeFlow, deserializeFlow } from "./dkg/flow-definition.js";
export { encodeRelationType, decodeRelationType, createRelationInstance, listRelationObjects } from "./dkg/relational-instance.js";
export type { RelationTypeAddress, RelationInstance } from "./dkg/relational-instance.js";
export type { FlowDefinition, FlowPoint, FlowDefinitionInput } from "./dkg/flow-definition.js";

export { defineDslBundle, DslBundleRegistry, analyzeDslCoverage, analyzeDslVersionSkew, analyzeAllVersionSkew } from "./dkg/dsl-bundle.js";
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
} from "./dkg/dsl-bundle.js";

export { analyzeImpact } from "./dkg/skills/analyze-impact.js";
export { inferMigrator } from "./dkg/skills/infer-migrator.js";
export type { DiffInfo } from "./dkg/skills/infer-migrator.js";
export { versionEventFromDiff } from "./dkg/skills/version-event-derive.js";
export type { DiffInput } from "./dkg/skills/version-event-derive.js";
export { scaffoldDecision } from "./dkg/skills/decision-scaffold.js";
export type { ScaffoldInput } from "./dkg/skills/decision-scaffold.js";
export { transitionPrefix, transitionDecision, resolveObservation, generateLifecycleReport } from "./dkg/skills/lifecycle-transition.js";
export type { TransitionResult, LifecycleReport } from "./dkg/skills/lifecycle-transition.js";
export { ServiceTopologyRegistry, createDemoTopology } from "./dkg/service-topology.js";
export type { ServiceOwnership, SharedContract, ServiceRegistration, TopologyReport, BreakingChange, ContractViolation, DrainPlan, ApprovalRequest, DependencyEdge, DependencyGraph, TimelineEvent } from "./dkg/service-topology.js";
export { buildDependencyGraph, buildTimeline } from "./dkg/service-topology.js";
export { analyzeTemporalTrends } from "./convergence/temporal-analysis.js";
export type { TimeWindow, TrendPoint, Anomaly, SlaViolation, SlaRule, TemporalReport } from "./convergence/temporal-analysis.js";
export { auditCoverage } from "./dkg/skills/coverage-audit.js";
export type { CoverageAuditResult } from "./dkg/skills/coverage-audit.js";
export { traceFlows } from "./dkg/skills/flow-trace.js";
export type { FlowViolation, FlowTraceResult } from "./dkg/skills/flow-trace.js";
export { checkConstraints, checkAllConstraints, auditAllConstraints } from "./dkg/skills/constraint-check.js";
export type { ConstraintCheckResult, ConstraintViolation as ConstraintViolationDetail, PassedConstraint } from "./dkg/skills/constraint-check.js";
export { safeEntryAdd } from "./dkg/skills/safe-entry-add.js";
export type { SafeEntryAddInput, SafeEntryAddResult } from "./dkg/skills/safe-entry-add.js";
export { checkDomainHealth, checkAllDomainsHealth } from "./dkg/skills/domain-health.js";
export type { DomainHealthResult, PrefixHealthSummary } from "./dkg/skills/domain-health.js";
export { entryAddChain, systemHealthChain } from "./dkg/skills/skill-chain.js";
export { convergeChain } from "./dkg/skills/converge-chain.js";
export type { ConvergeAction, ConvergeChainResult } from "./dkg/skills/converge-chain.js";
export type { ChainStepResult, SkillChainResult } from "./dkg/skills/skill-chain.js";

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
} from "./convergence/convergence.types.js";

export { compareAxes, comparePrefixes, scanAxisOverlaps } from "./convergence/symbol-comparator.js";
export { compareDecisions, scanDecisionConflicts } from "./convergence/decision-comparator.js";
export { discoverCausality } from "./convergence/causal-discovery.js";
export { analyzeSimplification } from "./convergence/simplification-advisor.js";
export { recommendFromSimplification, recommendFromObservation } from "./convergence/boundary-recommender.js";
export { analyzeHeadroom, applyHeadroomDecisions } from "./convergence/headroom-advisor.js";
export { aggregateUsageData, analyzeCollectionHealth } from "./convergence/usage-aggregator.js";
export { aggregateByDsl, aggregateByCategory, aggregateByService } from "./convergence/scoped-aggregator.js";
export type { ScopedUsage, BranchDistribution, ScopedReport } from "./convergence/scoped-aggregator.js";
export type { AddressContextRecord } from "./convergence/usage-aggregator.js";
export { optimalCapacity, optimizeCapacities, optimizeWithImpact } from "./convergence/capacity-optimizer.js";
export type { CapacityRecommendation, CapacityOptimizationReport } from "./convergence/capacity-optimizer.js";
export type { HeadroomIssue, HeadroomReport } from "./convergence/headroom-advisor.js";
export { recordSeparation, applySeparationRecord } from "./convergence/separation-record.js";
export type { SeparationRecord } from "./convergence/separation-record.js";
export { analyzeDeploymentSkew } from "./convergence/deployment-skew.js";
export { filterUsageByCategory, groupUsageByCategory, summarizeByCategory } from "./convergence/category-filter.js";
export type { DeploymentSkew } from "./convergence/deployment-skew.js";
export { analyzeEntryCoverage } from "./convergence/entry-coverage.js";
export type { EntryState, PrefixCoverage, DimCoverage, CoverageReport } from "./convergence/entry-coverage.js";

// ── Visualization ──────────────────────────────────
export { buildLayerMap, extractTracePaths, computeActivity } from "./visualization/layer-map.js";
export type { LayerLevel, PrefixPlacement, LayerDefinition, LayerMapResult, TraceStep, TracePath, PrefixActivity } from "./visualization/layer-map.js";
export { MonitorState } from "./visualization/monitor-queries.js";

// ── Store ───────────────────────────────────────────
export { DkgSqliteStore } from "./store/dkg-sqlite-store.js";

// ── Propagation ─────────────────────────────────────
export type { RegistryPort } from "./propagation/registry-port.js";
export { InMemoryRegistry } from "./propagation/registry-port.js";
export { RegistryHttpClient } from "./propagation/registry-http-client.js";
export { publishSpec } from "./propagation/publish.js";
export type { PublishInput, PublishResult } from "./propagation/publish.js";
export { seal, activateAndPropagate } from "./propagation/lifecycle.js";
export type { SealInput, ActivateInput, ActivateResult } from "./propagation/lifecycle.js";
export type { VersionNotification } from "./propagation/types.js";

// ── Shared ──────────────────────────────────────────
export { ok, err } from "./shared/result.js";
export type { Result } from "./shared/result.js";
export {
  SpecError,
  DuplicateRegistrationError,
  NotFoundError,
  ValidationError,
} from "./shared/errors.js";
export type { ValidationErrorDetail } from "./shared/errors.js";
