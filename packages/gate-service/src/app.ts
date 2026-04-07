// @facet
import { Hono } from "hono";
import type { Logger } from "pino";
import type { AddressStateStore, GateEngine } from "index-meta-workers";
import { requestId } from "./middleware/request-id.js";
import { createErrorHandler } from "./middleware/error-handler.js";
import { createHealthRoutes } from "./routes/health.js";
import { createMetricsRoutes } from "./routes/metrics.js";
import { createGateRoutes } from "./routes/gate.js";
import {
  createGateService,
  type GateLookupService,
} from "./lib/gate-service.js";
import { createLogger } from "./lib/logger.js";

export interface AppDeps {
  gateService?: GateLookupService;
  addressStateStore?: AddressStateStore;
  gateEngine?: GateEngine | null;
  logger?: Logger;
  version?: string;
  getUptimeSeconds?: () => number;
}

export function createApp(deps: AppDeps) {
  const app = new Hono();
  const logger = deps.logger ?? createLogger("gate-service");
  const gateService =
    deps.gateService ??
    createGateService({
      addressStateStore: deps.addressStateStore,
      gateEngine: deps.gateEngine,
    });

  app.use("*", requestId);

  app.route(
    "/",
    createHealthRoutes({
      engineConfigured: gateService.engine !== null,
      getUptimeSeconds: deps.getUptimeSeconds,
      version: deps.version,
    }),
  );
  app.route(
    "/",
    createMetricsRoutes({
      engineConfigured: gateService.engine !== null,
      getUptimeSeconds: deps.getUptimeSeconds,
    }),
  );
  app.route("/", createGateRoutes({ gateService }));

  app.onError(createErrorHandler(logger));

  return app;
}
