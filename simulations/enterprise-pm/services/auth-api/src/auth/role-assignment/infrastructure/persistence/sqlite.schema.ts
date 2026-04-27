// @def.boundary sim-auth-api
// @def.doc domain-slice-architecture

import { sqliteTable, text, primaryKey, index } from "drizzle-orm/sqlite-core";

export const roleAssignments = sqliteTable(
  "role_assignments",
  {
    userId: text("user_id").notNull(),
    roleId: text("role_id").notNull(),
    scopeType: text("scope_type", { enum: ["global", "department", "project"] }).notNull(),
    scopeId: text("scope_id"),
    assignedAt: text("assigned_at").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.roleId, t.scopeType, t.scopeId] }),
    index("idx_ra_user").on(t.userId),
  ],
);

export const SIM_AUTH_ROLE_ASSIGNMENT_SQLITE_DDL = `
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
