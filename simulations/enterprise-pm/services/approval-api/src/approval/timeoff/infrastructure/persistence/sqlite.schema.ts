// @def.boundary sim-approval-api
// @def.doc domain-slice-architecture

import { sqliteTable, text } from "drizzle-orm/sqlite-core";

export { approvalOutboxEvents as approvalOutbox } from "../../../sqlite/schema.js";

export const timeOffRequests = sqliteTable("time_off_requests", {
  id: text("id").primaryKey(),
  requesterId: text("requester_id").notNull(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  reason: text("reason").notNull(),
  status: text("status", {
    enum: ["draft", "submitted", "in_review", "approved", "rejected", "revision_requested"],
  }).notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const SIM_APPROVAL_TIMEOFF_SQLITE_DDL = `
CREATE TABLE IF NOT EXISTS time_off_requests (
  id TEXT PRIMARY KEY, requester_id TEXT NOT NULL,
  start_date TEXT NOT NULL, end_date TEXT NOT NULL, reason TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft','submitted','in_review','approved','rejected','revision_requested')),
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);

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
