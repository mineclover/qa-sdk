import type { DecodeMap } from 'index-meta-workers';
import { describe, expect, it, vi } from 'vitest';
import { createDecodeMapSync } from './decode-map-sync.js';

const REGISTRY = 'http://registry.test';

function map(indexId: string): DecodeMap {
  return { indexId } as unknown as DecodeMap;
}

/** registry 응답을 바꿔 가며 쓰는 fake — 호출 경로를 기록한다 */
function fakeRegistry() {
  const state = {
    digests: { demo: `sha256:${'a'.repeat(64)}` } as Record<string, string | null>,
    generationStatus: 200,
    maps: [map('order'), map('payment')],
    decodeMapStatus: 200,
    calls: [] as string[],
  };
  const fetchFn = vi.fn(async (input: string | URL | Request) => {
    const path = new URL(String(input)).pathname;
    state.calls.push(path);
    if (path === '/health/generation') {
      const generations = Object.fromEntries(
        Object.entries(state.digests).map(([id, catalogDigest]) => [id, { catalogDigest }]),
      );
      return Response.json({ generations }, { status: state.generationStatus });
    }
    return Response.json(state.maps, { status: state.decodeMapStatus });
  }) as unknown as typeof fetch;
  return { state, fetchFn };
}

function setup() {
  const registry = fakeRegistry();
  const pool = { loadMap: vi.fn() };
  const logger = { info: vi.fn(), warn: vi.fn() };
  const sync = createDecodeMapSync({
    registryUrl: REGISTRY,
    pool,
    logger,
    fetch: registry.fetchFn,
  });
  return { ...registry, pool, sync };
}

describe('createDecodeMapSync (S-8)', () => {
  it('처음에는 decode-map을 모두 불러온다', async () => {
    const { sync, pool } = setup();
    expect(await sync.sync()).toMatchObject({ status: 'loaded', loaded: 2, total: 2 });
    expect(pool.loadMap).toHaveBeenCalledTimes(2);
  });

  it('catalog digest가 같으면 decode-map을 다시 받지 않는다', async () => {
    const { sync, state, pool } = setup();
    await sync.sync();
    state.calls.length = 0;

    expect(await sync.sync()).toMatchObject({ status: 'unchanged' });
    expect(state.calls).toEqual(['/health/generation']);
    expect(pool.loadMap).toHaveBeenCalledTimes(2);
  });

  it('catalog digest가 바뀌면 다시 불러온다', async () => {
    const { sync, state, pool } = setup();
    await sync.sync();
    state.digests.demo = `sha256:${'b'.repeat(64)}`;
    state.maps = [map('order'), map('payment'), map('refund')];

    expect(await sync.sync()).toMatchObject({ status: 'loaded', loaded: 3 });
    expect(pool.loadMap).toHaveBeenCalledTimes(5);
  });

  it('digest를 알 수 없으면(구버전 registry·장애) 매번 다시 불러온다', async () => {
    const { sync, state, pool } = setup();
    state.generationStatus = 503;
    await sync.sync();
    await sync.sync();
    expect(pool.loadMap).toHaveBeenCalledTimes(4);

    state.generationStatus = 200;
    state.digests.demo = null; // digest 계산 실패한 catalog
    await sync.sync();
    expect(pool.loadMap).toHaveBeenCalledTimes(6);
  });

  it('decode-map 조회가 실패하면 기존 decoder를 유지하고 다음 주기에 다시 시도한다', async () => {
    const { sync, state, pool } = setup();
    await sync.sync();
    const loadedGeneration = sync.generation;

    state.digests.demo = `sha256:${'c'.repeat(64)}`;
    state.decodeMapStatus = 500;
    expect(await sync.sync()).toMatchObject({ status: 'failed' });
    expect(sync.generation).toBe(loadedGeneration);

    state.decodeMapStatus = 200;
    expect(await sync.sync()).toMatchObject({ status: 'loaded' });
    expect(pool.loadMap).toHaveBeenCalledTimes(4);
  });
});
