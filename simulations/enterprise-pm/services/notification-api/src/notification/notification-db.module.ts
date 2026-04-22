// @def.boundary sim-notification-api
// @def.doc sim-erp-pm-design

import { Module, type DynamicModule } from "@nestjs/common";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { createConnection } from "db-bootstrap";
import { createNotificationRepository } from "./factory.js";
import { env } from "../config/env.js";
import type { NotificationRepository } from "./shared/port.js";
import { SIM_NOTIF_SQLITE_DDL } from "./sqlite/schema.js";
import { SIM_NOTIF_PG_DDL } from "./pg/schema.js";

export const NOTIFICATION_REPOSITORY = Symbol("NOTIFICATION_REPOSITORY");

async function applyDdl(conn: Awaited<ReturnType<typeof createConnection>>): Promise<void> {
  if (conn.dialect === "sqlite") {
    const raw = (conn.db as unknown as { $client: { exec: (sql: string) => void } }).$client;
    if (raw && typeof raw.exec === "function") {
      raw.exec(SIM_NOTIF_SQLITE_DDL);
    }
    return;
  }
  const raw = (conn.db as unknown as { $client: unknown }).$client as unknown as {
    unsafe: (q: string) => Promise<unknown>;
  };
  if (raw && typeof raw.unsafe === "function") {
    await raw.unsafe(SIM_NOTIF_PG_DDL);
  }
}

@Module({})
export class NotificationDbModule {
  static forRoot(): DynamicModule {
    return {
      module: NotificationDbModule,
      providers: [
        {
          provide: NOTIFICATION_REPOSITORY,
          useFactory: async (): Promise<NotificationRepository> => {
            const conn = await createConnection(
              env.QA_DB_DIALECT === "sqlite"
                ? { dialect: "sqlite", sqlitePath: env.QA_SQLITE_PATH }
                : {
                    dialect: "pg",
                    pgHost: env.QA_PG_HOST!,
                    pgPort: env.QA_PG_PORT!,
                    pgDatabase: env.QA_PG_DATABASE!,
                    pgUser: env.QA_PG_USER!,
                    pgPassword: env.QA_PG_PASSWORD!,
                    pgSchema: env.QA_PG_SCHEMA ?? "sim",
                  },
            );
            await applyDdl(conn);
            return createNotificationRepository({
              dialect: conn.dialect,
              db: conn.db as BetterSQLite3Database | PostgresJsDatabase,
            });
          },
        },
      ],
      exports: [NOTIFICATION_REPOSITORY],
      global: true,
    };
  }
}
