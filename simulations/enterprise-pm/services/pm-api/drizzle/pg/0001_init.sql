-- @def.boundary sim-pm-api
-- Plan 11b — PG 초기 스키마. SIM_PM_PG_DDL 복사본.
CREATE SCHEMA IF NOT EXISTS sim;

CREATE TABLE IF NOT EXISTS sim.pm_projects (
  id TEXT PRIMARY KEY, name TEXT NOT NULL,
  owner_id TEXT NOT NULL, department_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft','active','archived')),
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sim_pm_proj_owner ON sim.pm_projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_sim_pm_proj_dept ON sim.pm_projects(department_id);

CREATE TABLE IF NOT EXISTS sim.pm_tasks (
  id TEXT PRIMARY KEY, project_id TEXT NOT NULL, title TEXT NOT NULL,
  assignee_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('todo','in_progress','done','blocked')),
  parent_task_id TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sim_pm_task_proj ON sim.pm_tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_sim_pm_task_parent ON sim.pm_tasks(parent_task_id);

CREATE TABLE IF NOT EXISTS sim.pm_project_members (
  project_id TEXT NOT NULL, user_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('lead','contributor','viewer')),
  joined_at TEXT NOT NULL,
  PRIMARY KEY (project_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_sim_pm_member_user ON sim.pm_project_members(user_id);
