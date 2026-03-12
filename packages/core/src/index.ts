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

export type {
  RecordKind,
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
  StepMatch,
  MatchResult,
  VerdictReport,
  LatencyViolation,
} from "./types/verdict.js";

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
} from "./lib/id.js";

export { now } from "./lib/clock.js";
