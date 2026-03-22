/**
 * dev-dkg-provider — 개발 대시보드용 DKG 데이터 프로바이더.
 *
 * spec-core 동적 import + lazy DKG bootstrap + TTL 캐시.
 * DEV_DASHBOARD_ENABLED=true 시에만 초기화.
 */

import type { Logger } from "pino";
import type {
  GraphRegistryPort,
  MetricValuePort,
  ObservationNodePort,
  DkgSqliteStorePort,
  AnalysisModulePort,
  StoreModulePort,
  CatalogPort,
} from "../types/spec-core-ports.js";

export interface DevDkgProviderConfig {
  /** 주입할 카탈로그 (없으면 DEMO_CATALOG fallback) */
  catalog?: CatalogPort;
  dkgSqlitePath?: string;
  catalogId?: string;
  cacheTtlMs?: number;
  logger?: Logger;
}

export interface DevDkgProvider {
  getGraph(): GraphRegistryPort;
  getCatalog(): CatalogPort;
  getStore(): DkgSqliteStorePort | undefined;
  /** 전체 metric 수집 */
  collectMetrics(): MetricValuePort[];
  /** metric → observation 변환 */
  metricsToObservations(metrics: MetricValuePort[]): ObservationNodePort[];
  /** 캐시 무효화 + 재부트스트랩 */
  refresh(): void;
  close(): void;
}

export async function createDevDkgProvider(
  config: DevDkgProviderConfig,
): Promise<DevDkgProvider> {
  const analysis = await import("@qa-sdk/spec-core/analysis") as unknown as AnalysisModulePort;
  const storeModule = await import("@qa-sdk/spec-core/store") as unknown as StoreModulePort;
  const demoSnapshot = await import("demo-snapshot") as { DEMO_CATALOG: CatalogPort; DEMO_DKG_CONFIG: unknown };

  const ttl = config.cacheTtlMs ?? 10 * 60 * 1000; // 10분
  let cachedGraph: GraphRegistryPort | null = null;
  let cachedCatalog: CatalogPort | null = null;
  let dkgStore: DkgSqliteStorePort | null = null;
  let lastInit = 0;

  // TransitionSpec 로드 (non-blocking, 실패 시 undefined)
  let transitionSpecs: readonly unknown[] | undefined;
  import("@qa-sdk/spec-core/transition").then(m => { transitionSpecs = m.DEMO_TRANSITION_SPECS as readonly unknown[]; }).catch(() => {});

  function ensureInit(): void {
    const now = Date.now();
    if (cachedGraph && (now - lastInit) < ttl) return;

    cachedCatalog = config.catalog ?? demoSnapshot.DEMO_CATALOG;

    if (config.dkgSqlitePath) {
      if (!dkgStore) {
        dkgStore = new storeModule.DkgSqliteStore(
          config.dkgSqlitePath,
          config.catalogId ?? "demo",
        );
      }
      const loaded = dkgStore.loadGraph();
      if (loaded.getAllNodes().length === 0) {
        cachedGraph = analysis.bootstrapDkg({ catalog: cachedCatalog, config: demoSnapshot.DEMO_DKG_CONFIG, transitionSpecs });
        dkgStore.saveGraph(cachedGraph!, "bootstrap");
      } else {
        cachedGraph = loaded;
      }
    } else {
      cachedGraph = analysis.bootstrapDkg({ catalog: cachedCatalog, config: demoSnapshot.DEMO_DKG_CONFIG, transitionSpecs });
    }

    lastInit = now;

    // ── 타입 경계 관측 로깅 ──
    if (config.logger && cachedGraph) {
      const graphShape = Object.keys(Object.getPrototypeOf(cachedGraph) ?? {});
      const graphOwn = Object.keys(cachedGraph);
      config.logger.info({
        graphConstructor: cachedGraph.constructor?.name,
        graphProtoMethods: graphShape.slice(0, 15),
        graphOwnKeys: graphOwn.slice(0, 10),
        nodeCount: cachedGraph.nodeCount,
        edgeCount: cachedGraph.edgeCount,
        sampleNode: cachedGraph.getAllNodes()[0],
      }, "type-boundary: graph shape");

      if (cachedCatalog) {
        config.logger.info({
          catalogKeys: Object.keys(cachedCatalog),
          axesCount: Object.keys(cachedCatalog.axes).length,
          prefixesCount: Object.keys(cachedCatalog.prefixes).length,
          sampleAxisKeys: Object.keys(Object.values(cachedCatalog.axes)[0] ?? {}),
        }, "type-boundary: catalog shape");
      }

      const metrics = analysis.collectMetrics(cachedCatalog, cachedGraph, null);
      if (metrics.length > 0) {
        config.logger.info({
          metricCount: metrics.length,
          sampleMetric: metrics[0],
          metricKeys: Object.keys(metrics[0]),
        }, "type-boundary: metric shape");
      }
    }

    config.logger?.debug("dev-dkg-provider: initialized");
  }

  return {
    getGraph() {
      ensureInit();
      return cachedGraph!;
    },
    getCatalog() {
      ensureInit();
      return cachedCatalog!;
    },
    getStore() {
      ensureInit();
      return dkgStore ?? undefined;
    },
    collectMetrics() {
      ensureInit();
      return analysis.collectMetrics(cachedCatalog!, cachedGraph!, null);
    },
    metricsToObservations(metrics: MetricValuePort[]) {
      return analysis.metricsToObservations(metrics);
    },
    refresh() {
      cachedGraph = null;
      lastInit = 0;
    },
    close() {
      if (dkgStore?.close) dkgStore.close();
      cachedGraph = null;
      cachedCatalog = null;
      dkgStore = null;
    },
  };
}
