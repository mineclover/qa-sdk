// @def.boundary sim-pm-api
// @def.doc domain-slice-architecture

import { sqliteTable, text, index } from "drizzle-orm/sqlite-core";

/**
 * SQLite schema (project slice).
 *
 * 본 테이블 (`projects`) 은 pm/sqlite/schema 의 SIM_PM_SQLITE_DDL 이 정의한다.
 * outbox 는 pm domain 공유 테이블 `pm_outbox_events` 를 재사용한다 (outbox
 * 어댑터가 service-shared schema 를 직접 import; alias re-export 불필요).
 */
export const projects = sqliteTable(
  "projects",
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
    index("idx_proj_owner").on(t.ownerId),
    index("idx_proj_dept").on(t.departmentId),
  ],
);
