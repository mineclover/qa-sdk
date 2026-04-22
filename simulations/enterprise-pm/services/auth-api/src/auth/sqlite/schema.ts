// @def.boundary sim-auth-api
// @def.doc sim-erp-pm-design

import { sqliteTable, text, primaryKey, index } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  displayName: text("display_name").notNull(),
  departmentId: text("department_id"),
  primaryRoleId: text("primary_role_id"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (t) => [index("idx_users_dept").on(t.departmentId)]);

export const departments = sqliteTable("departments", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  parentId: text("parent_id"),
  managerId: text("manager_id"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (t) => [index("idx_dept_parent").on(t.parentId)]);

export const roles = sqliteTable("roles", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  scopeType: text("scope_type", { enum: ["global", "department", "project"] }).notNull(),
  defaultMaskHex: text("default_mask_hex").notNull(),
  createdAt: text("created_at").notNull(),
});

export const roleAssignments = sqliteTable("role_assignments", {
  userId: text("user_id").notNull(),
  roleId: text("role_id").notNull(),
  scopeType: text("scope_type", { enum: ["global", "department", "project"] }).notNull(),
  scopeId: text("scope_id"),
  assignedAt: text("assigned_at").notNull(),
}, (t) => [
  primaryKey({ columns: [t.userId, t.roleId, t.scopeType, t.scopeId] }),
  index("idx_ra_user").on(t.userId),
]);

export const SIM_AUTH_SQLITE_DDL = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  department_id TEXT,
  primary_role_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_users_dept ON users(department_id);

CREATE TABLE IF NOT EXISTS departments (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  parent_id TEXT,
  manager_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_dept_parent ON departments(parent_id);

CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  scope_type TEXT NOT NULL CHECK (scope_type IN ('global','department','project')),
  default_mask_hex TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS role_assignments (
  user_id TEXT NOT NULL,
  role_id TEXT NOT NULL,
  scope_type TEXT NOT NULL CHECK (scope_type IN ('global','department','project')),
  scope_id TEXT,
  assigned_at TEXT NOT NULL,
  PRIMARY KEY (user_id, role_id, scope_type, scope_id)
);
CREATE INDEX IF NOT EXISTS idx_ra_user ON role_assignments(user_id);
`;
