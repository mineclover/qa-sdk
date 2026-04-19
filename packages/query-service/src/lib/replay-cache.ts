// @def.boundary query-api-spec
// @def.doc query-api-spec

/**
 * Replay LRU 캐시 — 시점 replay 결과를 메모리에 캐시.
 */

export interface ReplayCacheEntry {
  state: Record<string, string>;
  recordCount: number;
  cachedAt: number;
}

export interface ReplayCache {
  get(key: string): ReplayCacheEntry | undefined;
  set(key: string, entry: ReplayCacheEntry): void;
}

/**
 * 간단한 LRU + TTL 캐시.
 * @param maxSize 최대 항목 수 (기본 100)
 * @param ttlMs TTL 밀리초 (기본 5분)
 */
export function createReplayCache(maxSize = 100, ttlMs = 5 * 60 * 1000): ReplayCache {
  const cache = new Map<string, ReplayCacheEntry>();

  return {
    get(key) {
      const entry = cache.get(key);
      if (!entry) return undefined;
      if (Date.now() - entry.cachedAt > ttlMs) {
        cache.delete(key);
        return undefined;
      }
      // LRU: 재삽입으로 순서 갱신
      cache.delete(key);
      cache.set(key, entry);
      return entry;
    },
    set(key, entry) {
      cache.delete(key); // 기존 삭제 후 재삽입 (순서 갱신)
      if (cache.size >= maxSize) {
        // 가장 오래된 항목 제거 (Map.keys() 첫 번째)
        const oldest = cache.keys().next().value;
        if (oldest !== undefined) cache.delete(oldest);
      }
      cache.set(key, entry);
    },
  };
}

/** 캐시 키 생성 — 초 단위 truncate */
export function replayCacheKey(contextId: string, resourceId: string, ts: string): string {
  const truncated = ts.replace(/\.\d{3}Z$/, "Z"); // 밀리초 제거
  return `${contextId}:${resourceId}:${truncated}`;
}
