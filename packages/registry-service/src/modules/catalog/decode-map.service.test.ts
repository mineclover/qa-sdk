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
  it('shape는 axis capacity이고 headroom은 reserved entry로 채운다 (ADR-010, D-1)', async () => {
    const maps = await new DecodeMapService(store).list('demo');

    expect(maps).toHaveLength(1);
    expect(maps[0]).toMatchObject({ shape: [8], size: 8 });
    expect(maps[0]?.dims[0]?.entries).toEqual([
      'dev',
      'prod',
      ...Array.from({ length: 6 }, (_, i) => `(reserved:${i + 2})`),
    ]);
  });
});
