// @def.boundary sim-document-api
// @def.doc domain-slice-architecture

import { sql } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import {
  createSqliteTransactionPort,
  createPgTransactionPort,
  type TransactionPort,
} from "@qa-sdk/sim-domain-slice-kit";

export function createCommentSqliteTransactionPort(db: BetterSQLite3Database): TransactionPort {
  return createSqliteTransactionPort(db as unknown as { run: (q: unknown) => unknown }, sql);
}

export function createCommentPgTransactionPort(db: PostgresJsDatabase): TransactionPort {
  return createPgTransactionPort(db as unknown as { transaction: <T>(h: (tx: unknown) => Promise<T> | T) => Promise<T> });
}

export type CommentDialect = "sqlite" | "pg";

export interface CommentTransactionFactoryOpts {
  readonly dialect: CommentDialect;
  readonly db: BetterSQLite3Database | PostgresJsDatabase;
}

export function createCommentTransactionPort(
  opts: CommentTransactionFactoryOpts,
): TransactionPort {
  if (opts.dialect === "sqlite") {
    return createCommentSqliteTransactionPort(opts.db as BetterSQLite3Database);
  }
  if (opts.dialect === "pg") {
    return createCommentPgTransactionPort(opts.db as PostgresJsDatabase);
  }
  throw new Error(
    `createCommentTransactionPort: 지원하지 않는 dialect="${(opts as { dialect: string }).dialect}"`,
  );
}
