import { describe, expect, it } from 'vitest';
import { ConnectionContractError, SourceIdentifierRegistry } from '../src/index.js';

function rule(version: number, status: 'draft' | 'active' | 'retired' = 'active') {
  return {
    id: `erp-customer-identifiers-v${version}`,
    sourceSystem: 'erp',
    entityType: 'customer',
    version,
    localIdPattern: 'cust-[0-9]+',
    revisionPattern: 'rev-[0-9]+',
    revisionStrategy: 'opaque' as const,
    status,
    provenance: { kind: 'manual' as const, ref: 'identifier-review-1' },
  };
}

describe('source identifier registry', () => {
  it('validates source-local IDs and revisions by the active rule version', () => {
    const registry = new SourceIdentifierRegistry();
    registry.register(rule(1));

    expect(
      registry.validate({
        sourceSystem: 'erp',
        entityType: 'customer',
        localId: 'cust-7',
        revision: 'rev-3',
      }).id,
    ).toBe('erp-customer-identifiers-v1');
    expect(() =>
      registry.validate({
        sourceSystem: 'erp',
        entityType: 'customer',
        localId: 'acct-7',
        revision: 'rev-3',
      }),
    ).toThrow('does not match');
  });

  it('keeps rules from different source namespaces independent', () => {
    const registry = new SourceIdentifierRegistry();
    registry.register(rule(1));
    registry.register({
      ...rule(1),
      id: 'crm-account-identifiers-v1',
      sourceSystem: 'crm',
      entityType: 'account',
      localIdPattern: 'acct-[0-9]+',
    });

    expect(registry.get('erp', 'customer')?.id).toBe('erp-customer-identifiers-v1');
    expect(registry.get('crm', 'account')?.id).toBe('crm-account-identifiers-v1');
    expect(() =>
      registry.validate({
        sourceSystem: 'erp',
        entityType: 'customer',
        localId: 'acct-42',
        revision: 'rev-1',
      }),
    ).toThrow(ConnectionContractError);
  });

  it('does not collide when source or entity names contain the key separator', () => {
    const registry = new SourceIdentifierRegistry();
    registry.register({
      ...rule(1),
      id: 'erp-eu-customer-identifiers-v1',
      sourceSystem: 'erp:eu',
      localIdPattern: 'cust-[0-9]+',
    });
    registry.register({
      ...rule(1),
      id: 'erp-eu-customer-entity-identifiers-v1',
      sourceSystem: 'erp',
      entityType: 'eu:customer',
      localIdPattern: 'acct-[0-9]+',
    });

    expect(registry.list()).toHaveLength(2);
    expect(registry.get('erp:eu', 'customer')?.id).toBe('erp-eu-customer-identifiers-v1');
    expect(registry.get('erp', 'eu:customer')?.id).toBe('erp-eu-customer-entity-identifiers-v1');
  });

  it('does not use draft or retired rules for validation', () => {
    const registry = new SourceIdentifierRegistry();
    registry.register(rule(1, 'retired'));
    registry.register(rule(2, 'draft'));

    expect(() =>
      registry.validateLookup({
        sourceSystem: 'erp',
        entityType: 'customer',
        localId: 'cust-7',
      }),
    ).toThrow('No active identifier rule');
  });
});
