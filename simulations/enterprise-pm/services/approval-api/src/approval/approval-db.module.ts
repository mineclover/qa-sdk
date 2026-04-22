// @def.boundary sim-approval-api
// @def.doc sim-erp-pm-design

import { Module, type DynamicModule, type Provider } from "@nestjs/common";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { createConnection } from "db-bootstrap";
import { createApprovalRepository } from "./factory.js";
import { env } from "../config/env.js";
import type { ApprovalRepository } from "./shared/port.js";
import { SIM_APPROVAL_SQLITE_DDL } from "./sqlite/schema.js";
import { SIM_APPROVAL_PG_DDL } from "./pg/schema.js";

export const APPROVAL_REPOSITORY = Symbol("APPROVAL_REPOSITORY");
export const APPROVAL_DB_INSTANCE = Symbol("APPROVAL_DB_INSTANCE");

export interface ApprovalDbInstanceHandle {
  dialect: "sqlite" | "pg";
  db: BetterSQLite3Database | PostgresJsDatabase;
}

async function applyDdl(conn: Awaited<ReturnType<typeof createConnection>>): Promise<void> {
  if (conn.dialect === "sqlite") {
    const raw = (conn.db as unknown as { $client: { exec: (sql: string) => void } }).$client;
    if (raw && typeof raw.exec === "function") {
      raw.exec(SIM_APPROVAL_SQLITE_DDL);
    }
    return;
  }
  const raw = (conn.db as unknown as { $client: unknown }).$client as unknown as {
    unsafe: (q: string) => Promise<unknown>;
  };
  if (raw && typeof raw.unsafe === "function") {
    await raw.unsafe(SIM_APPROVAL_PG_DDL);
  }
}

@Module({})
export class ApprovalDbModule {
  static forRoot(): DynamicModule {
    const dbInstanceProvider: Provider = {
      provide: APPROVAL_DB_INSTANCE,
      useFactory: async (): Promise<ApprovalDbInstanceHandle> => {
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
        return {
          dialect: conn.dialect,
          db: conn.db as BetterSQLite3Database | PostgresJsDatabase,
        };
      },
    };
    return {
      module: ApprovalDbModule,
      providers: [
        dbInstanceProvider,
        {
          provide: APPROVAL_REPOSITORY,
          useFactory: async (handle: ApprovalDbInstanceHandle): Promise<ApprovalRepository> => {
            return await createApprovalRepository({
              dialect: handle.dialect,
              db: handle.db,
            });
          },
          inject: [APPROVAL_DB_INSTANCE],
        },
      ],
      exports: [APPROVAL_REPOSITORY, APPROVAL_DB_INSTANCE],
      global: true,
    };
  }
}
