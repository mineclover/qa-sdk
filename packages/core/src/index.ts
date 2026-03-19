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
  PayloadFormat,
  PayloadEncoding,
  MaskingMode,
  MaskedFieldMarker,
  PayloadDescriptor,
} from "./types/payload.js";

export type { ActorContext } from "./types/actor.js";

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

export { now } from "./lib/clock.js";

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
