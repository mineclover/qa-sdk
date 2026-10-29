import { buildCatalogSnapshot } from '@qa-sdk/core';
import { describe, expect, it, vi } from 'vitest';
import { gateCatalog } from './__fixtures__/snapshot-catalog.js';
import { createSnapshotRegistryClient } from './snapshot-registry-client.js';

async function snapshot() {
  return (
    await buildCatalogSnapshot(gateCatalog(['dev']), { snapshotVersion: 1, parentDigest: null })
  ).snapshot;
}

function respond(status: number, body: string) {
  return new Response(body, { status });
}

describe('snapshot registry client', () => {
  it('latest는 TTL 동안 캐시하고 만료 후 다시 조회한다', async () => {
    const s = await snapshot();
    const fetchImpl = vi.fn(async () => respond(200, JSON.stringify(s)));
    let clock = 0;
    const client = createSnapshotRegistryClient({
      registryUrl: 'http://registry/',
      fetchImpl: fetchImpl as unknown as typeof fetch,
      latestTtlMs: 1_000,
      now: () => clock,
    });
    await client.latest('shop');
    await client.latest('shop');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0][0]).toBe('http://registry/catalogs/shop/snapshots/latest');
    clock = 2_000;
    await client.latest('shop');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('digest 조회는 영구 캐시, latest로 받은 snapshot도 digest 캐시에 들어간다', async () => {
    const s = await snapshot();
    const fetchImpl = vi.fn(async () => respond(200, JSON.stringify(s)));
    const client = createSnapshotRegistryClient({
      registryUrl: 'http://registry',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    await client.latest('shop');
    expect(await client.byDigest('shop', s.digest)).toEqual(s);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('404는 undefined, 그 외 오류와 JSON이 아닌 응답은 throw', async () => {
    const notFound = createSnapshotRegistryClient({
      registryUrl: 'http://r',
      fetchImpl: (async () => respond(404, '')) as unknown as typeof fetch,
    });
    expect(await notFound.byDigest('shop', 'sha256:x')).toBeUndefined();
    const broken = createSnapshotRegistryClient({
      registryUrl: 'http://r',
      fetchImpl: (async () => respond(500, '')) as unknown as typeof fetch,
    });
    await expect(broken.latest('shop')).rejects.toThrow('500');
    const garbage = createSnapshotRegistryClient({
      registryUrl: 'http://r',
      fetchImpl: (async () => respond(200, '<html>')) as unknown as typeof fetch,
    });
    await expect(garbage.latest('shop')).rejects.toThrow('JSON');
  });
});
