// @def.boundary sim-pm-api
// @def.doc domain-slice-architecture

import { sql } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import {
  createSqliteTransactionPort,
  createPgTransactionPort,
  type TransactionPort,
} from "@qa-sdk/sim-domain-slice-kit";

export function createProjectSqliteTransactionPort(db: BetterSQLite3Database): TransactionPort {
  return createSqliteTransactionPort(db as unknown as { run: (q: unknown) => unknown }, sql);
}

export function createProjectPgTransactionPort(db: PostgresJsDatabase): TransactionPort {
  return createPgTransactionPort(db as unknown as { transaction: <T>(h: (tx: unknown) => Promise<T> | T) => Promise<T> });
}

export type ProjectDialect = "sqlite" | "pg";

export interface ProjectTransactionFactoryOpts {
  readonly dialect: ProjectDialect;
  readonly db: BetterSQLite3Database | PostgresJsDatabase;
}

export function createProjectTransactionPort(
  opts: ProjectTransactionFactoryOpts,
): TransactionPort {
  if (opts.dialect === "sqlite") {
    return createProjectSqliteTransactionPort(opts.db as BetterSQLite3Database);
  }
  if (opts.dialect === "pg") {
    return createProjectPgTransactionPort(opts.db as PostgresJsDatabase);
  }
  throw new Error(
    `createProjectTransactionPort: 지원하지 않는 dialect="${(opts as { dialect: string }).dialect}"`,
  );
}
