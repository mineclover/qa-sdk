// @def.boundary sim-auth-api
// @def.doc domain-slice-architecture

import { pgSchema, text, index } from "drizzle-orm/pg-core";

const sim = pgSchema("sim");

export const departments = sim.table(
  "auth_departments",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    parentId: text("parent_id"),
    managerId: text("manager_id"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [index("idx_sim_dept_parent").on(t.parentId)],
);

export const SIM_AUTH_DEPARTMENT_PG_DDL = `
CREATE SCHEMA IF NOT EXISTS sim;

CREATE TABLE IF NOT EXISTS sim.auth_departments (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  parent_id TEXT,
  manager_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sim_dept_parent ON sim.auth_departments(parent_id);
`;
