// @def.boundary ingest-system
// @def.doc ingest-system

/**
 * D1KeyObservationStore — version 컬럼 동작 검증 (P1+P3 이행).
 *
 * coordinate-storage.rule §1.1 준수 검증:
 *   - PK = (prefix_id, version, address)
 *   - packed_key parse → version/address 자동 분리 저장
 *   - prefix_observation_prefixes도 version별 분리 집계
 */

import { NodeSqliteDriver } from 'index-meta';
import { drizzle } from 'drizzle-orm/node-sqlite';
import { migrate } from 'drizzle-orm/node-sqlite/migrator';
import { beforeEach, describe, expect, it } from 'vitest';

import { createD1Drizzle, type D1Db } from './d1-db-type.js';
import { D1KeyObservationStore } from './d1-key-observation-store.js';

const migrationsFolder = new URL('../../drizzle', import.meta.url).pathname;

function createDbWithKeyObs(): D1Db {
  const driver = new NodeSqliteDriver(':memory:', null);
  const drizzleDb = drizzle({ client: driver.$client });
  // drizzle migration이 key_observations(version/address 복합 PK)를 포함한다
  migrate(drizzleDb, { migrationsFolder });
  return createD1Drizzle(driver.$client);
}

describe('D1KeyObservationStore — version 컬럼 동작', () => {
  let store: D1KeyObservationStore;

  beforeEach(() => {
    const db = createDbWithKeyObs();
    store = new D1KeyObservationStore(db);
  });

  it('observe 시 packed_key parse → version/address 자동 분리 저장', async () => {
    await store.observe({
      packedKey: 'svc:v1:42',
      prefixId: 'svc',
      registered: true,
      timestamp: '2026-04-22T10:00:00Z',
    });
    const rows = await store.findByPrefix('svc');
    expect(rows).toHaveLength(1);
    expect(rows[0].version).toBe('v1');
    expect(rows[0].address).toBe(42);
    expect(rows[0].packedKey).toBe('svc:v1:42');
  });

  it('같은 prefix·다른 version은 별도 row', async () => {
    await store.observe({
      packedKey: 'svc:v1:5',
      prefixId: 'svc',
      registered: true,
      timestamp: '2026-04-22T10:00:00Z',
    });
    await store.observe({
      packedKey: 'svc:v2:5',
      prefixId: 'svc',
      registered: true,
      timestamp: '2026-04-22T10:01:00Z',
    });
    const rows = await store.findByPrefix('svc');
    expect(rows).toHaveLength(2);
    expect(new Set(rows.map((r) => r.version))).toEqual(new Set(['v1', 'v2']));
  });

  it('같은 (prefix, version, address) 재관측 → count 증가', async () => {
    await store.observe({
      packedKey: 'svc:v1:1',
      prefixId: 'svc',
      registered: true,
      timestamp: '2026-04-22T10:00:00Z',
    });
    await store.observe({
      packedKey: 'svc:v1:1',
      prefixId: 'svc',
      registered: true,
      timestamp: '2026-04-22T10:01:00Z',
    });
    const rows = await store.findByPrefix('svc');
    expect(rows).toHaveLength(1);
    expect(rows[0].count).toBe(2);
  });

  it('invalid packed_key (포맷 위반) → 무시 + 카운트 0 (silent skip)', async () => {
    await store.observe({
      packedKey: 'invalid-format',
      prefixId: 'svc',
      registered: true,
      timestamp: '2026-04-22T10:00:00Z',
    });
    const summary = await store.summary();
    expect(summary.totalKeys).toBe(0);
  });

  it('entry에 explicit version/address 주어지면 packed_key parse 무시', async () => {
    await store.observe({
      packedKey: 'svc:v1:42',
      prefixId: 'svc',
      version: 'vX', // explicit override
      address: 999,
      registered: true,
      timestamp: '2026-04-22T10:00:00Z',
    });
    const rows = await store.findByPrefix('svc');
    expect(rows[0].version).toBe('vX');
    expect(rows[0].address).toBe(999);
  });

  it('prefixSummary는 version별로 분리된 row 반환', async () => {
    await store.observe({
      packedKey: 'svc:v1:1',
      prefixId: 'svc',
      registered: true,
      timestamp: '2026-04-22T10:00:00Z',
    });
    await store.observe({
      packedKey: 'svc:v1:2',
      prefixId: 'svc',
      registered: true,
      timestamp: '2026-04-22T10:01:00Z',
    });
    await store.observe({
      packedKey: 'svc:v2:1',
      prefixId: 'svc',
      registered: true,
      timestamp: '2026-04-22T10:02:00Z',
    });

    const sums = await store.prefixSummary('svc');
    expect(sums).toHaveLength(2);
    const byVersion = Object.fromEntries(sums.map((s) => [s.version, s]));
    expect(byVersion.v1.distinctKeys).toBe(2);
    expect(byVersion.v2.distinctKeys).toBe(1);
  });
});
