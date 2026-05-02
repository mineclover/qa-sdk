// @def.boundary sim-approval-api
// @def.doc domain-slice-architecture

import { sqliteTable, text } from "drizzle-orm/sqlite-core";

export const resourceRequests = sqliteTable("resource_requests", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull(),
  requesterId: text("requester_id").notNull(),
  resourceType: text("resource_type").notNull(),
  description: text("description").notNull(),
  status: text("status", {
    enum: ["draft", "submitted", "in_review", "approved", "rejected", "revision_requested"],
  }).notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const SIM_APPROVAL_RESOURCE_SQLITE_DDL = `
CREATE TABLE IF NOT EXISTS resource_requests (
  id TEXT PRIMARY KEY, project_id TEXT NOT NULL, requester_id TEXT NOT NULL,
  resource_type TEXT NOT NULL, description TEXT NOT NULL,
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
  status TEXT NOT NULL DEFAULT 'pending',
  idempotency_key TEXT NOT NULL DEFAULT '',
  dispatched_at INTEGER,
  retry_count INTEGER NOT NULL DEFAULT 0,
  next_attempt_at INTEGER
);
CREATE INDEX IF NOT EXISTS approval_outbox_status_idx ON approval_outbox_events(status, occurred_at);
`;
