// @def.boundary sim-auth-api
// @def.doc sim-erp-pm-design

import { Module, type DynamicModule } from "@nestjs/common";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { createConnection } from "db-bootstrap";
import { createAuthRepository } from "./factory.js";
import { env } from "../config/env.js";
import type { AuthRepository } from "./shared/port.js";
import { SIM_AUTH_SQLITE_DDL } from "./sqlite/schema.js";
import { SIM_AUTH_PG_DDL } from "./pg/schema.js";

export const AUTH_REPOSITORY = Symbol("AUTH_REPOSITORY");

/**
 * 서비스 부팅 시 idempotent DDL을 적용한다.
 * 모든 CREATE 문은 IF NOT EXISTS이므로 재기동 안전.
 * 운영 환경은 drizzle-kit migration이 SSOT이지만, dev/test는 본 auto-apply로 충분.
 */
async function applyDdl(conn: Awaited<ReturnType<typeof createConnection>>): Promise<void> {
  if (conn.dialect === "sqlite") {
    // BetterSQLite3Database.$client.exec로 raw 실행
    const db = conn.db as BetterSQLite3Database;
    // drizzle 인스턴스에서 내부 raw client 접근
    const raw = (db as unknown as { $client: { exec: (sql: string) => void } }).$client;
    if (raw && typeof raw.exec === "function") {
      raw.exec(SIM_AUTH_SQLITE_DDL);
    }
    return;
  }
  // PG: drizzle PostgresJsDatabase → sql unsafe
  const db = conn.db as PostgresJsDatabase;
  const raw = (db as unknown as { $client: (q: string) => Promise<unknown> }).$client as unknown as {
    unsafe: (q: string) => Promise<unknown>;
  };
  if (raw && typeof raw.unsafe === "function") {
    await raw.unsafe(SIM_AUTH_PG_DDL);
  }
}

@Module({})
export class AuthDbModule {
  static forRoot(): DynamicModule {
    return {
      module: AuthDbModule,
      providers: [
        {
          provide: AUTH_REPOSITORY,
          useFactory: async (): Promise<AuthRepository> => {
            const conn = await createConnection(
              env.QA_DB_DIALECT === "sqlite"
                ? {
                    dialect: "sqlite",
                    sqlitePath: env.QA_SQLITE_PATH,
                  }
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
            return createAuthRepository({
              dialect: conn.dialect,
              db: conn.db as BetterSQLite3Database | PostgresJsDatabase,
            });
          },
        },
      ],
      exports: [AUTH_REPOSITORY],
      global: true,
    };
  }
}
