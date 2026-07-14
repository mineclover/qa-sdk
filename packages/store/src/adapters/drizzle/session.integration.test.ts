// @def.boundary persistence-system-root
// @def.doc persistence-system-root

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DrizzleSessionStore } from '../../index.js';
import { qaSessions } from '../../db/schema.js';
import type { Db } from '../../db/client.js';
import { cleanupDb, closeTestDb, createTestDb, hasTestDatabaseUrl } from './test-db.js';

const describeIfDatabase = hasTestDatabaseUrl ? describe : describe.skip;

describeIfDatabase('DrizzleSessionStore', () => {
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

  it('upserts sessions idempotently, finds them by id, and closes them', async () => {
    const store = new DrizzleSessionStore(db);

    await store.upsert({
      sessionId: 'session_1',
      scenarioId: 'scenario_signup',
      labels: { region: 'kr' },
    });

    const created = await store.findById('session_1');
    expect(created).toEqual({
      sessionId: 'session_1',
      scenarioId: 'scenario_signup',
      labels: { region: 'kr' },
      actorId: null,
      userId: null,
      userAttributes: null,
      startedAt: expect.any(Date),
      closedAt: null,
    });

    await store.upsert({
      sessionId: 'session_1',
      scenarioId: 'scenario_checkout',
      labels: { region: 'us' },
    });

    const duplicate = await store.findById('session_1');
    expect(duplicate).toEqual(created);
    expect(await db.select().from(qaSessions)).toHaveLength(1);

    await store.close('session_1');

    await expect(store.findById('session_1')).resolves.toEqual({
      sessionId: 'session_1',
      scenarioId: 'scenario_signup',
      labels: { region: 'kr' },
      actorId: null,
      userId: null,
      userAttributes: null,
      startedAt: created!.startedAt,
      closedAt: expect.any(Date),
    });
  });
});
