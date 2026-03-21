import { serve } from "@hono/node-server";
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
  warnPortConflict("decode-service", env.PORT);
});

function warnPortConflict(self: string, port: number) {
  const known: Record<string, number> = { "registry-server": 3100, "ingest-server": 3200, "registry-service": 3300, "gate-service": 3400, "query-service": 3500, "decode-service": 3600 };
  for (const [name, p] of Object.entries(known)) {
    if (name !== self && p === port) logger.warn(`⚠ PORT ${port} conflicts with ${name} (default: ${p}). Set PORT env to avoid collision.`);
  }
}

function shutdown(signal: string) {
  logger.info({ signal }, "shutdown requested");
  server.close(() => {
    logger.info("shutdown complete");
    process.exit(0);
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
