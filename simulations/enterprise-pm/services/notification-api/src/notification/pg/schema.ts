// @def.boundary sim-notification-api
// @def.doc sim-erp-pm-design

import { pgSchema, primaryKey, index, text, boolean } from 'drizzle-orm/pg-core';

const sim = pgSchema('sim');

export const notifications = sim.table(
  'notif_notifications',
  {
    id: text('id').primaryKey(),
    recipientUserId: text('recipient_user_id').notNull(),
    type: text('type').notNull(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    status: text('status', { enum: ['pending', 'sent', 'read', 'failed'] }).notNull(),
    createdAt: text('created_at').notNull(),
    sentAt: text('sent_at'),
    readAt: text('read_at'),
  },
  (t) => [
    index('idx_sim_notif_recipient').on(t.recipientUserId),
    index('idx_sim_notif_status').on(t.status),
  ],
);

export const subscriptions = sim.table(
  'notif_subscriptions',
  {
    userId: text('user_id').notNull(),
    eventType: text('event_type').notNull(),
    channel: text('channel', { enum: ['in_app', 'email'] }).notNull(),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: text('created_at').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.eventType] }),
    index('idx_sim_sub_event').on(t.eventType),
  ],
);

/** event-type matching helper — sqlite/schema.ts와 동일. */
export function matchesEventType(pattern: string, actual: string): boolean {
  if (pattern === actual) return true;
  if (pattern.endsWith('.*')) {
    const prefix = pattern.slice(0, -2);
    return actual.startsWith(prefix + '.');
  }
  return false;
}

export const SIM_NOTIF_PG_DDL = `
CREATE SCHEMA IF NOT EXISTS sim;

CREATE TABLE IF NOT EXISTS sim.notif_notifications (
  id TEXT PRIMARY KEY,
  recipient_user_id TEXT NOT NULL,
  type TEXT NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending','sent','read','failed')),
  created_at TEXT NOT NULL, sent_at TEXT, read_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_sim_notif_recipient ON sim.notif_notifications(recipient_user_id);
CREATE INDEX IF NOT EXISTS idx_sim_notif_status ON sim.notif_notifications(status);

CREATE TABLE IF NOT EXISTS sim.notif_subscriptions (
  user_id TEXT NOT NULL, event_type TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('in_app','email')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, event_type)
);
CREATE INDEX IF NOT EXISTS idx_sim_sub_event ON sim.notif_subscriptions(event_type);
`;

export const SIM_NOTIF_PG_RESET_DDL = `
DROP TABLE IF EXISTS sim.notif_subscriptions CASCADE;
DROP TABLE IF EXISTS sim.notif_notifications CASCADE;

CREATE TABLE sim.notif_notifications (
  id TEXT PRIMARY KEY,
  recipient_user_id TEXT NOT NULL,
  type TEXT NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending','sent','read','failed')),
  created_at TEXT NOT NULL, sent_at TEXT, read_at TEXT
);
CREATE INDEX idx_sim_notif_recipient ON sim.notif_notifications(recipient_user_id);
CREATE INDEX idx_sim_notif_status ON sim.notif_notifications(status);

CREATE TABLE sim.notif_subscriptions (
  user_id TEXT NOT NULL, event_type TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('in_app','email')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, event_type)
);
CREATE INDEX idx_sim_sub_event ON sim.notif_subscriptions(event_type);
`;
