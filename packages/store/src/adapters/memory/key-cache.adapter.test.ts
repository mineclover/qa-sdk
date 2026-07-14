// @def.boundary persistence-system-root
// @def.doc persistence-system-root

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { InMemoryKeyCache } from './key-cache.adapter.js';

describe('InMemoryKeyCache', () => {
  let cache: InMemoryKeyCache<string>;

  beforeEach(() => {
    vi.useFakeTimers();
    cache = new InMemoryKeyCache<string>();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('set/get 기본 동작', async () => {
    await cache.set('k1', 'v1', 60_000);
    expect(await cache.get('k1')).toBe('v1');
  });

  it('존재하지 않는 키 → undefined', async () => {
    expect(await cache.get('missing')).toBeUndefined();
  });

  it('TTL 만료 시 undefined 반환 + eviction 카운트', async () => {
    await cache.set('k1', 'v1', 100);
    vi.advanceTimersByTime(101);
    expect(await cache.get('k1')).toBeUndefined();
    expect(cache.stats().evictions).toBe(1);
  });

  it('TTL 0 → 영구 캐시', async () => {
    await cache.set('k1', 'v1', 0);
    vi.advanceTimersByTime(999_999);
    expect(await cache.get('k1')).toBe('v1');
  });

  it('has — 존재/만료 판별', async () => {
    await cache.set('k1', 'v1', 100);
    expect(await cache.has('k1')).toBe(true);
    vi.advanceTimersByTime(101);
    expect(await cache.has('k1')).toBe(false);
  });

  it('delete — 단건 삭제', async () => {
    await cache.set('k1', 'v1', 60_000);
    expect(await cache.delete('k1')).toBe(true);
    expect(await cache.get('k1')).toBeUndefined();
    expect(await cache.delete('k1')).toBe(false);
  });

  it('clear — 전체 삭제 + 통계 초기화', async () => {
    await cache.set('k1', 'v1', 60_000);
    await cache.set('k2', 'v2', 60_000);
    await cache.get('k1'); // hit
    await cache.clear();
    expect(cache.stats().size).toBe(0);
    expect(cache.stats().hits).toBe(0);
  });

  it('stats — hit/miss 카운트', async () => {
    await cache.set('k1', 'v1', 60_000);
    await cache.get('k1'); // hit
    await cache.get('k1'); // hit
    await cache.get('missing'); // miss
    const s = cache.stats();
    expect(s.hits).toBe(2);
    expect(s.misses).toBe(1);
    expect(s.size).toBe(1);
  });

  it('maxSize 초과 시 LRU eviction', async () => {
    const small = new InMemoryKeyCache<string>({ maxSize: 3 });
    await small.set('a', '1', 60_000);
    await small.set('b', '2', 60_000);
    await small.set('c', '3', 60_000);
    // a가 가장 오래됨 → d 삽입 시 a 제거
    await small.set('d', '4', 60_000);
    expect(await small.get('a')).toBeUndefined();
    expect(await small.get('b')).toBe('2');
    expect(small.stats().evictions).toBe(1);
  });

  it('get으로 LRU 순서 갱신', async () => {
    const small = new InMemoryKeyCache<string>({ maxSize: 3 });
    await small.set('a', '1', 60_000);
    await small.set('b', '2', 60_000);
    await small.set('c', '3', 60_000);
    // a를 get → LRU 순서 갱신 (a가 최신)
    await small.get('a');
    // d 삽입 → b가 가장 오래됨 → b 제거
    await small.set('d', '4', 60_000);
    expect(await small.get('a')).toBe('1');
    expect(await small.get('b')).toBeUndefined();
  });

  it('동일 키 덮어쓰기', async () => {
    await cache.set('k1', 'old', 60_000);
    await cache.set('k1', 'new', 60_000);
    expect(await cache.get('k1')).toBe('new');
    expect(cache.stats().size).toBe(1);
  });
});
