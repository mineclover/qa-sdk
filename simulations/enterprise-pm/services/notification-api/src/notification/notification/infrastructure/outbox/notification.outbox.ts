// @def.boundary sim-notification-api
// @def.doc domain-slice-architecture

import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { createDrizzleOutboxPort, type OutboxPort } from '@qa-sdk/sim-domain-slice-kit';
import { notificationOutbox as sqliteNotificationOutbox } from '../persistence/sqlite.schema.js';
import { notificationOutbox as pgNotificationOutbox } from '../persistence/pg.schema.js';

/**
 * Notification slice 용 OutboxPort 생성기.
 *
 * - dialect 별 drizzle table 을 선택해 kit 의 createDrizzleOutboxPort 에 위임.
 * - subscription 슬라이스와 동일 테이블 (notification_outbox_events) 을 공유.
 */
export type NotificationDialect = 'sqlite' | 'pg';

export interface NotificationOutboxFactoryOpts {
  readonly dialect: NotificationDialect;
  readonly db: BetterSQLite3Database | PostgresJsDatabase;
}

export function createNotificationOutboxPort(opts: NotificationOutboxFactoryOpts): OutboxPort {
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
    `createNotificationOutboxPort: 지원하지 않는 dialect="${(opts as { dialect: string }).dialect}"`,
  );
}
