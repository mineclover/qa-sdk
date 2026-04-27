// @def.boundary sim-pm-api
// @def.doc sim-erp-pm-design

import { sqliteTable, text, integer, primaryKey, index } from "drizzle-orm/sqlite-core";

/**
 * Phase 3 — pm domain 의 모든 슬라이스가 공유하는 outbox 테이블.
 *
 * Slice 별 outbox factory 가 본 테이블을 참조한다. event_name 으로 슬라이스를
 * 구분 (`assignment.created`, `project.created`, `task.created`, `member.added` 등).
 * 컬럼명은 sim-domain-slice-kit/createDrizzleOutboxPort 컨벤션과 일치 (snake_case).
 */
export const pmOutboxEvents = sqliteTable(
  "pm_outbox_events",
  {
    id: text("id").primaryKey(),
    aggregate_id: text("aggregate_id").notNull(),
    event_name: text("event_name").notNull(),
    event_version: integer("event_version").notNull(),
    payload: text("payload").notNull(),
    occurred_at: integer("occurred_at").notNull(),
    scope_id: text("scope_id").notNull(),
    status: text("status", { enum: ["pending", "published", "failed"] })
      .notNull()
      .default("pending"),
  },
  (t) => [index("pm_outbox_status_idx").on(t.status, t.occurred_at)],
);

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  ownerId: text("owner_id").notNull(),
  departmentId: text("department_id").notNull(),
  status: text("status", { enum: ["draft", "active", "archived"] }).notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (t) => [
  index("idx_proj_owner").on(t.ownerId),
  index("idx_proj_dept").on(t.departmentId),
]);

export const tasks = sqliteTable("tasks", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull(),
  title: text("title").notNull(),
  assigneeId: text("assignee_id"),
  status: text("status", { enum: ["todo", "in_progress", "done", "blocked"] }).notNull(),
  parentTaskId: text("parent_task_id"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (t) => [
  index("idx_task_proj").on(t.projectId),
  index("idx_task_parent").on(t.parentTaskId),
]);

export const projectMembers = sqliteTable("project_members", {
  projectId: text("project_id").notNull(),
  userId: text("user_id").notNull(),
  role: text("role", { enum: ["lead", "contributor", "viewer"] }).notNull(),
  joinedAt: text("joined_at").notNull(),
}, (t) => [
  primaryKey({ columns: [t.projectId, t.userId] }),
  index("idx_pm_user").on(t.userId),
]);

export const SIM_PM_SQLITE_DDL = `
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

CREATE TABLE IF NOT EXISTS pm_outbox_events (
  id TEXT PRIMARY KEY,
  aggregate_id TEXT NOT NULL,
  event_name TEXT NOT NULL,
  event_version INTEGER NOT NULL,
  payload TEXT NOT NULL,
  occurred_at INTEGER NOT NULL,
  scope_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
);
CREATE INDEX IF NOT EXISTS pm_outbox_status_idx ON pm_outbox_events(status, occurred_at);
`;
