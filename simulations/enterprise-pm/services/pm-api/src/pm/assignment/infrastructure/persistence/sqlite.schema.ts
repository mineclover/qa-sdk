// @def.boundary sim-pm-api
// @def.doc domain-slice-architecture

import { sqliteTable, text, index } from "drizzle-orm/sqlite-core";

/**
 * SQLite schema (assignment slice).
 *
 * 컨벤션:
 *   - 테이블명 snake_case, prefix=pm_ (sim 환경 namespace)
 *   - 컬럼명 snake_case
 *   - 시간은 ISO-8601 TEXT (다른 pm-api 슬라이스와 동일 규칙)
 *
 * outbox 테이블은 pm-api 의 모든 슬라이스가 공유하는 `pm_outbox_events` 를
 * 사용한다 (다른 sim-* 서비스의 service-shared outbox 패턴과 일치). 슬라이스
 * 구분은 event_name (`assignment.created` 등) 으로 한다.
 */
export { pmOutboxEvents as assignmentOutbox } from "../../../sqlite/schema.js";

export const assignments = sqliteTable(
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
    index("idx_pm_assignment_project").on(t.projectId),
    index("idx_pm_assignment_manager").on(t.managerId),
  ],
);

/**
 * Assignment 슬라이스의 본 테이블 DDL. outbox 는 pm/sqlite/schema 의
 * SIM_PM_SQLITE_DDL 이 책임진다.
 */
export const SIM_PM_ASSIGNMENT_SQLITE_DDL = `
CREATE TABLE IF NOT EXISTS pm_assignments (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  manager_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft','assigned','cancelled')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pm_assignment_project ON pm_assignments(project_id);
CREATE INDEX IF NOT EXISTS idx_pm_assignment_manager ON pm_assignments(manager_id);
`;
