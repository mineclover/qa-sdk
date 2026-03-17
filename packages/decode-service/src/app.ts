import { Hono } from "hono";
import type { Logger } from "pino";
import { requestId } from "./middleware/request-id.js";
import { createErrorHandler } from "./middleware/error-handler.js";
import { createHealthRoutes } from "./routes/health.js";
import { createDecodeRoutes } from "./routes/decode.js";
import { DecoderPool } from "./lib/decoder-pool.js";
import { createLogger } from "./lib/logger.js";

export interface AppDeps {
  pool: DecoderPool;
  logger?: Logger;
  version?: string;
  getUptimeSeconds?: () => number;
}

export function createApp(deps: AppDeps) {
  const app = new Hono();
  const logger = deps.logger ?? createLogger("decode-service");

  // middleware
  app.use("*", requestId);

  // routes
  app.route("/", createHealthRoutes({
    pool: deps.pool,
    getUptimeSeconds: deps.getUptimeSeconds,
    version: deps.version,
  }));
  app.route("/", createDecodeRoutes({ pool: deps.pool }));

  // error handler
  app.onError(createErrorHandler(logger));

  return app;
}
