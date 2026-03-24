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
  getPrefixStructure,
  getPrefixShape,
  getPrefixEntries,
  getPrefixProfile,
  encodePrefix,
  decodePrefix,
  encodePrefixByValue,
  resolveAddress,
  decomposeAddress,
  verifyRoundTrip,
  decodePrefixAsResult,
  resolveAddressAsResult,
  decomposeAddressAsResult,
} from "./catalog/runtime.js";

export type { DecodeResult, DecodedDim } from "./catalog/decode-result.js";
export { entitiesToDecodeResult, decodeResultToEntities, decodeResultToDeep } from "./catalog/decode-result.js";

// ── Types ───────────────────────────────────────────────

export type {
  OwnerType,
  TransmissionOwner,
  TransmissionSource,
  TransmissionRuntime,
  BuildEnv,
  TransmissionBuild,
  TransmissionEnvelope,
} from "./types/envelope.js";

export type {
  ServiceIdentity,
  DeployContext,
  ServiceBootConfig,
} from "./types/service-identity.js";

export {
  toServiceDims,
  toTransmissionSource,
  toTransmissionBuild,
  catalogEnvToBuildEnv,
  buildEnvToCatalogEnv,
} from "./types/service-identity.js";

export type {
  PayloadFormat,
  PayloadEncoding,
  MaskingMode,
  MaskedFieldMarker,
  PayloadDescriptor,
} from "./types/payload.js";

export type { ActorContext } from "./types/actor.js";

export type {
  IdentificationMode,
  BehaviorPattern,
  PatternConfidence,
  PatternRule,
  PatternMatchCondition,
  PatternClassification,
  PatternAnomaly,
  AnomalyKind,
  PatternStats,
  PatternHealthReport,
} from "./types/event-pattern.js";

export type {
  RecordKind,
  MetricType,
  SpanStatusCode,
  EventRecord,
} from "./types/record.js";

export type { QaSession } from "./types/session.js";

export type {
  ScenarioSpec,
  EntryCondition,
  StepKind,
  ScenarioStep,
  StepConstraint,
  BranchDef,
} from "./types/scenario.js";

export type {
  SpecGraph,
  SpecNode,
  SpecEdgeType,
  SpecEdge,
  RuntimeGraph,
  RuntimeNode,
  RuntimeEdgeType,
  RuntimeEdge,
} from "./types/graph.js";

export type {
  Verdict,
  ConstraintResult,
  StepMatch,
  MatchResult,
  VerdictReport,
  LatencyViolation,
  OrderingViolation,
} from "./types/verdict.js";

export type {
  PathObservation,
  ReachedNode,
  TraversedEdge,
  TerminalReason,
} from "./types/path-observation.js";

export type {
  ServiceStatus,
  ServiceEntry,
  EventRecordKind,
  EventStatus,
  EventCategory,
  EventLifecycleStage,
  EventEntry,
} from "./types/registry.js";

// ── Schemas ─────────────────────────────────────────────

export {
  ownerTypeSchema,
  transmissionOwnerSchema,
  transmissionSourceSchema,
  transmissionRuntimeSchema,
  buildEnvSchema,
  transmissionBuildSchema,
  transmissionEnvelopeSchema,
} from "./schema/envelope.schema.js";

export {
  recordKindSchema,
  metricTypeSchema,
  spanStatusCodeSchema,
  payloadFormatSchema,
  payloadEncodingSchema,
  eventRecordSchema,
} from "./schema/record.schema.js";

export {
  constraintOpSchema,
  stepConstraintSchema,
  entryConditionSchema,
  branchDefSchema,
  stepKindSchema,
  scenarioStepSchema,
  scenarioSpecSchema,
} from "./schema/scenario.schema.js";

// ── Lib ─────────────────────────────────────────────────

export {
  newTransmissionId,
  newLogId,
  newTraceId,
  newSpanId,
  newQaSessionId,
  newVerdictId,
  newDlqId,
} from "./lib/id.js";

export { now, normalizeTimestamp, compareTimestamps } from "./lib/clock.js";

export {
  parseSerializedAddress,
  serializeAddress,
} from "./lib/address-parser.js";
export type { ParsedAddress } from "./lib/address-parser.js";

export { SERVICE_PORTS, detectPortConflicts, warnPortConflict } from "./lib/service-ports.js";
export type { ServicePortEntry } from "./lib/service-ports.js";

export { identifyActorMode } from "./lib/identify-actor.js";
export type { IdentifyActorInput } from "./lib/identify-actor.js";

export { createLogger } from "./lib/create-logger.js";
export type { Logger } from "./lib/create-logger.js";

export { AppError } from "./lib/app-error.js";

export {
  emptyStringToUndefined,
  optionalUrl,
  booleanWithDefaultFalse,
} from "./lib/env-helpers.js";

export { installSimpleShutdown } from "./lib/graceful-shutdown.js";
export type { SimpleShutdownDeps } from "./lib/graceful-shutdown.js";

// ── Ports (Storage Contracts) ───────────────────────────

export type {
  RecordStore,
  RecordInsert,
  RecordPaginationCursor,
  RecordPaginationParams,
  StoredRecord,
  StoredRecordPage,
} from "./ports/record-store.port.js";

export type {
  TraceStore,
  TraceUpsert,
  StoredTrace,
} from "./ports/trace-store.port.js";

export type { GraphStore } from "./ports/graph-store.port.js";

export type {
  VerdictStore,
  VerdictInsert,
  StoredVerdict,
} from "./ports/verdict-store.port.js";

export type {
  DlqStore,
  DlqInsert,
  DlqPhase,
  StoredDlqItem,
} from "./ports/dlq-store.port.js";

export type {
  TaskQueue,
  TaskPayload,
  TaskPhase,
  TaskQueueOptions,
  TaskHandler,
} from "./ports/task-queue.port.js";

export type {
  SessionStore,
  SessionUpsert,
  StoredSession,
} from "./ports/session-store.port.js";

export type {
  TransmissionStore,
  TransmissionInsert,
} from "./ports/transmission-store.port.js";

export type { ScenarioSpecStore } from "./ports/scenario-spec-store.port.js";

export type {
  MetricRollupStore,
  MetricRollupInsert,
  StoredMetricRollup,
  MetricRollupQuery,
  MetricWindowType,
} from "./ports/metric-rollup-store.port.js";

// ── Debug Protocol ──────────────────────────────────────
export type {
  DebugEventRecord, StreamFilter, DebugCommand, DebugResponse,
  TraceInfo, ResolvedDim, MsgpackEncode, MsgpackDecode,
} from "./debug/debug-protocol.js";
export {
  TAG_EVENT_RECORD, TAG_DEBUG_COMMAND, TAG_DEBUG_RESPONSE, TAG_HEARTBEAT,
  encodeFrame, decodeFrame, encodeEventRecord, encodeCommand, encodeResponse, encodeHeartbeat,
} from "./debug/debug-protocol.js";
