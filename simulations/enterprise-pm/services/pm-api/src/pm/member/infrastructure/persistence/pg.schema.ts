// @def.boundary sim-pm-api
// @def.doc domain-slice-architecture

import { pgSchema, text, primaryKey, index } from 'drizzle-orm/pg-core';

const sim = pgSchema('sim');

export const projectMembers = sim.table(
  'pm_project_members',
  {
    projectId: text('project_id').notNull(),
    userId: text('user_id').notNull(),
    role: text('role', { enum: ['lead', 'contributor', 'viewer'] }).notNull(),
    joinedAt: text('joined_at').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.projectId, t.userId] }),
    index('idx_sim_pm_member_user').on(t.userId),
  ],
);
