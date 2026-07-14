// @def.boundary persistence-system-root
// @def.doc persistence-system-root

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { RecordInsert } from '@qa-sdk/core';
import { DrizzleRecordStore } from '../../index.js';
import type { Db } from '../../db/client.js';
import { cleanupDb, closeTestDb, createTestDb, hasTestDatabaseUrl } from './test-db.js';
import { seedTrace } from './test-fixtures.js';

function buildRecord(overrides: Partial<RecordInsert> = {}): RecordInsert {
  return {
    logId: 'log_1',
    traceId: 'trace_1',
    spanId: 'span_1',
    timestamp: new Date('2026-03-12T00:00:03.000Z'),
    recordKind: 'log',
    eventKey: 'user_signed_in',
    eventVersion: '001',
    payloadFormat: 'json',
    payloadEncoding: 'raw',
    payloadMaskingApplied: false,
    payloadMaskedFields: [],
    payload: { ok: true },
    qaSessionId: 'session_1',
    ...overrides,
  };
}

const describeIfDatabase = hasTestDatabaseUrl ? describe : describe.skip;

describeIfDatabase('DrizzleRecordStore', () => {
  let db: Db;

  beforeAll(async () => {
    db = await createTestDb();
  });

  beforeEach(async () => {
    await cleanupDb();
  });

  afterEach(async () => {
    await cleanupDb();
  });

  afterAll(async () => {
    await closeTestDb();
  });

  it('inserts batches and queries records by trace, cursor, and event key', async () => {
    await seedTrace(db, { traceId: 'trace_1' });
    await seedTrace(db, { traceId: 'trace_2' });

    const store = new DrizzleRecordStore(db);
    const firstRecord = buildRecord({
      logId: 'log_a',
      timestamp: new Date('2026-03-12T00:00:01.000Z'),
    });
    const secondRecord = buildRecord({
      logId: 'log_b',
      timestamp: new Date('2026-03-12T00:00:01.000Z'),
      eventKey: 'checkout_started',
    });
    const thirdRecord = buildRecord({
      logId: 'log_c',
      timestamp: new Date('2026-03-12T00:00:02.000Z'),
      eventKey: 'checkout_completed',
    });
    const otherTraceRecord = buildRecord({
      logId: 'log_other',
      traceId: 'trace_2',
      qaSessionId: 'session_2',
      timestamp: new Date('2026-03-12T00:00:03.000Z'),
    });

    await store.insertBatch([thirdRecord, secondRecord, otherTraceRecord, firstRecord]);

    await expect(store.findByTraceId('trace_1')).resolves.toEqual([
      {
        ...firstRecord,
        createdAt: expect.any(Date),
      },
      {
        ...secondRecord,
        createdAt: expect.any(Date),
      },
      {
        ...thirdRecord,
        createdAt: expect.any(Date),
      },
    ]);

    const firstPage = await store.findByTraceIdPaginated('trace_1', {
      limit: 2,
    });

    expect(firstPage.items.map((record) => record.logId)).toEqual(['log_a', 'log_b']);
    expect(firstPage.hasMore).toBe(true);
    expect(firstPage.nextCursor).toEqual({
      timestamp: new Date('2026-03-12T00:00:01.000Z'),
      logId: 'log_b',
    });

    const secondPage = await store.findByTraceIdPaginated('trace_1', {
      limit: 2,
      cursor: firstPage.nextCursor ?? undefined,
    });

    expect(secondPage.items.map((record) => record.logId)).toEqual(['log_c']);
    expect(secondPage.hasMore).toBe(false);
    expect(secondPage.nextCursor).toBeNull();

    await expect(store.findByTraceAndEventKey('trace_1', 'checkout_completed')).resolves.toEqual([
      {
        ...thirdRecord,
        createdAt: expect.any(Date),
      },
    ]);
  });

  it('ignores duplicate log IDs when inserting a later batch', async () => {
    await seedTrace(db, { traceId: 'trace_1' });

    const store = new DrizzleRecordStore(db);
    const original = buildRecord({
      logId: 'log_existing',
      timestamp: new Date('2026-03-12T00:00:01.000Z'),
    });
    const newRecord = buildRecord({
      logId: 'log_new',
      timestamp: new Date('2026-03-12T00:00:02.000Z'),
    });

    await store.insertBatch([original]);

    await expect(store.insertBatch([original, newRecord])).resolves.toBeUndefined();

    await expect(store.findByTraceId('trace_1')).resolves.toEqual([
      {
        ...original,
        createdAt: expect.any(Date),
      },
      {
        ...newRecord,
        createdAt: expect.any(Date),
      },
    ]);
  });
});
