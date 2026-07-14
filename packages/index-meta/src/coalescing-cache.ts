// @def.boundary index-meta-system
// @def.doc index-meta-system

/**
 * CoalescingCache — 단일 비행(single-flight) 캐시 프리미티브
 *
 * 핵심 동작:
 * 1. 읽기(get): 캐시 fresh → 즉시 반환. stale/miss → single-flight fetch.
 *    동일 키에 대한 동시 stale reads는 1개의 fetch 결과를 공유.
 * 2. 쓰기(set): 배타적 접근. inflight가 있으면 완료 후 실행.
 *    쓰기는 서로 공유하지 않음 — 각 쓰기가 독립 실행.
 * 3. 갱신 완료 시 대기 중인 모든 읽기가 새 값을 수신.
 *
 * 사용 예:
 * ```ts
 * const backing = new SqlAddressRangeCache(driver);
 * const cache = new CoalescingCache<RangeCacheRecord | null>({
 *   isStale: (_v, cachedAt) => Date.now() - cachedAt > 60_000,
 * });
 *
 * // 읽기 — single-flight
 * const record = await cache.get(
 *   `perm\0v1\0role=admin`,
 *   () => backing.get("perm", "v1", "role=admin"),
 * );
 *
 * // 쓰기 — 배타적
 * await cache.set(`perm\0v1\0role=admin`, async () => {
 *   await backing.save(newRecord);
 *   return newRecord;
 * });
 * ```
 */

// ── 타입 ──────────────────────────────────────────────────

export interface CoalescingCacheOptions<V> {
  /**
   * 캐시 만료 판정.
   * true를 반환하면 갱신이 필요하다고 판단해 fetch를 시도한다.
   * 미지정 시 캐시된 값은 항상 fresh (invalidate/set으로만 갱신 트리거).
   */
  isStale?: (value: V, cachedAt: number) => boolean;

  /**
   * fetch/update 실패 시 재시도 횟수.
   * 기본 0 (재시도 없음, 즉 총 1회 시도).
   */
  retryCount?: number;
}

interface CacheSlot<V> {
  value: V;
  cachedAt: number;
}

// ── CoalescingCache ───────────────────────────────────────

export class CoalescingCache<V> {
  private readonly slots = new Map<string, CacheSlot<V>>();
  private readonly inflight = new Map<string, Promise<V>>();
  private readonly _isStale: ((value: V, cachedAt: number) => boolean) | undefined;
  private readonly _retryCount: number;

  constructor(options: CoalescingCacheOptions<V> = {}) {
    this._isStale = options.isStale;
    this._retryCount = options.retryCount ?? 0;
  }

  /**
   * 읽기.
   * - fresh 캐시 → 즉시 반환 (fetcher 호출 없음)
   * - stale 또는 miss → fetcher로 갱신 시도 (single-flight)
   * - 이미 inflight가 있으면 그 결과를 공유 (읽기 coalescing)
   */
  async get(key: string, fetcher: () => Promise<V>): Promise<V> {
    const slot = this.slots.get(key);
    if (slot && !this.checkStale(slot)) {
      return slot.value;
    }

    // inflight가 있으면 공유
    const existing = this.inflight.get(key);
    if (existing) return existing;

    return this.launch(key, fetcher);
  }

  /**
   * 쓰기.
   * - inflight(읽기 fetch 또는 다른 쓰기)가 있으면 완료 후 실행
   * - 다른 쓰기와 공유하지 않음 — 각각 독립 실행
   * - 완료 후 캐시 갱신 → 대기 중인 읽기에 전파
   */
  async set(key: string, updater: () => Promise<V>): Promise<V> {
    const existing = this.inflight.get(key);
    if (existing) {
      // inflight 완료 대기 (결과는 사용하지 않음)
      try {
        await existing;
      } catch {
        /* 무시 — 자체 쓰기를 수행할 것 */
      }
      // 대기 중 다른 쓰기가 시작했을 수 있으므로 재확인
      return this.set(key, updater);
    }

    return this.launch(key, updater);
  }

  /** 캐시에서 키 제거. 다음 get에서 fetcher를 트리거한다. */
  invalidate(key: string): void {
    this.slots.delete(key);
  }

  /** 전체 캐시 초기화. */
  clear(): void {
    this.slots.clear();
  }

  /** 캐시에 키가 존재하는지 (staleness 무시). */
  has(key: string): boolean {
    return this.slots.has(key);
  }

  /** 캐시된 값 직접 조회 (staleness 무시, fetch 없음). */
  peek(key: string): V | undefined {
    return this.slots.get(key)?.value;
  }

  /** 현재 inflight 중인 키 수. */
  get inflightCount(): number {
    return this.inflight.size;
  }

  /** 캐시된 엔트리 수. */
  get size(): number {
    return this.slots.size;
  }

  // ── 내부 ─────────────────────────────────────────────────

  private launch(key: string, fn: () => Promise<V>): Promise<V> {
    const promise = this.executeWithRetry(key, fn);
    this.inflight.set(key, promise);

    // settle 후 정리 (자기 promise인 경우만 — 다른 op가 교체했을 수 있음)
    const cleanup = () => {
      if (this.inflight.get(key) === promise) {
        this.inflight.delete(key);
      }
    };
    promise.then(cleanup, cleanup);

    return promise;
  }

  private async executeWithRetry(key: string, fn: () => Promise<V>): Promise<V> {
    const maxAttempts = this._retryCount + 1;
    let lastError: unknown;

    for (let i = 0; i < maxAttempts; i++) {
      try {
        const value = await fn();
        this.slots.set(key, { value, cachedAt: Date.now() });
        return value;
      } catch (e) {
        lastError = e;
      }
    }

    throw lastError;
  }

  private checkStale(slot: CacheSlot<V>): boolean {
    return this._isStale ? this._isStale(slot.value, slot.cachedAt) : false;
  }
}
