// @def.boundary sim-auth-api
// @def.doc domain-slice-architecture

import { sql } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import {
  createSqliteTransactionPort,
  createPgTransactionPort,
  type TransactionPort,
} from "@qa-sdk/sim-domain-slice-kit";

/**
 * dialect 별 TransactionPort 생성 헬퍼.
 *
 * - sqlite: better-sqlite3 가 native async transaction 미지원이므로 kit 의
 *   raw BEGIN/COMMIT 어댑터 사용.
 * - pg: drizzle 의 transaction() 메서드를 활용.
 */
export function createUserSqliteTransactionPort(db: BetterSQLite3Database): TransactionPort {
  return createSqliteTransactionPort(db as unknown as { run: (q: unknown) => unknown }, sql);
}

export function createUserPgTransactionPort(db: PostgresJsDatabase): TransactionPort {
  return createPgTransactionPort(db as unknown as { transaction: <T>(h: (tx: unknown) => Promise<T> | T) => Promise<T> });
}

export type UserDialect = "sqlite" | "pg";

export interface UserTransactionFactoryOpts {
  readonly dialect: UserDialect;
  readonly db: BetterSQLite3Database | PostgresJsDatabase;
}

export function createUserTransactionPort(opts: UserTransactionFactoryOpts): TransactionPort {
  if (opts.dialect === "sqlite") {
    return createUserSqliteTransactionPort(opts.db as BetterSQLite3Database);
  }
  if (opts.dialect === "pg") {
    return createUserPgTransactionPort(opts.db as PostgresJsDatabase);
  }
  throw new Error(
    `createUserTransactionPort: 지원하지 않는 dialect="${(opts as { dialect: string }).dialect}"`,
  );
}
