// @def.boundary decode-service-system
// @def.doc decode-service-system

import type { KeyCache } from '@qa-sdk/core';
import type { Redis as RedisClient } from 'ioredis';
import type { DecodeCacheHealth } from '../routes/health.js';

type MaybePromise<T> = T | Promise<T>;

export type RedisClientLike = Pick<RedisClient, 'ping' | 'disconnect'>;

export interface DecodeCacheInitResult {
  decodeCache?: KeyCache;
  cacheHealth: DecodeCacheHealth;
}

export interface DecodeCacheLogger {
  info?(meta: Record<string, unknown>, message: string): void;
  warn?(meta: Record<string, unknown>, message: string): void;
}

export interface DecodeCacheInitDeps {
  createRedisClient?: (url: string) => MaybePromise<RedisClientLike>;
  createRedisKeyCache?: (redis: RedisClientLike) => MaybePromise<KeyCache>;
  logger?: DecodeCacheLogger;
}

export async function initializeDecodeCache(
  redisUrl: string,
  deps: DecodeCacheInitDeps = {},
): Promise<DecodeCacheInitResult> {
  const disconnected: DecodeCacheHealth = { driver: 'redis', status: 'disconnected' };
  let redis: RedisClientLike | undefined;
  try {
    redis = deps.createRedisClient
      ? await deps.createRedisClient(redisUrl)
      : await createDefaultRedisClient(redisUrl);
    await redis.ping();

    const decodeCache = deps.createRedisKeyCache
      ? await deps.createRedisKeyCache(redis)
      : await createDefaultRedisKeyCache(redis);
    deps.logger?.info?.({ url: redisUrl }, 'Redis L2 cache connected');
    return {
      decodeCache,
      cacheHealth: { driver: 'redis', status: 'connected' },
    };
  } catch (err) {
    redis?.disconnect();
    deps.logger?.warn?.({ err }, 'Redis L2 cache init failed — using memory only');
    return { cacheHealth: disconnected };
  }
}

async function createDefaultRedisClient(redisUrl: string): Promise<RedisClient> {
  const Redis = (await import('ioredis')).default as unknown as new (url: string) => RedisClient;
  return new Redis(redisUrl);
}

async function createDefaultRedisKeyCache(redis: RedisClientLike): Promise<KeyCache> {
  const { RedisKeyCache } = await import('@qa-sdk/store');
  return new RedisKeyCache(redis as RedisClient, { prefix: 'decode:' });
}
