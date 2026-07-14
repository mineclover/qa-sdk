// @def.boundary index-meta-system
// @def.doc index-meta-system

/**
 * PositionEngine — CoalescingCache 테스트 (L1/L2 기반 프리미티브)
 *
 * 동시성 시나리오:
 * 1. 기본 get/set CRUD
 * 2. Single-flight: 동시 reads → 1 fetch, 결과 공유
 * 3. Staleness 감지 → 자동 갱신
 * 4. 쓰기 배타성: inflight 대기 후 독립 실행
 * 5. 읽기 중 쓰기, 쓰기 중 읽기 상호작용
 * 6. 실패 재시도 + 에러 전파
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { CoalescingCache } from './coalescing-cache.js';

// ── 헬퍼 ──────────────────────────────────────────────────

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: Error) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** 다음 microtask까지 양보 */
const tick = () => new Promise<void>((r) => setTimeout(r, 0));

// ── 테스트 ────────────────────────────────────────────────

describe('CoalescingCache', () => {
  afterEach(() => vi.restoreAllMocks());

  // ── 기본 CRUD ──────────────────────────────────────────

  it('get — miss 시 fetcher를 호출하고 결과를 캐싱한다', async () => {
    const cache = new CoalescingCache<number>();
    const fetcher = vi.fn().mockResolvedValue(42);

    expect(await cache.get('a', fetcher)).toBe(42);
    expect(fetcher).toHaveBeenCalledTimes(1);

    // 두 번째 get → 캐시 히트, fetcher 재호출 없음
    expect(await cache.get('a', fetcher)).toBe(42);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('set — 값을 쓰고 캐시에 반영한다', async () => {
    const cache = new CoalescingCache<number>();

    const v = await cache.set('a', async () => 99);
    expect(v).toBe(99);
    expect(cache.peek('a')).toBe(99);
  });

  it('서로 다른 키는 독립적으로 동작한다', async () => {
    const cache = new CoalescingCache<number>();
    const f1 = vi.fn().mockResolvedValue(1);
    const f2 = vi.fn().mockResolvedValue(2);

    const [v1, v2] = await Promise.all([cache.get('a', f1), cache.get('b', f2)]);

    expect(v1).toBe(1);
    expect(v2).toBe(2);
    expect(f1).toHaveBeenCalledTimes(1);
    expect(f2).toHaveBeenCalledTimes(1);
  });

  // ── Single-flight (읽기 coalescing) ────────────────────

  it('동시 get — 1개의 fetch만 실행되고 결과를 공유한다', async () => {
    const cache = new CoalescingCache<number>();
    const d = deferred<number>();
    const fetcher = vi.fn().mockReturnValue(d.promise);

    const p1 = cache.get('a', fetcher);
    const p2 = cache.get('a', fetcher);
    const p3 = cache.get('a', fetcher);

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(cache.inflightCount).toBe(1);

    d.resolve(42);

    const [v1, v2, v3] = await Promise.all([p1, p2, p3]);
    expect(v1).toBe(42);
    expect(v2).toBe(42);
    expect(v3).toBe(42);
  });

  it('fetch 완료 후 inflight가 정리된다', async () => {
    const cache = new CoalescingCache<number>();
    await cache.get('a', async () => 1);
    expect(cache.inflightCount).toBe(0);
  });

  // ── Staleness ──────────────────────────────────────────

  it('stale 판정 시 fetch를 다시 트리거한다', async () => {
    let now = 1000;
    vi.spyOn(Date, 'now').mockImplementation(() => now);

    const cache = new CoalescingCache<number>({
      isStale: (_v, cachedAt) => now - cachedAt > 100,
    });

    const fetcher = vi.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(2);

    expect(await cache.get('a', fetcher)).toBe(1);
    expect(fetcher).toHaveBeenCalledTimes(1);

    // fresh 상태에서 호출 → 캐시 히트
    now = 1050;
    expect(await cache.get('a', fetcher)).toBe(1);
    expect(fetcher).toHaveBeenCalledTimes(1);

    // stale 상태에서 호출 → 갱신
    now = 1200;
    expect(await cache.get('a', fetcher)).toBe(2);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('isStale 미지정 시 캐시는 항상 fresh이다', async () => {
    const cache = new CoalescingCache<number>();
    const fetcher = vi.fn().mockResolvedValue(1);

    await cache.get('a', fetcher);
    await cache.get('a', fetcher);
    await cache.get('a', fetcher);

    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  // ── 쓰기 배타성 ───────────────────────────────────────

  it('set — inflight 읽기가 있으면 완료 후 실행한다', async () => {
    const cache = new CoalescingCache<number>();
    const d = deferred<number>();
    const order: string[] = [];

    const fetcher = vi.fn().mockImplementation(() => {
      order.push('fetch-start');
      return d.promise;
    });
    const updater = vi.fn().mockImplementation(async () => {
      order.push('update');
      return 99;
    });

    const pGet = cache.get('a', fetcher);
    const pSet = cache.set('a', updater);

    // updater는 아직 실행되지 않음
    expect(updater).not.toHaveBeenCalled();

    d.resolve(42);
    expect(await pGet).toBe(42);

    const setResult = await pSet;
    expect(setResult).toBe(99);
    expect(order).toEqual(['fetch-start', 'update']);
  });

  it('동시 set — 각각 독립 실행, 직렬화된다', async () => {
    const cache = new CoalescingCache<number>();
    const d1 = deferred<number>();
    const d2 = deferred<number>();
    const order: string[] = [];

    const p1 = cache.set('a', () => {
      order.push('write1');
      return d1.promise;
    });
    const p2 = cache.set('a', () => {
      order.push('write2');
      return d2.promise;
    });

    // write1만 실행 중
    expect(order).toEqual(['write1']);

    d1.resolve(1);
    expect(await p1).toBe(1);

    // write1 완료 후 write2 실행
    await tick();
    expect(order).toEqual(['write1', 'write2']);

    d2.resolve(2);
    expect(await p2).toBe(2);
    expect(cache.peek('a')).toBe(2);
  });

  // ── 읽기-쓰기 상호작용 ────────────────────────────────

  it('쓰기 중 읽기 → 쓰기 결과를 공유한다', async () => {
    const cache = new CoalescingCache<number>();
    const d = deferred<number>();
    const readFetcher = vi.fn().mockResolvedValue(0);

    const pSet = cache.set('a', () => d.promise);

    // 쓰기 inflight 중 읽기 → 쓰기의 inflight에 합류
    const pGet = cache.get('a', readFetcher);
    expect(readFetcher).not.toHaveBeenCalled();

    d.resolve(99);

    expect(await pSet).toBe(99);
    expect(await pGet).toBe(99);
  });

  // ── 재시도 ─────────────────────────────────────────────

  it('실패 시 retryCount만큼 재시도한다', async () => {
    const cache = new CoalescingCache<number>({ retryCount: 2 });
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(new Error('fail1'))
      .mockRejectedValueOnce(new Error('fail2'))
      .mockResolvedValue(42);

    expect(await cache.get('a', fetcher)).toBe(42);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it('재시도 소진 시 에러를 전파한다', async () => {
    const cache = new CoalescingCache<number>({ retryCount: 1 });
    const fetcher = vi.fn().mockRejectedValue(new Error('fail'));

    await expect(cache.get('a', fetcher)).rejects.toThrow('fail');
    expect(fetcher).toHaveBeenCalledTimes(2); // 1 + 1 retry
  });

  it('fetch 실패 시 모든 대기자에게 에러가 전파된다', async () => {
    const cache = new CoalescingCache<number>();
    const d = deferred<number>();
    const fetcher = vi.fn().mockReturnValue(d.promise);

    const p1 = cache.get('a', fetcher);
    const p2 = cache.get('a', fetcher);

    d.reject(new Error('boom'));

    await expect(p1).rejects.toThrow('boom');
    await expect(p2).rejects.toThrow('boom');
  });

  it('실패 후 다음 get은 새로운 fetch를 시도한다', async () => {
    const cache = new CoalescingCache<number>();
    const fetcher = vi.fn().mockRejectedValueOnce(new Error('fail')).mockResolvedValueOnce(42);

    await expect(cache.get('a', fetcher)).rejects.toThrow('fail');
    expect(cache.has('a')).toBe(false); // 실패 시 캐시 안 됨

    expect(await cache.get('a', fetcher)).toBe(42);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  // ── invalidate / clear / peek / has ────────────────────

  it('invalidate → 다음 get에서 fetch를 트리거한다', async () => {
    const cache = new CoalescingCache<number>();
    const fetcher = vi.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(2);

    expect(await cache.get('a', fetcher)).toBe(1);

    cache.invalidate('a');
    expect(cache.has('a')).toBe(false);

    expect(await cache.get('a', fetcher)).toBe(2);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('clear → 전체 캐시 초기화', async () => {
    const cache = new CoalescingCache<number>();
    await cache.get('a', async () => 1);
    await cache.get('b', async () => 2);

    expect(cache.size).toBe(2);
    cache.clear();
    expect(cache.size).toBe(0);
    expect(cache.has('a')).toBe(false);
    expect(cache.has('b')).toBe(false);
  });

  it('peek — fetch 없이 캐시 값만 조회한다', async () => {
    const cache = new CoalescingCache<number>();

    expect(cache.peek('a')).toBeUndefined();

    await cache.get('a', async () => 42);
    expect(cache.peek('a')).toBe(42);
  });

  // ── set이 읽기 coalescing에 참여하지 않는지 검증 ───────

  it('set은 다른 set의 결과를 공유하지 않는다', async () => {
    const cache = new CoalescingCache<number>();
    const d1 = deferred<number>();

    const p1 = cache.set('a', () => d1.promise);

    // 두 번째 set은 첫 번째가 끝난 뒤 자체 updater 실행
    const p2 = cache.set('a', async () => 200);

    d1.resolve(100);
    expect(await p1).toBe(100);
    expect(await p2).toBe(200); // 자체 결과
    expect(cache.peek('a')).toBe(200); // 마지막 쓰기가 최종값
  });
});
