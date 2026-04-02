/**
 * @qa-sdk/core — 기반 인프라 + Pipe Engine + 표준 호환
 *
 * 3개 패싯:
 *   Foundation  — catalog, types, schemas, lib, ports
 *   Pipe        — pipe engine, data contract, constraint, test tracking, verdict
 *   Standards   — CloudEvents, AsyncAPI
 */

// ═══════════════════════════════════════════════════════
// Foundation — 카탈로그, 타입, 스키마, 유틸, 포트
// ═══════════════════════════════════════════════════════

// ── Catalog ─────────────────────────────────────────────

export type {
  VisualShape, DetailKind, PrefixCategory, LayerLevel, PrefixMeta,
  AxisVersionSnapshot, VersionedAxis, DimRef, PrefixVersionDef, PrefixDef,
  ColumnRef, TableSchema, Catalog, PrefixIds, AxisIds,
  CatalogProvider, CatalogInfo,
  DomainDef, ConsumerDef, ConstraintDef, DslBundleDef,
  IntentLinkDef, SkillDef, SpecDef,
  FlowGatePhase, FlowGateWeight, FlowBranchDef, FlowGateDependencyDef, FlowGateDef, FlowOutcomeDef, FlowSchemaDef, FlowSchemaRefDef,
  ReviewPairDef, DkgConfig,
  BrowserDimDef, BrowserPrefixDef, BrowserCatalog,
  PrefixStructure, PrefixShape, PrefixEntries, DimCapacityInfo, PrefixDimProfile,
  DecodedPosition, ResolvedDimValue, ResolvedAddress, DecomposedDim,
} from "./catalog/index.js";

export { StaticCatalogProvider } from "./catalog/static-provider.js";
export { CatalogRegistry } from "./catalog/catalog-registry.js";
export { deriveMeta } from "./catalog/derive-meta.js";
export { flattenForBrowser } from "./catalog/browser-flatten.js";
export { collectAxisUsage, summarizeAxisUsage, findUnusedAxes } from "./catalog/axis-usage.js";

export {
  latestPrefixVersion,
  getPrefixStructure, getPrefixShape, getPrefixEntries, getPrefixProfile,
  encodePrefix, decodePrefix, encodePrefixByValue,
  resolveAddress, decomposeAddress, verifyRoundTrip,
  decodePrefixAsResult, resolveAddressAsResult, decomposeAddressAsResult,
} from "./catalog/runtime.js";

export type { DecodeResult, DecodedDim } from "./catalog/decode-result.js";
export { entitiesToDecodeResult, decodeResultToEntities, decodeResultToDeep } from "./catalog/decode-result.js";

// ── Types ───────────────────────────────────────────────

export type { OwnerType, TransmissionOwner, TransmissionSource, TransmissionRuntime, BuildEnv, TransmissionBuild, TransmissionEnvelope } from "./types/envelope.js";
export type { ServiceIdentity, DeployContext, ServiceBootConfig } from "./types/service-identity.js";
export { toServiceDims, toTransmissionSource, toTransmissionBuild, catalogEnvToBuildEnv, buildEnvToCatalogEnv, createServiceBootConfig } from "./types/service-identity.js";
export type { PayloadFormat, PayloadEncoding, MaskingMode, MaskedFieldMarker, PayloadDescriptor } from "./types/payload.js";
export type { ActorContext } from "./types/actor.js";
export type { Brand, DocumentAddress, PrefixAddress } from "./types/branded.js";
export { documentAddress, prefixAddress } from "./types/branded.js";
export type { IdentificationMode, BehaviorPattern, PatternConfidence, PatternRule, PatternMatchCondition, PatternClassification, PatternAnomaly, AnomalyKind, PatternStats, PatternHealthReport } from "./types/event-pattern.js";
export type { RecordKind, MetricType, SpanStatusCode, EventRecord } from "./types/record.js";
export type { QaSession } from "./types/session.js";
export type { ScenarioSpec, EntryCondition, StepKind, ScenarioStep, StepConstraint, BranchDef } from "./types/scenario.js";
export type { SpecGraph, SpecNode, SpecEdgeType, SpecEdge, RuntimeGraph, RuntimeNode, RuntimeEdgeType, RuntimeEdge } from "./types/graph.js";
export type { Verdict, ConstraintResult, StepMatch, MatchResult, VerdictReport, LatencyViolation, OrderingViolation } from "./types/verdict.js";
export type { PathObservation, ReachedNode, TraversedEdge, TerminalReason } from "./types/path-observation.js";
export type { ServiceStatus, ServiceEntry, EventRecordKind, EventStatus, EventCategory, EventLifecycleStage, EventEntry } from "./types/registry.js";
export type { ColumnAxisMapping, DataObjectBinding, BindingValidation, LineageChainValidation, BoundDataObject } from "./data-object/index.js";
export { BindingRegistry, validateBindings, validateLineageChain } from "./data-object/index.js";

// ── Schemas ─────────────────────────────────────────────

export { ownerTypeSchema, transmissionOwnerSchema, transmissionSourceSchema, transmissionRuntimeSchema, buildEnvSchema, transmissionBuildSchema, transmissionEnvelopeSchema } from "./schema/envelope.schema.js";
export { recordKindSchema, metricTypeSchema, spanStatusCodeSchema, payloadFormatSchema, payloadEncodingSchema, eventRecordSchema } from "./schema/record.schema.js";
export { constraintOpSchema, stepConstraintSchema, entryConditionSchema, branchDefSchema, stepKindSchema, scenarioStepSchema, scenarioSpecSchema } from "./schema/scenario.schema.js";

// ── Lib ─────────────────────────────────────────────────

export { newTransmissionId, newLogId, newTraceId, newSpanId, newQaSessionId, newVerdictId, newDlqId } from "./lib/id.js";
export { now, normalizeTimestamp, compareTimestamps } from "./lib/clock.js";
export { parseSerializedAddress, serializeAddress } from "./lib/address-parser.js";
export type { ParsedAddress } from "./lib/address-parser.js";
export { SERVICE_PORTS, getServicePort, getServiceDevUrl, detectPortConflicts, warnPortConflict } from "./lib/service-ports.js";
export type { ServicePortEntry } from "./lib/service-ports.js";
export { identifyActorMode } from "./lib/identify-actor.js";
export type { IdentifyActorInput } from "./lib/identify-actor.js";
export { createLogger } from "./lib/create-logger.js";
export type { Logger, CreateLoggerOptions, LoggerDestination } from "./lib/create-logger.js";
export { AppError, ServiceClientError } from "./lib/app-error.js";
export { parseJsonColumn, parseJsonArray, parseJsonObject } from "./lib/typed-json.js";
export { emptyStringToUndefined, optionalUrl, booleanWithDefaultFalse } from "./lib/env-helpers.js";
export { installSimpleShutdown } from "./lib/graceful-shutdown.js";
export type { SimpleShutdownDeps } from "./lib/graceful-shutdown.js";

// ── Ports ───────────────────────────────────────────────

export type { RecordStore, RecordInsert, RecordPaginationCursor, RecordPaginationParams, StoredRecord, StoredRecordPage } from "./ports/record-store.port.js";
export type { TraceStore, TraceUpsert, StoredTrace } from "./ports/trace-store.port.js";
export type { GraphStore } from "./ports/graph-store.port.js";
export type { VerdictStore, VerdictInsert, StoredVerdict } from "./ports/verdict-store.port.js";
export type { DlqStore, DlqInsert, DlqPhase, StoredDlqItem } from "./ports/dlq-store.port.js";
export type { TaskQueue, TaskPayload, TaskPhase, TaskQueueOptions, TaskHandler } from "./ports/task-queue.port.js";
export type { SessionStore, SessionUpsert, StoredSession } from "./ports/session-store.port.js";
export type { TransmissionStore, TransmissionInsert } from "./ports/transmission-store.port.js";
export type { ScenarioSpecStore } from "./ports/scenario-spec-store.port.js";
export type { MetricRollupStore, MetricRollupInsert, StoredMetricRollup, MetricRollupQuery, MetricWindowType } from "./ports/metric-rollup-store.port.js";

// ═══════════════════════════════════════════════════════
// Pipe Engine — 파이프 실행, 분석, 검증, 판정
// ═══════════════════════════════════════════════════════

export {
  // types
  type PipeSpec, type PipeGraph, type PipeConnection, type ConnectionKind,
  type PipeFlow, type PipeStep, type PipeSequence, type PipeBranch, type PipeOptional,
  type PipeParallel, type PipeRace, type PipeAwait, type PipeRetry, type PipeFallback,
  type PipeLoop, type PipeCompensate, type PipeEmit, type PipeFinally, type PipeTimeout, type PipeFeedback,
  type PipeMap, type PipeReduce, type PipeBuffer, type PipeFilter,
  type PipeCircuitBreaker, type PipeThrottle, type PipeDebounce,
  type PipeSplit, type PipeEnrich, type PipeTap, type PipeResequence, type PipeWindow,
  type PipeDedup, type PipeCorrelation, type Constraint, type StepDataContract,
  // path
  countPipePaths, countGraphPaths,
  // validate
  validatePipeSpec, validatePipeGraph, type ValidationIssue,
  // serialize
  serializePipeSpec, deserializePipeSpec, serializePipeGraph, deserializePipeGraph,
  // store
  type PipeGraphStore, type PipeSpecStore, MemoryPipeGraphStore, MemoryPipeSpecStore,
  // analyze
  analyzePipeComplexity, findBottlenecks, analyzeCoverage, getChildFlows, collectGraphEvents,
  type PipeComplexity, type BottleneckReport, type CoverageReport, type GraphEvent,
  // fold
  computeFoldedContract, foldSubgraph, unfoldNode, detectFoldRegions,
  type FoldLevel, type FoldDataRef, type FoldedContract, type FoldedGraph, type FoldRegion,
  normalizeEndpoint, collectFlowSteps,
  // interpret
  extractPipeConcerns, propagatePipeConcerns, analyzePipeImpact, classifyPipeRole,
  PIPE_PROPAGATION_RULES,
  type PipeConcern, type InheritedPipeConcern, type PipeConcernEntry, type PipeConcernMap,
  type ImpactedPipe, type PipeImpactAnalysis, type PipeRole,
  // zoom
  computeZoomLevels, computeZoomView, computeLayout,
  type ZoomNodeStyle, type ZoomNode, type ZoomEdge, type ZoomSummary, type ZoomView, type ZoomLevelMap,
  // gate
  evaluateGate, evaluateGates, allGatesPass, hasReviewItems,
  type GateLevel, type GateVerdict, type GateCriterion, type PipeGateSpec,
  type CriterionResult, type GateResult, type SubGateIssue,
  // simulate
  simulate, matchHappyPath,
  type SimulationConfig, type SimulationResult, type SimStep, type SimEvent, type SimContext,
  type HappyPathSpec, type HappyPathMatch,
  // runtime
  type ConditionExpr, type FieldCondition, type LogicalCondition, type ExistsCondition, type EventCondition,
  type StepResult, type StepError, type ICancellationToken, type IPipeContext,
  type StepExecutor, type ExecutedStep, type RunResult,
  parseCondition, evaluateCondition, CancellationToken, PipeContext, ExecutorRegistry, PipeRunner,
  // bridge
  extractLineageFromSimulation, validateStepContracts, validateSimulationLineage, constraintResultToEvent,
  type StepCompatIssue, type SimulationLineageValidation, type ConstraintEvent,
  // matcher
  matchPath, type PipeMatchResult,
  // verdict v2
  computeVerdictV2, type VerdictV2, type FacetCoverage, type VerdictReportV2,
  // data contract
  type DataSchema, type DataColumn, type FacetRole, type ColumnConstraint, type DataColumnRef,
  type DataRelation, type CascadeRule,
  type FieldLineage, type FieldRef, type TransformKind,
  type SchemaVersion, type SchemaChange, type SchemaChangeType, type SchemaCompatibility,
  type FieldSet, type FieldSpec, type CompatibilityResult,
  checkCompatibility, computeSchemaHash,
  collectSchemaChanges, determineCompatibility, createSchemaVersion,
  LineageCollector, VersionCollector,
  // constraint
  type PipeConstraintDef, type ConstraintSubject, type SubjectKind,
  type ConstraintPredicate, type PredicateOp,
  type ConstraintContext, type ContextWhen,
  type ConstraintEvidence, type EvidenceMethod,
  type PipeConstraintResult, type FailureTrace,
  ConstraintRegistry, evaluatePredicate, executeConstraint,
  // test tracking
  type TestCase, type TestTarget, type TestExpectation, type TestSuite, type TestResult,
  type FacetQualityMetrics, type PipeQualityMetrics,
  buildTestAddress, parseTestAddress, TestRegistry,
  // mermaid
  pipeGraphToMermaid, zoomViewToMermaid, type MermaidOptions,
  // svg primitives
  svgRect, svgCircle, svgPolygon, svgLine, svgPath, svgText, svgGroup, svgSvg,
  svgMarker, svgDefs, bezierH, arcAbove,
  svgR, svgEscapeXml, svgEscapeAttr,
  type SvgAttrs, type SvgMarkerDef,
  // svg shapes + tokens
  ROLE_TOKENS, CERTAINTY_STROKE_DASH, CONCERN_TOKENS, EDGE_TOKENS,
  renderMarkerDefs,
  drawNodeShape, drawFoldedNode, drawEntryMarker,
  drawConcernBadges, drawNodeLabel, drawFoldedCount,
  drawEdgePath, drawConditionBadge,
  standaloneNodeSvg, standaloneEdgeSvg,
  type RoleTokens, type ConcernTokens, type EdgeTokens,
  type NodeShapeOptions, type EdgePathOptions,
  type StandaloneNodeOptions, type StandaloneEdgeOptions,
  // svg / d3
  pipeGraphToSvg, zoomViewToSvg, pipeGraphToD3, zoomViewToD3,
  type SvgOptions, type D3Node, type D3Link, type D3GraphData,
  // definition bridge
  resolveLifecycles, analyzeLayerPropagation, resolveTags, resolveBindings,
  type PipeDefLifecycle, type PipeDefLayer,
  type DefinitionMeta, type DefinitionLookup,
  type PipeLifecycleInfo, type LayerPropagation, type PipeTagInfo, type PipeBindingInfo,
  // segment detection
  detectPathSegments, type DetectedSegments, type SegmentReason,
} from "./pipe/index.js";

// ═══════════════════════════════════════════════════════
// Standards — CloudEvents, AsyncAPI
// ═══════════════════════════════════════════════════════

export {
  type CloudEvent, type EventRecordLike, type ManifestRef,
  toCloudEvent, fromCloudEvent,
  serializeCloudEvent, deserializeCloudEvent,
  toCloudEventBatch, fromCloudEventBatch,
  type AsyncApiOptions, type AsyncApiSpec,
  generateAsyncApi, asyncApiToYaml, asyncApiToJson,
} from "./standards/index.js";

// ═══════════════════════════════════════════════════════
// Debug
// ═══════════════════════════════════════════════════════

export type {
  DebugEventRecord, StreamFilter, DebugCommand, DebugResponse,
  TraceInfo, ResolvedDim, MsgpackEncode, MsgpackDecode,
} from "./debug/debug-protocol.js";
export {
  TAG_EVENT_RECORD, TAG_DEBUG_COMMAND, TAG_DEBUG_RESPONSE, TAG_HEARTBEAT,
  encodeFrame, decodeFrame, encodeEventRecord, encodeCommand, encodeResponse, encodeHeartbeat,
} from "./debug/debug-protocol.js";
