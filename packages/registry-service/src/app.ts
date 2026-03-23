import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Logger } from "pino";
import { RegistryService, type RegistryServiceDeps } from "./lib/registry-service.js";
import { createLogger } from "./lib/logger.js";
import { createErrorHandler } from "./middleware/error-handler.js";
import { requestId } from "./middleware/request-id.js";
import { createHealthRoutes } from "./routes/health.js";
import { createPrefixRoutes } from "./routes/prefix.js";
import { createVersionRoutes } from "./routes/version.js";
import { createDagRoutes } from "./routes/dag.js";
import { createWorkspaceRoutes } from "./routes/workspace.js";
import { createResolveRoutes } from "./routes/resolve.js";
import { createSchemaRoutes } from "./routes/schema.js";
import { createCatalogRoutes } from "./routes/catalog.js";
import { createAxisRoutes } from "./routes/axis.js";
import { createMetricsRoutes } from "./routes/metrics.js";
import { createDiagramRoutes } from "./routes/diagrams.js";
import { createServiceRoutes } from "./routes/services.js";
import { createEndpointRoutes } from "./routes/endpoints.js";
import { createEventSchemaRoutes } from "./routes/event-schemas.js";
import { createDecodeMapRoutes } from "./routes/decode-map.js";
import { createEventCatalogRoutes } from "./routes/event-catalog.js";
import { createServiceHealthRoutes } from "./routes/service-health.js";
import { createDashboardApiRoutes } from "./routes/dashboard-api.js";
import type { CatalogStore } from "./stores/catalog-store.js";
import type { AxisProfileStore } from "./stores/axis-profile-store.js";
import type { ConfigStore } from "./stores/config-store.js";
import type { ServiceEndpointStore } from "./stores/service-endpoint-store.js";
import type { EventSchemaStore } from "./stores/event-schema-store.js";
import type { DevDkgProvider } from "./lib/dev-dkg-provider.js";
import { createDevDashboardRoutes } from "./routes/dev-dashboard.js";
import type { CatalogPort, GraphRegistryPort, MetricValuePort } from "./types/spec-core-ports.js";

export interface AppDeps extends RegistryServiceDeps {
  logger?: Logger;
  catalogStore?: CatalogStore;
  axisStore?: AxisProfileStore;
  devDashboardProvider?: DevDkgProvider;
  /** DKG graph 제공자 — devDashboardProvider 없이도 다이어그램/대시보드 API 활성화 가능 */
  getGraph?: () => GraphRegistryPort;
  getCatalog?: () => CatalogPort;
  collectMetrics?: () => MetricValuePort[];
  /** 통합 설정 저장소 (DkgConfig, PatternRules 등) */
  configStore?: ConfigStore;
  /** 서비스 엔드포인트 저장소 (좌표계 기반 URL 관리) */
  endpointStore?: ServiceEndpointStore;
  /** 이벤트 스키마 저장소 (서비스별 이벤트 키/버전 관리) */
  eventSchemaStore?: EventSchemaStore;
  /** Service Bindings — 헬스체크 시 Worker→Worker 직접 호출 */
  serviceBindings?: Record<string, Fetcher>;
  corsOrigin?: string;
}

export function createApp(deps: AppDeps) {
  const app = new Hono();
  const logger = deps.logger ?? createLogger("registry-service");
  const service = new RegistryService(deps);

  app.use("*", cors({ origin: deps.corsOrigin ?? "*" }));
  app.use("*", requestId);
  app.onError(createErrorHandler(logger));

  app.route("/", createHealthRoutes({
    catalogStore: deps.catalogStore,
    configStore: deps.configStore,
  }));
  app.route("/", createPrefixRoutes({ service }));
  app.route("/", createVersionRoutes({ service }));
  app.route("/", createDagRoutes({ service }));
  app.route("/", createWorkspaceRoutes({ service }));
  app.route("/", createResolveRoutes({ service }));
  app.route("/", createSchemaRoutes({ service }));
  if (deps.catalogStore) {
    app.route("/", createCatalogRoutes({
      catalogStore: deps.catalogStore,
      onCatalogChange: (catalogId) => {
        logger.info({ catalogId }, "catalog changed — invalidating caches");
        if (deps.devDashboardProvider && typeof deps.devDashboardProvider.refresh === "function") {
          deps.devDashboardProvider.refresh();
        }
      },
      configStore: deps.configStore,
    }));
  }
  if (deps.axisStore) {
    app.route("/", createAxisRoutes({
      axisStore: deps.axisStore,
      onAxisChange: (catalogId, axisId) => {
        logger.info({ catalogId, axisId }, "axis changed — invalidating caches");
        if (deps.devDashboardProvider && typeof deps.devDashboardProvider.refresh === "function") {
          deps.devDashboardProvider.refresh();
        }
      },
    }));
  }
  if (deps.configStore) {
    app.route("/", createServiceRoutes({ configStore: deps.configStore, endpointStore: deps.endpointStore }));
    app.route("/", createServiceHealthRoutes({
      configStore: deps.configStore,
      endpointStore: deps.endpointStore,
      serviceBindings: deps.serviceBindings,
    }));
  }
  if (deps.endpointStore) {
    app.route("/", createEndpointRoutes({ endpointStore: deps.endpointStore }));
  }
  if (deps.eventSchemaStore) {
    app.route("/", createEventSchemaRoutes({ eventSchemaStore: deps.eventSchemaStore }));
  }
  if (deps.catalogStore) {
    app.route("/", createDecodeMapRoutes({ catalogStore: deps.catalogStore }));
  }
  if (deps.devDashboardProvider) {
    app.route("/", createDevDashboardRoutes({
      provider: deps.devDashboardProvider,
      catalogStore: deps.catalogStore,
    }));
  }

  // DKG 기반 API — devDashboardProvider 또는 getGraph 중 하나만 있으면 활성화
  const graphGetter = deps.devDashboardProvider
    ? () => deps.devDashboardProvider!.getGraph()
    : deps.getGraph;
  const catalogGetter = deps.devDashboardProvider
    ? () => deps.devDashboardProvider!.getCatalog()
    : deps.getCatalog;
  const metricsCollector = deps.devDashboardProvider
    ? () => deps.devDashboardProvider!.collectMetrics()
    : deps.collectMetrics;
  if (graphGetter) {
    app.route("/api/diagrams", createDiagramRoutes({ getGraph: graphGetter }));

    if (catalogGetter) {
      app.route("/api/dashboard", createDashboardApiRoutes({
        getGraph: graphGetter,
        getCatalog: catalogGetter,
        collectMetrics: metricsCollector,
      }));
    }
  }
  app.route(
    "/",
    createMetricsRoutes({
      catalogStore: deps.catalogStore,
      axisStore: deps.axisStore,
    }),
  );

  // Event Catalog API — static import (Worker 호환)
  app.route("/", createEventCatalogRoutes());

  return app;
}
