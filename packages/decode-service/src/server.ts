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

/** registry-service에서 전체 DecodeMap 자동 fetch */
async function loadFromRegistry(registryUrl: string) {
  try {
    const res = await fetch(`${registryUrl}/api/decode-map`, {
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) {
      logger.warn({ status: res.status }, "registry decode-map fetch failed");
      return;
    }
    const maps: any[] = await res.json();
    let loaded = 0;
    for (const map of maps) {
      try {
        pool.loadMap(map);
        loaded++;
      } catch (err) {
        logger.warn({ indexId: map.indexId, error: String(err) }, "decode-map load failed");
      }
    }
    logger.info({ loaded, total: maps.length }, "loaded decode-maps from registry");
  } catch (err) {
    logger.warn({ error: String(err) }, "registry decode-map fetch failed — starting with empty pool");
  }
}

const app = createApp({
  pool,
  logger,
  getUptimeSeconds: () => Math.floor((Date.now() - startedAt) / 1000),
});

const server = serve({ fetch: app.fetch, port: env.PORT }, async (info) => {
  logger.info({ port: info.port }, "decode-service listening");
  warnPortConflict("decode-service", env.PORT, logger);

  // registry에서 DecodeMap 자동 로드
  if (env.REGISTRY_URL) {
    await loadFromRegistry(env.REGISTRY_URL);
  }
});

installSimpleShutdown({ server, logger });
