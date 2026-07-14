// @def.boundary sim-approval-api
// @def.doc domain-slice-architecture

import { sql } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import {
  createSqliteTransactionPort,
  createPgTransactionPort,
  type TransactionPort,
} from '@qa-sdk/sim-domain-slice-kit';

export function createResourceSqliteTransactionPort(db: BetterSQLite3Database): TransactionPort {
  return createSqliteTransactionPort(db as unknown as { run: (q: unknown) => unknown }, sql);
}
export function createResourcePgTransactionPort(db: PostgresJsDatabase): TransactionPort {
  return createPgTransactionPort(
    db as unknown as { transaction: <T>(h: (tx: unknown) => Promise<T> | T) => Promise<T> },
  );
}

export type ResourceDialect = 'sqlite' | 'pg';

export interface ResourceTransactionFactoryOpts {
  readonly dialect: ResourceDialect;
  readonly db: BetterSQLite3Database | PostgresJsDatabase;
}

export function createResourceTransactionPort(
  opts: ResourceTransactionFactoryOpts,
): TransactionPort {
  if (opts.dialect === 'sqlite')
    return createResourceSqliteTransactionPort(opts.db as BetterSQLite3Database);
  if (opts.dialect === 'pg') return createResourcePgTransactionPort(opts.db as PostgresJsDatabase);
  throw new Error(
    `createResourceTransactionPort: dialect=${(opts as { dialect: string }).dialect}`,
  );
}
