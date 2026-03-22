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
import type { CatalogStore } from "./stores/catalog-store.js";
import type { AxisProfileStore } from "./stores/axis-profile-store.js";
import type { ConfigStore } from "./stores/config-store.js";
import type { DevDkgProvider } from "./lib/dev-dkg-provider.js";
import { createDevDashboardRoutes } from "./routes/dev-dashboard.js";

export interface AppDeps extends RegistryServiceDeps {
  logger?: Logger;
  catalogStore?: CatalogStore;
  axisStore?: AxisProfileStore;
  devDashboardProvider?: DevDkgProvider;
  /** 통합 설정 저장소 (DkgConfig, PatternRules 등) */
  configStore?: ConfigStore;
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
    app.route("/", createServiceRoutes({ configStore: deps.configStore }));
  }
  if (deps.devDashboardProvider) {
    app.route("/", createDevDashboardRoutes({
      provider: deps.devDashboardProvider,
      catalogStore: deps.catalogStore,
    }));

    // DKG 기반 다이어그램 API — devDashboardProvider가 graph를 제공
    app.route("/api/diagrams", createDiagramRoutes({
      getGraph: () => deps.devDashboardProvider!.getGraph(),
    }));
  }
  app.route(
    "/",
    createMetricsRoutes({
      catalogStore: deps.catalogStore,
      axisStore: deps.axisStore,
    }),
  );

  return app;
}
