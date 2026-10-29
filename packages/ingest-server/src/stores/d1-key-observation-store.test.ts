// @def.boundary ingest-system
// @def.doc ingest-system

// ── d1-key-observation-store.test.ts 분리 from d1-stores.test.ts ───

import { describe, expect, it, beforeEach } from 'vitest';
import { NodeSqliteDriver } from 'index-meta-store';
import { D1KeyObservationStore } from './d1-key-observation-store.js';
import { createD1Drizzle, type D1Db } from './d1-db-type.js';
import { drizzle } from 'drizzle-orm/node-sqlite';
import { migrate } from 'drizzle-orm/node-sqlite/migrator';

const migrationsFolder = new URL('../../drizzle', import.meta.url).pathname;

// key_observations 테이블은 migration에 미포함 — DDL 직접 실행.
// coordinate-storage.rule §1.1 P1+P3 준수: PK = (prefix_id, version, address) / (prefix_id, version).
const KEY_OBS_DDL = `
CREATE TABLE IF NOT EXISTS key_observations (
  prefix_id       TEXT    NOT NULL,
  version         TEXT    NOT NULL,
  address         INTEGER NOT NULL,
  packed_key      TEXT    NOT NULL,
  registered      INTEGER NOT NULL DEFAULT 0,
  count           INTEGER NOT NULL DEFAULT 1,
  first_seen      TEXT    NOT NULL,
  last_seen       TEXT    NOT NULL,
  payload_summary TEXT    NOT NULL DEFAULT '{}',
  PRIMARY KEY (prefix_id, version, address)
);
CREATE INDEX IF NOT EXISTS idx_key_obs_packed ON key_observations(packed_key);
CREATE INDEX IF NOT EXISTS idx_key_obs_prefix_version ON key_observations(prefix_id, version);
CREATE INDEX IF NOT EXISTS idx_key_obs_last_seen ON key_observations(last_seen);
CREATE INDEX IF NOT EXISTS idx_key_obs_count ON key_observations(count DESC);
CREATE INDEX IF NOT EXISTS idx_key_obs_registered ON key_observations(registered);

CREATE TABLE IF NOT EXISTS key_observation_prefixes (
  prefix_id      TEXT    NOT NULL,
  version        TEXT    NOT NULL,
  distinct_keys  INTEGER NOT NULL DEFAULT 1,
  total_count    INTEGER NOT NULL DEFAULT 0,
  first_seen     TEXT    NOT NULL,
  last_seen      TEXT    NOT NULL,
  PRIMARY KEY (prefix_id, version)
);
`;

function createDbWithKeyObs(): D1Db {
  const driver = new NodeSqliteDriver(':memory:', null);
  const drizzleDb = drizzle({ client: driver.$client });
  migrate(drizzleDb, { migrationsFolder });
  // migration에 key_observations 미포함 — DDL 직접 실행
  (driver.$client as { exec(sql: string): void }).exec(KEY_OBS_DDL);
  return createD1Drizzle(driver.$client);
}

describe('D1KeyObservationStore', () => {
  let store: D1KeyObservationStore;

  beforeEach(() => {
    const db = createDbWithKeyObs();
    store = new D1KeyObservationStore(db);
  });

  it('observe + findByPrefix 라운드트립', async () => {
    await store.observe({
      packedKey: 'svc:v1:42',
      prefixId: 'svc',
      registered: true,
      timestamp: '2026-04-06T10:00:00Z',
      payloadFields: ['page', 'action'],
      samplePayload: { page: 'home', action: 'click' },
    });

    const results = await store.findByPrefix('svc');
    expect(results).toHaveLength(1);
    expect(results[0].packedKey).toBe('svc:v1:42');
    expect(results[0].count).toBe(1);
    expect(results[0].registered).toBe(true);
    expect(results[0].payloadSummary.fieldFrequency).toEqual({ page: 1, action: 1 });
    expect(results[0].payloadSummary.sampleValues).toEqual({ page: 'home', action: 'click' });
  });

  it('반복 observe 시 count 누적', async () => {
    const entry = {
      packedKey: 'svc:v1:42',
      prefixId: 'svc',
      registered: true,
      timestamp: '2026-04-06T10:00:00Z',
    };
    await store.observe(entry);
    await store.observe({ ...entry, timestamp: '2026-04-06T11:00:00Z' });
    await store.observe({ ...entry, timestamp: '2026-04-06T12:00:00Z' });

    const results = await store.findByPrefix('svc');
    expect(results[0].count).toBe(3);
    expect(results[0].firstSeen).toBe('2026-04-06T10:00:00Z');
    expect(results[0].lastSeen).toBe('2026-04-06T12:00:00Z');
  });

  it('observeBatch 다건 처리', async () => {
    await store.observeBatch([
      {
        packedKey: 'svc:v1:1',
        prefixId: 'svc',
        registered: true,
        timestamp: '2026-04-06T10:00:00Z',
      },
      {
        packedKey: 'svc:v1:2',
        prefixId: 'svc',
        registered: true,
        timestamp: '2026-04-06T10:01:00Z',
      },
      {
        packedKey: 'pv:v2:1',
        prefixId: 'pv',
        registered: false,
        timestamp: '2026-04-06T10:02:00Z',
      },
    ]);

    const svcResults = await store.findByPrefix('svc');
    expect(svcResults).toHaveLength(2);

    const pvResults = await store.findByPrefix('pv');
    expect(pvResults).toHaveLength(1);
    expect(pvResults[0].registered).toBe(false);
  });

  it('summary 전체 통계', async () => {
    await store.observeBatch([
      {
        packedKey: 'svc:v1:1',
        prefixId: 'svc',
        registered: true,
        timestamp: '2026-04-06T10:00:00Z',
      },
      {
        packedKey: 'svc:v1:1',
        prefixId: 'svc',
        registered: true,
        timestamp: '2026-04-06T10:01:00Z',
      },
      {
        packedKey: 'pv:v2:1',
        prefixId: 'pv',
        registered: false,
        timestamp: '2026-04-06T10:02:00Z',
      },
    ]);

    const s = await store.summary();
    expect(s.totalKeys).toBe(2);
    expect(s.totalCount).toBe(3);
    expect(s.registeredKeys).toBe(1);
    expect(s.unregisteredKeys).toBe(1);
    expect(s.prefixBreakdown).toEqual({ svc: 2, pv: 1 });
  });

  it('findStale — 기준 시점 이전 관측', async () => {
    await store.observeBatch([
      {
        packedKey: 'old:v1:1',
        prefixId: 'old',
        registered: true,
        timestamp: '2026-01-01T00:00:00Z',
      },
      {
        packedKey: 'new:v1:1',
        prefixId: 'new',
        registered: true,
        timestamp: '2026-04-06T10:00:00Z',
      },
    ]);

    const stale = await store.findStale('2026-03-01T00:00:00Z');
    expect(stale).toHaveLength(1);
    expect(stale[0].prefixId).toBe('old');
  });

  it('findUnregistered — drift 감지', async () => {
    await store.observeBatch([
      {
        packedKey: 'svc:v1:1',
        prefixId: 'svc',
        registered: true,
        timestamp: '2026-04-06T10:00:00Z',
      },
      {
        packedKey: 'unknown:v1:1',
        prefixId: 'unknown',
        registered: false,
        timestamp: '2026-04-06T10:01:00Z',
      },
      {
        packedKey: 'unknown:v1:2',
        prefixId: 'unknown',
        registered: false,
        timestamp: '2026-04-06T10:02:00Z',
      },
    ]);

    const unregistered = await store.findUnregistered();
    expect(unregistered).toHaveLength(2);
    expect(unregistered.every((o) => !o.registered)).toBe(true);
  });

  it('prefixSummary — prefix 레벨 집계 (version별 분리)', async () => {
    await store.observeBatch([
      {
        packedKey: 'svc:v1:1',
        prefixId: 'svc',
        registered: true,
        timestamp: '2026-04-06T10:00:00Z',
      },
      {
        packedKey: 'svc:v1:2',
        prefixId: 'svc',
        registered: true,
        timestamp: '2026-04-06T10:01:00Z',
      },
      {
        packedKey: 'svc:v1:1',
        prefixId: 'svc',
        registered: true,
        timestamp: '2026-04-06T10:02:00Z',
      },
    ]);

    const prefixes = await store.prefixSummary('svc');
    expect(prefixes).toHaveLength(1);
    expect(prefixes[0].version).toBe('v1');
    expect(prefixes[0].distinctKeys).toBe(2);
    expect(prefixes[0].totalCount).toBe(3);
  });

  it('findByPrefix orderBy=last_seen', async () => {
    await store.observeBatch([
      {
        packedKey: 'svc:v1:1',
        prefixId: 'svc',
        registered: true,
        timestamp: '2026-04-06T10:00:00Z',
      },
      {
        packedKey: 'svc:v1:2',
        prefixId: 'svc',
        registered: true,
        timestamp: '2026-04-06T12:00:00Z',
      },
    ]);

    const results = await store.findByPrefix('svc', { orderBy: 'last_seen' });
    expect(results[0].packedKey).toBe('svc:v1:2');
  });
});
