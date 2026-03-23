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
import type { D1Database, SqlDriver } from "index-meta";
import { SqlCatalogStore } from "./stores/sql-catalog-store.js";
import { SqlConfigStore } from "./stores/sql-config-store.js";
import { SqlServiceEndpointStore } from "./stores/sql-service-endpoint-store.js";
import { SqlPrefixOwnerStore } from "./stores/sql-prefix-owner-store.js";
import { SqlDraftLockStore } from "./stores/sql-draft-lock-store.js";
import { SqlAxisProfileStore } from "./stores/sql-axis-profile-store.js";
import { SqlEventSchemaStore } from "./stores/sql-event-schema-store.js";
import { SqlPrefixRegistry, SqlVersionLifecycleStore } from "index-meta";
import { bootstrapDkg } from "@qa-sdk/spec-core/dkg";
import type { GraphRegistry } from "@qa-sdk/spec-core/dkg";
import { collectMetrics } from "@qa-sdk/spec-core/convergence";
import { DEMO_CATALOG, DEMO_DKG_CONFIG } from "demo-snapshot";
import type { CatalogPort, MetricValuePort } from "./types/spec-core-ports.js";

type WorkerD1Database = D1Database & {
  exec(sql: string): Promise<unknown>;
};

interface Env {
  DB: WorkerD1Database;
  // Service Bindings — 헬스체크용
  INGEST_SERVICE?: Fetcher;
  GATE_SERVICE?: Fetcher;
  QUERY_SERVICE?: Fetcher;
  DECODE_SERVICE?: Fetcher;
  GATEWAY_SERVICE?: Fetcher;
  DEMO_API_SERVICE?: Fetcher;
}

// ── DKG graph 캐시 (Worker 인스턴스 수명 동안 유지) ──
let cachedGraph: GraphRegistry | null = null;

function getGraph(): GraphRegistry {
  if (!cachedGraph) {
    cachedGraph = bootstrapDkg({ catalog: DEMO_CATALOG, config: DEMO_DKG_CONFIG });
  }
  return cachedGraph;
}

function getCatalog(): CatalogPort {
  return DEMO_CATALOG;
}

function getMetrics(): MetricValuePort[] {
  const graph = getGraph();
  return collectMetrics(DEMO_CATALOG, graph, null);
}

/** Env의 Service Bindings → serviceId 맵으로 변환 */
function buildServiceBindings(env: Env): Record<string, Fetcher> {
  const bindings: Record<string, Fetcher> = {};
  if (env.INGEST_SERVICE)   bindings["ingest-server"] = env.INGEST_SERVICE;
  if (env.GATE_SERVICE)     bindings["gate-service"] = env.GATE_SERVICE;
  if (env.QUERY_SERVICE)    bindings["query-service"] = env.QUERY_SERVICE;
  if (env.DECODE_SERVICE)   bindings["decode-service"] = env.DECODE_SERVICE;
  if (env.GATEWAY_SERVICE)  bindings["gateway"] = env.GATEWAY_SERVICE;
  if (env.DEMO_API_SERVICE) bindings["platform-demo-api"] = env.DEMO_API_SERVICE;
  return bindings;
}

let ddlInitialized = false;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const driver = new D1SqlDriver(env.DB);
    const sqlDriver: SqlDriver = driver;

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
      ownerStore: new SqlPrefixOwnerStore(sqlDriver),
      lockStore: new SqlDraftLockStore(sqlDriver),
      catalogStore: new SqlCatalogStore(sqlDriver),
      configStore: new SqlConfigStore(sqlDriver),
      endpointStore: new SqlServiceEndpointStore(sqlDriver),
      eventSchemaStore: new SqlEventSchemaStore(sqlDriver),
      axisStore: new SqlAxisProfileStore(sqlDriver),
      getGraph,
      getCatalog,
      collectMetrics: getMetrics,
      serviceBindings: buildServiceBindings(env),
      corsOrigin: "*",
    });

    return app.fetch(request);
  },
};
