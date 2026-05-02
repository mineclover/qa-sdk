// @def.boundary sim-auth-api
// @def.doc domain-slice-architecture

import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { createDrizzleOutboxPort, type OutboxPort } from "@qa-sdk/sim-domain-slice-kit";
import { authOutboxEvents as sqliteAuthOutbox } from "../../../_outbox/sqlite.schema.js";
import { authOutboxEvents as pgAuthOutbox } from "../../../_outbox/pg.schema.js";

/**
 * User slice 용 OutboxPort — auth 도메인 전체가 공유하는 단일 outbox table 사용.
 */
export type UserDialect = "sqlite" | "pg";

export interface UserOutboxFactoryOpts {
  readonly dialect: UserDialect;
  readonly db: BetterSQLite3Database | PostgresJsDatabase;
}

export function createUserOutboxPort(opts: UserOutboxFactoryOpts): OutboxPort {
  if (opts.dialect === "sqlite") {
    return createDrizzleOutboxPort({
      db: opts.db as never,
      table: sqliteAuthOutbox,
    });
  }
  if (opts.dialect === "pg") {
    return createDrizzleOutboxPort({
      db: opts.db as never,
      table: pgAuthOutbox,
    });
  }
  throw new Error(
    `createUserOutboxPort: 지원하지 않는 dialect="${(opts as { dialect: string }).dialect}"`,
  );
}
