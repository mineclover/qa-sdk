// @def.boundary sim-pm-api
// @def.doc domain-slice-architecture

import { pgSchema, text, index } from "drizzle-orm/pg-core";

/**
 * Postgres schema (assignment slice).
 *
 * 기존 pm pg/schema.ts 와 동일한 sim namespace 사용. 컬럼명 snake_case.
 * outbox 는 pm-api domain 공유 테이블 `sim.pm_outbox_events` 를 재사용한다
 * (outbox 어댑터가 service-shared schema 를 직접 import; alias re-export 불필요).
 */
const sim = pgSchema("sim");

export const assignments = sim.table(
  "pm_assignments",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").notNull(),
    managerId: text("manager_id").notNull(),
    status: text("status", { enum: ["draft", "assigned", "cancelled"] }).notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [
    index("idx_sim_pm_assignment_project").on(t.projectId),
    index("idx_sim_pm_assignment_manager").on(t.managerId),
  ],
);

export const SIM_PM_ASSIGNMENT_PG_DDL = `
CREATE SCHEMA IF NOT EXISTS sim;

CREATE TABLE IF NOT EXISTS sim.pm_assignments (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  manager_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft','assigned','cancelled')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sim_pm_assignment_project ON sim.pm_assignments(project_id);
CREATE INDEX IF NOT EXISTS idx_sim_pm_assignment_manager ON sim.pm_assignments(manager_id);
`;
