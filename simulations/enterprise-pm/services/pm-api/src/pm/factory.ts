// @def.boundary sim-pm-api
// @def.doc sim-erp-pm-design

import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import type { PmRepository } from "./shared/port.js";

export type PmRepoDialect = "sqlite" | "pg";

export interface PmRepoFactoryOpts {
  dialect: PmRepoDialect;
  db: BetterSQLite3Database | PostgresJsDatabase;
}

export async function createPmRepository(opts: PmRepoFactoryOpts): Promise<PmRepository> {
  if (opts.dialect === "sqlite") {
    const { SqlitePmRepository } = await import("./sqlite/adapter.js");
    return new SqlitePmRepository(opts.db as BetterSQLite3Database);
  }
  if (opts.dialect === "pg") {
    const { PgPmRepository } = await import("./pg/adapter.js");
    return new PgPmRepository(opts.db as PostgresJsDatabase);
  }
  throw new Error(
    `createPmRepository: 지원하지 않는 dialect="${(opts as { dialect: string }).dialect}"`,
  );
}
