-- @def.boundary sim-pm-api
-- Plan 11b — SQLite 초기 스키마. SIM_PM_SQLITE_DDL 복사본.
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY, name TEXT NOT NULL,
  owner_id TEXT NOT NULL, department_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft','active','archived')),
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_proj_owner ON projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_proj_dept ON projects(department_id);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY, project_id TEXT NOT NULL, title TEXT NOT NULL,
  assignee_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('todo','in_progress','done','blocked')),
  parent_task_id TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_task_proj ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_task_parent ON tasks(parent_task_id);

CREATE TABLE IF NOT EXISTS project_members (
  project_id TEXT NOT NULL, user_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('lead','contributor','viewer')),
  joined_at TEXT NOT NULL,
  PRIMARY KEY (project_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_pm_user ON project_members(user_id);
