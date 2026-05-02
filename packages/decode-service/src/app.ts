// @def.boundary decode-service-system
// @def.doc decode-service-system

import { Hono } from "hono";
import type { Logger } from "pino";
import type { KeyCache } from "@qa-sdk/core";
import { requestId } from "./middleware/request-id.js";
import { createErrorHandler } from "./middleware/error-handler.js";
import { createHealthRoutes } from "./routes/health.js";
import { createMetricsRoutes } from "./routes/metrics.js";
import { createDecodeRoutes } from "./routes/decode.js";
import { DecoderPool } from "./lib/decoder-pool.js";
import { createLogger } from "./lib/logger.js";

export interface AppDeps {
  pool: DecoderPool;
  logger?: Logger;
  version?: string;
  getUptimeSeconds?: () => number;
  /** Redis L2 decode 캐시 */
  decodeCache?: KeyCache;
  /** 캐시 TTL (밀리초) */
  cacheTtlMs?: number;
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
  app.route(
    "/",
    createMetricsRoutes({
      pool: deps.pool,
      getUptimeSeconds: deps.getUptimeSeconds,
    }),
  );
  app.route("/", createDecodeRoutes({ pool: deps.pool, decodeCache: deps.decodeCache, cacheTtlMs: deps.cacheTtlMs }));

  // error handler
  app.onError(createErrorHandler(logger));

  return app;
}
