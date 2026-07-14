import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  buildIdempotencyKey,
  parseIdempotencyKey,
  type IdempotencyKeyInput,
} from './idempotency-key.js';

describe('outbox idempotency key grammar (#12)', () => {
  it('builds canonical aggregateId:eventName:epoch', () => {
    const out = buildIdempotencyKey({
      aggregateId: 'proj-001',
      eventName: 'approval.budget.submitted',
      occurredAt: 1714250400000,
    });
    expect(out).toBe('proj-001:approval.budget.submitted:1714250400000');
  });

  it('parses back to original shape (epoch ms)', () => {
    const orig: IdempotencyKeyInput = {
      aggregateId: 'proj-001',
      eventName: 'approval.budget.submitted',
      occurredAt: 1714250400000,
    };
    expect(parseIdempotencyKey(buildIdempotencyKey(orig))).toEqual({
      aggregateId: 'proj-001',
      eventName: 'approval.budget.submitted',
      occurredAt: 1714250400000,
    });
  });

  it('normalizes Date input to epoch ms', () => {
    const date = new Date(1714250400000);
    const out = buildIdempotencyKey({
      aggregateId: 'proj-001',
      eventName: 'approval.budget.submitted',
      occurredAt: date,
    });
    expect(out).toBe('proj-001:approval.budget.submitted:1714250400000');
  });

  it('rejects invalid aggregateId (uppercase)', () => {
    expect(() =>
      buildIdempotencyKey({
        aggregateId: 'PROJ-001',
        eventName: 'approval.budget.submitted',
        occurredAt: 1714250400000,
      }),
    ).toThrow();
  });

  it('rejects invalid eventName (current tense / 2-tier)', () => {
    expect(() =>
      buildIdempotencyKey({
        aggregateId: 'proj-001',
        eventName: 'approval.submit',
        occurredAt: 1714250400000,
      }),
    ).toThrow();
  });

  it('is deterministic — same input → same output (100x)', () => {
    const input: IdempotencyKeyInput = {
      aggregateId: 'proj-001',
      eventName: 'approval.budget.submitted',
      occurredAt: 1714250400000,
    };
    const first = buildIdempotencyKey(input);
    for (let i = 0; i < 100; i++) {
      expect(buildIdempotencyKey(input)).toBe(first);
    }
  });

  it('roundtrip property (200 cases)', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-z][a-z0-9-]+$/).filter((s) => s.length >= 2 && s.length <= 24),
        fc.tuple(
          fc.stringMatching(/^[a-z][a-z0-9-]+$/).filter((s) => s.length >= 2 && s.length <= 16),
          fc.stringMatching(/^[a-z][a-z0-9-]+$/).filter((s) => s.length >= 2 && s.length <= 16),
          fc.stringMatching(/^[a-z][a-z0-9-]+$/).filter((s) => s.length >= 2 && s.length <= 16),
        ),
        fc.integer({ min: 0, max: 4_102_444_800_000 }),
        (aggregateId, [d, a, v], epoch) => {
          const eventName = `${d}.${a}.${v}`;
          const orig: IdempotencyKeyInput = { aggregateId, eventName, occurredAt: epoch };
          const built = buildIdempotencyKey(orig);
          expect(parseIdempotencyKey(built)).toEqual({
            aggregateId,
            eventName,
            occurredAt: epoch,
          });
        },
      ),
      { numRuns: 200 },
    );
  });
});
