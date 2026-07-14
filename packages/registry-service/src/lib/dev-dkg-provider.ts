// @def.boundary registry-system
// @def.doc registry-system

/**
 * dev-dkg-provider — 개발 대시보드용 DKG 데이터 프로바이더.
 *
 * spec-core 동적 import + lazy DKG bootstrap + TTL 캐시.
 * DEV_DASHBOARD_ENABLED=true 시에만 초기화.
 */

import type { Logger } from 'pino';
import type {
  GraphRegistryPort,
  MetricValuePort,
  ObservationNodePort,
  DkgSqliteStorePort,
  AnalysisModulePort,
  StoreModulePort,
  CatalogPort,
  DkgConfigPort,
  TransitionSpecPort,
} from '../types/spec-core-ports.js';

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

export async function createDevDkgProvider(config: DevDkgProviderConfig): Promise<DevDkgProvider> {
  const enrichmentModule = await import('dkg-enrichment');
  const convergenceModule = await import('@qa-sdk/convergence');
  const storeModuleImport = await import('@qa-sdk/spec-core/store');
  const demoSnapshotImport = await import('demo-snapshot');
  const demoDkgConfigImport = await import('demo-dkg-config');

  const analysis: AnalysisModulePort = {
    bootstrapDkg(options) {
      return enrichmentModule.bootstrapDkg({
        catalog: options.catalog as Parameters<typeof enrichmentModule.bootstrapDkg>[0]['catalog'],
        config: options.config as Parameters<typeof enrichmentModule.bootstrapDkg>[0]['config'],
        date: options.date,
        transitionSpecs: options.transitionSpecs as Parameters<
          typeof enrichmentModule.bootstrapDkg
        >[0]['transitionSpecs'],
      });
    },
    collectMetrics(catalog, graph, usage) {
      return convergenceModule.collectMetrics(
        catalog as Parameters<typeof convergenceModule.collectMetrics>[0],
        graph as Parameters<typeof convergenceModule.collectMetrics>[1],
        usage as Parameters<typeof convergenceModule.collectMetrics>[2],
      ) as MetricValuePort[];
    },
    metricsToObservations(metrics, options) {
      return convergenceModule.metricsToObservations(
        metrics as Parameters<typeof convergenceModule.metricsToObservations>[0],
        options,
      ) as ObservationNodePort[];
    },
  };

  class DkgSqliteStoreAdapter implements DkgSqliteStorePort {
    private readonly inner: InstanceType<typeof storeModuleImport.DkgSqliteStore>;

    constructor(path: string, catalogId?: string) {
      this.inner = new storeModuleImport.DkgSqliteStore(path, catalogId);
    }

    loadGraph(): GraphRegistryPort {
      return this.inner.loadGraph();
    }

    saveGraph(
      graph: GraphRegistryPort,
      source: string,
    ): { nodesWritten: number; edgesWritten: number } {
      return this.inner.saveGraph(
        graph as Parameters<InstanceType<typeof storeModuleImport.DkgSqliteStore>['saveGraph']>[0],
        source as Parameters<InstanceType<typeof storeModuleImport.DkgSqliteStore>['saveGraph']>[1],
      );
    }

    saveNodes(
      nodes: readonly import('../types/spec-core-ports.js').DkgNodePort[],
      edges: readonly import('../types/spec-core-ports.js').DkgEdgePort[],
      source: string,
    ): void {
      this.inner.saveNodes(
        nodes as Parameters<InstanceType<typeof storeModuleImport.DkgSqliteStore>['saveNodes']>[0],
        edges as Parameters<InstanceType<typeof storeModuleImport.DkgSqliteStore>['saveNodes']>[1],
        source as Parameters<InstanceType<typeof storeModuleImport.DkgSqliteStore>['saveNodes']>[2],
      );
    }

    saveUsageSnapshotWithObservations(
      usage: import('../types/spec-core-ports.js').UsageDataPort,
      observations: readonly import('../types/spec-core-ports.js').DkgNodePort[],
    ): { snapshotId: number } {
      return this.inner.saveUsageSnapshotWithObservations(
        usage as Parameters<
          InstanceType<typeof storeModuleImport.DkgSqliteStore>['saveUsageSnapshotWithObservations']
        >[0],
        observations as Parameters<
          InstanceType<typeof storeModuleImport.DkgSqliteStore>['saveUsageSnapshotWithObservations']
        >[1],
      );
    }

    setMeta(key: string, value: string): void {
      this.inner.setMeta(key, value);
    }

    getMeta(key: string): string | null {
      return this.inner.getMeta(key);
    }

    updateNode(node: import('../types/spec-core-ports.js').DkgNodePort): void {
      this.inner.updateNode(
        node as Parameters<InstanceType<typeof storeModuleImport.DkgSqliteStore>['updateNode']>[0],
      );
    }

    close(): void {
      this.inner.close();
    }
  }

  const storeModule: StoreModulePort = {
    DkgSqliteStore: DkgSqliteStoreAdapter,
  };

  const demoSnapshot: { DEMO_CATALOG: CatalogPort; DEMO_DKG_CONFIG: DkgConfigPort } = {
    DEMO_CATALOG: demoSnapshotImport.DEMO_CATALOG,
    DEMO_DKG_CONFIG: demoDkgConfigImport.DEMO_DKG_CONFIG,
  };

  const ttl = config.cacheTtlMs ?? 10 * 60 * 1000; // 10분
  let cachedGraph: GraphRegistryPort | null = null;
  let cachedCatalog: CatalogPort | null = null;
  let dkgStore: DkgSqliteStorePort | null = null;
  let lastInit = 0;

  // TransitionSpec 로드 (non-blocking, 실패 시 undefined)
  let transitionSpecs: readonly TransitionSpecPort[] | undefined;
  import('@qa-sdk/spec-core/transition')
    .then((m) => {
      transitionSpecs = m.DEMO_TRANSITION_SPECS;
      return undefined;
    })
    .catch(() => {});

  function ensureInit(): void {
    const now = Date.now();
    if (cachedGraph && now - lastInit < ttl) return;

    cachedCatalog = config.catalog ?? demoSnapshot.DEMO_CATALOG;

    if (config.dkgSqlitePath) {
      if (!dkgStore) {
        dkgStore = new storeModule.DkgSqliteStore(config.dkgSqlitePath, config.catalogId ?? 'demo');
      }
      const loaded = dkgStore.loadGraph();
      if (loaded.getAllNodes().length === 0) {
        cachedGraph = analysis.bootstrapDkg({
          catalog: cachedCatalog,
          config: demoSnapshot.DEMO_DKG_CONFIG,
          transitionSpecs,
        });
        dkgStore.saveGraph(cachedGraph, 'bootstrap');
      } else {
        cachedGraph = loaded;
      }
    } else {
      cachedGraph = analysis.bootstrapDkg({
        catalog: cachedCatalog,
        config: demoSnapshot.DEMO_DKG_CONFIG,
        transitionSpecs,
      });
    }

    lastInit = now;

    // ── 타입 경계 관측 로깅 ──
    if (config.logger && cachedGraph) {
      const graphShape = Object.keys(Object.getPrototypeOf(cachedGraph) ?? {});
      const graphOwn = Object.keys(cachedGraph);
      config.logger.info(
        {
          graphConstructor: cachedGraph.constructor?.name,
          graphProtoMethods: graphShape.slice(0, 15),
          graphOwnKeys: graphOwn.slice(0, 10),
          nodeCount: cachedGraph.nodeCount,
          edgeCount: cachedGraph.edgeCount,
          sampleNode: cachedGraph.getAllNodes()[0],
        },
        'type-boundary: graph shape',
      );

      if (cachedCatalog) {
        config.logger.info(
          {
            catalogKeys: Object.keys(cachedCatalog),
            axesCount: Object.keys(cachedCatalog.axes).length,
            prefixesCount: Object.keys(cachedCatalog.prefixes).length,
            sampleAxisKeys: Object.keys(Object.values(cachedCatalog.axes)[0] ?? {}),
          },
          'type-boundary: catalog shape',
        );
      }

      const metrics = analysis.collectMetrics(cachedCatalog, cachedGraph, null);
      if (metrics.length > 0) {
        config.logger.info(
          {
            metricCount: metrics.length,
            sampleMetric: metrics[0],
            metricKeys: Object.keys(metrics[0]),
          },
          'type-boundary: metric shape',
        );
      }
    }

    config.logger?.debug('dev-dkg-provider: initialized');
  }

  return {
    getGraph() {
      ensureInit();
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- ensureInit() guarantees cachedGraph is set
      return cachedGraph!;
    },
    getCatalog() {
      ensureInit();
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- ensureInit() guarantees cachedCatalog is set
      return cachedCatalog!;
    },
    getStore() {
      ensureInit();
      return dkgStore ?? undefined;
    },
    collectMetrics() {
      ensureInit();
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- ensureInit() guarantees both are set
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
