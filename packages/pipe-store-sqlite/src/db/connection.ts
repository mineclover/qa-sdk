/**
 * 공유 DB 연결 — 단일 인스턴스에서 마이그레이션 1회 실행
 */

import { getDatabaseSync, type DatabaseSyncInstance } from "index-meta";
import { drizzle } from "drizzle-orm/node-sqlite";
import { migrate } from "drizzle-orm/node-sqlite/migrator";
import { existsSync, readdirSync } from "node:fs";

export type DrizzleDb = ReturnType<typeof drizzle>;

function resolveMigrationsFolder(): string {
  const candidates = [
    new URL("../drizzle", import.meta.url).pathname,
    new URL("../../drizzle", import.meta.url).pathname,
  ];
  const resolved = candidates.find((candidate) => {
    if (!existsSync(candidate)) return false;
    if (existsSync(`${candidate}/meta/_journal.json`)) return false;
    return readdirSync(candidate, { withFileTypes: true })
      .some((entry) => entry.isDirectory() && existsSync(`${candidate}/${entry.name}/migration.sql`));
  });
  if (!resolved) {
    throw new Error(`drizzle migrations folder not found. tried: ${candidates.join(", ")}`);
  }
  return resolved;
}

export function createDb(path: string): { rawDb: DatabaseSyncInstance; db: DrizzleDb } {
  const DatabaseSync = getDatabaseSync();
  const rawDb = new DatabaseSync(path);
  rawDb.exec("PRAGMA journal_mode = WAL");
  rawDb.exec("PRAGMA busy_timeout = 3000");
  const db = drizzle({ client: rawDb });
  migrate(db, {
    migrationsFolder: resolveMigrationsFolder(),
  });
  return { rawDb, db };
}
