// @def.boundary sim-pm-api
// @def.doc domain-slice-architecture

import { pgSchema, text, index } from 'drizzle-orm/pg-core';

const sim = pgSchema('sim');

export const tasks = sim.table(
  'pm_tasks',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id').notNull(),
    title: text('title').notNull(),
    assigneeId: text('assignee_id'),
    status: text('status', { enum: ['todo', 'in_progress', 'done', 'blocked'] }).notNull(),
    parentTaskId: text('parent_task_id'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [
    index('idx_sim_pm_task_proj').on(t.projectId),
    index('idx_sim_pm_task_parent').on(t.parentTaskId),
  ],
);
