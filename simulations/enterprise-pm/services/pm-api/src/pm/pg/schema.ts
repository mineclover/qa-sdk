// @def.boundary sim-pm-api
// @def.doc sim-erp-pm-design

import { pgSchema, primaryKey, index, text } from "drizzle-orm/pg-core";

const sim = pgSchema("sim");

export const projects = sim.table("pm_projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  ownerId: text("owner_id").notNull(),
  departmentId: text("department_id").notNull(),
  status: text("status", { enum: ["draft", "active", "archived"] }).notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (t) => [
  index("idx_sim_pm_proj_owner").on(t.ownerId),
  index("idx_sim_pm_proj_dept").on(t.departmentId),
]);

export const tasks = sim.table("pm_tasks", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull(),
  title: text("title").notNull(),
  assigneeId: text("assignee_id"),
  status: text("status", { enum: ["todo", "in_progress", "done", "blocked"] }).notNull(),
  parentTaskId: text("parent_task_id"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (t) => [
  index("idx_sim_pm_task_proj").on(t.projectId),
  index("idx_sim_pm_task_parent").on(t.parentTaskId),
]);

export const projectMembers = sim.table("pm_project_members", {
  projectId: text("project_id").notNull(),
  userId: text("user_id").notNull(),
  role: text("role", { enum: ["lead", "contributor", "viewer"] }).notNull(),
  joinedAt: text("joined_at").notNull(),
}, (t) => [
  primaryKey({ columns: [t.projectId, t.userId] }),
  index("idx_sim_pm_member_user").on(t.userId),
]);

export const SIM_PM_PG_DDL = `
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
`;

export const SIM_PM_PG_RESET_DDL = `
DROP TABLE IF EXISTS sim.pm_project_members CASCADE;
DROP TABLE IF EXISTS sim.pm_tasks CASCADE;
DROP TABLE IF EXISTS sim.pm_projects CASCADE;

CREATE TABLE sim.pm_projects (
  id TEXT PRIMARY KEY, name TEXT NOT NULL,
  owner_id TEXT NOT NULL, department_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft','active','archived')),
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX idx_sim_pm_proj_owner ON sim.pm_projects(owner_id);
CREATE INDEX idx_sim_pm_proj_dept ON sim.pm_projects(department_id);

CREATE TABLE sim.pm_tasks (
  id TEXT PRIMARY KEY, project_id TEXT NOT NULL, title TEXT NOT NULL,
  assignee_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('todo','in_progress','done','blocked')),
  parent_task_id TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX idx_sim_pm_task_proj ON sim.pm_tasks(project_id);
CREATE INDEX idx_sim_pm_task_parent ON sim.pm_tasks(parent_task_id);

CREATE TABLE sim.pm_project_members (
  project_id TEXT NOT NULL, user_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('lead','contributor','viewer')),
  joined_at TEXT NOT NULL,
  PRIMARY KEY (project_id, user_id)
);
CREATE INDEX idx_sim_pm_member_user ON sim.pm_project_members(user_id);
`;
