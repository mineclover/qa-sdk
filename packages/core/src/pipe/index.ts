// ── Pipe Types ────────────────────────────────────────
export type {
  PipePort, PortRef, PipeSpec, PipeGraph, PipeConnection, ConnectionKind,
  PipeFlow, PipeStep, PipeSequence, PipeBranch, PipeOptional,
  PipeParallel, PipeRace, PipeAwait, PipeRetry, PipeFallback,
  PipeLoop, PipeCompensate, PipeTransitionScope, PipeEmit, PipeFinally, PipeTimeout, PipeFeedback,
  PipeMap, PipeReduce, PipeBuffer, PipeFilter,
  PipeCircuitBreaker, PipeThrottle, PipeDebounce,
  PipeSplit, PipeEnrich, PipeTap, PipeResequence, PipeWindow,
  PipeDedup, PipeCorrelation, Constraint,
  StepDataContract, LineageHint,
} from "../types/pipe-spec.js";

// ── Path ──────────────────────────────────────────────
export { countPipePaths, countGraphPaths } from "./pipe-path.js";

// ── Validate ──────────────────────────────────────────
export { validatePipeSpec, validatePipeGraph } from "./pipe-validate.js";
export type { ValidationIssue } from "./pipe-validate.js";

// ── Port Resolution ───────────────────────────────────
export { inferPortsFromDataContract, resolvePorts } from "./pipe-port.js";

// ── Serialize ─────────────────────────────────────────
export { serializePipeSpec, deserializePipeSpec, serializePipeGraph, deserializePipeGraph } from "./pipe-serialize.js";

// ── Store (포트 + 인메모리) ───────────────────────────
export type { PipeGraphStore, PipeSpecStore } from "./pipe-store.js";
export { MemoryPipeGraphStore, MemoryPipeSpecStore } from "./pipe-store.js";

// ── Analyze ───────────────────────────────────────────
export { analyzePipeComplexity, findBottlenecks, analyzeCoverage, getChildFlows, collectGraphEvents } from "./pipe-analyze.js";
export type { PipeComplexity, BottleneckReport, CoverageReport, GraphEvent } from "./pipe-analyze.js";

// ── Fold ──────────────────────────────────────────────
export { computeFoldedContract, foldSubgraph, unfoldNode, restoreLineageFromFold, validateFoldCheckpoint, detectFoldRegions } from "./pipe-fold.js";
export type { FoldLevel, FoldDataRef, FoldedContract, FoldedGraph, FoldRegion, FoldCheckpointResult } from "./pipe-fold.js";
export { normalize as normalizeEndpoint, collectFlowSteps } from "./pipe-fold.js";

// ── Interpret ─────────────────────────────────────────
export { extractPipeConcerns, propagatePipeConcerns, analyzePipeImpact, classifyPipeRole, PIPE_PROPAGATION_RULES } from "./pipe-interpret.js";
export type { PipeConcern, InheritedPipeConcern, PipeConcernEntry, PipeConcernMap, ImpactedPipe, PipeImpactAnalysis, PipeRole } from "./pipe-interpret.js";

// ── Zoom ──────────────────────────────────────────────
export { computeZoomLevels, computeZoomView, computeLayout } from "./pipe-zoom.js";
export type { ZoomNodeStyle, ZoomNode, ZoomEdge, ZoomSummary, ZoomView, ZoomLevelMap } from "./pipe-zoom.js";

// ── Gate ──────────────────────────────────────────────
export { evaluateGate, evaluateGates, allGatesPass, hasReviewItems } from "./pipe-gate.js";
export type { GateLevel, GateVerdict, GateCriterion, PipeGateSpec, CriterionResult, GateResult, SubGateIssue } from "./pipe-gate.js";

// ── Simulate ──────────────────────────────────────────
export { simulate, matchHappyPath } from "./pipe-simulate.js";
export type { SimulationConfig, SimulationResult, SimStep, SimEvent, SimContext, HappyPathSpec, HappyPathMatch } from "./pipe-simulate.js";

// ── Runtime ───────────────────────────────────────────
export type {
  ConditionExpr, FieldCondition, LogicalCondition, ExistsCondition, EventCondition,
  StepResult, StepError, ICancellationToken, IPipeContext,
  StepExecutor, ExecutedStep, RunResult,
} from "../types/pipe-runtime.js";
export { parseCondition, evaluateCondition, CancellationToken, PipeContext, ExecutorRegistry, PipeRunner } from "./pipe-runtime.js";

// ── Bridge ────────────────────────────────────────────
export { extractLineageFromSimulation, validateStepContracts, validateSimulationLineage, constraintResultToEvent } from "./pipe-bridge.js";
export type { StepCompatIssue, SimulationLineageValidation, ConstraintEvent } from "./pipe-bridge.js";

// ── Static Lineage (정적 계보 추적) ──────────────────
export {
  deriveStaticLineage, deriveStaticLineageWithDiagnostics,
  summarizeFlowLineage, validateStaticLineage, findFieldOrigin,
  deriveGraphLineage, summarizeGraphLineage, findFieldOriginInGraph,
  lineageId, serializeLineage, deserializeLineage, diffLineage,
} from "./pipe-lineage.js";
export type { FlowLineageSummary, StaticLineageValidation, GraphLineageSummary, LineageDiff, LineageWarning, StaticLineageResult } from "./pipe-lineage.js";

// ── PathMatcher ───────────────────────────────────────
export type { MatchResult as PipeMatchResult } from "./path-matcher.js";
export { matchPath } from "./path-matcher.js";

// ── Verdict v2 ────────────────────────────────────────
export { computeVerdictV2 } from "./verdict-v2.js";
export type { VerdictV2, FacetCoverage, VerdictReportV2 } from "./verdict-v2.js";

// ── Data Contract ─────────────────────────────────────
export type {
  DataSchema, DataColumn, FacetRole, ColumnConstraint, ColumnRef as DataColumnRef,
  DataRelation, CascadeRule,
  FieldLineage, FieldRef, TransformKind,
  SchemaVersion, SchemaChange, SchemaChangeType, SchemaCompatibility,
  FieldSet, FieldSpec, CompatibilityResult,
} from "../types/data-schema.js";
export {
  checkCompatibility, computeSchemaHash,
  collectSchemaChanges, determineCompatibility, createSchemaVersion,
  LineageCollector, VersionCollector,
} from "./data-contract.js";

// ── Constraint Engine ─────────────────────────────────
export type {
  ConstraintDef as PipeConstraintDef, ConstraintSubject, SubjectKind,
  ConstraintPredicate, PredicateOp,
  ConstraintContext, ContextWhen,
  ConstraintEvidence, EvidenceMethod,
  ConstraintResult as PipeConstraintResult, FailureTrace,
} from "../types/constraint.js";
export { ConstraintRegistry, evaluatePredicate, executeConstraint } from "./constraint-engine.js";

// ── Segment Detection ─────────────────────────────────
export { detectPathSegments } from "./pipe-segment.js";
export type { DetectedSegments, SegmentReason } from "./pipe-segment.js";

// 시각화 (Mermaid, SVG primitives, shapes, SVG/D3) → viz-core로 이동 완료

// ── Definition Bridge ─────────────────────────────────
export { resolveLifecycles, analyzeLayerPropagation, resolveTags, resolveBindings } from "./pipe-definition-bridge.js";
export type {
  DefLifecycle as PipeDefLifecycle, DefLayer as PipeDefLayer,
  DefinitionMeta, DefinitionLookup,
  PipeLifecycleInfo, LayerPropagation, PipeTagInfo, PipeBindingInfo,
} from "./pipe-definition-bridge.js";

// ── Test Tracking ─────────────────────────────────────
export type {
  TestPhase,
  TestCase, TestTarget, TestExpectation, TestSuite, TestResult,
  FacetQualityMetrics, PhaseQualityMetrics, PipeQualityMetrics,
} from "../types/test-tracking.js";
export { TEST_PHASES } from "../types/test-tracking.js";
export { buildTestAddress, parseTestAddress, TestRegistry } from "./test-tracking.js";

// ── Sim → Phase Bridge ──────────────────────────────
export type { PhaseAnnotatedStep, SimPhaseResult } from "./sim-phase-bridge.js";
export { annotateSimPhases, FACET_PHASE_DEFAULTS } from "./sim-phase-bridge.js";
