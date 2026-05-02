// @def.boundary sim-auth-api
// @def.doc domain-slice-architecture

import { pgSchema, text, bigint, index } from "drizzle-orm/pg-core";

/**
 * Postgres — auth 도메인의 ONE shared outbox table.
 *
 * 6 슬라이스가 sim.auth_outbox_events 에 함께 적재한다. snake_case 컬럼명
 * (Phase 1 caveat 5).
 */
const sim = pgSchema("sim");

export const authOutboxEvents = sim.table(
  "auth_outbox_events",
  {
    id: text("id").primaryKey(),
    aggregate_id: text("aggregate_id").notNull(),
    event_name: text("event_name").notNull(),
    event_version: bigint("event_version", { mode: "number" }).notNull(),
    payload: text("payload").notNull(),
    occurred_at: bigint("occurred_at", { mode: "number" }).notNull(),
    scope_id: text("scope_id").notNull(),
    status: text("status", { enum: ["pending", "published", "failed"] })
      .notNull()
      .default("pending"),
  },
  (t) => [index("idx_sim_auth_outbox_status").on(t.status, t.occurred_at)],
);

export const SIM_AUTH_OUTBOX_PG_DDL = `
CREATE SCHEMA IF NOT EXISTS sim;

CREATE TABLE IF NOT EXISTS sim.auth_outbox_events (
  id TEXT PRIMARY KEY,
  aggregate_id TEXT NOT NULL,
  event_name TEXT NOT NULL,
  event_version BIGINT NOT NULL,
  payload TEXT NOT NULL,
  occurred_at BIGINT NOT NULL,
  scope_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
);
CREATE INDEX IF NOT EXISTS idx_sim_auth_outbox_status ON sim.auth_outbox_events(status, occurred_at);
`;
