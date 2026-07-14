// @def.boundary decode-service-system
// @def.doc decode-service-system

import { describe, expect, it, vi } from 'vitest';
import type { KeyCache } from '@qa-sdk/core';
import { initializeDecodeCache } from './decode-cache.js';

function createKeyCache(): KeyCache {
  return {
    get: async () => undefined,
    set: async () => {},
    delete: async () => false,
    clear: async () => {},
    has: async () => false,
    stats: () => ({ size: 0, hits: 0, misses: 0, evictions: 0 }),
  };
}

describe('initializeDecodeCache', () => {
  it('Redis ping 성공 후에만 connected cache를 반환', async () => {
    const redis = {
      ping: vi.fn().mockResolvedValue('PONG'),
      disconnect: vi.fn(),
    };
    const cache = createKeyCache();
    const createRedisKeyCache = vi.fn(() => cache);

    const result = await initializeDecodeCache('redis://localhost:6379', {
      createRedisClient: () => redis,
      createRedisKeyCache,
    });

    expect(redis.ping).toHaveBeenCalledOnce();
    expect(createRedisKeyCache).toHaveBeenCalledWith(redis);
    expect(result.decodeCache).toBe(cache);
    expect(result.cacheHealth).toEqual({
      driver: 'redis',
      status: 'connected',
    });
  });

  it('Redis ping 실패 시 cache를 노출하지 않고 disconnected를 유지', async () => {
    const redis = {
      ping: vi.fn().mockRejectedValue(new Error('ECONNREFUSED')),
      disconnect: vi.fn(),
    };
    const createRedisKeyCache = vi.fn(() => createKeyCache());

    const result = await initializeDecodeCache('redis://localhost:6379', {
      createRedisClient: () => redis,
      createRedisKeyCache,
    });

    expect(redis.ping).toHaveBeenCalledOnce();
    expect(redis.disconnect).toHaveBeenCalledOnce();
    expect(createRedisKeyCache).not.toHaveBeenCalled();
    expect(result.decodeCache).toBeUndefined();
    expect(result.cacheHealth).toEqual({
      driver: 'redis',
      status: 'disconnected',
    });
  });
});
