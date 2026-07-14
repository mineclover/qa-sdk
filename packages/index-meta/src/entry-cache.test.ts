// @def.boundary index-meta-system
// @def.doc index-meta-system

/**
 * PositionEngine — EntryCache (L1) 테스트
 * prefix+version 파티션 양방향 캐시 + single-flight
 */
import { describe, it, expect } from 'vitest';
import { EntryCache } from './entry-cache.js';
import type { IndexMetaStore, EntryRecord } from './index-meta-store.js';

/** 최소 IndexMetaStore stub — getEntries만 구현 */
function stubStore(data: Record<string, EntryRecord[]>): IndexMetaStore {
  return {
    getEntries: async (prefix: string, versionId: string) => {
      return data[`${prefix}\0${versionId}`] ?? [];
    },
  } as unknown as IndexMetaStore;
}

function entry(prefix: string, versionId: string, position: number, value: string): EntryRecord {
  return { prefix, versionId, position, value, createdAt: '2026-01-01T00:00:00Z' };
}

describe('PositionEngine: EntryCache', () => {
  const entries: EntryRecord[] = [
    entry('role', 'v1', 1, 'admin'),
    entry('role', 'v1', 2, 'editor'),
    entry('role', 'v1', 3, 'viewer'),
  ];

  it('getByPosition — bulk load 후 O(1)', async () => {
    const store = stubStore({ 'role\0v1': entries });
    const cache = new EntryCache(store);

    expect(await cache.getByPosition('role', 'v1', 1)).toBe('admin');
    expect(await cache.getByPosition('role', 'v1', 2)).toBe('editor');
    expect(await cache.getByPosition('role', 'v1', 99)).toBeNull();
  });

  it('getByValue — 역방향 조회', async () => {
    const store = stubStore({ 'role\0v1': entries });
    const cache = new EntryCache(store);

    expect(await cache.getByValue('role', 'v1', 'admin')).toBe(1);
    expect(await cache.getByValue('role', 'v1', 'editor')).toBe(2);
    expect(await cache.getByValue('role', 'v1', 'ghost')).toBeNull();
  });

  it('getAll — 전체 entry 반환', async () => {
    const store = stubStore({ 'role\0v1': entries });
    const cache = new EntryCache(store);

    const all = await cache.getAll('role', 'v1');
    expect(all).toHaveLength(3);
  });

  it('exists — 캐시에서 O(1) 중복 체크', async () => {
    const store = stubStore({ 'role\0v1': entries });
    const cache = new EntryCache(store);

    // 파티션 미로드 → false
    expect(cache.exists('role', 'v1', 'admin')).toBe(false);

    // 로드 후 → true
    await cache.getByPosition('role', 'v1', 1);
    expect(cache.exists('role', 'v1', 'admin')).toBe(true);
    expect(cache.exists('role', 'v1', 'ghost')).toBe(false);
  });

  it('size — 파티션 크기', async () => {
    const store = stubStore({ 'role\0v1': entries });
    const cache = new EntryCache(store);

    expect(cache.size('role', 'v1')).toBe(0); // 미로드
    await cache.getAll('role', 'v1');
    expect(cache.size('role', 'v1')).toBe(3);
  });

  it('append — 캐시에 entry 추가', async () => {
    const store = stubStore({ 'role\0v1': entries });
    const cache = new EntryCache(store);

    await cache.getAll('role', 'v1'); // 파티션 로드
    cache.append('role', 'v1', entry('role', 'v1', 4, 'guest'));

    expect(await cache.getByPosition('role', 'v1', 4)).toBe('guest');
    expect(await cache.getByValue('role', 'v1', 'guest')).toBe(4);
    expect(cache.size('role', 'v1')).toBe(4);
  });

  it('append — 미로드 파티션에는 무시', () => {
    const store = stubStore({});
    const cache = new EntryCache(store);
    // 에러 없이 무시
    cache.append('role', 'v1', entry('role', 'v1', 1, 'admin'));
    expect(cache.size('role', 'v1')).toBe(0);
  });

  it('invalidate — 재로드 트리거', async () => {
    let fetchCount = 0;
    const store = {
      getEntries: async () => {
        fetchCount++;
        return entries;
      },
    } as unknown as IndexMetaStore;

    const cache = new EntryCache(store);
    await cache.getAll('role', 'v1');
    expect(fetchCount).toBe(1);

    // 두 번째 호출 — 캐시 히트
    await cache.getAll('role', 'v1');
    expect(fetchCount).toBe(1);

    // invalidate 후 — 재로드
    cache.invalidate('role', 'v1');
    await cache.getAll('role', 'v1');
    expect(fetchCount).toBe(2);
  });

  it('single-flight — 동시 로드 시 fetch 1회', async () => {
    let fetchCount = 0;
    const store = {
      getEntries: async () => {
        fetchCount++;
        await new Promise((r) => setTimeout(r, 10));
        return entries;
      },
    } as unknown as IndexMetaStore;

    const cache = new EntryCache(store);
    const [a, b, c] = await Promise.all([
      cache.getByPosition('role', 'v1', 1),
      cache.getByValue('role', 'v1', 'editor'),
      cache.getAll('role', 'v1'),
    ]);

    expect(fetchCount).toBe(1);
    expect(a).toBe('admin');
    expect(b).toBe(2);
    expect(c).toHaveLength(3);
  });

  it('partitionCount', async () => {
    const store = stubStore({
      'role\0v1': entries,
      'perm\0v1': [entry('perm', 'v1', 1, 'read')],
    });
    const cache = new EntryCache(store);
    await cache.getAll('role', 'v1');
    await cache.getAll('perm', 'v1');
    expect(cache.partitionCount).toBe(2);

    cache.clear();
    expect(cache.partitionCount).toBe(0);
  });
});
