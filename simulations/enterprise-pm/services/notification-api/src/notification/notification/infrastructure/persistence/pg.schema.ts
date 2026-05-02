// @def.boundary sim-notification-api
// @def.doc domain-slice-architecture

import { pgSchema, text, bigint, index } from "drizzle-orm/pg-core";

/**
 * Postgres schema (notification slice).
 *
 * sim namespace, prefix=notif_. 컬럼명 snake_case.
 * outbox 는 슬라이스간 공유 테이블 (notification_outbox_events).
 */
const sim = pgSchema("sim");

export const notifications = sim.table(
  "notif_notifications",
  {
    id: text("id").primaryKey(),
    recipientUserId: text("recipient_user_id").notNull(),
    type: text("type").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    status: text("status", { enum: ["pending", "sent", "read", "failed"] }).notNull(),
    createdAt: text("created_at").notNull(),
    sentAt: text("sent_at"),
    readAt: text("read_at"),
  },
  (t) => [
    index("idx_sim_notif_recipient").on(t.recipientUserId),
    index("idx_sim_notif_status").on(t.status),
  ],
);

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
  (t) => [index("idx_sim_notification_outbox_status").on(t.status, t.occurred_at)],
);

export const SIM_NOTIF_NOTIFICATION_PG_DDL = `
CREATE SCHEMA IF NOT EXISTS sim;

CREATE TABLE IF NOT EXISTS sim.notif_notifications (
  id TEXT PRIMARY KEY,
  recipient_user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending','sent','read','failed')),
  created_at TEXT NOT NULL,
  sent_at TEXT,
  read_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_sim_notif_recipient ON sim.notif_notifications(recipient_user_id);
CREATE INDEX IF NOT EXISTS idx_sim_notif_status ON sim.notif_notifications(status);
`;

export const SIM_NOTIF_OUTBOX_PG_DDL = `
CREATE SCHEMA IF NOT EXISTS sim;

CREATE TABLE IF NOT EXISTS sim.notification_outbox_events (
  id TEXT PRIMARY KEY,
  aggregate_id TEXT NOT NULL,
  event_name TEXT NOT NULL,
  event_version BIGINT NOT NULL,
  payload TEXT NOT NULL,
  occurred_at BIGINT NOT NULL,
  scope_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
);
CREATE INDEX IF NOT EXISTS idx_sim_notification_outbox_status ON sim.notification_outbox_events(status, occurred_at);
`;
