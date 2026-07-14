// @def.boundary sim-auth-api
// @def.doc domain-slice-architecture

import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';

/**
 * SQLite — auth 도메인의 ONE shared outbox table.
 *
 * 6 슬라이스 (user / role / role-assignment / department / authenticate /
 * bitmap) 모두 동일 `auth_outbox_events` 테이블에 이벤트를 적재한다.
 * Phase 1 caveat 5: snake_case 컬럼명 + 단일 outbox 테이블.
 */
export const authOutboxEvents = sqliteTable(
  'auth_outbox_events',
  {
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
  },
  (t) => [index('idx_auth_outbox_status').on(t.status, t.occurred_at)],
);

export const SIM_AUTH_OUTBOX_SQLITE_DDL = `
CREATE TABLE IF NOT EXISTS auth_outbox_events (
  id TEXT PRIMARY KEY,
  aggregate_id TEXT NOT NULL,
  event_name TEXT NOT NULL,
  event_version INTEGER NOT NULL,
  payload TEXT NOT NULL,
  occurred_at INTEGER NOT NULL,
  scope_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
);
CREATE INDEX IF NOT EXISTS idx_auth_outbox_status ON auth_outbox_events(status, occurred_at);
`;
