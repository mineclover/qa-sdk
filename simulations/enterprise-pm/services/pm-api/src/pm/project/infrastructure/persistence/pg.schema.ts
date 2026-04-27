// @def.boundary sim-pm-api
// @def.doc domain-slice-architecture

import { pgSchema, text, index } from "drizzle-orm/pg-core";

/**
 * outbox 는 pm domain 공유 테이블 `sim.pm_outbox_events` 를 재사용.
 */
export { pmOutboxEvents as projectOutbox } from "../../../pg/schema.js";

const sim = pgSchema("sim");

export const projects = sim.table(
  "pm_projects",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    ownerId: text("owner_id").notNull(),
    departmentId: text("department_id").notNull(),
    status: text("status", { enum: ["draft", "active", "archived"] }).notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [
    index("idx_sim_pm_proj_owner").on(t.ownerId),
    index("idx_sim_pm_proj_dept").on(t.departmentId),
  ],
);
