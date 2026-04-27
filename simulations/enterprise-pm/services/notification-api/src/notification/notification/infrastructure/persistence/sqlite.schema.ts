// @def.boundary sim-notification-api
// @def.doc domain-slice-architecture

import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

/**
 * SQLite schema (notification slice).
 *
 * 컨벤션:
 *   - 본 테이블 prefix=notif_ (sim namespace, snake_case)
 *   - 컬럼명 snake_case
 *   - ISO-8601 TEXT 타임스탬프
 *
 * 본 슬라이스 + subscription 슬라이스가 outbox 를 공유 (shared
 * `notification_outbox_events` 테이블). outbox 정의는 본 파일에서 export.
 */
export const notifications = sqliteTable(
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
    index("idx_notif_recipient").on(t.recipientUserId),
    index("idx_notif_status").on(t.status),
  ],
);

/**
 * Shared outbox table for the notification domain.
 *
 * 본 슬라이스(notification) 와 subscription 슬라이스가 동일 테이블에 이벤트를
 * 발행한다. 컬럼명은 sim-domain-slice-kit/createDrizzleOutboxPort 와 일치
 * (snake_case).
 */
export const notificationOutbox = sqliteTable(
  "notification_outbox_events",
  {
    id: text("id").primaryKey(),
    aggregate_id: text("aggregate_id").notNull(),
    event_name: text("event_name").notNull(),
    event_version: integer("event_version").notNull(),
    payload: text("payload").notNull(),
    occurred_at: integer("occurred_at").notNull(),
    scope_id: text("scope_id").notNull(),
    status: text("status", { enum: ["pending", "published", "failed"] })
      .notNull()
      .default("pending"),
  },
  (t) => [index("idx_notification_outbox_status").on(t.status, t.occurred_at)],
);

export const SIM_NOTIF_NOTIFICATION_SQLITE_DDL = `
CREATE TABLE IF NOT EXISTS notif_notifications (
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
CREATE INDEX IF NOT EXISTS idx_notif_recipient ON notif_notifications(recipient_user_id);
CREATE INDEX IF NOT EXISTS idx_notif_status ON notif_notifications(status);
`;

/** 슬라이스 공통 outbox DDL — notification + subscription 공유. */
export const SIM_NOTIF_OUTBOX_SQLITE_DDL = `
CREATE TABLE IF NOT EXISTS notification_outbox_events (
  id TEXT PRIMARY KEY,
  aggregate_id TEXT NOT NULL,
  event_name TEXT NOT NULL,
  event_version INTEGER NOT NULL,
  payload TEXT NOT NULL,
  occurred_at INTEGER NOT NULL,
  scope_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
);
CREATE INDEX IF NOT EXISTS idx_notification_outbox_status ON notification_outbox_events(status, occurred_at);
`;
