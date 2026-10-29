// @def.boundary ingest-system
// @def.doc ingest-system

/**
 * Drizzle ORM schema definitions for D1 (SQLite).
 * d1-schema.sql.ts DDL과 1:1 대응.
 *
 * 런타임 변경 없음 — drizzle-kit generate용 스키마 정의만 포함.
 */
import {
  sqliteTable,
  text,
  integer,
  real,
  index,
  uniqueIndex,
  primaryKey,
} from 'drizzle-orm/sqlite-core';

// ─── qa_sessions ───────────────────────────────────────────────
export const qaSessions = sqliteTable('qa_sessions', {
  sessionId: text('session_id').primaryKey(),
  scenarioId: text('scenario_id'),
  labels: text('labels'),
  actorId: text('actor_id'),
  userId: text('user_id'),
  userAttributes: text('user_attributes'),
  startedAt: text('started_at').notNull(),
  closedAt: text('closed_at'),
});

export type QaSessionRow = typeof qaSessions.$inferSelect;

// ─── traces ────────────────────────────────────────────────────
export const traces = sqliteTable(
  'traces',
  {
    traceId: text('trace_id').primaryKey(),
    sessionId: text('session_id'),
    serviceName: text('service_name'),
    actorId: text('actor_id'),
    userId: text('user_id'),
    userAttributes: text('user_attributes'),
    recordCount: integer('record_count').notNull().default(0),
    firstTimestamp: text('first_timestamp'),
    lastTimestamp: text('last_timestamp'),
    reconstructed: integer('reconstructed', { mode: 'boolean' }).notNull().default(false),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [
    index('idx_traces_session_id').on(t.sessionId),
    index('idx_traces_reconstructed').on(t.reconstructed, t.createdAt),
  ],
);

export type TraceRow = typeof traces.$inferSelect;

// ─── event_records ─────────────────────────────────────────────
export const eventRecords = sqliteTable(
  'event_records',
  {
    logId: text('log_id').primaryKey(),
    traceId: text('trace_id').notNull(),
    spanId: text('span_id').notNull(),
    parentSpanId: text('parent_span_id'),
    timestamp: text('timestamp').notNull(),
    recordKind: text('record_kind').notNull(),
    eventKey: text('event_key').notNull(),
    eventVersion: text('event_version').notNull(),
    spanName: text('span_name'),
    startTime: text('start_time'),
    endTime: text('end_time'),
    statusCode: text('status_code'),
    payloadFormat: text('payload_format').notNull(),
    payloadEncoding: text('payload_encoding').notNull(),
    payloadMaskingApplied: integer('payload_masking_applied', { mode: 'boolean' })
      .notNull()
      .default(false),
    payloadMaskedFields: text('payload_masked_fields').notNull().default('[]'),
    payload: text('payload'),
    registryWarning: text('registry_warning'),
    addressContext: text('address_context'),
    qaSessionId: text('qa_session_id'),
    actorId: text('actor_id'),
    userId: text('user_id'),
    userAttributes: text('user_attributes'),
    createdAt: text('created_at').notNull(),
    // Metric (record_kind === 'metric') — additive migration으로 추가. labels/buckets/quantiles는 JSON 문자열
    metricType: text('metric_type'),
    metricName: text('metric_name'),
    metricValue: real('metric_value'),
    metricUnit: text('metric_unit'),
    metricLabels: text('metric_labels'),
    metricBuckets: text('metric_buckets'),
    metricQuantiles: text('metric_quantiles'),
  },
  (t) => [
    index('idx_event_records_trace_id').on(t.traceId),
    index('idx_event_records_trace_timestamp').on(t.traceId, t.timestamp),
    index('idx_event_records_event_key').on(t.eventKey),
    index('idx_event_records_session_id').on(t.qaSessionId),
  ],
);

export type EventRecordRow = typeof eventRecords.$inferSelect;

// ─── verdict_reports ───────────────────────────────────────────
export const verdictReports = sqliteTable(
  'verdict_reports',
  {
    id: text('id').primaryKey(),
    scenarioId: text('scenario_id').notNull(),
    traceId: text('trace_id').notNull(),
    qaSessionId: text('qa_session_id'),
    overallVerdict: text('overall_verdict').notNull(),
    report: text('report').notNull(),
    pathObservation: text('path_observation'),
    loopDetected: integer('loop_detected'),
    terminalReason: text('terminal_reason'),
    computedAt: text('computed_at').notNull(),
  },
  (t) => [
    index('idx_verdict_reports_scenario_id').on(t.scenarioId),
    index('idx_verdict_reports_trace_id').on(t.traceId),
    index('idx_verdict_reports_session_id').on(t.qaSessionId),
    index('idx_verdict_reports_verdict').on(t.overallVerdict),
    uniqueIndex('uniq_verdict_scenario_trace').on(t.scenarioId, t.traceId),
  ],
);

export type VerdictReportRow = typeof verdictReports.$inferSelect;

// ─── transmissions ─────────────────────────────────────────────
export const transmissions = sqliteTable('transmissions', {
  transmissionId: text('transmission_id').primaryKey(),
  sentAt: text('sent_at').notNull(),
  ownerType: text('owner_type').notNull(),
  ownerId: text('owner_id').notNull(),
  serviceName: text('service_name').notNull(),
  sdkName: text('sdk_name').notNull(),
  sdkVersion: text('sdk_version').notNull(),
  platform: text('platform').notNull(),
  env: text('env').notNull(),
  recordCount: integer('record_count').notNull(),
  receivedAt: text('received_at').notNull(),
});

// ─── dead_letter_queue ─────────────────────────────────────────
export const deadLetterQueue = sqliteTable(
  'dead_letter_queue',
  {
    id: text('id').primaryKey(),
    traceId: text('trace_id').notNull(),
    phase: text('phase').notNull(),
    errorMessage: text('error_message').notNull(),
    attemptCount: integer('attempt_count').notNull().default(0),
    lastAttemptedAt: text('last_attempted_at'),
    createdAt: text('created_at').notNull(),
    resolvedAt: text('resolved_at'),
  },
  (t) => [
    index('idx_dlq_pending').on(t.resolvedAt, t.createdAt),
    index('idx_dlq_trace_phase').on(t.traceId, t.phase),
  ],
);

// ─── insight_labels ────────────────────────────────────────────
export const insightLabels = sqliteTable(
  'insight_labels',
  {
    id: text('id').primaryKey(),
    kind: text('kind').notNull(),
    targetId: text('target_id').notNull(),
    label: text('label').notNull(),
    status: text('status').notNull().default('pending'),
    notes: text('notes'),
    metadata: text('metadata'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [
    index('idx_insight_labels_kind').on(t.kind),
    index('idx_insight_labels_target').on(t.targetId),
  ],
);

// ─── key_observations ─────────────────────────────────────────
// coordinate-storage.rule §1.1 — version은 1급 컬럼으로 분리. PK는 (prefix_id, version, address).
// packed_key는 역호환·이력 추적용 secondary index만.
export const keyObservations = sqliteTable(
  'key_observations',
  {
    prefixId: text('prefix_id').notNull(),
    version: text('version').notNull(),
    address: integer('address').notNull(),
    packedKey: text('packed_key').notNull(),
    registered: integer('registered', { mode: 'boolean' }).notNull().default(false),
    count: integer('count').notNull().default(1),
    firstSeen: text('first_seen').notNull(),
    lastSeen: text('last_seen').notNull(),
    payloadSummary: text('payload_summary').notNull().default('{}'),
  },
  (t) => [
    primaryKey({ columns: [t.prefixId, t.version, t.address] }),
    index('idx_key_obs_packed').on(t.packedKey),
    index('idx_key_obs_prefix_version').on(t.prefixId, t.version),
    index('idx_key_obs_last_seen').on(t.lastSeen),
    index('idx_key_obs_count').on(t.count),
    index('idx_key_obs_registered').on(t.registered),
  ],
);

export type KeyObservationRow = typeof keyObservations.$inferSelect;

// ─── key_observation_prefixes ─────────────────────────────────
// coordinate-storage.rule §1.1 P3 — version 차원 추가, 집계도 version별 분리.
export const keyObservationPrefixes = sqliteTable(
  'key_observation_prefixes',
  {
    prefixId: text('prefix_id').notNull(),
    version: text('version').notNull(),
    distinctKeys: integer('distinct_keys').notNull().default(1),
    totalCount: integer('total_count').notNull().default(0),
    firstSeen: text('first_seen').notNull(),
    lastSeen: text('last_seen').notNull(),
  },
  (t) => [primaryKey({ columns: [t.prefixId, t.version] })],
);

export type KeyObservationPrefixRow = typeof keyObservationPrefixes.$inferSelect;

// ─── runtime_graphs ───────────────────────────────────────
export const runtimeGraphs = sqliteTable('runtime_graphs', {
  traceId: text('trace_id').primaryKey(),
  graph: text('graph').notNull(), // JSON string (RuntimeGraph)
  nodeCount: integer('node_count').notNull(),
  edgeCount: integer('edge_count').notNull(),
  builtAt: text('built_at').notNull(), // ISO-8601
});

// ─── scenario_specs ───────────────────────────────────────
export const scenarioSpecs = sqliteTable(
  'scenario_specs',
  {
    scenarioId: text('scenario_id').primaryKey(),
    version: text('version').notNull(),
    domain: text('domain').notNull(),
    description: text('description'),
    spec: text('spec').notNull(), // JSON string (ScenarioSpec)
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [index('idx_scenario_specs_domain').on(t.domain)],
);
