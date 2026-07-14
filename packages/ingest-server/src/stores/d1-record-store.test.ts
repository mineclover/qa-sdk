// @def.boundary ingest-system
// @def.doc ingest-system

// ── d1-record-store.test.ts 분리 from d1-stores.test.ts ───

import { describe, expect, it, beforeEach } from 'vitest';
import { NodeSqliteDriver } from 'index-meta';
import { D1RecordStore } from './d1-record-store.js';
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

describe('D1RecordStore', () => {
  let store: D1RecordStore;

  beforeEach(() => {
    const db = createDb();
    store = new D1RecordStore(db);
  });

  it('insertBatch + findByTraceId', async () => {
    await store.insertBatch([
      {
        logId: 'r1',
        traceId: 't1',
        spanId: 's1',
        timestamp: new Date('2026-01-01T00:00:00Z'),
        recordKind: 'log',
        eventKey: 'page.view',
        eventVersion: '001',
        payloadFormat: 'json',
        payloadEncoding: 'raw',
        payloadMaskingApplied: false,
        payloadMaskedFields: [],
        payload: { page: 'home' },
      },
      {
        logId: 'r2',
        traceId: 't1',
        spanId: 's2',
        timestamp: new Date('2026-01-01T00:00:01Z'),
        recordKind: 'log',
        eventKey: 'cart.add',
        eventVersion: '001',
        payloadFormat: 'json',
        payloadEncoding: 'raw',
        payloadMaskingApplied: false,
        payloadMaskedFields: [],
      },
    ]);

    const records = await store.findByTraceId('t1');
    expect(records).toHaveLength(2);
    expect(records[0].eventKey).toBe('page.view');
    expect(records[0].payload).toEqual({ page: 'home' });
    expect(records[1].eventKey).toBe('cart.add');
  });

  it('findBySessionId', async () => {
    await store.insertBatch([
      {
        logId: 'r1',
        traceId: 't1',
        spanId: 's1',
        timestamp: new Date(),
        recordKind: 'log',
        eventKey: 'e1',
        eventVersion: '001',
        payloadFormat: 'json',
        payloadEncoding: 'raw',
        payloadMaskingApplied: false,
        payloadMaskedFields: [],
        qaSessionId: 'sess-1',
      },
      {
        logId: 'r2',
        traceId: 't2',
        spanId: 's2',
        timestamp: new Date(),
        recordKind: 'log',
        eventKey: 'e2',
        eventVersion: '001',
        payloadFormat: 'json',
        payloadEncoding: 'raw',
        payloadMaskingApplied: false,
        payloadMaskedFields: [],
        qaSessionId: 'sess-1',
      },
      {
        logId: 'r3',
        traceId: 't3',
        spanId: 's3',
        timestamp: new Date(),
        recordKind: 'log',
        eventKey: 'e3',
        eventVersion: '001',
        payloadFormat: 'json',
        payloadEncoding: 'raw',
        payloadMaskingApplied: false,
        payloadMaskedFields: [],
        qaSessionId: 'sess-2',
      },
    ]);

    const records = await store.findBySessionId('sess-1');
    expect(records).toHaveLength(2);
  });

  it('ON CONFLICT DO NOTHING (중복 삽입 무시)', async () => {
    const record = {
      logId: 'dup',
      traceId: 't1',
      spanId: 's1',
      timestamp: new Date(),
      recordKind: 'log',
      eventKey: 'e1',
      eventVersion: '001',
      payloadFormat: 'json',
      payloadEncoding: 'raw',
      payloadMaskingApplied: false,
      payloadMaskedFields: [] as string[],
    };
    await store.insertBatch([record]);
    await store.insertBatch([record]); // 중복
    const records = await store.findByTraceId('t1');
    expect(records).toHaveLength(1);
  });

  it('address_context JSON 파싱', async () => {
    await store.insertBatch([
      {
        logId: 'r1',
        traceId: 't1',
        spanId: 's1',
        timestamp: new Date(),
        recordKind: 'log',
        eventKey: 'e1',
        eventVersion: '001',
        payloadFormat: 'json',
        payloadEncoding: 'raw',
        payloadMaskingApplied: false,
        payloadMaskedFields: [],
        addressContext: { service: 's:v1:0', page_view: 'pv:v2:1' },
      },
    ]);
    const records = await store.findByTraceId('t1');
    expect(records[0].addressContext).toEqual({ service: 's:v1:0', page_view: 'pv:v2:1' });
  });
});
