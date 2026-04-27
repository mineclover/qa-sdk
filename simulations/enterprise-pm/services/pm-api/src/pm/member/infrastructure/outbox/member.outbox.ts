// @def.boundary sim-pm-api
// @def.doc domain-slice-architecture

import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { createDrizzleOutboxPort, type OutboxPort } from "@qa-sdk/sim-domain-slice-kit";
import { memberOutbox as sqliteMemberOutbox } from "../persistence/sqlite.schema.js";
import { memberOutbox as pgMemberOutbox } from "../persistence/pg.schema.js";

export type MemberDialect = "sqlite" | "pg";

export interface MemberOutboxFactoryOpts {
  readonly dialect: MemberDialect;
  readonly db: BetterSQLite3Database | PostgresJsDatabase;
}

export function createMemberOutboxPort(opts: MemberOutboxFactoryOpts): OutboxPort {
  if (opts.dialect === "sqlite") {
    return createDrizzleOutboxPort({
      db: opts.db as never,
      table: sqliteMemberOutbox,
    });
  }
  if (opts.dialect === "pg") {
    return createDrizzleOutboxPort({
      db: opts.db as never,
      table: pgMemberOutbox,
    });
  }
  throw new Error(
    `createMemberOutboxPort: 지원하지 않는 dialect="${(opts as { dialect: string }).dialect}"`,
  );
}
