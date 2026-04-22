// @def.boundary sim-reporting-api
// @def.doc sim-erp-pm-design

import { Module, type DynamicModule } from "@nestjs/common";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { createConnection } from "db-bootstrap";
import { createReportingRepository } from "./factory.js";
import { env } from "../config/env.js";
import type { ReportingRepository } from "./shared/port.js";
import { SIM_REPORTING_SQLITE_DDL } from "./sqlite/schema.js";
import { SIM_REPORTING_PG_DDL } from "./pg/schema.js";

export const REPORTING_REPOSITORY = Symbol("REPORTING_REPOSITORY");

async function applyDdl(conn: Awaited<ReturnType<typeof createConnection>>): Promise<void> {
  if (conn.dialect === "sqlite") {
    const raw = (conn.db as unknown as { $client: { exec: (sql: string) => void } }).$client;
    if (raw && typeof raw.exec === "function") {
      raw.exec(SIM_REPORTING_SQLITE_DDL);
    }
    return;
  }
  const raw = (conn.db as unknown as { $client: unknown }).$client as unknown as {
    unsafe: (q: string) => Promise<unknown>;
  };
  if (raw && typeof raw.unsafe === "function") {
    await raw.unsafe(SIM_REPORTING_PG_DDL);
  }
}

@Module({})
export class ReportingDbModule {
  static forRoot(): DynamicModule {
    return {
      module: ReportingDbModule,
      providers: [
        {
          provide: REPORTING_REPOSITORY,
          useFactory: async (): Promise<ReportingRepository> => {
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
            return createReportingRepository({
              dialect: conn.dialect,
              db: conn.db as BetterSQLite3Database | PostgresJsDatabase,
            });
          },
        },
      ],
      exports: [REPORTING_REPOSITORY],
      global: true,
    };
  }
}
