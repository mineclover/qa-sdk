import { Hono } from "hono";
import type { Logger } from "pino";
import type { Db } from "./db/client.js";
import { requestId } from "./middleware/request-id.js";
import { createRequestLogger } from "./middleware/logger.js";
import { createErrorHandler } from "./middleware/error-handler.js";
import {
  createDbHealthChecker,
  createHealthRoutes,
  type DbHealthChecker,
} from "./routes/health.js";
import { serviceRoutes } from "./routes/services.js";
import { eventRoutes } from "./routes/events.js";
import { ServiceRepository } from "./modules/services/service.repository.js";
import { ServiceService } from "./modules/services/service.service.js";
import { EventRepository } from "./modules/events/event.repository.js";
import { EventService } from "./modules/events/event.service.js";
import { cors } from "hono/cors";
import { createLogger } from "./lib/logger.js";

export interface AppDeps {
  checkDbHealth?: DbHealthChecker;
  getUptimeSeconds?: () => number;
  logger?: Logger;
  version?: string;
  corsOrigin?: string;
}

export function createApp(db: Db, deps: AppDeps = {}) {
  const app = new Hono();
  const logger = deps.logger ?? createLogger("registry-server");

  // middleware
  app.use("*", cors({ origin: deps.corsOrigin ?? "*" }));
  app.use("*", requestId);
  app.use("*", createRequestLogger(logger));

  // dependencies
  const serviceRepo = new ServiceRepository(db);
  const eventRepo = new EventRepository(db);
  const serviceSvc = new ServiceService(serviceRepo);
  const eventSvc = new EventService(eventRepo, serviceRepo, db);

  // routes
  app.route(
    "/",
    createHealthRoutes({
      checkDbHealth: deps.checkDbHealth ?? createDbHealthChecker(db),
      getUptimeSeconds: deps.getUptimeSeconds,
      version: deps.version,
    }),
  );
  app.route("/", serviceRoutes(serviceSvc));
  app.route("/", eventRoutes(eventSvc));

  // error handler
  app.onError(createErrorHandler(logger));

  return app;
}
