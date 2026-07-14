// @def.boundary sim-auth-api
// @def.doc domain-slice-architecture

import { pgSchema, text, index } from 'drizzle-orm/pg-core';

/**
 * Postgres schema (user slice).
 *
 * 기존 auth pg/schema.ts 와 동일한 sim namespace + 동일 테이블/컬럼셋.
 */
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

export const SIM_AUTH_USER_PG_DDL = `
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
`;
