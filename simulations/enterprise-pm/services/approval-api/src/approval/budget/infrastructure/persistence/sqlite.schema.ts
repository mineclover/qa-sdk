// @def.boundary sim-approval-api
// @def.doc domain-slice-architecture

import { sqliteTable, text, integer, real, index } from "drizzle-orm/sqlite-core";

export { approvalOutboxEvents as approvalOutbox } from "../../../sqlite/schema.js";

/**
 * SQLite schema (budget slice).
 *
 * 컨벤션:
 *   - 테이블명 snake_case, 슬라이스 prefix 없음 (legacy 와 호환: budget_requests)
 *   - 컬럼명 snake_case
 *   - 시간은 ISO-8601 TEXT
 */
export const budgetRequests = sqliteTable(
  "budget_requests",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").notNull(),
    projectDepartmentId: text("project_department_id").notNull().default(""),
    amount: real("amount").notNull(),
    requesterId: text("requester_id").notNull(),
    status: text("status", {
      enum: ["draft", "submitted", "in_review", "approved", "rejected", "revision_requested"],
    }).notNull(),
    currentStage: integer("current_stage").notNull(),
    totalStages: integer("total_stages").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [
    index("idx_br_proj").on(t.projectId),
    index("idx_br_req").on(t.requesterId),
  ],
);

export const SIM_APPROVAL_BUDGET_SQLITE_DDL = `
CREATE TABLE IF NOT EXISTS budget_requests (
  id TEXT PRIMARY KEY, project_id TEXT NOT NULL,
  project_department_id TEXT NOT NULL DEFAULT '',
  amount REAL NOT NULL,
  requester_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft','submitted','in_review','approved','rejected','revision_requested')),
  current_stage INTEGER NOT NULL, total_stages INTEGER NOT NULL,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_br_proj ON budget_requests(project_id);
CREATE INDEX IF NOT EXISTS idx_br_req ON budget_requests(requester_id);

CREATE TABLE IF NOT EXISTS approval_outbox_events (
  id TEXT PRIMARY KEY,
  aggregate_id TEXT NOT NULL,
  event_name TEXT NOT NULL,
  event_version INTEGER NOT NULL,
  payload TEXT NOT NULL,
  occurred_at INTEGER NOT NULL,
  scope_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
);
CREATE INDEX IF NOT EXISTS approval_outbox_status_idx ON approval_outbox_events(status, occurred_at);
`;
