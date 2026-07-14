// @def.boundary sim-notification-api
// @def.doc domain-slice-architecture

import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { createDrizzleOutboxPort, type OutboxPort } from '@qa-sdk/sim-domain-slice-kit';
import { notificationOutbox as sqliteNotificationOutbox } from '../persistence/sqlite.schema.js';
import { notificationOutbox as pgNotificationOutbox } from '../persistence/pg.schema.js';

/**
 * Subscription slice 용 OutboxPort. notification 슬라이스와 동일 물리 테이블
 * (notification_outbox_events) 을 공유하지만, drizzle table object 는 본 슬라이스
 * 의 sqlite.schema/pg.schema 에 colocate 된 정의를 사용한다 (cross-slice import 금지).
 */
export type SubscriptionDialect = 'sqlite' | 'pg';

export interface SubscriptionOutboxFactoryOpts {
  readonly dialect: SubscriptionDialect;
  readonly db: BetterSQLite3Database | PostgresJsDatabase;
}

export function createSubscriptionOutboxPort(opts: SubscriptionOutboxFactoryOpts): OutboxPort {
  if (opts.dialect === 'sqlite') {
    return createDrizzleOutboxPort({
      db: opts.db as never,
      table: sqliteNotificationOutbox,
    });
  }
  if (opts.dialect === 'pg') {
    return createDrizzleOutboxPort({
      db: opts.db as never,
      table: pgNotificationOutbox,
    });
  }
  throw new Error(
    `createSubscriptionOutboxPort: 지원하지 않는 dialect="${(opts as { dialect: string }).dialect}"`,
  );
}
