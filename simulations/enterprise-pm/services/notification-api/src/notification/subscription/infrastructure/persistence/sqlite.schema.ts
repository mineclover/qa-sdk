// @def.boundary sim-notification-api
// @def.doc domain-slice-architecture

import { sqliteTable, text, integer, primaryKey, index } from 'drizzle-orm/sqlite-core';

/**
 * SQLite schema (subscription slice).
 *
 * outbox 는 notification 도메인 전체가 공유하는 단일 물리 테이블
 * (`notification_outbox_events`). drizzle table object 는 슬라이스마다
 * 독립적으로 선언하지만 동일한 물리 테이블을 가리킨다 — 이는 슬라이스
 * 캡슐화 (cross-slice import 금지) 와 outbox 공유를 양립시키기 위함.
 */
export const subscriptions = sqliteTable(
  'notif_subscriptions',
  {
    userId: text('user_id').notNull(),
    eventType: text('event_type').notNull(),
    channel: text('channel', { enum: ['in_app', 'email'] }).notNull(),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    createdAt: text('created_at').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.eventType] }),
    index('idx_notif_sub_event').on(t.eventType),
  ],
);

/**
 * Shared outbox table reference — `notification_outbox_events`. notification
 * 슬라이스가 동일 컬럼 정의를 가진 별도 drizzle table 을 export 하지만 양쪽 모두
 * 동일 물리 테이블을 가리킨다.
 */
export const notificationOutbox = sqliteTable('notification_outbox_events', {
  id: text('id').primaryKey(),
  aggregate_id: text('aggregate_id').notNull(),
  event_name: text('event_name').notNull(),
  event_version: integer('event_version').notNull(),
  payload: text('payload').notNull(),
  occurred_at: integer('occurred_at').notNull(),
  scope_id: text('scope_id').notNull(),
  status: text('status', { enum: ['pending', 'published', 'failed'] })
    .notNull()
    .default('pending'),
});

export const SIM_NOTIF_SUBSCRIPTION_SQLITE_DDL = `
CREATE TABLE IF NOT EXISTS notif_subscriptions (
  user_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('in_app','email')),
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, event_type)
);
CREATE INDEX IF NOT EXISTS idx_notif_sub_event ON notif_subscriptions(event_type);
`;
