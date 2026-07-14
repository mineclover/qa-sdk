// @def.boundary sim-audit-browser-api
// @def.doc domain-slice-architecture

import { describe, expect, it } from 'vitest';
import { InMemoryAuthorizationGraphStore } from 'authorization-ontology';
import { GraphSnapshotQueryAdapter } from './graph-snapshot-query.adapter.js';

describe('GraphSnapshotQueryAdapter', () => {
  it('latest — graph 의 마지막 snapshot 반환', async () => {
    const store = new InMemoryAuthorizationGraphStore();
    await store.saveSnapshot({
      graphId: 'graph-1',
      snapshotId: 'graph-1:001',
      createdAt: '2026-04-24T00:00:00.000Z',
      graph: { realms: [], nodes: [], relations: [] },
    });
    await store.saveSnapshot({
      graphId: 'graph-1',
      snapshotId: 'graph-1:002',
      createdAt: '2026-04-24T00:01:00.000Z',
      graph: { realms: [], nodes: [], relations: [] },
    });
    const adapter = new GraphSnapshotQueryAdapter(store);
    const latest = await adapter.latest('graph-1');
    expect(latest?.snapshotId).toBe('graph-1:002');
  });

  it('latest — graph 미존재 시 null', async () => {
    const store = new InMemoryAuthorizationGraphStore();
    const adapter = new GraphSnapshotQueryAdapter(store);
    expect(await adapter.latest('missing')).toBeNull();
  });
});
