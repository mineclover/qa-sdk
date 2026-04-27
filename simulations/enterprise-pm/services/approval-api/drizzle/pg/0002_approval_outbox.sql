-- @def.boundary sim-approval-api
-- Phase 2 — approval slices 가 공유하는 outbox 테이블 (Postgres / sim namespace).
CREATE SCHEMA IF NOT EXISTS sim;

CREATE TABLE IF NOT EXISTS sim.approval_outbox_events (
  id TEXT PRIMARY KEY,
  aggregate_id TEXT NOT NULL,
  event_name TEXT NOT NULL,
  event_version BIGINT NOT NULL,
  payload TEXT NOT NULL,
  occurred_at BIGINT NOT NULL,
  scope_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
);
CREATE INDEX IF NOT EXISTS approval_outbox_status_idx ON sim.approval_outbox_events(status, occurred_at);
