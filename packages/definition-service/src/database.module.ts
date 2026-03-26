import { Module, Global } from "@nestjs/common";
import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import { DEFINITION_SERVICE_DDL } from "./stores/schema.js";
import { env } from "./config/env.js";

/** DI 토큰 — 문자열 (ESM 호환) */
export const DATABASE = "DATABASE";

@Global()
@Module({
  providers: [
    {
      provide: DATABASE,
      useFactory: (): Database.Database => {
        const sqlitePath = env.SQLITE_PATH;

        if (sqlitePath === ":memory:") {
          console.warn("[database] :memory: 사용 — 재시작 시 데이터 소실. 운영에서는 파일 경로를 지정하세요.");
        } else {
          const dir = dirname(sqlitePath);
          if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
        }

        const db = new Database(sqlitePath);
        db.pragma("journal_mode = WAL");

        for (const stmt of DEFINITION_SERVICE_DDL.split(";").filter(s => s.trim())) {
          db.exec(stmt);
        }

        return db;
      },
    },
  ],
  exports: [DATABASE],
})
export class DatabaseModule {}
