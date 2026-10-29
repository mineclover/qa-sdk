import type { KeyObservation, KeyObservationStore } from '@qa-sdk/core';
import { describe, expect, it, vi } from 'vitest';
import { createKeyObservationRoutes } from './key-observations.js';

function fakeStore(): KeyObservationStore {
  const observation = {
    packedKey: 'service:v1:3',
    prefixId: 'service',
  } as unknown as KeyObservation;
  return {
    observe: vi.fn(),
    observeBatch: vi.fn(),
    findByPrefix: vi.fn(async () => [observation]),
    summary: vi.fn(async () => ({
      totalKeys: 1,
      totalCount: 4,
      registeredKeys: 0,
      unregisteredKeys: 1,
      prefixBreakdown: { service: 1 },
    })),
    findStale: vi.fn(async () => []),
    findUnregistered: vi.fn(async () => [observation]),
    prefixSummary: vi.fn(async () => []),
  };
}

describe('key observation routes (U-4)', () => {
  it('store가 없으면 503 inactive', async () => {
    const res = await createKeyObservationRoutes({}).request('/v1/key-observations/summary');
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ status: 'inactive' });
  });

  it('summary는 전체 요약과 prefix 집계를 함께 돌려준다', async () => {
    const store = fakeStore();
    const res = await createKeyObservationRoutes({ keyObservationStore: store }).request(
      '/v1/key-observations/summary',
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      summary: { totalKeys: 1, unregisteredKeys: 1 },
      prefixes: [],
    });
  });

  it('limit은 1~500으로 제한하고 잘못된 값은 기본값을 쓴다', async () => {
    const store = fakeStore();
    const app = createKeyObservationRoutes({ keyObservationStore: store });
    await app.request('/v1/key-observations/unregistered?limit=9999');
    await app.request('/v1/key-observations/unregistered?limit=abc');
    expect(store.findUnregistered).toHaveBeenNthCalledWith(1, { limit: 500 });
    expect(store.findUnregistered).toHaveBeenNthCalledWith(2, { limit: 50 });
  });

  it('prefix 조회는 orderBy를 count·last_seen으로만 받는다', async () => {
    const store = fakeStore();
    const app = createKeyObservationRoutes({ keyObservationStore: store });
    await app.request('/v1/key-observations/prefixes/service?orderBy=last_seen&limit=5');
    await app.request('/v1/key-observations/prefixes/service?orderBy=drop');
    expect(store.findByPrefix).toHaveBeenNthCalledWith(1, 'service', {
      limit: 5,
      orderBy: 'last_seen',
    });
    expect(store.findByPrefix).toHaveBeenNthCalledWith(2, 'service', {
      limit: 50,
      orderBy: 'count',
    });
  });
});
