-- @def.boundary sim-approval-api
-- Phase 2 — approval slices 가 공유하는 outbox 테이블 (SQLite).
-- 컬럼명은 sim-domain-slice-kit/createDrizzleOutboxPort 컨벤션과 일치 (snake_case).
CREATE TABLE IF NOT EXISTS approval_outbox_events (
  id TEXT PRIMARY KEY,
  aggregate_id TEXT NOT NULL,
  event_name TEXT NOT NULL,
  event_version INTEGER NOT NULL,
  payload TEXT NOT NULL,
  occurred_at INTEGER NOT NULL,
  scope_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
);
CREATE INDEX IF NOT EXISTS approval_outbox_status_idx ON approval_outbox_events(status, occurred_at);
