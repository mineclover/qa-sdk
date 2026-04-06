import "dotenv/config";
import { serve } from "@hono/node-server";
import { warnPortConflict, installSimpleShutdown, createServiceBootConfig } from "@qa-sdk/core";
import type { KeyCache } from "@qa-sdk/core";
import type { DecodeMap } from "index-meta";
import { env } from "./config/env.js";
import { createApp } from "./app.js";
import { DecoderPool } from "./lib/decoder-pool.js";
import { createLogger } from "./lib/logger.js";

const logger = createLogger("decode-service");
const pool = new DecoderPool(env.CACHE_TTL_MS);
const startedAt = Date.now();

// Redis L2 캐시 초기화 (CACHE_DRIVER=redis)
let decodeCache: KeyCache | undefined;
if (env.CACHE_DRIVER === "redis" && env.REDIS_URL) {
  try {
    const Redis = (await import("ioredis")).default;
    const { RedisKeyCache } = await import("@qa-sdk/store");
    const redis = new Redis(env.REDIS_URL);
    decodeCache = new RedisKeyCache(redis, { prefix: "decode:" });
    logger.info({ url: env.REDIS_URL }, "Redis L2 cache connected");
  } catch (err) {
    logger.warn({ err }, "Redis L2 cache init failed — using memory only");
  }
}

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
    const maps = await res.json() as DecodeMap[];
    let loaded = 0;
    for (const map of maps) {
      try {
        pool.loadMap(map);
        loaded++;
      } catch (err) {
        logger.warn({ indexId: map.indexId, err }, "decode-map load failed");
      }
    }
    logger.info({ loaded, total: maps.length }, "loaded decode-maps from registry");
  } catch (err) {
    logger.warn({ err }, "registry decode-map fetch failed — starting with empty pool");
  }
}

const app = createApp({
  pool,
  logger,
  getUptimeSeconds: () => Math.floor((Date.now() - startedAt) / 1000),
  decodeCache,
  cacheTtlMs: env.CACHE_TTL_MS,
});

const serviceConfig = createServiceBootConfig("decode-service");
const server = serve({ fetch: app.fetch, port: env.PORT }, async (info) => {
  logger.info({
    port: info.port,
    service: `${serviceConfig.namespace}/${serviceConfig.name}`,
    env: serviceConfig.env,
    region: serviceConfig.region,
  }, "decode-service listening");
  warnPortConflict("decode-service", env.PORT, logger);

  // registry에서 DecodeMap 자동 로드
  if (env.REGISTRY_URL) {
    await loadFromRegistry(env.REGISTRY_URL);
  }
});

installSimpleShutdown({ server, logger });
