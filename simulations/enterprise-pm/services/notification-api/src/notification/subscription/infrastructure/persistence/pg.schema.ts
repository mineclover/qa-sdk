// @def.boundary sim-notification-api
// @def.doc domain-slice-architecture

import { pgSchema, text, boolean, bigint, primaryKey, index } from "drizzle-orm/pg-core";

const sim = pgSchema("sim");

export const subscriptions = sim.table(
  "notif_subscriptions",
  {
    userId: text("user_id").notNull(),
    eventType: text("event_type").notNull(),
    channel: text("channel", { enum: ["in_app", "email"] }).notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: text("created_at").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.eventType] }),
    index("idx_sim_notif_sub_event").on(t.eventType),
  ],
);

/**
 * Shared outbox — `sim.notification_outbox_events`. notification 슬라이스의
 * 정의와 동일한 물리 테이블을 가리킨다.
 */
export const notificationOutbox = sim.table(
  "notification_outbox_events",
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
);

export const SIM_NOTIF_SUBSCRIPTION_PG_DDL = `
CREATE SCHEMA IF NOT EXISTS sim;

CREATE TABLE IF NOT EXISTS sim.notif_subscriptions (
  user_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('in_app','email')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, event_type)
);
CREATE INDEX IF NOT EXISTS idx_sim_notif_sub_event ON sim.notif_subscriptions(event_type);
`;
