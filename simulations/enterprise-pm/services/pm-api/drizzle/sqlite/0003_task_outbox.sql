-- @def.boundary sim-pm-api
-- Phase 2 — task slice 의 outbox 테이블 SQLite 추가.
-- 본 테이블 (`tasks`) 은 0001_init 에 이미 존재. 슬라이스는 outbox 만 추가.
CREATE TABLE IF NOT EXISTS pm_task_outbox (
  id TEXT PRIMARY KEY,
  aggregate_id TEXT NOT NULL,
  event_name TEXT NOT NULL,
  event_version INTEGER NOT NULL,
  payload TEXT NOT NULL,
  occurred_at INTEGER NOT NULL,
  scope_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
);
CREATE INDEX IF NOT EXISTS idx_pm_task_outbox_status ON pm_task_outbox(status, occurred_at);
