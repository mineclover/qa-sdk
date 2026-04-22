// @def.boundary db-bootstrap
// @def.doc db-bootstrap

/**
 * Store 패키지의 port-contract.test.ts가 사용할 fixture 헬퍼.
 *
 * SQLite: :memory: + DDL 적용 → 자동 close
 * PG: qa_sdk_test DB 안에 random schema 생성 → DDL 적용 → cleanup 시 schema drop
 *
 * 병렬 vitest 실행 시 schema 충돌 회피 위해 random suffix.
 */

import { randomBytes } from "node:crypto";

export interface SqliteFixture {
  db: unknown;
  cleanup(): Promise<void>;
}

export interface PgFixture {
  db: unknown;
  schemaName: string;
  cleanup(): Promise<void>;
}

export interface PgFixtureConfig {
  pgHost: string;
  pgPort: number;
  pgDatabase: string;
  pgUser: string;
  pgPassword: string;
}

export async function createSqliteTestFixture(ddl: string): Promise<SqliteFixture> {
  const Database = (await import("better-sqlite3")).default;
  const { drizzle } = await import("drizzle-orm/better-sqlite3");
  const raw = new Database(":memory:");
  raw.exec(ddl);
  return {
    db: drizzle({ client: raw }),
    async cleanup() { raw.close(); },
  };
}

export async function createPgTestFixture(
  ddl: string,
  cfg: PgFixtureConfig,
): Promise<PgFixture> {
  const postgres = (await import("postgres")).default;
  const { drizzle } = await import("drizzle-orm/postgres-js");

  const schemaName = `test_${randomBytes(4).toString("hex")}`;
  const sql = postgres({
    host: cfg.pgHost,
    port: cfg.pgPort,
    database: cfg.pgDatabase,
    user: cfg.pgUser,
    password: cfg.pgPassword,
    max: 5,
    onnotice: () => {},
  });

  await sql`CREATE SCHEMA ${sql(schemaName)}`;
  await sql`SET search_path TO ${sql(schemaName)}, public`;
  // DDL은 search_path 안에서 실행 — schema-less 테이블 명령이 schemaName에 적용됨
  await sql.unsafe(ddl);

  return {
    db: drizzle({ client: sql }),
    schemaName,
    async cleanup() {
      try {
        await sql`DROP SCHEMA ${sql(schemaName)} CASCADE`;
      } finally {
        await sql.end();
      }
    },
  };
}
