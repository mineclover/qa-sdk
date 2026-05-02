// @def.boundary sim-auth-api
// @def.doc domain-slice-architecture

import { pgSchema, text, primaryKey, index } from "drizzle-orm/pg-core";

const sim = pgSchema("sim");

export const roleAssignments = sim.table(
  "auth_role_assignments",
  {
    userId: text("user_id").notNull(),
    roleId: text("role_id").notNull(),
    scopeType: text("scope_type", { enum: ["global", "department", "project"] }).notNull(),
    /** PG PRIMARY KEY 가 NOT NULL 강제 — sentinel '' 사용. */
    scopeId: text("scope_id").notNull().default(""),
    assignedAt: text("assigned_at").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.roleId, t.scopeType, t.scopeId] }),
    index("idx_sim_ra_user").on(t.userId),
  ],
);

export const SIM_AUTH_ROLE_ASSIGNMENT_PG_DDL = `
CREATE SCHEMA IF NOT EXISTS sim;

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
