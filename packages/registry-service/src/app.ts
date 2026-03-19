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

export interface AppDeps extends RegistryServiceDeps {
  logger?: Logger;
}

export function createApp(deps: AppDeps) {
  const app = new Hono();
  const logger = deps.logger ?? createLogger("registry-service");
  const service = new RegistryService(deps);

  app.use("*", cors());
  app.use("*", requestId);
  app.onError(createErrorHandler(logger));

  app.route("/", createHealthRoutes());
  app.route("/", createPrefixRoutes({ service }));
  app.route("/", createVersionRoutes({ service }));
  app.route("/", createDagRoutes({ service }));
  app.route("/", createWorkspaceRoutes({ service }));
  app.route("/", createResolveRoutes({ service }));
  app.route("/", createSchemaRoutes({ service }));

  return app;
}
