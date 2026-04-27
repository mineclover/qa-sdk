-- @def.boundary sim-pm-api
-- Phase 2 — project slice 의 outbox 테이블 SQLite 추가.
-- 본 테이블 (`projects`) 은 0001_init 에 이미 존재.
CREATE TABLE IF NOT EXISTS pm_project_outbox (
  id TEXT PRIMARY KEY,
  aggregate_id TEXT NOT NULL,
  event_name TEXT NOT NULL,
  event_version INTEGER NOT NULL,
  payload TEXT NOT NULL,
  occurred_at INTEGER NOT NULL,
  scope_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
);
CREATE INDEX IF NOT EXISTS idx_pm_project_outbox_status ON pm_project_outbox(status, occurred_at);
