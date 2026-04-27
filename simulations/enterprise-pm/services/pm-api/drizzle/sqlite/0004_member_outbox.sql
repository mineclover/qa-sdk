-- @def.boundary sim-pm-api
-- Phase 2 — member slice 의 outbox 테이블 SQLite 추가.
-- 본 테이블 (`project_members`) 은 0001_init 에 이미 존재.
CREATE TABLE IF NOT EXISTS pm_member_outbox (
  id TEXT PRIMARY KEY,
  aggregate_id TEXT NOT NULL,
  event_name TEXT NOT NULL,
  event_version INTEGER NOT NULL,
  payload TEXT NOT NULL,
  occurred_at INTEGER NOT NULL,
  scope_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
);
CREATE INDEX IF NOT EXISTS idx_pm_member_outbox_status ON pm_member_outbox(status, occurred_at);
