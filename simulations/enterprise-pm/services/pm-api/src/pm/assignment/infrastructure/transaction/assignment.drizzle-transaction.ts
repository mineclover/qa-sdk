// @def.boundary sim-pm-api
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
 * - pg: drizzle 의 transaction() 메서드를 활용 (postgres-js, node-postgres 호환).
 *
 * Phase 0 caveat: createSqliteTransactionPort 는 (db, sqlTag) 시그니처.
 */
export function createAssignmentSqliteTransactionPort(db: BetterSQLite3Database): TransactionPort {
  return createSqliteTransactionPort(db as unknown as { run: (q: unknown) => unknown }, sql);
}

export function createAssignmentPgTransactionPort(db: PostgresJsDatabase): TransactionPort {
  return createPgTransactionPort(
    db as unknown as { transaction: <T>(h: (tx: unknown) => Promise<T> | T) => Promise<T> },
  );
}

export type AssignmentDialect = 'sqlite' | 'pg';

export interface AssignmentTransactionFactoryOpts {
  readonly dialect: AssignmentDialect;
  readonly db: BetterSQLite3Database | PostgresJsDatabase;
}

export function createAssignmentTransactionPort(
  opts: AssignmentTransactionFactoryOpts,
): TransactionPort {
  if (opts.dialect === 'sqlite') {
    return createAssignmentSqliteTransactionPort(opts.db as BetterSQLite3Database);
  }
  if (opts.dialect === 'pg') {
    return createAssignmentPgTransactionPort(opts.db as PostgresJsDatabase);
  }
  throw new Error(
    `createAssignmentTransactionPort: 지원하지 않는 dialect="${(opts as { dialect: string }).dialect}"`,
  );
}
