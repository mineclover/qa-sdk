// @def.boundary sim-auth-api
// @def.doc sim-erp-pm-design

import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import type { AuthRepository } from "./shared/port.js";

export type AuthRepoDialect = "sqlite" | "pg";

export interface AuthRepoFactoryOpts {
  dialect: AuthRepoDialect;
  /**
   * Drizzle DB 인스턴스.
   * - dialect="sqlite" → BetterSQLite3Database
   * - dialect="pg"     → PostgresJsDatabase
   */
  db: BetterSQLite3Database | PostgresJsDatabase;
}

/**
 * dialect-specific 어댑터 인스턴스화. Plan 05c factory 패턴.
 *
 * 미설치 드라이버 환경에서는 해당 dialect 분기에 닿지 않으면 부팅 가능
 * (peerDep optional 동기). 호출자는 db-bootstrap의 createConnection으로
 * 미리 dialect별 db 인스턴스를 만들어 전달.
 */
export async function createAuthRepository(
  opts: AuthRepoFactoryOpts,
): Promise<AuthRepository> {
  if (opts.dialect === "sqlite") {
    const { SqliteAuthRepository } = await import("./sqlite/adapter.js");
    return new SqliteAuthRepository(opts.db as BetterSQLite3Database);
  }
  if (opts.dialect === "pg") {
    const { PgAuthRepository } = await import("./pg/adapter.js");
    return new PgAuthRepository(opts.db as PostgresJsDatabase);
  }
  throw new Error(
    `createAuthRepository: 지원하지 않는 dialect="${(opts as { dialect: string }).dialect}"`,
  );
}
