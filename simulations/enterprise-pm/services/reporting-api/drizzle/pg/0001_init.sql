-- @def.boundary sim-reporting-api
-- Plan 11c — PG 초기 스키마. SIM_REPORTING_PG_DDL 복사본.
CREATE SCHEMA IF NOT EXISTS sim;

CREATE TABLE IF NOT EXISTS sim.reporting_reports (
  id TEXT PRIMARY KEY, name TEXT NOT NULL,
  query_definition TEXT NOT NULL, created_by TEXT NOT NULL,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sim.reporting_daily_metrics (
  id TEXT PRIMARY KEY,
  metric_key TEXT NOT NULL, date TEXT NOT NULL,
  value DOUBLE PRECISION NOT NULL, dimensions TEXT NOT NULL,
  computed_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sim_dm_key_date ON sim.reporting_daily_metrics(metric_key, date);
