import type { CacheEntry, CacheStats, KeyCache } from "@qa-sdk/core";

/**
 * InMemory KeyCache — L1 프로세스 내 캐시.
 *
 * lazy eviction: get/has 시 만료 항목을 제거한다.
 * maxSize 초과 시 가장 오래된 항목부터 LRU 순으로 제거한다.
 */
export class InMemoryKeyCache<T = unknown> implements KeyCache<T> {
  private readonly store = new Map<string, CacheEntry<T>>();
  private readonly maxSize: number;
  private hits = 0;
  private misses = 0;
  private evictions = 0;

  constructor(opts?: { maxSize?: number }) {
    this.maxSize = opts?.maxSize ?? 10_000;
  }

  async get(key: string): Promise<T | undefined> {
    const entry = this.store.get(key);
    if (!entry) {
      this.misses++;
      return undefined;
    }
    if (this.isExpired(entry)) {
      this.store.delete(key);
      this.evictions++;
      this.misses++;
      return undefined;
    }
    // LRU: 재삽입으로 순서 갱신
    this.store.delete(key);
    this.store.set(key, entry);
    this.hits++;
    return entry.value;
  }

  async set(key: string, value: T, ttlMs: number): Promise<void> {
    // 기존 키 삭제 (순서 갱신)
    this.store.delete(key);
    this.evictIfFull();
    this.store.set(key, {
      value,
      cachedAt: Date.now(),
      ttlMs,
    });
  }

  async delete(key: string): Promise<boolean> {
    return this.store.delete(key);
  }

  async clear(): Promise<void> {
    this.store.clear();
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
  }

  async has(key: string): Promise<boolean> {
    const entry = this.store.get(key);
    if (!entry) return false;
    if (this.isExpired(entry)) {
      this.store.delete(key);
      this.evictions++;
      return false;
    }
    return true;
  }

  stats(): CacheStats {
    return {
      size: this.store.size,
      hits: this.hits,
      misses: this.misses,
      evictions: this.evictions,
    };
  }

  private isExpired(entry: CacheEntry<T>): boolean {
    if (entry.ttlMs === 0) return false;
    return Date.now() - entry.cachedAt > entry.ttlMs;
  }

  private evictIfFull(): void {
    while (this.store.size >= this.maxSize) {
      // Map 순서상 첫 번째 = 가장 오래된 (LRU)
      const oldest = this.store.keys().next().value;
      if (oldest !== undefined) {
        this.store.delete(oldest);
        this.evictions++;
      }
    }
  }
}
