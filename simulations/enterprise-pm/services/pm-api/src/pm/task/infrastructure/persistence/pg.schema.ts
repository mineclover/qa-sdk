// @def.boundary sim-pm-api
// @def.doc domain-slice-architecture

import { pgSchema, text, index } from "drizzle-orm/pg-core";

/**
 * outbox 는 pm domain 공유 테이블 `sim.pm_outbox_events` 를 재사용.
 */
export { pmOutboxEvents as taskOutbox } from "../../../pg/schema.js";

const sim = pgSchema("sim");

export const tasks = sim.table(
  "pm_tasks",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").notNull(),
    title: text("title").notNull(),
    assigneeId: text("assignee_id"),
    status: text("status", { enum: ["todo", "in_progress", "done", "blocked"] }).notNull(),
    parentTaskId: text("parent_task_id"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [
    index("idx_sim_pm_task_proj").on(t.projectId),
    index("idx_sim_pm_task_parent").on(t.parentTaskId),
  ],
);
