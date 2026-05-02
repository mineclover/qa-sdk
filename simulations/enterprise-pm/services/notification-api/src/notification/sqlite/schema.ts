// @def.boundary sim-notification-api
// @def.doc sim-erp-pm-design

import { sqliteTable, text, integer, primaryKey, index } from "drizzle-orm/sqlite-core";

export const notifications = sqliteTable("notifications", {
  id: text("id").primaryKey(),
  recipientUserId: text("recipient_user_id").notNull(),
  type: text("type").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  status: text("status", { enum: ["pending", "sent", "read", "failed"] }).notNull(),
  createdAt: text("created_at").notNull(),
  sentAt: text("sent_at"),
  readAt: text("read_at"),
}, (t) => [
  index("idx_notif_recipient").on(t.recipientUserId),
  index("idx_notif_status").on(t.status),
]);

export const subscriptions = sqliteTable("subscriptions", {
  userId: text("user_id").notNull(),
  eventType: text("event_type").notNull(),
  channel: text("channel", { enum: ["in_app", "email"] }).notNull(),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull(),
}, (t) => [
  primaryKey({ columns: [t.userId, t.eventType] }),
  index("idx_sub_event").on(t.eventType),
]);

export const SIM_NOTIF_SQLITE_DDL = `
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  recipient_user_id TEXT NOT NULL,
  type TEXT NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending','sent','read','failed')),
  created_at TEXT NOT NULL, sent_at TEXT, read_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_notif_recipient ON notifications(recipient_user_id);
CREATE INDEX IF NOT EXISTS idx_notif_status ON notifications(status);

CREATE TABLE IF NOT EXISTS subscriptions (
  user_id TEXT NOT NULL, event_type TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('in_app','email')),
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, event_type)
);
CREATE INDEX IF NOT EXISTS idx_sub_event ON subscriptions(event_type);
`;

/** event-type matching helper — 정확 일치 + "<domain>.*" wildcard. */
export function matchesEventType(pattern: string, actual: string): boolean {
  if (pattern === actual) return true;
  if (pattern.endsWith(".*")) {
    const prefix = pattern.slice(0, -2);
    return actual.startsWith(prefix + ".");
  }
  return false;
}
