// @def.boundary sim-pm-api
// @def.doc domain-slice-architecture

import { sqliteTable, text, index } from 'drizzle-orm/sqlite-core';

/**
 * SQLite schema (task slice).
 *
 * 본 테이블 (`tasks`) 은 pm/sqlite/schema 의 SIM_PM_SQLITE_DDL 이 정의한다.
 * outbox 는 pm domain 공유 테이블 `pm_outbox_events` 를 재사용한다 (outbox
 * 어댑터가 service-shared schema 를 직접 import; alias re-export 불필요).
 */
export const tasks = sqliteTable(
  'tasks',
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
  (t) => [index('idx_task_proj').on(t.projectId), index('idx_task_parent').on(t.parentTaskId)],
);
