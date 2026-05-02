-- @def.boundary sim-reporting-api
-- Plan 11c — SQLite 초기 스키마. SIM_REPORTING_SQLITE_DDL 복사본.
CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY, name TEXT NOT NULL,
  query_definition TEXT NOT NULL, created_by TEXT NOT NULL,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS daily_metrics (
  id TEXT PRIMARY KEY,
  metric_key TEXT NOT NULL, date TEXT NOT NULL,
  value REAL NOT NULL, dimensions TEXT NOT NULL,
  computed_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_dm_key_date ON daily_metrics(metric_key, date);
