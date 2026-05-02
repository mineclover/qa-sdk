// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

/**
 * @qa-sdk/core/platform — QA 플랫폼 전용 타입 및 유틸리티.
 *
 * 시나리오, 검증, 그래프, 저장소 포트 등 QA 플랫폼 서비스에서만 사용하는 타입.
 * 외부 소비자(인코딩/카탈로그만 필요)는 @qa-sdk/core 메인 또는 @qa-sdk/core/catalog 사용.
 */

// ── Scenario ─────────────────────────────────────────────
export type {
  ScenarioSpec,
  EntryCondition,
  StepKind,
  ScenarioStep,
  StepConstraint,
  BranchDef,
} from "../types/scenario.js";

// ── Graph ────────────────────────────────────────────────
export type {
  SpecGraph,
  SpecNode,
  SpecEdgeType,
  SpecEdge,
  RuntimeGraph,
  RuntimeNode,
  RuntimeEdgeType,
  RuntimeEdge,
} from "../types/graph.js";

// ── Verdict ──────────────────────────────────────────────
export type {
  Verdict,
  ConstraintResult,
  StepMatch,
  MatchResult,
  VerdictReport,
  LatencyViolation,
  OrderingViolation,
} from "../types/verdict.js";

// ── Path Observation ─────────────────────────────────────
export type {
  PathObservation,
  ReachedNode,
  TraversedEdge,
  TerminalReason,
} from "../types/path-observation.js";

// ── Registry ─────────────────────────────────────────────
export type {
  ServiceStatus,
  ServiceEntry,
  EventRecordKind,
  EventStatus,
  EventCategory,
  EventLifecycleStage,
  EventEntry,
} from "../types/registry.js";

// ── Event Pattern ────────────────────────────────────────
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
} from "../types/event-pattern.js";

// ── Scenario Schema ──────────────────────────────────────
export {
  constraintOpSchema,
  stepConstraintSchema,
  entryConditionSchema,
  branchDefSchema,
  stepKindSchema,
  scenarioStepSchema,
  scenarioSpecSchema,
} from "../schema/scenario.schema.js";

// ── Storage Ports ────────────────────────────────────────
export type {
  RecordStore,
  RecordInsert,
  RecordPaginationCursor,
  RecordPaginationParams,
  StoredRecord,
  StoredRecordPage,
} from "../ports/record-store.port.js";

export type {
  TraceStore,
  TraceUpsert,
  StoredTrace,
} from "../ports/trace-store.port.js";

export type { GraphStore } from "../ports/graph-store.port.js";

export type {
  VerdictStore,
  VerdictInsert,
  StoredVerdict,
} from "../ports/verdict-store.port.js";

export type {
  DlqStore,
  DlqInsert,
  DlqPhase,
  StoredDlqItem,
} from "../ports/dlq-store.port.js";

export type {
  TaskQueue,
  TaskPayload,
  TaskPhase,
  TaskQueueOptions,
  TaskHandler,
} from "../ports/task-queue.port.js";

export type {
  SessionStore,
  SessionUpsert,
  StoredSession,
} from "../ports/session-store.port.js";

export type {
  TransmissionStore,
  TransmissionInsert,
} from "../ports/transmission-store.port.js";

export type { ScenarioSpecStore } from "../ports/scenario-spec-store.port.js";

export type {
  MetricRollupStore,
  MetricRollupInsert,
  StoredMetricRollup,
  MetricRollupQuery,
  MetricWindowType,
} from "../ports/metric-rollup-store.port.js";

// ── Server Utilities ─────────────────────────────────────
export { SERVICE_PORTS, getServicePort, getServiceDevUrl, detectPortConflicts, warnPortConflict } from "../lib/service-ports.js";
export type { ServicePortEntry } from "../lib/service-ports.js";

export { createLogger } from "../lib/create-logger.js";
export type { Logger } from "../lib/create-logger.js";

export { AppError } from "../lib/app-error.js";

export {
  emptyStringToUndefined,
  optionalUrl,
  booleanWithDefaultFalse,
} from "../lib/env-helpers.js";

export { installSimpleShutdown } from "../lib/graceful-shutdown.js";
export type { SimpleShutdownDeps } from "../lib/graceful-shutdown.js";

// ── Auth ────────────────────────────────────────────────
export { createAuthMiddleware, authConfigFromEnv } from "./auth-middleware.js";
export type { AuthMode, AuthConfig, AuthContext } from "./auth-middleware.js";
