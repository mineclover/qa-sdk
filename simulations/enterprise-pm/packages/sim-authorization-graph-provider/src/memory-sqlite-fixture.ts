// @def.boundary sim-authorization-graph-provider
// @def.doc authorization-graph-store

import Database, { type Database as DatabaseType } from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { createSimAuthorizationGraphStore } from './create-store.js';
import type { AuthorizationGraphStore } from 'authorization-ontology';

export { AUTHORIZATION_GRAPH_SNAPSHOTS_SQLITE_DDL } from './sqlite/schema.js';
import { AUTHORIZATION_GRAPH_SNAPSHOTS_SQLITE_DDL as DDL } from './sqlite/schema.js';

export interface InMemorySqliteAuthorizationGraphFixture {
  sqlite: DatabaseType;
  db: BetterSQLite3Database<Record<string, never>>;
  store: AuthorizationGraphStore;
  close: () => void;
}

export async function createInMemorySqliteAuthorizationGraphFixture(): Promise<InMemorySqliteAuthorizationGraphFixture> {
  const sqlite = new Database(':memory:');
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  sqlite.exec(DDL);
  const db = drizzle({ client: sqlite });
  const store = await createSimAuthorizationGraphStore({
    dialect: 'sqlite',
    db,
    applyDdl: false,
  });
  return {
    sqlite,
    db,
    store,
    close: () => sqlite.close(),
  };
}
