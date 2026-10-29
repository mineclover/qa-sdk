// @def.boundary registry-system
// @def.doc registry-system

import { buildCatalogSnapshot, type Catalog } from '@qa-sdk/core';
import { describe, expect, it } from 'vitest';
import { createRegistryDatabaseDriver } from '../bootstrap/stores.js';
import {
  InMemoryCatalogSnapshotStore,
  type CatalogSnapshotStore,
} from './catalog-snapshot-store.js';
import { SqlCatalogSnapshotStore } from './sql-catalog-snapshot-store.js';

const SMALL_CATALOG: Catalog = {
  id: 'small',
  name: 'small',
  axes: {
    env: { id: 'env', name: 'env', versions: { v1: { entries: ['dev', 'prod'], capacity: 4 } } },
  },
  prefixes: {
    svc: {
      id: 'svc',
      name: 'svc',
      labels: ['env'],
      dims: { env: { kind: 'axis', axisId: 'env' } },
      versions: [{ version: 'v1', axisVersions: { env: 'v1' } }],
    },
  },
};

async function snapshotOf(
  catalog: Catalog,
  snapshotVersion: number,
  parentDigest: string | null = null,
) {
  return (await buildCatalogSnapshot(catalog, { snapshotVersion, parentDigest })).snapshot;
}

const implementations: [string, () => Promise<CatalogSnapshotStore>][] = [
  ['InMemory', async () => new InMemoryCatalogSnapshotStore()],
  ['Sql', async () => new SqlCatalogSnapshotStore(await createRegistryDatabaseDriver(':memory:'))],
];

describe.each(implementations)('%sCatalogSnapshotStore', (_name, create) => {
  it('발행 후 digest·latest로 조회되고, 같은 내용 재발행은 exists', async () => {
    const store = await create();
    const snapshot = await snapshotOf(SMALL_CATALOG, 1);
    expect(await store.publish(snapshot)).toBe('created');
    expect(await store.publish(structuredClone(snapshot))).toBe('exists');
    expect(await store.get(snapshot.digest)).toEqual(snapshot);
    expect((await store.latest(SMALL_CATALOG.id))?.digest).toBe(snapshot.digest);
  });

  it('같은 digest에 다른 내용은 CONFLICT', async () => {
    const store = await create();
    const snapshot = await snapshotOf(SMALL_CATALOG, 1);
    await store.publish(snapshot);
    await expect(store.publish({ ...snapshot, snapshotVersion: 2 })).rejects.toMatchObject({
      code: 'CONFLICT',
    });
  });

  it('snapshotVersion이 단조 증가하지 않으면 CONFLICT, 증가하면 latest가 바뀐다', async () => {
    const store = await create();
    const v1 = await snapshotOf(SMALL_CATALOG, 1);
    await store.publish(v1);
    const renamed = { ...SMALL_CATALOG, name: 'renamed' };
    await expect(store.publish(await snapshotOf(renamed, 1, v1.digest))).rejects.toMatchObject({
      code: 'CONFLICT',
    });
    const v2 = await snapshotOf(renamed, 2, v1.digest);
    expect(await store.publish(v2)).toBe('created');
    expect((await store.latest(SMALL_CATALOG.id))?.digest).toBe(v2.digest);
    expect(await store.get(v1.digest)).toEqual(v1);
  });

  it('없는 digest·catalog는 undefined', async () => {
    const store = await create();
    expect(await store.get(`sha256:${'0'.repeat(64)}`)).toBeUndefined();
    expect(await store.latest('none')).toBeUndefined();
  });
});
