import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  buildReplicationSlot,
  parseReplicationSlot,
  REPLICATION_PURPOSES,
  type ReplicationSlot,
} from './replication-slot.js';

describe('replication slot name grammar (#13)', () => {
  it('builds sim_read_replica_slot from canonical input', () => {
    const out = buildReplicationSlot({ purpose: 'read_replica' });
    expect(out).toBe('sim_read_replica_slot');
  });

  it('parses sim_audit_stream_slot back to original shape', () => {
    const orig: ReplicationSlot = { purpose: 'audit_stream' };
    expect(parseReplicationSlot(buildReplicationSlot(orig))).toEqual(orig);
  });

  it('rejects purpose outside allowlist', () => {
    expect(() => buildReplicationSlot({ purpose: 'metrics_export' as never })).toThrow();
  });

  it('rejects parsing of camelCase simReadReplicaSlot (PG 규칙 위반)', () => {
    expect(() => parseReplicationSlot('simReadReplicaSlot')).toThrow();
  });

  it('output satisfies PG identifier rules (lowercase / underscores / ≤63 chars)', () => {
    for (const purpose of REPLICATION_PURPOSES) {
      const out = buildReplicationSlot({ purpose });
      expect(out).toMatch(/^[a-z_][a-z0-9_]*$/);
      expect(out.length).toBeLessThanOrEqual(63);
    }
  });

  it('roundtrip property over purpose allowlist', () => {
    fc.assert(
      fc.property(fc.constantFrom(...REPLICATION_PURPOSES), (purpose) => {
        const orig: ReplicationSlot = { purpose };
        expect(parseReplicationSlot(buildReplicationSlot(orig))).toEqual(orig);
      }),
      { numRuns: 100 },
    );
  });
});
