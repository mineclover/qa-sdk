import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { buildSchemaHash, verifySchemaHash, type SchemaHashInput } from './schema-hash.js';

const ev = { domain: 'approval', entity: 'request', action: 'submitted' } as const;
const mk = (payloadShape: SchemaHashInput['payloadShape']) =>
  buildSchemaHash({ eventName: ev, payloadShape });

describe('outbox schemaHash grammar (#6)', () => {
  it('builds 16-char hex hash for known shape', () => {
    expect(mk({ id: 'string', amount: 'number', note: 'string?' })).toMatch(/^[0-9a-f]{16}$/);
  });
  it('is deterministic: same shape → same hash', () => {
    const s = { id: 'string', amount: 'number' };
    expect(mk(s)).toBe(mk(s));
  });
  it('is key-order independent (canonicalJSON sorts keys)', () => {
    expect(mk({ id: 'string', amount: 'number', note: 'string?' })).toBe(
      mk({ note: 'string?', amount: 'number', id: 'string' }),
    );
  });
  it('different shape → different hash', () => {
    expect(mk({ id: 'string', amount: 'number' })).not.toBe(
      mk({ id: 'string', amount: 'number', extra: 'boolean' }),
    );
  });
  it('strips undefined values before hashing', () => {
    expect(mk({ id: 'string', amount: 'number' })).toBe(
      mk({ id: 'string', amount: 'number', removed: undefined }),
    );
  });
  it('preserves array order (arrays are not sorted)', () => {
    expect(mk({ tags: ['b', 'a'] })).not.toBe(mk({ tags: ['a', 'b'] }));
  });
  it('verifySchemaHash: true on match, false on mismatch', () => {
    const input: SchemaHashInput = {
      eventName: ev,
      payloadShape: { id: 'string', amount: 'number' },
    };
    const h = buildSchemaHash(input);
    expect(verifySchemaHash(input, h)).toBe(true);
    expect(verifySchemaHash(input, '0000000000000000')).toBe(false);
  });
  it('property: 200 random shapes hash deterministically and verify roundtrips', () => {
    fc.assert(
      fc.property(
        fc.dictionary(
          fc.stringMatching(/^[a-z][a-z0-9_]{0,12}$/),
          fc.constantFrom('string', 'number', 'boolean', 'string?', 'number?'),
          { minKeys: 1, maxKeys: 8 },
        ),
        (shape) => {
          const input: SchemaHashInput = { eventName: ev, payloadShape: shape };
          const h = buildSchemaHash(input);
          expect(h).toMatch(/^[0-9a-f]{16}$/);
          expect(buildSchemaHash(input)).toBe(h);
          expect(verifySchemaHash(input, h)).toBe(true);
        },
      ),
      { numRuns: 200 },
    );
  });
});
