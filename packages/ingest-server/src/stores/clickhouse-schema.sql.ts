// @def.boundary ingest-system
// @def.doc ingest-system

// TODO(audit-versioning): D1 스키마는 (prefix_id, version, address)로 분리 완료(0001/0002 마이그레이션).
//   ClickHouse는 운영 도입 시점에 동일 패턴 적용 — version LowCardinality(String) + ORDER BY (prefix_id, version, packed_key).
//   현재는 실 운영 적용 전이라 D1과 동기 보류. coordinate-storage.rule §1.1 참조.

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

CREATE TABLE IF NOT EXISTS key_observations (
  packed_key String,
  prefix_id LowCardinality(String),
  registered UInt8 DEFAULT 0,
  count UInt32 DEFAULT 1,
  first_seen DateTime64(3),
  last_seen DateTime64(3),
  payload_summary String DEFAULT '{}'
) ENGINE = ReplacingMergeTree(last_seen)
ORDER BY (prefix_id, packed_key);

CREATE TABLE IF NOT EXISTS key_observation_prefixes (
  prefix_id LowCardinality(String),
  distinct_keys UInt32 DEFAULT 1,
  total_count UInt32 DEFAULT 0,
  first_seen DateTime64(3),
  last_seen DateTime64(3)
) ENGINE = ReplacingMergeTree(last_seen)
ORDER BY prefix_id;

CREATE TABLE IF NOT EXISTS transmissions (
  transmission_id String,
  sent_at DateTime64(3),
  owner_type LowCardinality(String),
  owner_id String,
  service_name LowCardinality(String),
  sdk_name LowCardinality(String),
  sdk_version String,
  platform LowCardinality(String),
  env LowCardinality(String),
  record_count UInt32,
  received_at DateTime64(3) DEFAULT now64(3)
) ENGINE = MergeTree()
ORDER BY (service_name, sent_at, transmission_id);

CREATE TABLE IF NOT EXISTS dead_letter_queue (
  id String,
  trace_id String,
  phase LowCardinality(String),
  error_message String,
  attempt_count UInt32 DEFAULT 0,
  last_attempted_at Nullable(DateTime64(3)),
  created_at DateTime64(3) DEFAULT now64(3),
  resolved_at Nullable(DateTime64(3))
) ENGINE = ReplacingMergeTree(created_at)
ORDER BY (trace_id, phase, id);

CREATE TABLE IF NOT EXISTS insight_labels (
  id String,
  kind LowCardinality(String),
  target_id String,
  label LowCardinality(String),
  status LowCardinality(String) DEFAULT 'pending',
  notes Nullable(String),
  metadata Nullable(String),
  created_at DateTime64(3) DEFAULT now64(3),
  updated_at DateTime64(3) DEFAULT now64(3)
) ENGINE = ReplacingMergeTree(updated_at)
ORDER BY (kind, target_id, id);

CREATE TABLE IF NOT EXISTS runtime_graphs (
  trace_id String,
  graph String,
  node_count UInt32,
  edge_count UInt32,
  built_at DateTime64(3) DEFAULT now64(3)
) ENGINE = ReplacingMergeTree(built_at)
ORDER BY trace_id;

CREATE TABLE IF NOT EXISTS scenario_specs (
  scenario_id String,
  version String,
  domain LowCardinality(String),
  description Nullable(String),
  spec String,
  created_at DateTime64(3) DEFAULT now64(3),
  updated_at DateTime64(3) DEFAULT now64(3)
) ENGINE = ReplacingMergeTree(updated_at)
ORDER BY (domain, scenario_id);
`;
