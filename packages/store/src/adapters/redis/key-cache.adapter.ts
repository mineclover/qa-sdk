// @def.boundary persistence-system-root
// @def.doc persistence-system-root

import type { KeyCache, CacheStats } from "@qa-sdk/core";
import type { Redis } from "ioredis";

/**
 * Redis KeyCache — L2 네트워크 캐시.
 *
 * 모든 키에 prefix를 적용하여 네임스페이스 격리.
 * stats의 hits/misses는 프로세스 로컬 카운터 (InMemoryKeyCache와 동일).
 */
export class RedisKeyCache<T = unknown> implements KeyCache<T> {
  private readonly prefix: string;
  private hits = 0;
  private misses = 0;

  constructor(
    private readonly redis: Redis,
    opts?: { prefix?: string },
  ) {
    this.prefix = opts?.prefix ?? "kc:";
  }

  private _key(key: string): string {
    return `${this.prefix}${key}`;
  }

  async get(key: string): Promise<T | undefined> {
    const raw = await this.redis.get(this._key(key));
    if (raw === null) {
      this.misses++;
      return undefined;
    }
    try {
      this.hits++;
      return JSON.parse(raw) as T;
    } catch {
      // 데이터 손상 방어
      this.misses++;
      this.hits--;
      return undefined;
    }
  }

  async set(key: string, value: T, ttlMs: number): Promise<void> {
    const json = JSON.stringify(value);
    if (ttlMs > 0) {
      await this.redis.set(this._key(key), json, "PX", ttlMs);
    } else {
      await this.redis.set(this._key(key), json);
    }
  }

  async delete(key: string): Promise<boolean> {
    const count = await this.redis.del(this._key(key));
    return count > 0;
  }

  async clear(): Promise<void> {
    const pattern = `${this.prefix}*`;
    let cursor = "0";
    do {
      const [nextCursor, keys] = await this.redis.scan(cursor, "MATCH", pattern, "COUNT", 100);
      cursor = nextCursor;
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } while (cursor !== "0");
    this.hits = 0;
    this.misses = 0;
  }

  async has(key: string): Promise<boolean> {
    const exists = await this.redis.exists(this._key(key));
    return exists === 1;
  }

  stats(): CacheStats {
    return {
      size: 0,
      hits: this.hits,
      misses: this.misses,
      evictions: 0,
    };
  }

  /** prefix 범위 키 수 실시간 조회 */
  async scanSize(): Promise<number> {
    const pattern = `${this.prefix}*`;
    let cursor = "0";
    let count = 0;
    do {
      const [nextCursor, keys] = await this.redis.scan(cursor, "MATCH", pattern, "COUNT", 100);
      cursor = nextCursor;
      count += keys.length;
    } while (cursor !== "0");
    return count;
  }
}
