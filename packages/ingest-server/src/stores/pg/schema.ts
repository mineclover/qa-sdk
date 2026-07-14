// @def.boundary ingest-system
// @def.doc ingest-system

/**
 * ingest schema 안의 key_observations + key_observation_prefixes (Plan 07b).
 *
 * §4 (coord-storage-audit) P1·P3 결과를 PG로 이식:
 *   - PK = (prefix_id, version, address)
 *   - packed_key는 secondary index (역호환·이력 추적)
 *   - prefix 집계도 (prefix_id, version) 복합 PK
 *
 * SQLite 버전(`packages/ingest-server/src/db/schema.ts` keyObservations)과 동일 구조,
 * dialect 차이만:
 *   - integer → integer (그대로)
 *   - text → text (그대로)
 *   - boolean SQLite는 INTEGER(0/1), PG는 native boolean
 *   - JSON payload_summary는 PG에서 jsonb (성능)
 *   - timestamp 필드는 ISO-8601 text 유지 (ingest 핫패스 호환성)
 */

import { boolean, index, integer, jsonb, pgSchema, primaryKey, text } from 'drizzle-orm/pg-core';

const ingestSchema = pgSchema('ingest');

export const keyObservations = ingestSchema.table(
  'key_observations',
  {
    prefixId: text('prefix_id').notNull(),
    version: text('version').notNull(),
    address: integer('address').notNull(),
    packedKey: text('packed_key').notNull(),
    registered: boolean('registered').notNull().default(false),
    count: integer('count').notNull().default(1),
    firstSeen: text('first_seen').notNull(),
    lastSeen: text('last_seen').notNull(),
    payloadSummary: jsonb('payload_summary').notNull().default({}),
  },
  (t) => [
    primaryKey({ columns: [t.prefixId, t.version, t.address] }),
    index('idx_key_obs_packed_pg').on(t.packedKey),
    index('idx_key_obs_prefix_version_pg').on(t.prefixId, t.version),
    index('idx_key_obs_last_seen_pg').on(t.lastSeen),
    index('idx_key_obs_count_pg').on(t.count),
    index('idx_key_obs_registered_pg').on(t.registered),
  ],
);

export const keyObservationPrefixes = ingestSchema.table(
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

export type KeyObservationPgRow = typeof keyObservations.$inferSelect;
export type KeyObservationPrefixPgRow = typeof keyObservationPrefixes.$inferSelect;

/**
 * ingest.event_records — RecordStore의 PG 구현 대상 (Plan 07c).
 *
 * D1 schema(`packages/ingest-server/src/db/schema.ts` eventRecords)와 동일 컬럼.
 * dialect 차이:
 *   - boolean payload_masking_applied: PG native (D1은 INTEGER 0/1)
 *   - jsonb 컬럼: payload, address_context, user_attributes, payload_masked_fields
 *     (D1은 모두 TEXT JSON)
 *   - timestamp 필드는 ISO-8601 text 유지 — ingest 핫패스 호환성
 */
export const eventRecords = ingestSchema.table(
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
    payloadMaskingApplied: boolean('payload_masking_applied').notNull().default(false),
    payloadMaskedFields: jsonb('payload_masked_fields').notNull().default([]),
    payload: jsonb('payload'),
    registryWarning: text('registry_warning'),
    addressContext: jsonb('address_context'),
    qaSessionId: text('qa_session_id'),
    actorId: text('actor_id'),
    userId: text('user_id'),
    userAttributes: jsonb('user_attributes'),
    createdAt: text('created_at').notNull(),
  },
  (t) => [
    index('idx_event_records_trace_id_pg').on(t.traceId),
    index('idx_event_records_trace_timestamp_pg').on(t.traceId, t.timestamp),
    index('idx_event_records_event_key_pg').on(t.eventKey),
    index('idx_event_records_session_id_pg').on(t.qaSessionId),
  ],
);

export type EventRecordPgRow = typeof eventRecords.$inferSelect;

/**
 * raw DDL — ingest.event_records.
 * KEY_OBSERVATIONS_PG_DDL과 별도 — schema CREATE는 idempotent.
 */
export const EVENT_RECORDS_PG_DDL = `
CREATE SCHEMA IF NOT EXISTS ingest;

CREATE TABLE IF NOT EXISTS ingest.event_records (
  log_id                   TEXT PRIMARY KEY,
  trace_id                 TEXT NOT NULL,
  span_id                  TEXT NOT NULL,
  parent_span_id           TEXT,
  timestamp                TEXT NOT NULL,
  record_kind              TEXT NOT NULL,
  event_key                TEXT NOT NULL,
  event_version            TEXT NOT NULL,
  span_name                TEXT,
  start_time               TEXT,
  end_time                 TEXT,
  status_code              TEXT,
  payload_format           TEXT NOT NULL,
  payload_encoding         TEXT NOT NULL,
  payload_masking_applied  BOOLEAN NOT NULL DEFAULT FALSE,
  payload_masked_fields    JSONB NOT NULL DEFAULT '[]'::jsonb,
  payload                  JSONB,
  registry_warning         TEXT,
  address_context          JSONB,
  qa_session_id            TEXT,
  actor_id                 TEXT,
  user_id                  TEXT,
  user_attributes          JSONB,
  created_at               TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_event_records_trace_id_pg         ON ingest.event_records(trace_id);
CREATE INDEX IF NOT EXISTS idx_event_records_trace_timestamp_pg  ON ingest.event_records(trace_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_event_records_event_key_pg        ON ingest.event_records(event_key);
CREATE INDEX IF NOT EXISTS idx_event_records_session_id_pg       ON ingest.event_records(qa_session_id);

-- RLS — Phase 3 Plan 15b
-- actor_id OR user_id 가 current_user_id() 와 일치하는 row 만 read.
-- INSERT 는 actor_id = current_user_id() 또는 NULL.

ALTER TABLE ingest.event_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY er_admin_bypass ON ingest.event_records
  FOR ALL
  USING (auth.current_role_tag() = 'admin')
  WITH CHECK (auth.current_role_tag() = 'admin');

CREATE POLICY er_select_policy ON ingest.event_records
  FOR SELECT
  USING (
    auth.has_bit(31)
    AND (
      actor_id = auth.current_user_id()
      OR user_id = auth.current_user_id()
    )
  );

CREATE POLICY er_insert_policy ON ingest.event_records
  FOR INSERT
  WITH CHECK (
    actor_id IS NULL
    OR actor_id = auth.current_user_id()
  );
`;

/**
 * raw DDL — Drizzle Kit 마이그레이션 정착 전까지 fixture/migration용.
 * §4 P1~P3 패턴 PG 이식.
 */
export const KEY_OBSERVATIONS_PG_DDL = `
CREATE SCHEMA IF NOT EXISTS ingest;

CREATE TABLE IF NOT EXISTS ingest.key_observations (
  prefix_id        TEXT NOT NULL,
  version          TEXT NOT NULL,
  address          INTEGER NOT NULL,
  packed_key       TEXT NOT NULL,
  registered       BOOLEAN NOT NULL DEFAULT FALSE,
  count            INTEGER NOT NULL DEFAULT 1,
  first_seen       TEXT NOT NULL,
  last_seen        TEXT NOT NULL,
  payload_summary  JSONB NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (prefix_id, version, address)
);
CREATE INDEX IF NOT EXISTS idx_key_obs_packed_pg          ON ingest.key_observations(packed_key);
CREATE INDEX IF NOT EXISTS idx_key_obs_prefix_version_pg  ON ingest.key_observations(prefix_id, version);
CREATE INDEX IF NOT EXISTS idx_key_obs_last_seen_pg       ON ingest.key_observations(last_seen);
CREATE INDEX IF NOT EXISTS idx_key_obs_count_pg           ON ingest.key_observations(count);
CREATE INDEX IF NOT EXISTS idx_key_obs_registered_pg      ON ingest.key_observations(registered);

CREATE TABLE IF NOT EXISTS ingest.key_observation_prefixes (
  prefix_id      TEXT NOT NULL,
  version        TEXT NOT NULL,
  distinct_keys  INTEGER NOT NULL DEFAULT 1,
  total_count    INTEGER NOT NULL DEFAULT 0,
  first_seen     TEXT NOT NULL,
  last_seen      TEXT NOT NULL,
  PRIMARY KEY (prefix_id, version)
);

-- RLS — Phase 3 Plan 15b 실제 정책
-- helper: auth.* (Plan 15a). bit: INGEST_READ_BIT=30 (rls-bits.ts).
-- tenant 경계: prefix_id 앞 segment 가 app.tenant_id 와 일치해야 함.

ALTER TABLE ingest.key_observations ENABLE ROW LEVEL SECURITY;

CREATE POLICY ko_admin_bypass ON ingest.key_observations
  FOR ALL
  USING (auth.current_role_tag() = 'admin')
  WITH CHECK (auth.current_role_tag() = 'admin');

CREATE POLICY ko_select_policy ON ingest.key_observations
  FOR SELECT
  USING (
    auth.has_bit(30)
    AND split_part(prefix_id, '_', 1) = current_setting('app.tenant_id', true)
    AND current_setting('app.tenant_id', true) IS NOT NULL
    AND current_setting('app.tenant_id', true) <> ''
  );

CREATE POLICY ko_insert_policy ON ingest.key_observations
  FOR INSERT
  WITH CHECK (
    split_part(prefix_id, '_', 1) = current_setting('app.tenant_id', true)
    AND current_setting('app.tenant_id', true) IS NOT NULL
    AND current_setting('app.tenant_id', true) <> ''
  );

-- UPDATE (count 증가 upsert) 은 INSERT 와 동일 tenant 조건
CREATE POLICY ko_update_policy ON ingest.key_observations
  FOR UPDATE
  USING (
    split_part(prefix_id, '_', 1) = current_setting('app.tenant_id', true)
  )
  WITH CHECK (
    split_part(prefix_id, '_', 1) = current_setting('app.tenant_id', true)
  );

-- key_observation_prefixes 도 동일 tenant 경계
ALTER TABLE ingest.key_observation_prefixes ENABLE ROW LEVEL SECURITY;

CREATE POLICY kop_admin_bypass ON ingest.key_observation_prefixes
  FOR ALL
  USING (auth.current_role_tag() = 'admin')
  WITH CHECK (auth.current_role_tag() = 'admin');

CREATE POLICY kop_all_policy ON ingest.key_observation_prefixes
  FOR ALL
  USING (split_part(prefix_id, '_', 1) = current_setting('app.tenant_id', true))
  WITH CHECK (split_part(prefix_id, '_', 1) = current_setting('app.tenant_id', true));
`;
