// @def.boundary sim-notification-api
// @def.doc domain-slice-architecture

import { sql } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import {
  createSqliteTransactionPort,
  createPgTransactionPort,
  type TransactionPort,
} from "@qa-sdk/sim-domain-slice-kit";

export function createSubscriptionSqliteTransactionPort(
  db: BetterSQLite3Database,
): TransactionPort {
  return createSqliteTransactionPort(db as unknown as { run: (q: unknown) => unknown }, sql);
}

export function createSubscriptionPgTransactionPort(db: PostgresJsDatabase): TransactionPort {
  return createPgTransactionPort(
    db as unknown as { transaction: <T>(h: (tx: unknown) => Promise<T> | T) => Promise<T> },
  );
}

export type SubscriptionDialect = "sqlite" | "pg";

export interface SubscriptionTransactionFactoryOpts {
  readonly dialect: SubscriptionDialect;
  readonly db: BetterSQLite3Database | PostgresJsDatabase;
}

export function createSubscriptionTransactionPort(
  opts: SubscriptionTransactionFactoryOpts,
): TransactionPort {
  if (opts.dialect === "sqlite") {
    return createSubscriptionSqliteTransactionPort(opts.db as BetterSQLite3Database);
  }
  if (opts.dialect === "pg") {
    return createSubscriptionPgTransactionPort(opts.db as PostgresJsDatabase);
  }
  throw new Error(
    `createSubscriptionTransactionPort: 지원하지 않는 dialect="${(opts as { dialect: string }).dialect}"`,
  );
}
