/**
 * worker.ts — Cloudflare Workers 진입점.
 *
 * core 로직(app.ts)은 Node.js와 동일.
 * 차이: D1SqlDriver + Workers runtime + seed 로직.
 *
 * wrangler.toml:
 *   main = "src/worker.ts"
 *   [[d1_databases]]
 *   binding = "DB"
 *   database_id = "xxx"
 *
 * 사용:
 *   npx wrangler dev --local
 *   npx wrangler deploy
 */

import { createApp } from "./app.js";

// D1 바인딩 타입
interface Env {
  DB: D1Database;
  DEV_DASHBOARD_ENABLED?: string;
}

// D1Database 타입 (CF Workers runtime)
interface D1Database {
  prepare(query: string): D1PreparedStatement;
  exec(query: string): Promise<D1ExecResult>;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
}
interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  first<T = Record<string, unknown>>(column?: string): Promise<T | null>;
  run(): Promise<D1ExecResult>;
}
interface D1Result<T> { results: T[]; success: boolean; }
interface D1ExecResult { success: boolean; }

// D1을 SqlDriver 인터페이스로 래핑 (index-meta의 D1SqlDriver와 동일 패턴)
class D1StoreDriver {
  constructor(private readonly db: D1Database) {}

  async execute(sql: string, params: unknown[] = []): Promise<void> {
    await this.db.prepare(sql).bind(...params).run();
  }

  async query<T extends Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
    const result = await this.db.prepare(sql).bind(...params).all<T>();
    return result.results;
  }

  async queryOne<T extends Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T | null> {
    return this.db.prepare(sql).bind(...params).first<T>();
  }
}

// DDL 실행 — registry-service 전 테이블 + index-meta prefix/version 테이블
async function initSchema(db: D1Database) {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS catalogs (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, data TEXT NOT NULL,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS config (
      catalog_id TEXT NOT NULL, config_type TEXT NOT NULL, data TEXT NOT NULL,
      updated_at TEXT NOT NULL, PRIMARY KEY (catalog_id, config_type)
    );
    CREATE TABLE IF NOT EXISTS service_endpoint (
      catalog_id TEXT NOT NULL, namespace TEXT NOT NULL, svc_name TEXT NOT NULL,
      env TEXT NOT NULL, region TEXT NOT NULL, url TEXT NOT NULL, updated_at TEXT NOT NULL,
      PRIMARY KEY (catalog_id, namespace, svc_name, env, region)
    );
    CREATE TABLE IF NOT EXISTS axis_profile (
      id TEXT NOT NULL, catalog_id TEXT NOT NULL DEFAULT 'demo',
      name TEXT NOT NULL, current_version TEXT NOT NULL DEFAULT 'v1',
      capacity INTEGER NOT NULL DEFAULT 32, entry_count INTEGER NOT NULL DEFAULT 0,
      meta_json TEXT, updated_at TEXT NOT NULL,
      PRIMARY KEY (id, catalog_id)
    );
    CREATE TABLE IF NOT EXISTS prefix (
      prefix TEXT PRIMARY KEY, owner TEXT NOT NULL,
      kind TEXT NOT NULL CHECK (kind IN ('leaf', 'composite')),
      number_type TEXT NOT NULL DEFAULT 'number' CHECK (number_type IN ('number', 'bigint')),
      created_at TEXT NOT NULL, meta_json TEXT, labels_json TEXT
    );
    CREATE TABLE IF NOT EXISTS draft_lock (
      prefix TEXT NOT NULL, version_id TEXT NOT NULL, locked_at TEXT NOT NULL,
      PRIMARY KEY (prefix, version_id)
    );
  `);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const driver = new D1StoreDriver(env.DB);

    // 첫 요청 시 스키마 초기화 (D1은 migration 기반이 아닌 idempotent DDL)
    await initSchema(env.DB);

    // 전체 SQL store — D1 위에서 동작 (in-memory 없음)
    const { SqlCatalogStore } = await import("./stores/sql-catalog-store.js");
    const { SqlConfigStore } = await import("./stores/sql-config-store.js");
    const { SqlServiceEndpointStore } = await import("./stores/sql-service-endpoint-store.js");
    const { SqlPrefixOwnerStore } = await import("./stores/sql-prefix-owner-store.js");
    const { SqlDraftLockStore } = await import("./stores/sql-draft-lock-store.js");
    const { SqlPrefixRegistry, SqlVersionLifecycleStore } = await import("index-meta") as any;

    const app = createApp({
      prefixRegistry: new SqlPrefixRegistry(driver as any),
      versionStore: new SqlVersionLifecycleStore(driver as any),
      ownerStore: new SqlPrefixOwnerStore(driver as any),
      lockStore: new SqlDraftLockStore(driver as any),
      catalogStore: new SqlCatalogStore(driver as any),
      configStore: new SqlConfigStore(driver as any),
      endpointStore: new SqlServiceEndpointStore(driver as any),
      corsOrigin: "*",
    });

    return app.fetch(request);
  },
};
