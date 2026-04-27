// @def.boundary sim-pm-api
// @def.doc domain-slice-architecture

import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { createDrizzleOutboxPort, type OutboxPort } from "@qa-sdk/sim-domain-slice-kit";
import { taskOutbox as sqliteTaskOutbox } from "../persistence/sqlite.schema.js";
import { taskOutbox as pgTaskOutbox } from "../persistence/pg.schema.js";

export type TaskDialect = "sqlite" | "pg";

export interface TaskOutboxFactoryOpts {
  readonly dialect: TaskDialect;
  readonly db: BetterSQLite3Database | PostgresJsDatabase;
}

export function createTaskOutboxPort(opts: TaskOutboxFactoryOpts): OutboxPort {
  if (opts.dialect === "sqlite") {
    return createDrizzleOutboxPort({
      db: opts.db as never,
      table: sqliteTaskOutbox,
    });
  }
  if (opts.dialect === "pg") {
    return createDrizzleOutboxPort({
      db: opts.db as never,
      table: pgTaskOutbox,
    });
  }
  throw new Error(
    `createTaskOutboxPort: 지원하지 않는 dialect="${(opts as { dialect: string }).dialect}"`,
  );
}
