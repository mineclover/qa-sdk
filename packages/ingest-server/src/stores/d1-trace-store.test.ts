// @def.boundary ingest-system
// @def.doc ingest-system

// ── d1-trace-store.test.ts 분리 from d1-stores.test.ts ───

import { describe, expect, it, beforeEach } from 'vitest';
import { NodeSqliteDriver } from 'index-meta-store';
import { D1TraceStore } from './d1-trace-store.js';
import { createD1Drizzle, type D1Db } from './d1-db-type.js';
import { drizzle } from 'drizzle-orm/node-sqlite';
import { migrate } from 'drizzle-orm/node-sqlite/migrator';

const migrationsFolder = new URL('../../drizzle', import.meta.url).pathname;

function createDb(): D1Db {
  const driver = new NodeSqliteDriver(':memory:', null);
  const drizzleDb = drizzle({ client: driver.$client });
  migrate(drizzleDb, { migrationsFolder });
  return createD1Drizzle(driver.$client);
}

describe('D1TraceStore', () => {
  let store: D1TraceStore;

  beforeEach(() => {
    const db = createDb();
    store = new D1TraceStore(db);
  });

  it('upsert + findById', async () => {
    await store.upsert({
      traceId: 't1',
      serviceName: 'web',
      recordCount: 3,
      firstTimestamp: new Date('2026-01-01'),
      lastTimestamp: new Date('2026-01-01T00:00:02'),
    });
    const trace = await store.findById('t1');
    expect(trace).not.toBeNull();
    expect(trace!.recordCount).toBe(3);
    expect(trace!.serviceName).toBe('web');
  });

  it('upsert 중복 시 recordCount 누적', async () => {
    await store.upsert({
      traceId: 't1',
      recordCount: 2,
      firstTimestamp: new Date('2026-01-01'),
      lastTimestamp: new Date('2026-01-01T00:00:01'),
    });
    await store.upsert({
      traceId: 't1',
      recordCount: 3,
      firstTimestamp: new Date('2026-01-01T00:00:02'),
      lastTimestamp: new Date('2026-01-01T00:00:04'),
    });
    const trace = await store.findById('t1');
    expect(trace!.recordCount).toBe(5); // 2 + 3
  });

  it('findRecent', async () => {
    await store.upsert({
      traceId: 't1',
      recordCount: 1,
      firstTimestamp: new Date('2026-01-01'),
      lastTimestamp: new Date('2026-01-01'),
    });
    await store.upsert({
      traceId: 't2',
      recordCount: 1,
      firstTimestamp: new Date('2026-01-02'),
      lastTimestamp: new Date('2026-01-02'),
    });
    const recent = await store.findRecent(10);
    expect(recent.length).toBe(2);
    // 두 trace가 모두 포함됨 (순서는 updated_at 의존이므로 id set으로 확인)
    const ids = new Set(recent.map((t) => t.traceId));
    expect(ids.has('t1')).toBe(true);
    expect(ids.has('t2')).toBe(true);
  });

  it('markReconstructed', async () => {
    await store.upsert({
      traceId: 't1',
      recordCount: 1,
      firstTimestamp: new Date(),
      lastTimestamp: new Date(),
    });
    await store.markReconstructed('t1');
    const trace = await store.findById('t1');
    expect(trace!.reconstructed).toBe(true);
  });
});
