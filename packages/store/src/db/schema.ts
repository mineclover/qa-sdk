// @def.boundary persistence-system-root
// @def.doc persistence-system-root

import type { PathObservation, RuntimeGraph } from "@qa-sdk/core";
import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  index,
  unique,
} from "drizzle-orm/pg-core";

// ── QA Sessions ─────────────────────────────────────────
// QA 세션 단위. 하나의 테스트/검증 세션을 식별한다.

export const qaSessions = pgTable("qa_sessions", {
  sessionId: text("session_id").primaryKey(),
  scenarioId: text("scenario_id"),
  labels: jsonb("labels").$type<Record<string, string>>(),
  actorId: text("actor_id"),
  userId: text("user_id"),
  userAttributes: jsonb("user_attributes").$type<Record<string, string>>(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  closedAt: timestamp("closed_at", { withTimezone: true }),
});

// ── Traces ──────────────────────────────────────────────
// trace_id 단위 집계. reconstruction 상태를 추적한다.

export const traces = pgTable("traces", {
  traceId: text("trace_id").primaryKey(),
  sessionId: text("session_id").references(() => qaSessions.sessionId),
  serviceName: text("service_name"),
  actorId: text("actor_id"),
  userId: text("user_id"),
  userAttributes: jsonb("user_attributes").$type<Record<string, string>>(),
  recordCount: integer("record_count").notNull().default(0),
  firstTimestamp: timestamp("first_timestamp", { withTimezone: true }),
  lastTimestamp: timestamp("last_timestamp", { withTimezone: true }),
  reconstructed: boolean("reconstructed").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("idx_traces_session_id").on(table.sessionId),
  index("idx_traces_reconstructed").on(table.reconstructed, table.createdAt),
]);

// ── Event Records ───────────────────────────────────────
// SDK가 전송한 개별 이벤트 레코드. ingestion 시 저장된다.

export const eventRecords = pgTable("event_records", {
  logId: text("log_id").primaryKey(),
  traceId: text("trace_id").notNull().references(() => traces.traceId),
  spanId: text("span_id").notNull(),
  parentSpanId: text("parent_span_id"),

  timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
  recordKind: text("record_kind").notNull(), // log | span

  eventKey: text("event_key").notNull(),
  eventVersion: text("event_version").notNull(),

  spanName: text("span_name"),
  startTime: timestamp("start_time", { withTimezone: true }),
  endTime: timestamp("end_time", { withTimezone: true }),
  statusCode: text("status_code"),

  payloadFormat: text("payload_format").notNull(),
  payloadEncoding: text("payload_encoding").notNull(),
  payloadMaskingApplied: boolean("payload_masking_applied").notNull(),
  payloadMaskedFields: jsonb("payload_masked_fields").$type<string[]>().notNull(),
  payload: jsonb("payload"),
  registryWarning: text("registry_warning"),

  addressContext: jsonb("address_context").$type<Record<string, string>>(),
  qaSessionId: text("qa_session_id"),
  actorId: text("actor_id"),
  userId: text("user_id"),
  userAttributes: jsonb("user_attributes").$type<Record<string, string>>(),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("idx_event_records_trace_id").on(table.traceId),
  index("idx_event_records_trace_timestamp").on(
    table.traceId,
    table.timestamp,
  ),
  index("idx_event_records_event_key").on(table.eventKey),
  index("idx_event_records_session_id").on(table.qaSessionId),
]);

// ── Transmissions ───────────────────────────────────────
// 수신한 envelope 메타데이터. 감사/디버깅용.

export const transmissions = pgTable("transmissions", {
  transmissionId: text("transmission_id").primaryKey(),
  sentAt: timestamp("sent_at", { withTimezone: true }).notNull(),
  ownerType: text("owner_type").notNull(),
  ownerId: text("owner_id").notNull(),
  serviceName: text("service_name").notNull(),
  sdkName: text("sdk_name").notNull(),
  sdkVersion: text("sdk_version").notNull(),
  platform: text("platform").notNull(),
  env: text("env").notNull(),
  recordCount: integer("record_count").notNull(),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
});

// ── Runtime Graphs ──────────────────────────────────────
// reconstruction 결과. trace별 실행 그래프를 JSON으로 저장한다.

export const runtimeGraphs = pgTable("runtime_graphs", {
  traceId: text("trace_id").primaryKey().references(() => traces.traceId),
  graph: jsonb("graph").$type<RuntimeGraph>().notNull(),
  nodeCount: integer("node_count").notNull(),
  edgeCount: integer("edge_count").notNull(),
  builtAt: timestamp("built_at", { withTimezone: true }).notNull().defaultNow(),
});

// ── Scenario Specs ─────────────────────────────────────
// 검증 시나리오 정의. ScenarioSpec JSON 전체를 저장한다.

export const scenarioSpecs = pgTable("scenario_specs", {
  scenarioId: text("scenario_id").primaryKey(),
  version: text("version").notNull(),
  domain: text("domain").notNull(),
  description: text("description"),
  spec: jsonb("spec").notNull(), // Full ScenarioSpec JSON
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("idx_scenario_specs_domain").on(table.domain),
]);

// ── Verdict Reports ─────────────────────────────────────
// matching + verdict 결과.

export const verdictReports = pgTable("verdict_reports", {
  id: text("id").primaryKey(),
  scenarioId: text("scenario_id").notNull(),
  traceId: text("trace_id").notNull().references(() => traces.traceId),
  qaSessionId: text("qa_session_id"),
  overallVerdict: text("overall_verdict").notNull(), // pass | fail | warn | degraded | unknown
  report: jsonb("report").notNull(), // VerdictReport JSON (path_observation 포함)
  /** 경로 관측 결과. report.path_observation과 동일하며 DB 레벨 직접 조회용으로 제공 */
  pathObservation: jsonb("path_observation").$type<PathObservation>(),
  loopDetected: boolean("loop_detected"),
  terminalReason: text("terminal_reason"),
  computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("idx_verdict_reports_scenario_id").on(table.scenarioId),
  index("idx_verdict_reports_trace_id").on(table.traceId),
  index("idx_verdict_reports_session_id").on(table.qaSessionId),
  index("idx_verdict_reports_verdict").on(table.overallVerdict),
  unique().on(table.scenarioId, table.traceId),
]);

// ── Dead Letter Queue ───────────────────────────────────
// reconstruction / verdict 후처리 실패를 추적한다.

export const deadLetterQueue = pgTable("dead_letter_queue", {
  id: text("id").primaryKey(),
  traceId: text("trace_id").notNull().references(() => traces.traceId),
  phase: text("phase").notNull(),
  errorMessage: text("error_message").notNull(),
  attemptCount: integer("attempt_count").notNull().default(0),
  lastAttemptedAt: timestamp("last_attempted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
}, (table) => [
  index("idx_dead_letter_queue_pending").on(
    table.resolvedAt,
    table.createdAt,
  ),
  index("idx_dead_letter_queue_trace_phase").on(
    table.traceId,
    table.phase,
  ),
]);

// ── Key Observations ───────────────────────────────────
// packed_key 관측 빈도 추적. 좌표 공간 coverage/drift 분석.

/**
 * @deprecated 2026-04-22 (Plan 07b 완료) — `@qa-sdk/ingest-server`의
 * `src/stores/pg/schema.ts` (pgSchema("ingest").table("key_observations"))가 SSOT.
 *
 * 본 정의는 단일 PK(packed_key)로 §4 P1·P3 결과(`(prefix_id, version, address)` 복합 PK)를
 * 만족하지 못한다. neue 코드는 import 금지. history 보존용으로만 유지.
 * 다음 packages/store major release에서 제거 예정.
 */
// @def.coord-storage-exempt: deprecated legacy key_observations schema; ingest-server pg schema is SSOT.
export const keyObservations = pgTable("key_observations", {
  packedKey: text("packed_key").primaryKey(),
  prefixId: text("prefix_id").notNull(),
  registered: boolean("registered").notNull().default(false),
  count: integer("count").notNull().default(1),
  firstSeen: timestamp("first_seen", { withTimezone: true }).notNull(),
  lastSeen: timestamp("last_seen", { withTimezone: true }).notNull(),
  payloadSummary: jsonb("payload_summary").notNull().default({}),
}, (t) => [
  index("idx_key_obs_prefix").on(t.prefixId),
  index("idx_key_obs_last_seen").on(t.lastSeen),
  index("idx_key_obs_count").on(t.count),
  index("idx_key_obs_registered").on(t.registered),
]);

// ── Key Observation Prefixes ───────────────────────────
// prefix 레벨 집계. capacity planning 지원.

/**
 * @deprecated 2026-04-22 (Plan 07b 완료) — `@qa-sdk/ingest-server`의
 * `src/stores/pg/schema.ts` (pgSchema("ingest").table("key_observation_prefixes"))가 SSOT.
 *
 * 본 정의는 단일 PK(prefix_id)로 §4 P3 결과(version별 분리 집계)를 만족하지 못한다.
 * 신규 코드 import 금지. 다음 major release에서 제거 예정.
 */
export const keyObservationPrefixes = pgTable("key_observation_prefixes", {
  prefixId: text("prefix_id").primaryKey(),
  distinctKeys: integer("distinct_keys").notNull().default(1),
  totalCount: integer("total_count").notNull().default(0),
  firstSeen: timestamp("first_seen", { withTimezone: true }).notNull(),
  lastSeen: timestamp("last_seen", { withTimezone: true }).notNull(),
});

// ── Insight Labels ─────────────────────────────────────
// 관측 데이터 수동 레이블링. 인사이트 분류·감사 추적.

export const insightLabels = pgTable("insight_labels", {
  id: text("id").primaryKey(),
  kind: text("kind").notNull(),
  targetId: text("target_id").notNull(),
  label: text("label").notNull(),
  status: text("status").notNull().default("pending"),
  notes: text("notes"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("idx_insight_labels_kind").on(t.kind),
  index("idx_insight_labels_target").on(t.targetId),
]);
