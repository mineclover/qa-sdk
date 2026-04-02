/**
 * 공유 DB 연결 — 단일 인스턴스에서 마이그레이션 1회 실행
 */

import { getDatabaseSync, type DatabaseSyncInstance } from "index-meta";
import { drizzle } from "drizzle-orm/node-sqlite";
import { migrate } from "drizzle-orm/node-sqlite/migrator";

export type DrizzleDb = ReturnType<typeof drizzle>;

export function createDb(path: string): { rawDb: DatabaseSyncInstance; db: DrizzleDb } {
  const DatabaseSync = getDatabaseSync();
  const rawDb = new DatabaseSync(path);
  rawDb.exec("PRAGMA journal_mode = WAL");
  rawDb.exec("PRAGMA busy_timeout = 3000");
  const db = drizzle({ client: rawDb });
  migrate(db, {
    migrationsFolder: new URL("../../drizzle", import.meta.url).pathname,
  });
  return { rawDb, db };
}
