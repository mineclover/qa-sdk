// @def.boundary persistence-system-root
// @def.doc persistence-system-root

import { beforeEach, describe, expect, it } from 'vitest';
import type { FlowInstance } from 'decision-flow';
import { SqliteInstanceStore } from './store.js';

function makeInstance(overrides: Partial<FlowInstance> = {}): FlowInstance {
  return {
    id: overrides.id ?? 'test-001',
    schemaId: overrides.schemaId ?? 'test-schema',
    schemaVersion: overrides.schemaVersion ?? 'v1',
    status: overrides.status ?? 'completed',
    context: overrides.context ?? { flag: true, count: 3, team: 'platform' },
    selections: overrides.selections ?? [],
    outcome: overrides.outcome,
    startedAt: overrides.startedAt ?? '2026-03-25T00:00:00Z',
    completedAt: overrides.completedAt ?? '2026-03-25T00:01:00Z',
    coordinateAddress: overrides.coordinateAddress,
  };
}

describe('SqliteInstanceStore', () => {
  let store: SqliteInstanceStore;

  beforeEach(() => {
    store = new SqliteInstanceStore(':memory:');
  });

  it('preserves boolean and numeric context queries', () => {
    store.save(makeInstance({ id: 'i1', context: { flag: true, count: 3 } }));
    store.save(makeInstance({ id: 'i2', context: { flag: false, count: 4 } }));

    expect(store.findByContext({ key: 'flag', value: true }).map((x) => x.id)).toEqual(['i1']);
    expect(store.findByContext({ key: 'count', value: 3 }).map((x) => x.id)).toEqual(['i1']);
  });
});
