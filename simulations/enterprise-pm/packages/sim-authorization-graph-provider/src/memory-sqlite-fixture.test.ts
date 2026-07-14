// @def.boundary sim-authorization-graph-provider
// @def.doc authorization-graph-store

import { describe, expect, it } from 'vitest';
import {
  AUTHORIZATION_GRAPH_SNAPSHOTS_SQLITE_DDL,
  createInMemorySqliteAuthorizationGraphFixture,
} from './memory-sqlite-fixture.js';

describe('memory-sqlite-authorization-graph-fixture', () => {
  it('creates table and closes cleanly', async () => {
    const fixture = await createInMemorySqliteAuthorizationGraphFixture();
    const tables = fixture.sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all() as { name: string }[];
    expect(new Set(tables.map((table) => table.name)).has('authorization_graph_snapshots')).toBe(
      true,
    );
    fixture.close();
    expect(() => fixture.sqlite.prepare('SELECT 1').get()).toThrow();
  });

  it('exports sqlite DDL', () => {
    expect(AUTHORIZATION_GRAPH_SNAPSHOTS_SQLITE_DDL).toContain('authorization_graph_snapshots');
  });
});
