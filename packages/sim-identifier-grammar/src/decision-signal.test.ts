import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  buildDecisionSignal,
  parseDecisionSignal,
  SIGNALS_BY_CATEGORY,
  ALL_SIGNAL_PAIRS,
  type DecisionSignal,
  type SignalCategory,
} from './decision-signal.js';

describe('decision signal grammar (#15)', () => {
  it('builds canonical names + roundtrips', () => {
    expect(buildDecisionSignal({ category: 'compatibility', signal: 'schemaCompatRate' })).toBe(
      'compatibility.schemaCompatRate',
    );
    expect(buildDecisionSignal({ category: 'perf', signal: 'errorRate' })).toBe('perf.errorRate');
    const orig: DecisionSignal = { category: 'decisionQuality', signal: 'denyRateDelta' };
    expect(parseDecisionSignal(buildDecisionSignal(orig))).toEqual(orig);
  });

  it('rejects unknown category', () => {
    expect(() =>
      buildDecisionSignal({ category: 'unknown' as never, signal: 'errorRate' }),
    ).toThrow();
    expect(() => parseDecisionSignal('unknown.errorRate')).toThrow();
  });

  it('rejects signal not in matrix for given category (perf.RPS reject)', () => {
    // RPS는 loadPressure 전용. perf 카테고리에 끼워 넣으면 거부.
    expect(() => buildDecisionSignal({ category: 'perf', signal: 'RPS' as never })).toThrow();
    expect(() => parseDecisionSignal('perf.RPS')).toThrow();
    expect(() => parseDecisionSignal('perf.schemaCompatRate')).toThrow();
  });

  it('rejects malformed (separator/segment count)', () => {
    expect(() => parseDecisionSignal('perf:errorRate')).toThrow();
    expect(() => parseDecisionSignal('perf')).toThrow();
    expect(() => parseDecisionSignal('perf.errorRate.extra')).toThrow();
  });

  it('roundtrip over every pair in matrix', () => {
    for (const [category, signal] of ALL_SIGNAL_PAIRS) {
      expect(parseDecisionSignal(buildDecisionSignal({ category, signal }))).toEqual({
        category,
        signal,
      });
    }
  });

  it('property: 200 random pairs roundtrip + cross-category reject', () => {
    fc.assert(
      fc.property(fc.constantFrom(...ALL_SIGNAL_PAIRS), ([category, signal]) => {
        expect(parseDecisionSignal(buildDecisionSignal({ category, signal }))).toEqual({
          category,
          signal,
        });
        for (const other of Object.keys(SIGNALS_BY_CATEGORY) as SignalCategory[]) {
          if (other === category) continue;
          if ((SIGNALS_BY_CATEGORY[other] as readonly string[]).includes(signal)) continue;
          expect(() => buildDecisionSignal({ category: other, signal: signal as never })).toThrow();
        }
      }),
      { numRuns: 200 },
    );
  });
});
