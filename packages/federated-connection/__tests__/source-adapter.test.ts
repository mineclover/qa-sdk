import { describe, expect, it } from 'vitest';
import {
  ConnectionRegistry,
  ConnectionContractError,
  compareSourceSnapshots,
  observeSource,
  type SourceAdapter,
  type SourceSnapshot,
} from '../src/index.js';

const lookup = {
  sourceSystem: 'erp',
  entityType: 'customer',
  localId: 'cust-7',
} as const;

function snapshot(
  revision: string,
  payloadHash: string,
  status: SourceSnapshot<unknown>['status'] = 'present',
): SourceSnapshot<unknown> {
  return {
    source: { ...lookup, revision },
    status,
    observedAt: '2026-07-19T00:00:00.000Z',
    payloadHash,
    payload: status === 'present' ? { id: lookup.localId } : undefined,
  };
}

describe('source adapter observation', () => {
  it('derives lifecycle changes from source revision and payload hash', () => {
    expect(compareSourceSnapshots(undefined, snapshot('rev-1', 'hash-1')).kind).toBe('created');
    expect(
      compareSourceSnapshots(snapshot('rev-1', 'hash-1'), snapshot('rev-1', 'hash-1')),
    ).toMatchObject({
      kind: 'unchanged',
      revisionChanged: false,
      payloadChanged: false,
    });
    expect(
      compareSourceSnapshots(snapshot('rev-1', 'hash-1'), snapshot('rev-2', 'hash-2')),
    ).toMatchObject({
      kind: 'updated',
      revisionChanged: true,
      payloadChanged: true,
    });
    expect(
      compareSourceSnapshots(snapshot('rev-2', 'hash-2'), snapshot('rev-3', 'hash-3', 'deleted'))
        .kind,
    ).toBe('deleted');
    expect(
      compareSourceSnapshots(snapshot('rev-3', 'hash-3', 'deleted'), snapshot('rev-4', 'hash-4'))
        .kind,
    ).toBe('restored');
  });

  it('fetches an immutable source snapshot through the adapter boundary', async () => {
    const adapter: SourceAdapter<{ name: string }> = {
      sourceSystem: 'erp',
      entityType: 'customer',
      async fetch(input) {
        expect(input).toEqual(lookup);
        return {
          ...snapshot('rev-4', 'hash-4'),
          payload: { name: 'Ada' },
        };
      },
    };

    const observation = await observeSource(adapter, lookup, snapshot('rev-3', 'hash-3'));
    expect(observation.change).toMatchObject({ kind: 'updated', revisionChanged: true });
    expect(observation.snapshot.payload).toEqual({ name: 'Ada' });

    const registry = new ConnectionRegistry();
    registry.registerMapping({
      id: 'map-erp-customer-7-rev-4',
      source: observation.snapshot.source,
      target: { namespace: 'qa', connectionId: 'customer-7', version: 1 },
      status: 'active',
      provenance: { kind: 'source', ref: 'erp-fetch-4' },
    });
    expect(registry.resolve(observation.snapshot.source).status).toBe('resolved');
  });

  it('rejects an adapter snapshot that crosses source identity', async () => {
    const adapter: SourceAdapter = {
      sourceSystem: 'erp',
      entityType: 'customer',
      async fetch() {
        return {
          ...snapshot('rev-4', 'hash-4'),
          source: { ...snapshot('rev-4', 'hash-4').source, sourceSystem: 'crm' },
        };
      },
    };

    await expect(observeSource(adapter, lookup)).rejects.toThrow(ConnectionContractError);
  });

  it('rejects invalid timestamps and mismatched adapter lookup', async () => {
    expect(() =>
      compareSourceSnapshots(undefined, { ...snapshot('rev-1', 'hash-1'), observedAt: 'now' }),
    ).toThrow('observedAt');

    const adapter: SourceAdapter = {
      sourceSystem: 'erp',
      entityType: 'customer',
      fetch: async () => snapshot('rev-1', 'hash-1'),
    };
    await expect(observeSource(adapter, { ...lookup, entityType: 'order' })).rejects.toThrow(
      'does not match',
    );
  });
});
