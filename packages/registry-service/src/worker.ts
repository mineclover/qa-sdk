/**
 * worker.ts — Cloudflare Workers 진입점.
 *
 * core 로직(app.ts)은 Node.js와 동일.
 * 드라이버: index-meta D1SqlDriver.
 * 모든 import는 static (CF Workers에서 dynamic import 제한).
 */

import { createApp } from "./app.js";
import { REGISTRY_SCHEMA_DDL } from "./stores/schema.sql.js";
import { D1SqlDriver } from "index-meta";
import { SqlCatalogStore } from "./stores/sql-catalog-store.js";
import { SqlConfigStore } from "./stores/sql-config-store.js";
import { SqlServiceEndpointStore } from "./stores/sql-service-endpoint-store.js";
import { SqlPrefixOwnerStore } from "./stores/sql-prefix-owner-store.js";
import { SqlDraftLockStore } from "./stores/sql-draft-lock-store.js";
import { SqlAxisProfileStore } from "./stores/sql-axis-profile-store.js";
import { SqlPrefixRegistry, SqlVersionLifecycleStore } from "index-meta";

interface Env {
  DB: any; // D1Database binding
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const driver = new D1SqlDriver(env.DB);

    // DDL 초기화 — 개별 문장으로 실행 (D1 안정성)
    for (const stmt of REGISTRY_SCHEMA_DDL.split(";").map(s => s.trim()).filter(s => s.length > 0)) {
      try { await env.DB.exec(stmt + ";"); } catch { /* 이미 존재 */ }
    }

    const app = createApp({
      prefixRegistry: new SqlPrefixRegistry(driver),
      versionStore: new SqlVersionLifecycleStore(driver),
      ownerStore: new SqlPrefixOwnerStore(driver as any),
      lockStore: new SqlDraftLockStore(driver as any),
      catalogStore: new SqlCatalogStore(driver as any),
      configStore: new SqlConfigStore(driver as any),
      endpointStore: new SqlServiceEndpointStore(driver as any),
      axisStore: new SqlAxisProfileStore(driver as any),
      corsOrigin: "*",
    });

    return app.fetch(request);
  },
};
