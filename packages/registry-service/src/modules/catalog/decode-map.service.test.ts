// @def.boundary registry-system
// @def.doc registry-system

import { describe, expect, it } from 'vitest';
import type { Catalog } from '@qa-sdk/core';
import type { CatalogRecord, CatalogStore } from '../../stores/catalog-store.js';
import { DecodeMapService } from './decode-map.service.js';

const record: CatalogRecord = {
  id: 'demo',
  name: 'Demo',
  data: JSON.stringify({
    id: 'demo',
    axes: {
      env: {
        id: 'env',
        name: 'Environment',
        versions: {
          v1: { entries: ['dev', 'prod'], capacity: 8 },
        },
      },
    },
    prefixes: {
      service: {
        id: 'service',
        name: 'Service',
        labels: ['env'],
        dims: { env: { kind: 'axis', axisId: 'env' } },
        versions: [{ version: 'v1', axisVersions: { env: 'v1' } }],
      },
    },
  } satisfies Partial<Catalog>),
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const store: CatalogStore = {
  register: async () => undefined,
  get: async () => record,
  list: async () => [record],
  update: async () => undefined,
  delete: async () => undefined,
};

describe('DecodeMapService', () => {
  it('uses actual entries length for shape, not reserved axis capacity', async () => {
    const maps = await new DecodeMapService(store).list('demo');

    expect(maps).toHaveLength(1);
    expect(maps[0]).toMatchObject({ shape: [2], size: 2 });
    expect(maps[0]?.dims[0]?.entries).toEqual(['dev', 'prod']);
  });
});
