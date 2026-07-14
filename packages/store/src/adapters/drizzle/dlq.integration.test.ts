// @def.boundary persistence-system-root
// @def.doc persistence-system-root

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import type { DlqInsert } from '@qa-sdk/core';
import { DrizzleDlqStore } from '../../index.js';
import { deadLetterQueue } from '../../db/schema.js';
import type { Db } from '../../db/client.js';
import { cleanupDb, closeTestDb, createTestDb, hasTestDatabaseUrl } from './test-db.js';
import { seedTrace } from './test-fixtures.js';

function buildDlqItem(overrides: Partial<DlqInsert> = {}): DlqInsert {
  return {
    id: 'dlq_1',
    traceId: 'trace_1',
    phase: 'reconstruction',
    errorMessage: 'reconstruction failed',
    ...overrides,
  };
}

const describeIfDatabase = hasTestDatabaseUrl ? describe : describe.skip;

describeIfDatabase('DrizzleDlqStore', () => {
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

  it('stores pending items and tracks attempts and resolution', async () => {
    await seedTrace(db, { traceId: 'trace_1' });

    const store = new DrizzleDlqStore(db);
    await store.insert(buildDlqItem());

    await expect(store.findPending()).resolves.toEqual([
      {
        id: 'dlq_1',
        traceId: 'trace_1',
        phase: 'reconstruction',
        errorMessage: 'reconstruction failed',
        attemptCount: 0,
        lastAttemptedAt: null,
        createdAt: expect.any(Date),
        resolvedAt: null,
      },
    ]);

    await store.markAttempted('dlq_1');

    await expect(store.findPending()).resolves.toEqual([
      {
        id: 'dlq_1',
        traceId: 'trace_1',
        phase: 'reconstruction',
        errorMessage: 'reconstruction failed',
        attemptCount: 1,
        lastAttemptedAt: expect.any(Date),
        createdAt: expect.any(Date),
        resolvedAt: null,
      },
    ]);

    await store.markResolved('dlq_1');

    await expect(store.findPending()).resolves.toEqual([]);
    await expect(
      db.select().from(deadLetterQueue).where(eq(deadLetterQueue.id, 'dlq_1')),
    ).resolves.toEqual([
      expect.objectContaining({
        id: 'dlq_1',
        attemptCount: 1,
        resolvedAt: expect.any(Date),
      }),
    ]);
  });
});
