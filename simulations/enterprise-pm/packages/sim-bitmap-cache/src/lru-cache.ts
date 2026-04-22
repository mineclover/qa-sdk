// @def.boundary sim-bitmap-cache
// @def.doc authorization-ontology-bitmap-pipeline

/**
 * BitmapLruCache — VersionedBitmap의 process-local LRU 캐시.
 *
 * bitmap-pipeline 스펙 §5 (Invalidation) 의 Subscriber측 구현.
 * Redis pub/sub로부터 InvalidationMessage 수신 시 본 cache의 해당 entry 삭제.
 *
 * key 포맷: "${userId}|${prefix}|${v}". 구분자 "|"는 userId/prefix/v 어느 것에도
 * 포함되지 않음 (도메인 규약).
 */

import { LRUCache } from "lru-cache";
import type { VersionedBitmap } from "permission-engine";

export interface BitmapLruCacheOptions {
  max: number;
}

export function makeKey(userId: string, prefix: string, v: string): string {
  return `${userId}|${prefix}|${v}`;
}

export function parseKey(
  key: string,
): { userId: string; prefix: string; v: string } {
  const [userId, prefix, v] = key.split("|");
  if (!userId || !prefix || !v) {
    throw new Error(`invalid cache key: ${key}`);
  }
  return { userId, prefix, v };
}

export class BitmapLruCache {
  private readonly cache: LRUCache<string, VersionedBitmap>;

  constructor(opts: BitmapLruCacheOptions) {
    // VersionedBitmap.expiresAt 기준 TTL을 set시 동적으로 지정.
    // global TTL은 설정하지 않음 (set 시마다 per-entry TTL 사용).
    this.cache = new LRUCache({
      max: opts.max,
      ttlAutopurge: false,
    });
  }

  set(
    userId: string,
    prefix: string,
    v: string,
    bitmap: VersionedBitmap,
  ): void {
    const remaining = new Date(bitmap.expiresAt).getTime() - Date.now();
    if (remaining <= 0) return;
    this.cache.set(makeKey(userId, prefix, v), bitmap, { ttl: remaining });
  }

  get(userId: string, prefix: string, v: string): VersionedBitmap | undefined {
    return this.cache.get(makeKey(userId, prefix, v));
  }

  /** §5 scope=user — 해당 user의 모든 (prefix, v) entry 삭제. */
  invalidateUser(userId: string): number {
    let removed = 0;
    const prefix = `${userId}|`;
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
        removed++;
      }
    }
    return removed;
  }

  /** §5 scope=role — affectedUserIds 일괄 삭제. */
  invalidateUsers(userIds: readonly string[]): number {
    let removed = 0;
    for (const id of userIds) {
      removed += this.invalidateUser(id);
    }
    return removed;
  }

  /** §5 scope=prefix — 해당 prefix의 모든 entry 삭제. */
  invalidatePrefix(prefix: string): number {
    let removed = 0;
    const needle = `|${prefix}|`;
    for (const key of this.cache.keys()) {
      if (key.includes(needle)) {
        this.cache.delete(key);
        removed++;
      }
    }
    return removed;
  }

  size(): number {
    return this.cache.size;
  }

  clear(): void {
    this.cache.clear();
  }
}
