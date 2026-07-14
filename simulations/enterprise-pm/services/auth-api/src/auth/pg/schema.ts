// @def.boundary sim-auth-api
// @def.doc sim-erp-pm-design

import { pgSchema, primaryKey, index, text } from 'drizzle-orm/pg-core';

const sim = pgSchema('sim');

export const users = sim.table(
  'auth_users',
  {
    id: text('id').primaryKey(),
    email: text('email').notNull().unique(),
    displayName: text('display_name').notNull(),
    departmentId: text('department_id'),
    primaryRoleId: text('primary_role_id'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [index('idx_sim_users_dept').on(t.departmentId)],
);

export const departments = sim.table(
  'auth_departments',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    parentId: text('parent_id'),
    managerId: text('manager_id'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [index('idx_sim_dept_parent').on(t.parentId)],
);

export const roles = sim.table('auth_roles', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  scopeType: text('scope_type', { enum: ['global', 'department', 'project'] }).notNull(),
  defaultMaskHex: text('default_mask_hex').notNull(),
  createdAt: text('created_at').notNull(),
});

export const roleAssignments = sim.table(
  'auth_role_assignments',
  {
    userId: text('user_id').notNull(),
    roleId: text('role_id').notNull(),
    scopeType: text('scope_type', { enum: ['global', 'department', 'project'] }).notNull(),
    /**
     * scope_id — PG PRIMARY KEY가 NOT NULL을 강제하므로 sentinel ''을 사용.
     * 어댑터 ↔ port interface 경계에서 '' ↔ null 매핑(encodeScopeId/decodeScopeId).
     */
    scopeId: text('scope_id').notNull().default(''),
    assignedAt: text('assigned_at').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.roleId, t.scopeType, t.scopeId] }),
    index('idx_sim_ra_user').on(t.userId),
  ],
);

/** PG DDL — drizzle-kit migration 또는 테스트 fixture가 사용. */
export const SIM_AUTH_PG_DDL = `
CREATE SCHEMA IF NOT EXISTS sim;

CREATE TABLE IF NOT EXISTS sim.auth_users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  department_id TEXT,
  primary_role_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sim_users_dept ON sim.auth_users(department_id);

CREATE TABLE IF NOT EXISTS sim.auth_departments (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  parent_id TEXT,
  manager_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sim_dept_parent ON sim.auth_departments(parent_id);

CREATE TABLE IF NOT EXISTS sim.auth_roles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  scope_type TEXT NOT NULL CHECK (scope_type IN ('global','department','project')),
  default_mask_hex TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sim.auth_role_assignments (
  user_id TEXT NOT NULL,
  role_id TEXT NOT NULL,
  scope_type TEXT NOT NULL CHECK (scope_type IN ('global','department','project')),
  scope_id TEXT NOT NULL DEFAULT '',
  assigned_at TEXT NOT NULL,
  PRIMARY KEY (user_id, role_id, scope_type, scope_id)
);
CREATE INDEX IF NOT EXISTS idx_sim_ra_user ON sim.auth_role_assignments(user_id);
`;

/** 테스트용 reset DDL — drop + recreate + CHECK/INDEX. */
export const SIM_AUTH_PG_RESET_DDL = `
DROP TABLE IF EXISTS sim.auth_role_assignments CASCADE;
DROP TABLE IF EXISTS sim.auth_roles CASCADE;
DROP TABLE IF EXISTS sim.auth_users CASCADE;
DROP TABLE IF EXISTS sim.auth_departments CASCADE;

CREATE TABLE sim.auth_users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  department_id TEXT,
  primary_role_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_sim_users_dept ON sim.auth_users(department_id);

CREATE TABLE sim.auth_departments (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  parent_id TEXT,
  manager_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_sim_dept_parent ON sim.auth_departments(parent_id);

CREATE TABLE sim.auth_roles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  scope_type TEXT NOT NULL CHECK (scope_type IN ('global','department','project')),
  default_mask_hex TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE sim.auth_role_assignments (
  user_id TEXT NOT NULL,
  role_id TEXT NOT NULL,
  scope_type TEXT NOT NULL CHECK (scope_type IN ('global','department','project')),
  scope_id TEXT NOT NULL DEFAULT '',
  assigned_at TEXT NOT NULL,
  PRIMARY KEY (user_id, role_id, scope_type, scope_id)
);
CREATE INDEX idx_sim_ra_user ON sim.auth_role_assignments(user_id);
`;
