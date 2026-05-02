-- @def.boundary sim-auth-api
-- Phase 2 — auth 도메인 6 슬라이스가 공유하는 단일 outbox table 추가.
-- 컬럼명은 sim-domain-slice-kit/createDrizzleOutboxPort 컨벤션과 일치 (snake_case).
CREATE TABLE IF NOT EXISTS auth_outbox_events (
  id TEXT PRIMARY KEY,
  aggregate_id TEXT NOT NULL,
  event_name TEXT NOT NULL,
  event_version INTEGER NOT NULL,
  payload TEXT NOT NULL,
  occurred_at INTEGER NOT NULL,
  scope_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
);
CREATE INDEX IF NOT EXISTS idx_auth_outbox_status ON auth_outbox_events(status, occurred_at);
