// @def.boundary registry-system
// @def.doc registry-system

import { computeCatalogDigest, shortDigest, type Catalog } from '@qa-sdk/core';
import { describe, expect, it } from 'vitest';
import { HealthController } from '../../health.controller.js';
import { InMemoryCatalogSnapshotStore } from '../../stores/catalog-snapshot-store.js';
import { InMemoryCatalogStore } from '../../stores/in-memory-catalog-store.js';
import { CatalogService } from './catalog.service.js';

function catalogWith(envEntries: string[], capacity = 4): Catalog {
  return {
    id: 'shop',
    name: 'shop',
    axes: { env: { id: 'env', name: 'env', versions: { v1: { entries: envEntries, capacity } } } },
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
}

function setup() {
  const catalogStore = new InMemoryCatalogStore();
  const snapshotStore = new InMemoryCatalogSnapshotStore();
  const service = CatalogService.fromStores({ catalogStore, snapshotStore });
  return { catalogStore, snapshotStore, service };
}

const payload = (catalog: Catalog) => ({
  id: catalog.id,
  name: catalog.name,
  data: JSON.stringify(catalog),
});

describe('CatalogService snapshot 발행 (Track B)', () => {
  it('등록 시 snapshot v1을 발행하고 응답에 digest를 담는다', async () => {
    const { service } = setup();
    const catalog = catalogWith(['dev', 'prod']);
    const result = await service.register(payload(catalog));
    expect(result.snapshot).toMatchObject({
      digest: await computeCatalogDigest(catalog),
      snapshotVersion: 1,
      issues: [],
    });
    expect((await service.getLatestSnapshot('shop')).snapshotVersion).toBe(1);
  });

  it('capacity 안의 entry 추가는 v2로 발행되고 parentDigest가 v1을 가리킨다', async () => {
    const { service } = setup();
    const v1 = (await service.register(payload(catalogWith(['dev', 'prod'])))).snapshot!;
    await service.update('shop', { data: JSON.stringify(catalogWith(['dev', 'prod', 'qa'])) });
    const latest = await service.getLatestSnapshot('shop');
    expect(latest).toMatchObject({ snapshotVersion: 2, parentDigest: v1.digest });
  });

  it('같은 prefix version의 breaking 변경은 422로 거부하고 catalog를 바꾸지 않는다', async () => {
    const { service, catalogStore } = setup();
    const original = catalogWith(['dev', 'prod']);
    await service.register(payload(original));
    await expect(
      service.update('shop', { data: JSON.stringify(catalogWith(['dev', 'prod'], 8)) }),
    ).rejects.toMatchObject({ statusCode: 422, extras: { code: 'MigrationRequired' } });
    expect((await catalogStore.get('shop'))?.data).toBe(JSON.stringify(original));
    expect((await service.getLatestSnapshot('shop')).snapshotVersion).toBe(1);
  });

  it('내용이 같은 update는 새 version을 만들지 않는다', async () => {
    const { service } = setup();
    const catalog = catalogWith(['dev', 'prod']);
    await service.register(payload(catalog));
    await service.update('shop', { data: JSON.stringify(catalog) });
    expect((await service.getLatestSnapshot('shop')).snapshotVersion).toBe(1);
  });

  it('store에 직접 쓴 catalog(시드)는 최신 snapshot 조회 시 발행된다', async () => {
    const { service, catalogStore } = setup();
    const catalog = catalogWith(['dev', 'prod']);
    await catalogStore.register({ ...payload(catalog), createdAt: 'x', updatedAt: 'x' });
    const latest = await service.getLatestSnapshot('shop');
    expect(latest).toMatchObject({
      snapshotVersion: 1,
      digest: await computeCatalogDigest(catalog),
    });
  });

  it('없는 digest나 다른 catalog의 digest는 404 UnknownCatalogSnapshot', async () => {
    const { service } = setup();
    await service.register(payload(catalogWith(['dev', 'prod'])));
    await expect(service.getSnapshot('shop', `sha256:${'0'.repeat(64)}`)).rejects.toMatchObject({
      statusCode: 404,
      extras: { code: 'UnknownCatalogSnapshot' },
    });
  });

  it('JSON이 아닌 data는 400', async () => {
    const { service } = setup();
    await expect(service.register({ id: 'bad', name: 'bad', data: '{' })).rejects.toMatchObject({
      statusCode: 400,
    });
  });
});

describe('health/generation', () => {
  it('catalogHash는 SDK GENERATION과 같은 shortDigest(catalogDigest)이다', async () => {
    const { catalogStore } = setup();
    const catalog = catalogWith(['dev', 'prod']);
    await catalogStore.register({ ...payload(catalog), createdAt: 'x', updatedAt: 'x' });
    const digest = await computeCatalogDigest(catalog);
    const { generations } = await new HealthController(catalogStore).generation();
    expect(generations.shop).toMatchObject({
      catalogDigest: digest,
      catalogHash: shortDigest(digest),
    });
  });
});
