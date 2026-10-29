import type { Catalog } from '@qa-sdk/core';

/** snapshot gate 테스트 주입 데이터 */
export function gateCatalog(envEntries: string[], capacity = 4, id = 'shop'): Catalog {
  return {
    id,
    name: id,
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
