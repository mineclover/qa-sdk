// @def.boundary sim-pm-api
// @def.doc domain-slice-architecture

import { sqliteTable, text, primaryKey, index } from "drizzle-orm/sqlite-core";

/**
 * SQLite schema (member slice).
 *
 * 본 테이블 (`project_members`) 은 pm/sqlite/schema 의 SIM_PM_SQLITE_DDL 이 정의한다.
 * outbox 는 pm domain 공유 테이블 `pm_outbox_events` 를 재사용한다.
 */
export { pmOutboxEvents as memberOutbox } from "../../../sqlite/schema.js";

export const projectMembers = sqliteTable(
  "project_members",
  {
    projectId: text("project_id").notNull(),
    userId: text("user_id").notNull(),
    role: text("role", { enum: ["lead", "contributor", "viewer"] }).notNull(),
    joinedAt: text("joined_at").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.projectId, t.userId] }),
    index("idx_pm_user").on(t.userId),
  ],
);
