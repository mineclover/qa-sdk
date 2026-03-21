/**
 * convergence-graph-provider — DKG graph + catalog의 lazy 초기화.
 *
 * spec-core 동적 import를 캡슐화하여 ingest-server의 정적 의존에 포함되지 않도록 한다.
 * CONVERGENCE_ENABLED=true일 때만 server.ts에서 이 모듈을 동적으로 로딩한다.
 */

import type { Logger } from "pino";

export interface GraphProviderConfig {
  /** 주입할 카탈로그 (없으면 registry fetch → DEMO_CATALOG fallback) */
  catalog?: unknown;
  /** DKG SQLite 경로 (설정 시 기존 DKG store에서 로드) */
  dkgSqlitePath?: string;
  /** 카탈로그 ID (default: "demo") */
  catalogId?: string;
  /** registry-service URL (설정 시 catalog를 API에서 fetch) */
  registryUrl?: string;
  logger?: Logger;
}

export interface GraphProviderResult {
  getGraph: () => unknown;
  getCatalog: () => unknown;
  getDkgStore: () => unknown | undefined;
  close: () => void;
}

/**
 * Lazy graph/catalog 프로바이더 생성.
 *
 * 최초 호출 시:
 * 1. DKG SQLite 경로가 있으면 → DkgSqliteStore에서 graph 로드
 * 2. 없으면 → bootstrapDkg()로 인메모리 부트스트랩
 * 3. catalog는 DEMO_CATALOG (또는 store에서 로드)
 *
 * 이후 호출은 캐시된 인스턴스 반환.
 */
export async function createGraphProvider(
  config: GraphProviderConfig,
): Promise<GraphProviderResult> {
  // spec-core 동적 import
  const [analysisModule, storeModule] = await Promise.all([
    import("@qa-sdk/spec-core/analysis"),
    import("@qa-sdk/spec-core/store"),
  ]);

  // demo-snapshot도 동적 import (catalog 제공)
  const demoSnapshot = await import("demo-snapshot");

  let cachedGraph: unknown = null;
  let cachedCatalog: unknown = null;
  let dkgStore: unknown = null;

  /** registry-service에서 카탈로그를 fetch. 실패 시 null */
  async function fetchCatalogFromRegistry(): Promise<unknown | null> {
    if (!config.registryUrl) return null;
    const catalogId = config.catalogId ?? "demo";
    try {
      const url = `${config.registryUrl}/catalogs/${catalogId}`;
      const res = await fetch(url);
      if (!res.ok) return null;
      const record = await res.json() as { data?: string };
      if (record.data) {
        const parsed = JSON.parse(record.data);
        config.logger?.info({ catalogId }, "catalog fetched from registry-service");
        return parsed;
      }
      return null;
    } catch (err) {
      config.logger?.warn({ error: err instanceof Error ? err.message : String(err) }, "registry catalog fetch failed — using fallback");
      return null;
    }
  }

  let registryFetchDone = false;
  let registryCatalog: unknown = null;

  function ensureInit(): void {
    if (cachedGraph) return;

    const catalog = registryCatalog ?? config.catalog ?? demoSnapshot.DEMO_CATALOG;
    cachedCatalog = catalog;

    if (config.dkgSqlitePath) {
      // SQLite에서 기존 DKG 로드
      const store = new (storeModule as any).DkgSqliteStore(
        config.dkgSqlitePath,
        config.catalogId ?? "demo",
      );
      dkgStore = store;

      const loaded = store.loadGraph();
      // 노드가 비어있으면 부트스트랩 후 저장
      if (loaded.getAllNodes().length === 0) {
        config.logger?.info("DKG store empty, bootstrapping...");
        cachedGraph = (analysisModule as any).bootstrapDkg({ catalog });
        store.saveGraph(cachedGraph, "bootstrap");
      } else {
        cachedGraph = loaded;
      }
    } else {
      // 인메모리 부트스트랩
      cachedGraph = (analysisModule as any).bootstrapDkg({ catalog });
    }

    config.logger?.info("convergence graph provider initialized");
  }

  // registry fetch를 한 번 시도 (비동기 → 프로바이더 생성 시)
  if (config.registryUrl) {
    registryCatalog = await fetchCatalogFromRegistry();
    registryFetchDone = true;
  }

  return {
    getGraph(): unknown {
      ensureInit();
      return cachedGraph;
    },
    getCatalog(): unknown {
      ensureInit();
      return cachedCatalog;
    },
    getDkgStore(): unknown | undefined {
      ensureInit();
      return dkgStore;
    },
    close(): void {
      if (dkgStore && typeof (dkgStore as any).close === "function") {
        (dkgStore as any).close();
      }
      cachedGraph = null;
      cachedCatalog = null;
      dkgStore = null;
    },
  };
}
