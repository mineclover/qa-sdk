-- @def.boundary sim-auth-api
-- Phase 2 — auth 도메인 6 슬라이스가 공유하는 단일 outbox table 추가 (Postgres).
CREATE SCHEMA IF NOT EXISTS sim;

CREATE TABLE IF NOT EXISTS sim.auth_outbox_events (
  id TEXT PRIMARY KEY,
  aggregate_id TEXT NOT NULL,
  event_name TEXT NOT NULL,
  event_version BIGINT NOT NULL,
  payload TEXT NOT NULL,
  occurred_at BIGINT NOT NULL,
  scope_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
);
CREATE INDEX IF NOT EXISTS idx_sim_auth_outbox_status ON sim.auth_outbox_events(status, occurred_at);
