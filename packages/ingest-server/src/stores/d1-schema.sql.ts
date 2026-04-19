// @def.boundary ingest-system
// @def.doc ingest-system

/**
 * D1용 DDL — PG schema.ts의 SQLite 호환 버전.
 *
 * ⚠️ 이 DDL은 src/db/schema.ts (Drizzle 스키마)와 동일해야 합니다.
 * 스키마 변경 시 src/db/schema.ts를 먼저 수정하고 drizzle-kit generate로
 * 마이그레이션을 생성한 뒤, 이 파일도 동기화하세요.
 *
 * Workers 환경에서는 파일시스템 접근이 불가하여 drizzle migrate() 사용 불가.
 * Node.js 테스트에서는 drizzle migrate 사용을 권장합니다.
 *
 * 차이점 (PG vs SQLite):
 * - jsonb → TEXT (JSON string)
 * - timestamp with timezone → TEXT (ISO-8601)
 * - boolean → INTEGER (0/1)
 */
export const INGEST_D1_SCHEMA_DDL = `
CREATE TABLE IF NOT EXISTS qa_sessions (
  session_id       TEXT PRIMARY KEY,
  scenario_id      TEXT,
  labels           TEXT,
  actor_id         TEXT,
  user_id          TEXT,
  user_attributes  TEXT,
  started_at       TEXT NOT NULL,
  closed_at        TEXT
);

CREATE TABLE IF NOT EXISTS traces (
  trace_id         TEXT PRIMARY KEY,
  session_id       TEXT,
  service_name     TEXT,
  actor_id         TEXT,
  user_id          TEXT,
  user_attributes  TEXT,
  record_count     INTEGER NOT NULL DEFAULT 0,
  first_timestamp  TEXT,
  last_timestamp   TEXT,
  reconstructed    INTEGER NOT NULL DEFAULT 0,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_traces_session_id ON traces(session_id);
CREATE INDEX IF NOT EXISTS idx_traces_reconstructed ON traces(reconstructed, created_at);

CREATE TABLE IF NOT EXISTS event_records (
  log_id               TEXT PRIMARY KEY,
  trace_id             TEXT NOT NULL,
  span_id              TEXT NOT NULL,
  parent_span_id       TEXT,
  timestamp            TEXT NOT NULL,
  record_kind          TEXT NOT NULL,
  event_key            TEXT NOT NULL,
  event_version        TEXT NOT NULL,
  span_name            TEXT,
  start_time           TEXT,
  end_time             TEXT,
  status_code          TEXT,
  payload_format       TEXT NOT NULL,
  payload_encoding     TEXT NOT NULL,
  payload_masking_applied INTEGER NOT NULL DEFAULT 0,
  payload_masked_fields TEXT NOT NULL DEFAULT '[]',
  payload              TEXT,
  registry_warning     TEXT,
  address_context      TEXT,
  qa_session_id        TEXT,
  actor_id             TEXT,
  user_id              TEXT,
  user_attributes      TEXT,
  created_at           TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_event_records_trace_id ON event_records(trace_id);
CREATE INDEX IF NOT EXISTS idx_event_records_trace_timestamp ON event_records(trace_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_event_records_event_key ON event_records(event_key);
CREATE INDEX IF NOT EXISTS idx_event_records_session_id ON event_records(qa_session_id);

CREATE TABLE IF NOT EXISTS verdict_reports (
  id               TEXT PRIMARY KEY,
  scenario_id      TEXT NOT NULL,
  trace_id         TEXT NOT NULL,
  qa_session_id    TEXT,
  overall_verdict  TEXT NOT NULL,
  report           TEXT NOT NULL,
  path_observation TEXT,
  loop_detected    INTEGER,
  terminal_reason  TEXT,
  computed_at      TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_verdict_reports_scenario_id ON verdict_reports(scenario_id);
CREATE INDEX IF NOT EXISTS idx_verdict_reports_trace_id ON verdict_reports(trace_id);
CREATE INDEX IF NOT EXISTS idx_verdict_reports_session_id ON verdict_reports(qa_session_id);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_verdict_scenario_trace ON verdict_reports(scenario_id, trace_id);
CREATE INDEX IF NOT EXISTS idx_verdict_reports_verdict ON verdict_reports(overall_verdict);

CREATE TABLE IF NOT EXISTS transmissions (
  transmission_id TEXT PRIMARY KEY,
  sent_at        TEXT NOT NULL,
  owner_type     TEXT NOT NULL,
  owner_id       TEXT NOT NULL,
  service_name   TEXT NOT NULL,
  sdk_name       TEXT NOT NULL,
  sdk_version    TEXT NOT NULL,
  platform       TEXT NOT NULL,
  env            TEXT NOT NULL,
  record_count   INTEGER NOT NULL,
  received_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS dead_letter_queue (
  id               TEXT PRIMARY KEY,
  trace_id         TEXT NOT NULL,
  phase            TEXT NOT NULL,
  error_message    TEXT NOT NULL,
  attempt_count    INTEGER NOT NULL DEFAULT 0,
  last_attempted_at TEXT,
  created_at       TEXT NOT NULL,
  resolved_at      TEXT
);

CREATE INDEX IF NOT EXISTS idx_dlq_pending ON dead_letter_queue(resolved_at, created_at);
CREATE INDEX IF NOT EXISTS idx_dlq_trace_phase ON dead_letter_queue(trace_id, phase);

CREATE TABLE IF NOT EXISTS insight_labels (
  id               TEXT PRIMARY KEY,
  kind             TEXT NOT NULL,
  target_id        TEXT NOT NULL,
  label            TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'pending',
  notes            TEXT,
  metadata         TEXT,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_insight_labels_kind ON insight_labels(kind);
CREATE INDEX IF NOT EXISTS idx_insight_labels_target ON insight_labels(target_id);

CREATE TABLE IF NOT EXISTS key_observations (
  packed_key      TEXT    NOT NULL PRIMARY KEY,
  prefix_id       TEXT    NOT NULL,
  registered      INTEGER NOT NULL DEFAULT 0,
  count           INTEGER NOT NULL DEFAULT 1,
  first_seen      TEXT    NOT NULL,
  last_seen       TEXT    NOT NULL,
  payload_summary TEXT    NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_key_obs_prefix ON key_observations(prefix_id);
CREATE INDEX IF NOT EXISTS idx_key_obs_last_seen ON key_observations(last_seen);
CREATE INDEX IF NOT EXISTS idx_key_obs_count ON key_observations(count DESC);
CREATE INDEX IF NOT EXISTS idx_key_obs_registered ON key_observations(registered);

CREATE TABLE IF NOT EXISTS key_observation_prefixes (
  prefix_id      TEXT    NOT NULL PRIMARY KEY,
  distinct_keys  INTEGER NOT NULL DEFAULT 1,
  total_count    INTEGER NOT NULL DEFAULT 0,
  first_seen     TEXT    NOT NULL,
  last_seen      TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS runtime_graphs (
  trace_id   TEXT PRIMARY KEY,
  graph      TEXT NOT NULL,
  node_count INTEGER NOT NULL,
  edge_count INTEGER NOT NULL,
  built_at   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS scenario_specs (
  scenario_id TEXT PRIMARY KEY,
  version     TEXT NOT NULL,
  domain      TEXT NOT NULL,
  description TEXT,
  spec        TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_scenario_specs_domain ON scenario_specs(domain);
`;
