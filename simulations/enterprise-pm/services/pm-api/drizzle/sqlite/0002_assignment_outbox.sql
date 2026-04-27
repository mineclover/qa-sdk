-- @def.boundary sim-pm-api
-- Phase 1 — assignment slice 의 본 테이블 + outbox 테이블 SQLite 추가.
-- 컬럼명은 sim-domain-slice-kit/createDrizzleOutboxPort 컨벤션과 일치 (snake_case).
CREATE TABLE IF NOT EXISTS pm_assignments (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  manager_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft','assigned','cancelled')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pm_assignment_project ON pm_assignments(project_id);
CREATE INDEX IF NOT EXISTS idx_pm_assignment_manager ON pm_assignments(manager_id);

CREATE TABLE IF NOT EXISTS pm_assignment_outbox (
  id TEXT PRIMARY KEY,
  aggregate_id TEXT NOT NULL,
  event_name TEXT NOT NULL,
  event_version INTEGER NOT NULL,
  payload TEXT NOT NULL,
  occurred_at INTEGER NOT NULL,
  scope_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
);
CREATE INDEX IF NOT EXISTS idx_pm_assignment_outbox_status ON pm_assignment_outbox(status, occurred_at);
