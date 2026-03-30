import { Global, Module } from "@nestjs/common";
import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { createLogger } from "./lib/logger.js";
import { env } from "./config/env.js";
import * as schema from "./db/schema.js";

const logger = createLogger("decision-service");

export const RAW_DATABASE = "RAW_DATABASE";
export const DATABASE = "DATABASE";
export type DecisionServiceDatabase = BetterSQLite3Database<typeof schema>;

const migrationsFolder = new URL("../drizzle", import.meta.url).pathname;

@Global()
@Module({
  providers: [
    {
      provide: RAW_DATABASE,
      useFactory: () => {
        if (env.SQLITE_PATH !== ":memory:") {
          const dir = dirname(env.SQLITE_PATH);
          if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
        }

        const db = new Database(env.SQLITE_PATH);
        db.pragma("journal_mode = WAL");
        db.pragma("busy_timeout = 3000");

        // drizzle-kit 마이그레이션 실행
        try {
          const drizzleDb = drizzle({ client: db, schema });
          migrate(drizzleDb, { migrationsFolder });
        } catch (err) {
          logger.error({ err }, "drizzle 마이그레이션 실패");
          throw err;
        }

        return db;
      },
    },
    {
      provide: DATABASE,
      inject: [RAW_DATABASE],
      useFactory: (db: Database.Database): DecisionServiceDatabase => drizzle({ client: db, schema }),
    },
  ],
  exports: [RAW_DATABASE, DATABASE],
})
export class DatabaseModule {}
