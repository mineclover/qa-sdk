// @def.boundary sim-pm-api
// @def.doc domain-slice-architecture

import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { createDrizzleOutboxPort, type OutboxPort } from "@qa-sdk/sim-domain-slice-kit";
import { pmOutboxEvents as sqliteMemberOutbox } from "../../../sqlite/schema.js";
import { pmOutboxEvents as pgMemberOutbox } from "../../../pg/schema.js";

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
