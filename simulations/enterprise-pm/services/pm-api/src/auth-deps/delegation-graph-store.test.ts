// @def.boundary sim-pm-api
// @def.doc authorization-graph-store

import { describe, expect, it } from 'vitest';
import { InMemoryAuthorizationGraphStore } from 'authorization-ontology';
import { ProjectDelegationGraphStore } from './delegation-graph-store.js';

describe('ProjectDelegationGraphStore', () => {
  it('stores delegation in authorization graph snapshots and resolves latest delegate membership', async () => {
    const store = new InMemoryAuthorizationGraphStore();
    const delegation = new ProjectDelegationGraphStore(store);

    await delegation.grant('consultant-graph-1', 'user-frank');
    await delegation.grant('consultant-graph-1', 'user-eve');

    expect(await delegation.hasDelegate('consultant-graph-1', 'user-frank')).toBe(true);
    expect(await delegation.hasDelegate('consultant-graph-1', 'user-eve')).toBe(true);
    expect(await delegation.hasDelegate('consultant-graph-1', 'user-bob')).toBe(false);

    const snapshots = await store.listSnapshots({ graphId: 'consultant-graph-1' });
    expect(snapshots.length).toBe(2);
    expect(snapshots.at(-1)?.graph.nodes.map((node) => node.coord.anchor)).toEqual(
      expect.arrayContaining(['consultant-graph-1', 'user-frank', 'user-eve']),
    );
  });
});
