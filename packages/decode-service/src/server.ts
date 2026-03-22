import "dotenv/config";
import { serve } from "@hono/node-server";
import { warnPortConflict, installSimpleShutdown } from "@qa-sdk/core";
import { env } from "./config/env.js";
import { createApp } from "./app.js";
import { DecoderPool } from "./lib/decoder-pool.js";
import { createLogger } from "./lib/logger.js";

const logger = createLogger("decode-service");
const pool = new DecoderPool(env.CACHE_TTL_MS);
const startedAt = Date.now();

const app = createApp({
  pool,
  logger,
  getUptimeSeconds: () => Math.floor((Date.now() - startedAt) / 1000),
});

const server = serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  logger.info({ port: info.port }, "decode-service listening");
  warnPortConflict("decode-service", env.PORT, logger);
});

installSimpleShutdown({ server, logger });
