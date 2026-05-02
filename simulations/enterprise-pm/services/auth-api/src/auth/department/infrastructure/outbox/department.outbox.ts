// @def.boundary sim-auth-api
// @def.doc domain-slice-architecture

import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { createDrizzleOutboxPort, type OutboxPort } from "@qa-sdk/sim-domain-slice-kit";
import { authOutboxEvents as sqliteAuthOutbox } from "../../../_outbox/sqlite.schema.js";
import { authOutboxEvents as pgAuthOutbox } from "../../../_outbox/pg.schema.js";

export type DepartmentDialect = "sqlite" | "pg";

export interface DepartmentOutboxFactoryOpts {
  readonly dialect: DepartmentDialect;
  readonly db: BetterSQLite3Database | PostgresJsDatabase;
}

export function createDepartmentOutboxPort(opts: DepartmentOutboxFactoryOpts): OutboxPort {
  if (opts.dialect === "sqlite") {
    return createDrizzleOutboxPort({ db: opts.db as never, table: sqliteAuthOutbox });
  }
  if (opts.dialect === "pg") {
    return createDrizzleOutboxPort({ db: opts.db as never, table: pgAuthOutbox });
  }
  throw new Error(`createDepartmentOutboxPort: 지원하지 않는 dialect="${(opts as { dialect: string }).dialect}"`);
}
