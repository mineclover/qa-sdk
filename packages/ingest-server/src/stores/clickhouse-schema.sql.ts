/**
 * ClickHouse DDL — ReplacingMergeTree 기반 이벤트 저장.
 *
 * 특징:
 * - event_records: MergeTree (append-only, 최적화된 시계열 쿼리)
 * - traces: ReplacingMergeTree (updated_at로 최신 행 유지)
 * - qa_sessions: ReplacingMergeTree
 * - verdict_reports: ReplacingMergeTree (computed_at)
 */
export const CLICKHOUSE_SCHEMA_DDL = `
CREATE TABLE IF NOT EXISTS event_records (
  log_id String,
  trace_id String,
  span_id String,
  parent_span_id Nullable(String),
  timestamp DateTime64(3),
  record_kind LowCardinality(String),
  event_key LowCardinality(String),
  event_version String,
  span_name Nullable(String),
  start_time Nullable(DateTime64(3)),
  end_time Nullable(DateTime64(3)),
  status_code Nullable(LowCardinality(String)),
  payload_format LowCardinality(String),
  payload_encoding LowCardinality(String),
  payload_masking_applied UInt8,
  payload_masked_fields String DEFAULT '[]',
  payload Nullable(String),
  registry_warning Nullable(String),
  address_context Nullable(String),
  qa_session_id Nullable(String),
  actor_id Nullable(String),
  user_id Nullable(String),
  user_attributes Nullable(String),
  created_at DateTime64(3) DEFAULT now64(3)
) ENGINE = MergeTree()
ORDER BY (trace_id, timestamp, log_id)
PARTITION BY toYYYYMM(timestamp);

CREATE TABLE IF NOT EXISTS traces (
  trace_id String,
  session_id Nullable(String),
  service_name Nullable(LowCardinality(String)),
  actor_id Nullable(String),
  user_id Nullable(String),
  user_attributes Nullable(String),
  record_count UInt32 DEFAULT 0,
  first_timestamp Nullable(DateTime64(3)),
  last_timestamp Nullable(DateTime64(3)),
  reconstructed UInt8 DEFAULT 0,
  created_at DateTime64(3) DEFAULT now64(3),
  updated_at DateTime64(3) DEFAULT now64(3)
) ENGINE = ReplacingMergeTree(updated_at)
ORDER BY trace_id;

CREATE TABLE IF NOT EXISTS qa_sessions (
  session_id String,
  scenario_id Nullable(String),
  labels Nullable(String),
  actor_id Nullable(String),
  user_id Nullable(String),
  user_attributes Nullable(String),
  started_at DateTime64(3) DEFAULT now64(3),
  closed_at Nullable(DateTime64(3))
) ENGINE = ReplacingMergeTree(started_at)
ORDER BY session_id;

CREATE TABLE IF NOT EXISTS verdict_reports (
  id String,
  scenario_id String,
  trace_id String,
  qa_session_id Nullable(String),
  overall_verdict LowCardinality(String),
  report String,
  path_observation Nullable(String),
  loop_detected Nullable(UInt8),
  terminal_reason Nullable(String),
  computed_at DateTime64(3) DEFAULT now64(3)
) ENGINE = ReplacingMergeTree(computed_at)
ORDER BY (scenario_id, trace_id);
`;
