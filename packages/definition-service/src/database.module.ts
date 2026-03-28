import { Module, Global } from "@nestjs/common";
import { existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import Database from "better-sqlite3";
import { createLogger } from "@qa-sdk/core";
import { env } from "./config/env.js";

const logger = createLogger("definition-service");

export const DATABASE = "DATABASE";

/**
 * drizzle/폴더의 migration.sql 파일을 직접 실행.
 * drizzle-orm migrate()의 journal 형식 불일치 문제를 우회.
 */
function applyMigrations(db: Database.Database, migrationsDir: string) {
  if (!existsSync(migrationsDir)) return;

  const dirs = readdirSync(migrationsDir, { withFileTypes: true })
    .filter(d => d.isDirectory() && !d.name.startsWith(".") && d.name !== "meta")
    .sort((a, b) => a.name.localeCompare(b.name));

  for (const dir of dirs) {
    const sqlFile = join(migrationsDir, dir.name, "migration.sql");
    if (!existsSync(sqlFile)) continue;

    const sql = readFileSync(sqlFile, "utf-8");
    // --> statement-breakpoint 로 분할 + 각 구문에서 세미콜론으로 한 번 더 분할
    const blocks = sql.split("--> statement-breakpoint").map(s => s.trim()).filter(Boolean);
    for (const block of blocks) {
      // 블록 내에 여러 구문이 있을 수 있음 (FTS5 VIRTUAL TABLE 등)
      const stmts = block.split(";").map(s => s.trim()).filter(Boolean);
      for (const stmt of stmts) {
        try {
          db.exec(stmt);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (!msg.includes("already exists")) {
            logger.warn({ stmt: stmt.slice(0, 80), error: msg }, "migration statement 실패");
          }
        }
      }
    }
  }
}

@Global()
@Module({
  providers: [
    {
      provide: DATABASE,
      useFactory: (): Database.Database => {
        const sqlitePath = env.SQLITE_PATH;

        if (sqlitePath !== ":memory:") {
          const dir = dirname(sqlitePath);
          if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
        }

        const db = new Database(sqlitePath);
        db.pragma("journal_mode = WAL");
        db.pragma("busy_timeout = 3000");

        // drizzle 마이그레이션 SQL 직접 실행
        const migrationsDir = new URL("../drizzle", import.meta.url).pathname;
        applyMigrations(db, migrationsDir);

        return db;
      },
    },
  ],
  exports: [DATABASE],
})
export class DatabaseModule {}
