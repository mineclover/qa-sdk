// @def.boundary decode-service-system
// @def.doc decode-service-system

import 'dotenv/config';
import { serve } from '@hono/node-server';
import { warnPortConflict, installSimpleShutdown, createServiceBootConfig } from '@qa-sdk/core';
import type { KeyCache } from '@qa-sdk/core';
import { env } from './config/env.js';
import { createApp } from './app.js';
import { DecoderPool } from './lib/decoder-pool.js';
import { initializeDecodeCache } from './lib/decode-cache.js';
import { createDecodeMapSync } from './lib/decode-map-sync.js';
import { createLogger } from './lib/logger.js';
import type { DecodeCacheHealth } from './routes/health.js';

const logger = createLogger('decode-service');
// decoder는 DecodeMap에서 결정론적으로 만들어지므로 만료시키지 않는다.
// 갱신은 decode-map 동기화가 catalog digest 변경을 보고 수행한다.
const pool = new DecoderPool(0);
const decodeMapSync = env.REGISTRY_URL
  ? createDecodeMapSync({ registryUrl: env.REGISTRY_URL, pool, logger })
  : undefined;
let refreshTimer: ReturnType<typeof setInterval> | undefined;
const startedAt = Date.now();

// Redis L2 캐시 초기화 (CACHE_DRIVER=redis)
let decodeCache: KeyCache | undefined;
let cacheHealth: DecodeCacheHealth = { driver: 'memory', status: 'disabled' };
if (env.CACHE_DRIVER === 'redis' && env.REDIS_URL) {
  const redisCache = await initializeDecodeCache(env.REDIS_URL, { logger });
  decodeCache = redisCache.decodeCache;
  cacheHealth = redisCache.cacheHealth;
}

const app = createApp({
  pool,
  logger,
  getUptimeSeconds: () => Math.floor((Date.now() - startedAt) / 1000),
  decodeCache,
  cacheTtlMs: env.CACHE_TTL_MS,
  cacheHealth,
});

const serviceConfig = createServiceBootConfig('decode-service');
const server = serve({ fetch: app.fetch, port: env.PORT }, async (info) => {
  logger.info(
    {
      port: info.port,
      service: `${serviceConfig.namespace}/${serviceConfig.name}`,
      env: serviceConfig.env,
      region: serviceConfig.region,
    },
    'decode-service listening',
  );
  warnPortConflict('decode-service', env.PORT, logger);

  // registry에서 DecodeMap 로드 + catalog 변경 시 갱신
  if (decodeMapSync) {
    await decodeMapSync.sync();
    if (env.DECODE_MAP_REFRESH_MS > 0) {
      refreshTimer = setInterval(() => void decodeMapSync.sync(), env.DECODE_MAP_REFRESH_MS);
      refreshTimer.unref();
    }
  }
});

installSimpleShutdown({
  server,
  logger,
  cleanup: async () => {
    if (refreshTimer) clearInterval(refreshTimer);
  },
});
