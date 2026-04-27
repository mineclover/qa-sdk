// @def.boundary sim-approval-api
// @def.doc domain-slice-architecture

import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { createDrizzleOutboxPort, type OutboxPort } from "@qa-sdk/sim-domain-slice-kit";
import { approvalOutbox as sqliteApprovalOutbox } from "../persistence/sqlite.schema.js";
import { approvalOutbox as pgApprovalOutbox } from "../persistence/pg.schema.js";

export type TimeOffDialect = "sqlite" | "pg";

export interface TimeOffOutboxFactoryOpts {
  readonly dialect: TimeOffDialect;
  readonly db: BetterSQLite3Database | PostgresJsDatabase;
}

export function createTimeOffOutboxPort(opts: TimeOffOutboxFactoryOpts): OutboxPort {
  if (opts.dialect === "sqlite") {
    return createDrizzleOutboxPort({ db: opts.db as never, table: sqliteApprovalOutbox });
  }
  if (opts.dialect === "pg") {
    return createDrizzleOutboxPort({ db: opts.db as never, table: pgApprovalOutbox });
  }
  throw new Error(`createTimeOffOutboxPort: dialect=${(opts as { dialect: string }).dialect}`);
}
