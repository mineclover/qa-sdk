// @def.boundary sim-notification-api
// @def.doc sim-erp-pm-design

import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import type { NotificationRepository } from "./shared/port.js";

export type NotificationRepoDialect = "sqlite" | "pg";

export interface NotificationRepoFactoryOpts {
  dialect: NotificationRepoDialect;
  db: BetterSQLite3Database | PostgresJsDatabase;
}

export async function createNotificationRepository(
  opts: NotificationRepoFactoryOpts,
): Promise<NotificationRepository> {
  if (opts.dialect === "sqlite") {
    const { SqliteNotificationRepository } = await import("./sqlite/adapter.js");
    return new SqliteNotificationRepository(opts.db as BetterSQLite3Database);
  }
  if (opts.dialect === "pg") {
    const { PgNotificationRepository } = await import("./pg/adapter.js");
    return new PgNotificationRepository(opts.db as PostgresJsDatabase);
  }
  throw new Error(
    `createNotificationRepository: 지원하지 않는 dialect="${(opts as { dialect: string }).dialect}"`,
  );
}
