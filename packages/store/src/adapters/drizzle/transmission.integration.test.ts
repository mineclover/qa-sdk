// @def.boundary persistence-system-root
// @def.doc persistence-system-root

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DrizzleTransmissionStore } from '../../index.js';
import { transmissions } from '../../db/schema.js';
import type { Db } from '../../db/client.js';
import { cleanupDb, closeTestDb, createTestDb, hasTestDatabaseUrl } from './test-db.js';

const describeIfDatabase = hasTestDatabaseUrl ? describe : describe.skip;

describeIfDatabase('DrizzleTransmissionStore', () => {
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

  it('persists transmissions in PostgreSQL', async () => {
    const store = new DrizzleTransmissionStore(db);

    await store.insert({
      transmissionId: 'tx_1',
      sentAt: new Date('2026-03-12T00:00:00.000Z'),
      ownerType: 'workspace',
      ownerId: 'workspace_1',
      serviceName: 'mobile-app',
      sdkName: 'qa-sdk-js',
      sdkVersion: '0.1.0',
      platform: 'ios',
      env: 'staging',
      recordCount: 3,
    });

    await expect(db.select().from(transmissions)).resolves.toEqual([
      {
        transmissionId: 'tx_1',
        sentAt: new Date('2026-03-12T00:00:00.000Z'),
        ownerType: 'workspace',
        ownerId: 'workspace_1',
        serviceName: 'mobile-app',
        sdkName: 'qa-sdk-js',
        sdkVersion: '0.1.0',
        platform: 'ios',
        env: 'staging',
        recordCount: 3,
        receivedAt: expect.any(Date),
      },
    ]);
  });
});
