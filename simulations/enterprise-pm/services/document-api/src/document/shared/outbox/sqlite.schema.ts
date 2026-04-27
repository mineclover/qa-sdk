// @def.boundary sim-document-api
// @def.doc domain-slice-architecture

import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

/**
 * Service-wide shared outbox — document/comment/version slice 가 공유.
 * snake_case 컬럼은 sim-domain-slice-kit/createDrizzleOutboxPort 컨벤션과 일치.
 */
export const documentOutboxEvents = sqliteTable(
  "document_outbox_events",
  {
    id: text("id").primaryKey(),
    aggregate_id: text("aggregate_id").notNull(),
    event_name: text("event_name").notNull(),
    event_version: integer("event_version").notNull(),
    payload: text("payload").notNull(),
    occurred_at: integer("occurred_at").notNull(),
    scope_id: text("scope_id").notNull(),
    status: text("status", { enum: ["pending", "published", "failed"] }).notNull().default("pending"),
  },
  (t) => [index("idx_document_outbox_events_status").on(t.status, t.occurred_at)],
);

export const SIM_DOC_OUTBOX_SQLITE_DDL = `
CREATE TABLE IF NOT EXISTS document_outbox_events (
  id TEXT PRIMARY KEY,
  aggregate_id TEXT NOT NULL,
  event_name TEXT NOT NULL,
  event_version INTEGER NOT NULL,
  payload TEXT NOT NULL,
  occurred_at INTEGER NOT NULL,
  scope_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
);
CREATE INDEX IF NOT EXISTS idx_document_outbox_events_status ON document_outbox_events(status, occurred_at);
`;
