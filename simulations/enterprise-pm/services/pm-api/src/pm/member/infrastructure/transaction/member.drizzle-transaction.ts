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

export function createMemberSqliteTransactionPort(db: BetterSQLite3Database): TransactionPort {
  return createSqliteTransactionPort(db as unknown as { run: (q: unknown) => unknown }, sql);
}

export function createMemberPgTransactionPort(db: PostgresJsDatabase): TransactionPort {
  return createPgTransactionPort(
    db as unknown as { transaction: <T>(h: (tx: unknown) => Promise<T> | T) => Promise<T> },
  );
}

export type MemberDialect = 'sqlite' | 'pg';

export interface MemberTransactionFactoryOpts {
  readonly dialect: MemberDialect;
  readonly db: BetterSQLite3Database | PostgresJsDatabase;
}

export function createMemberTransactionPort(opts: MemberTransactionFactoryOpts): TransactionPort {
  if (opts.dialect === 'sqlite') {
    return createMemberSqliteTransactionPort(opts.db as BetterSQLite3Database);
  }
  if (opts.dialect === 'pg') {
    return createMemberPgTransactionPort(opts.db as PostgresJsDatabase);
  }
  throw new Error(
    `createMemberTransactionPort: 지원하지 않는 dialect="${(opts as { dialect: string }).dialect}"`,
  );
}
