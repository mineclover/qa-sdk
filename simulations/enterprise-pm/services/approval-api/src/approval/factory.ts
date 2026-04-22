// @def.boundary sim-approval-api
// @def.doc sim-erp-pm-design

import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import type { ApprovalRepository } from "./shared/port.js";

export type ApprovalRepoDialect = "sqlite" | "pg";

export interface ApprovalRepoFactoryOpts {
  dialect: ApprovalRepoDialect;
  db: BetterSQLite3Database | PostgresJsDatabase;
}

export async function createApprovalRepository(
  opts: ApprovalRepoFactoryOpts,
): Promise<ApprovalRepository> {
  if (opts.dialect === "sqlite") {
    const { SqliteApprovalRepository } = await import("./sqlite/adapter.js");
    return new SqliteApprovalRepository(opts.db as BetterSQLite3Database);
  }
  if (opts.dialect === "pg") {
    const { PgApprovalRepository } = await import("./pg/adapter.js");
    return new PgApprovalRepository(opts.db as PostgresJsDatabase);
  }
  throw new Error(
    `createApprovalRepository: 지원하지 않는 dialect="${(opts as { dialect: string }).dialect}"`,
  );
}
