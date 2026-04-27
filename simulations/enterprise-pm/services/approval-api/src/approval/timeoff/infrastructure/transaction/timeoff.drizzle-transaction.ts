// @def.boundary sim-approval-api
// @def.doc domain-slice-architecture

import { sql } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import {
  createSqliteTransactionPort,
  createPgTransactionPort,
  type TransactionPort,
} from "@qa-sdk/sim-domain-slice-kit";

export function createTimeOffSqliteTransactionPort(db: BetterSQLite3Database): TransactionPort {
  return createSqliteTransactionPort(db as unknown as { run: (q: unknown) => unknown }, sql);
}
export function createTimeOffPgTransactionPort(db: PostgresJsDatabase): TransactionPort {
  return createPgTransactionPort(
    db as unknown as { transaction: <T>(h: (tx: unknown) => Promise<T> | T) => Promise<T> },
  );
}

export type TimeOffDialect = "sqlite" | "pg";

export interface TimeOffTransactionFactoryOpts {
  readonly dialect: TimeOffDialect;
  readonly db: BetterSQLite3Database | PostgresJsDatabase;
}

export function createTimeOffTransactionPort(opts: TimeOffTransactionFactoryOpts): TransactionPort {
  if (opts.dialect === "sqlite") return createTimeOffSqliteTransactionPort(opts.db as BetterSQLite3Database);
  if (opts.dialect === "pg") return createTimeOffPgTransactionPort(opts.db as PostgresJsDatabase);
  throw new Error(`createTimeOffTransactionPort: dialect=${(opts as { dialect: string }).dialect}`);
}
