/**
 * Drizzle ORM schema definitions for D1 (SQLite).
 * d1-schema.sql.ts DDL과 1:1 대응.
 *
 * 런타임 변경 없음 — drizzle-kit generate용 스키마 정의만 포함.
 */
import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";

// ─── qa_sessions ───────────────────────────────────────────────
export const qaSessions = sqliteTable("qa_sessions", {
  sessionId: text("session_id").primaryKey(),
  scenarioId: text("scenario_id"),
  labels: text("labels"),
  actorId: text("actor_id"),
  userId: text("user_id"),
  userAttributes: text("user_attributes"),
  startedAt: text("started_at").notNull(),
  closedAt: text("closed_at"),
});

// ─── traces ────────────────────────────────────────────────────
export const traces = sqliteTable(
  "traces",
  {
    traceId: text("trace_id").primaryKey(),
    sessionId: text("session_id"),
    serviceName: text("service_name"),
    actorId: text("actor_id"),
    userId: text("user_id"),
    userAttributes: text("user_attributes"),
    recordCount: integer("record_count").notNull().default(0),
    firstTimestamp: text("first_timestamp"),
    lastTimestamp: text("last_timestamp"),
    reconstructed: integer("reconstructed", { mode: "boolean" }).notNull().default(false),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [
    index("idx_traces_session_id").on(t.sessionId),
    index("idx_traces_reconstructed").on(t.reconstructed, t.createdAt),
  ],
);

// ─── event_records ─────────────────────────────────────────────
export const eventRecords = sqliteTable(
  "event_records",
  {
    logId: text("log_id").primaryKey(),
    traceId: text("trace_id").notNull(),
    spanId: text("span_id").notNull(),
    parentSpanId: text("parent_span_id"),
    timestamp: text("timestamp").notNull(),
    recordKind: text("record_kind").notNull(),
    eventKey: text("event_key").notNull(),
    eventVersion: text("event_version").notNull(),
    spanName: text("span_name"),
    startTime: text("start_time"),
    endTime: text("end_time"),
    statusCode: text("status_code"),
    payloadFormat: text("payload_format").notNull(),
    payloadEncoding: text("payload_encoding").notNull(),
    payloadMaskingApplied: integer("payload_masking_applied", { mode: "boolean" }).notNull().default(false),
    payloadMaskedFields: text("payload_masked_fields").notNull().default("[]"),
    payload: text("payload"),
    registryWarning: text("registry_warning"),
    addressContext: text("address_context"),
    qaSessionId: text("qa_session_id"),
    actorId: text("actor_id"),
    userId: text("user_id"),
    userAttributes: text("user_attributes"),
    createdAt: text("created_at").notNull(),
  },
  (t) => [
    index("idx_event_records_trace_id").on(t.traceId),
    index("idx_event_records_trace_timestamp").on(t.traceId, t.timestamp),
    index("idx_event_records_event_key").on(t.eventKey),
    index("idx_event_records_session_id").on(t.qaSessionId),
  ],
);

// ─── verdict_reports ───────────────────────────────────────────
export const verdictReports = sqliteTable(
  "verdict_reports",
  {
    id: text("id").primaryKey(),
    scenarioId: text("scenario_id").notNull(),
    traceId: text("trace_id").notNull(),
    qaSessionId: text("qa_session_id"),
    overallVerdict: text("overall_verdict").notNull(),
    report: text("report").notNull(),
    pathObservation: text("path_observation"),
    loopDetected: integer("loop_detected"),
    terminalReason: text("terminal_reason"),
    computedAt: text("computed_at").notNull(),
  },
  (t) => [
    index("idx_verdict_reports_scenario_id").on(t.scenarioId),
    index("idx_verdict_reports_trace_id").on(t.traceId),
    index("idx_verdict_reports_session_id").on(t.qaSessionId),
    uniqueIndex("uniq_verdict_scenario_trace").on(t.scenarioId, t.traceId),
  ],
);

// ─── transmissions ─────────────────────────────────────────────
export const transmissions = sqliteTable("transmissions", {
  transmissionId: text("transmission_id").primaryKey(),
  sentAt: text("sent_at").notNull(),
  ownerType: text("owner_type").notNull(),
  ownerId: text("owner_id").notNull(),
  serviceName: text("service_name").notNull(),
  sdkName: text("sdk_name").notNull(),
  sdkVersion: text("sdk_version").notNull(),
  platform: text("platform").notNull(),
  env: text("env").notNull(),
  recordCount: integer("record_count").notNull(),
  receivedAt: text("received_at").notNull(),
});

// ─── dead_letter_queue ─────────────────────────────────────────
export const deadLetterQueue = sqliteTable(
  "dead_letter_queue",
  {
    id: text("id").primaryKey(),
    traceId: text("trace_id").notNull(),
    phase: text("phase").notNull(),
    errorMessage: text("error_message").notNull(),
    attemptCount: integer("attempt_count").notNull().default(0),
    lastAttemptedAt: text("last_attempted_at"),
    createdAt: text("created_at").notNull(),
    resolvedAt: text("resolved_at"),
  },
  (t) => [
    index("idx_dlq_pending").on(t.resolvedAt, t.createdAt),
  ],
);

// ─── insight_labels ────────────────────────────────────────────
export const insightLabels = sqliteTable(
  "insight_labels",
  {
    id: text("id").primaryKey(),
    kind: text("kind").notNull(),
    targetId: text("target_id").notNull(),
    label: text("label").notNull(),
    status: text("status").notNull().default("pending"),
    notes: text("notes"),
    metadata: text("metadata"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [
    index("idx_insight_labels_kind").on(t.kind),
    index("idx_insight_labels_target").on(t.targetId),
  ],
);
