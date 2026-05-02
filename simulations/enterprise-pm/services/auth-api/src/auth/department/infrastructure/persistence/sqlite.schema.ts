// @def.boundary sim-auth-api
// @def.doc domain-slice-architecture

import { sqliteTable, text, index } from "drizzle-orm/sqlite-core";

export const departments = sqliteTable(
  "departments",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    parentId: text("parent_id"),
    managerId: text("manager_id"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [index("idx_dept_parent").on(t.parentId)],
);

export const SIM_AUTH_DEPARTMENT_SQLITE_DDL = `
CREATE TABLE IF NOT EXISTS departments (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  parent_id TEXT,
  manager_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_dept_parent ON departments(parent_id);
`;
