// @def.boundary sim-auth-api
// @def.doc sim-erp-pm-design

import { Module, type DynamicModule } from "@nestjs/common";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { createConnection } from "db-bootstrap";
import { createAuthRepository } from "./factory.js";
import { env } from "../config/env.js";
import type { AuthRepository } from "./shared/port.js";

export const AUTH_REPOSITORY = Symbol("AUTH_REPOSITORY");

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
