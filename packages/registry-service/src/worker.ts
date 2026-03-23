/**
 * worker.ts — Cloudflare Workers 진입점.
 *
 * core 로직(app.ts)은 Node.js와 동일.
 * 드라이버: index-meta D1SqlDriver.
 * 모든 import는 static (CF Workers에서 dynamic import 제한).
 *
 * DKG graph를 bootstrap하여 /api/diagrams 엔드포인트 활성화.
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
import { SqlEventSchemaStore } from "./stores/sql-event-schema-store.js";
import { SqlPrefixRegistry, SqlVersionLifecycleStore } from "index-meta";
import { bootstrapDkg } from "@qa-sdk/spec-core/dkg";
import { collectMetrics } from "@qa-sdk/spec-core/convergence";
import { DEMO_CATALOG, DEMO_DKG_CONFIG } from "demo-snapshot";

interface Env {
  DB: any; // D1Database binding
}

// ── DKG graph 캐시 (Worker 인스턴스 수명 동안 유지) ──
let cachedGraph: unknown | null = null;

function getGraph(): unknown {
  if (!cachedGraph) {
    cachedGraph = bootstrapDkg({ catalog: DEMO_CATALOG, config: DEMO_DKG_CONFIG });
  }
  return cachedGraph;
}

function getCatalog(): unknown {
  return DEMO_CATALOG;
}

function getMetrics(): unknown[] {
  const graph = getGraph();
  return collectMetrics(DEMO_CATALOG as any, graph as any, null);
}

let ddlInitialized = false;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const driver = new D1SqlDriver(env.DB);

    // DDL 초기화 — 첫 요청에서만 실행
    if (!ddlInitialized) {
      for (const stmt of REGISTRY_SCHEMA_DDL.split(";").map(s => s.trim()).filter(s => s.length > 0)) {
        try { await env.DB.exec(stmt + ";"); } catch { /* 이미 존재 */ }
      }
      ddlInitialized = true;
    }

    const app = createApp({
      prefixRegistry: new SqlPrefixRegistry(driver),
      versionStore: new SqlVersionLifecycleStore(driver),
      ownerStore: new SqlPrefixOwnerStore(driver as any),
      lockStore: new SqlDraftLockStore(driver as any),
      catalogStore: new SqlCatalogStore(driver as any),
      configStore: new SqlConfigStore(driver as any),
      endpointStore: new SqlServiceEndpointStore(driver as any),
      eventSchemaStore: new SqlEventSchemaStore(driver as any),
      axisStore: new SqlAxisProfileStore(driver as any),
      getGraph,
      getCatalog,
      collectMetrics: getMetrics,
      corsOrigin: "*",
    });

    return app.fetch(request);
  },
};
