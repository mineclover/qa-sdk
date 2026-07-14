// @def.boundary sim-notification-api
// @def.doc domain-slice-architecture

import { sql } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import {
  createSqliteTransactionPort,
  createPgTransactionPort,
  type TransactionPort,
} from '@qa-sdk/sim-domain-slice-kit';

/**
 * dialect 별 TransactionPort 생성 헬퍼.
 *
 * - sqlite: better-sqlite3 가 native async transaction 미지원이므로 kit 의
 *   raw BEGIN/COMMIT 어댑터 사용. drizzle 의 sql 태그를 함께 전달.
 * - pg: drizzle 의 transaction() 메서드를 활용.
 */
export function createNotificationSqliteTransactionPort(
  db: BetterSQLite3Database,
): TransactionPort {
  return createSqliteTransactionPort(db as unknown as { run: (q: unknown) => unknown }, sql);
}

export function createNotificationPgTransactionPort(db: PostgresJsDatabase): TransactionPort {
  return createPgTransactionPort(
    db as unknown as { transaction: <T>(h: (tx: unknown) => Promise<T> | T) => Promise<T> },
  );
}

export type NotificationDialect = 'sqlite' | 'pg';

export interface NotificationTransactionFactoryOpts {
  readonly dialect: NotificationDialect;
  readonly db: BetterSQLite3Database | PostgresJsDatabase;
}

export function createNotificationTransactionPort(
  opts: NotificationTransactionFactoryOpts,
): TransactionPort {
  if (opts.dialect === 'sqlite') {
    return createNotificationSqliteTransactionPort(opts.db as BetterSQLite3Database);
  }
  if (opts.dialect === 'pg') {
    return createNotificationPgTransactionPort(opts.db as PostgresJsDatabase);
  }
  throw new Error(
    `createNotificationTransactionPort: 지원하지 않는 dialect="${(opts as { dialect: string }).dialect}"`,
  );
}
