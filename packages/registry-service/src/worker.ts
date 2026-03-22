/**
 * worker.ts — Cloudflare Workers 진입점.
 *
 * core 로직(app.ts)은 Node.js와 동일.
 * 드라이버만 교체: index-meta의 D1SqlDriver 사용.
 *
 * 드라이버 패턴 (SqlDriver 인터페이스 공유):
 *   Node.js  → NodeSqliteDriver (node:sqlite)
 *   CF D1    → D1SqlDriver (index-meta)
 *   Bun      → BunSqliteDriver (추후 추가)
 *   better   → BetterSqliteDriver (index-meta)
 *
 * wrangler.toml:
 *   main = "src/worker.ts"
 *   [[d1_databases]]
 *   binding = "DB"
 *   database_id = "xxx"
 */

import { createApp } from "./app.js";
import { REGISTRY_SCHEMA_DDL } from "./stores/schema.sql.js";

// D1 타입 (CF Workers runtime)
interface D1Database {
  prepare(query: string): any;
  exec(query: string): Promise<any>;
}

interface Env {
  DB: D1Database;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // index-meta의 D1SqlDriver 사용 (인라인 드라이버 없음)
    const { D1SqlDriver } = await import("index-meta") as any;
    const driver = new D1SqlDriver(env.DB);

    // DDL 초기화 (idempotent)
    await env.DB.exec(REGISTRY_SCHEMA_DDL);

    // 전체 SQL store — D1 위에서 동작
    const { SqlCatalogStore } = await import("./stores/sql-catalog-store.js");
    const { SqlConfigStore } = await import("./stores/sql-config-store.js");
    const { SqlServiceEndpointStore } = await import("./stores/sql-service-endpoint-store.js");
    const { SqlPrefixOwnerStore } = await import("./stores/sql-prefix-owner-store.js");
    const { SqlDraftLockStore } = await import("./stores/sql-draft-lock-store.js");
    const { SqlAxisProfileStore } = await import("./stores/sql-axis-profile-store.js");
    const { SqlPrefixRegistry, SqlVersionLifecycleStore } = await import("index-meta") as any;

    const app = createApp({
      prefixRegistry: new SqlPrefixRegistry(driver),
      versionStore: new SqlVersionLifecycleStore(driver),
      ownerStore: new SqlPrefixOwnerStore(driver),
      lockStore: new SqlDraftLockStore(driver),
      catalogStore: new SqlCatalogStore(driver),
      configStore: new SqlConfigStore(driver),
      endpointStore: new SqlServiceEndpointStore(driver),
      axisStore: new SqlAxisProfileStore(driver),
      corsOrigin: "*",
    });

    return app.fetch(request);
  },
};
