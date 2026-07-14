// @def.boundary ingest-system
// @def.doc ingest-system

// ── d1-session-store.test.ts 분리 from d1-stores.test.ts ───

import { describe, expect, it, beforeEach } from 'vitest';
import { NodeSqliteDriver } from 'index-meta';
import { D1SessionStore } from './d1-session-store.js';
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

describe('D1SessionStore', () => {
  let store: D1SessionStore;

  beforeEach(() => {
    const db = createDb();
    store = new D1SessionStore(db);
  });

  it('upsert + findById', async () => {
    await store.upsert({ sessionId: 's1', scenarioId: 'sc1' });
    const session = await store.findById('s1');
    expect(session).not.toBeNull();
    expect(session!.scenarioId).toBe('sc1');
  });

  it('close', async () => {
    await store.upsert({ sessionId: 's1' });
    await store.close('s1');
    const session = await store.findById('s1');
    expect(session!.closedAt).not.toBeNull();
  });
});
