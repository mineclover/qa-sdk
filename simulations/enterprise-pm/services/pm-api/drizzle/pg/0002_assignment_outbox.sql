-- @def.boundary sim-pm-api
-- Phase 1 — assignment slice 의 본 테이블 + outbox 테이블 Postgres 추가.
CREATE SCHEMA IF NOT EXISTS sim;

CREATE TABLE IF NOT EXISTS sim.pm_assignments (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  manager_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft','assigned','cancelled')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sim_pm_assignment_project ON sim.pm_assignments(project_id);
CREATE INDEX IF NOT EXISTS idx_sim_pm_assignment_manager ON sim.pm_assignments(manager_id);

CREATE TABLE IF NOT EXISTS sim.pm_assignment_outbox (
  id TEXT PRIMARY KEY,
  aggregate_id TEXT NOT NULL,
  event_name TEXT NOT NULL,
  event_version BIGINT NOT NULL,
  payload TEXT NOT NULL,
  occurred_at BIGINT NOT NULL,
  scope_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
);
CREATE INDEX IF NOT EXISTS idx_sim_pm_assignment_outbox_status ON sim.pm_assignment_outbox(status, occurred_at);
