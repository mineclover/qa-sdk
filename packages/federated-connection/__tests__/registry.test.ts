import { describe, expect, it } from 'vitest';
import {
  ConnectionRegistry,
  MappingConflictError,
  connectionRefKey,
  mappingKey,
  sourceRefKey,
  type ConnectionMapping,
  type SourceRef,
} from '../src/index.js';

const source: SourceRef = {
  sourceSystem: 'erp',
  entityType: 'customer',
  localId: 'cust-7',
  revision: 'rev-3',
};

const mapping: ConnectionMapping = {
  id: 'map-erp-customer-7',
  source,
  target: { namespace: 'qa', connectionId: 'customer-7', version: 1 },
  status: 'active',
  confidence: 1,
  transformVersion: 'identity-v1',
  provenance: { kind: 'manual', ref: 'review-1' },
};

describe('federated connection registry', () => {
  it('preserves source identity separately from connection identity', () => {
    expect(sourceRefKey(source)).toBe('source:erp:customer:cust-7:rev-3');
    expect(connectionRefKey(mapping.target)).toBe('connection:qa:customer-7:1');
    expect(mappingKey(mapping)).toContain('source:erp:customer:cust-7:rev-3');
  });

  it('resolves one active mapping and reports missing mappings', () => {
    const registry = new ConnectionRegistry();
    registry.registerMapping(mapping);

    expect(registry.resolve(source)).toMatchObject({
      status: 'resolved',
      mapping: { id: 'map-erp-customer-7' },
    });
    expect(registry.resolve({ ...source, localId: 'cust-8' })).toEqual({
      status: 'missing',
      source: { ...source, localId: 'cust-8' },
      candidates: [],
    });
  });

  it('connects different source identifiers without merging their source identity', () => {
    const registry = new ConnectionRegistry();
    const crmSource: SourceRef = {
      sourceSystem: 'crm',
      entityType: 'account',
      localId: 'acct-42',
      revision: 'snapshot-9',
    };
    const sharedConnection = { namespace: 'qa', connectionId: 'party-7', version: 1 } as const;

    registry.registerMapping({
      ...mapping,
      target: sharedConnection,
    });
    registry.registerMapping({
      id: 'map-crm-account-42',
      source: crmSource,
      target: sharedConnection,
      status: 'active',
      provenance: { kind: 'imported', ref: 'crm-crosswalk-v1' },
    });

    const erpResolution = registry.resolve(source);
    const crmResolution = registry.resolve(crmSource);
    expect(erpResolution).toMatchObject({
      status: 'resolved',
      mapping: { target: sharedConnection },
    });
    expect(crmResolution).toMatchObject({
      status: 'resolved',
      mapping: { target: sharedConnection },
    });
    expect(registry.mappingsForSource(source)).toHaveLength(1);
    expect(registry.mappingsForSource(crmSource)).toHaveLength(1);
    expect(sourceRefKey(source)).not.toBe(sourceRefKey(crmSource));
  });

  it('rejects two active mappings for one source identity', () => {
    const registry = new ConnectionRegistry();
    registry.registerMapping(mapping);

    expect(() =>
      registry.registerMapping({
        ...mapping,
        id: 'map-erp-customer-7-alt',
        target: { namespace: 'qa', connectionId: 'customer-alt', version: 1 },
      }),
    ).toThrow(MappingConflictError);
  });

  it('keeps ambiguous candidates without treating them as resolved', () => {
    const registry = new ConnectionRegistry();
    registry.registerMapping({ ...mapping, status: 'proposed' });
    registry.registerMapping({
      ...mapping,
      id: 'map-erp-customer-7-alt',
      target: { namespace: 'qa', connectionId: 'customer-alt', version: 1 },
      status: 'ambiguous',
    });

    expect(registry.resolve(source).status).toBe('ambiguous');
    expect(registry.mappingsForSource(source)).toHaveLength(2);
  });

  it('returns deterministic snapshots and typed relation queries', () => {
    const registry = new ConnectionRegistry();
    registry.registerRelation({
      id: 'rel-2',
      relationType: 'derived_from',
      source: { kind: 'connection', ref: mapping.target },
      target: { kind: 'source', ref: source },
      provenance: { kind: 'derived', ref: 'plan-1' },
    });
    registry.registerRelation({
      id: 'rel-1',
      relationType: 'owns',
      source: { kind: 'connection', ref: mapping.target },
      target: { kind: 'source', ref: source },
      provenance: { kind: 'manual' },
    });

    expect(
      registry.relationsFrom({ kind: 'connection', ref: mapping.target }, 'owns'),
    ).toHaveLength(1);
    expect(registry.snapshot().relations.map((relation) => relation.id)).toEqual([
      'rel-2',
      'rel-1',
    ]);
  });

  it('does not expose mutable registry internals', () => {
    const registry = new ConnectionRegistry();
    registry.registerMapping(mapping);
    const result = registry.resolve(source);
    if (result.status !== 'resolved') throw new Error('expected resolved mapping');

    const mutableTarget = result.mapping.target as unknown as { connectionId: string };
    mutableTarget.connectionId = 'mutated';
    expect(registry.resolve(source)).toMatchObject({
      mapping: { target: { connectionId: 'customer-7' } },
    });
  });
});
