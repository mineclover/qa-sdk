// @def.boundary sim-canary-controller
// spec 2026-05-02 §5 — DecisionRingBuffer SSOT 테스트.

import { describe, it, expect, beforeEach } from 'vitest';
import { DecisionRingBuffer } from './decision-ring-buffer.js';
import type {
  SafetyDecisionRecordInput,
  ResourceDecisionRecordInput,
  AlertEventRecordInput,
} from 'sim-decision-view';

const C = (n: number) => `sim.cyc.01HXYZ000000000000000${n}`;

function s(
  cId: string,
  verdict: 'promote' | 'rollback' = 'promote',
  at = '2026-05-02T10:00:00.000Z',
): SafetyDecisionRecordInput {
  return {
    decisionId: `sim.dec.safety.${cId.replace('sim.cyc.', '')}`,
    cycleId: cId,
    pass: 'safety',
    verdict,
    cycleAt: at,
    triggerSignals: [],
    confidence: 0.9,
    categoryVerdicts: {
      perf: 'PASS',
      compatibility: 'PASS',
      decisionQuality: 'PASS',
      auditSafety: 'PASS',
      replicationHealth: 'PASS',
    },
  };
}

function r(
  cId: string,
  verdict: 'scale-up' | 'rejected' = 'scale-up',
): ResourceDecisionRecordInput {
  return {
    decisionId: `sim.dec.resource.${cId.replace('sim.cyc.', '')}`,
    cycleId: cId,
    pass: 'resource',
    verdict,
    cycleAt: '2026-05-02T10:00:30.000Z',
    triggerSignals: [],
    confidence: 0.85,
    categoryVerdicts: {
      loadPressure: 'PASS',
      resourceHeadroom: 'PASS',
      stability: 'PASS',
    },
  };
}

describe('DecisionRingBuffer (spec §5)', () => {
  let rb: DecisionRingBuffer;
  beforeEach(() => {
    rb = new DecisionRingBuffer({ maxSize: 5 });
  });

  it('appendSafety FIFO + maxSize evict + queryDecisions 필터(verdict/cycleIds/limit) + queryFirst null/match', () => {
    for (let i = 1; i <= 7; i++) rb.appendSafety(s(C(i), i === 4 ? 'rollback' : 'promote'));
    const all = rb.queryDecisions({ pass: 'safety' });
    expect(all).toHaveLength(5);
    expect(all[0].cycleId).toBe(C(3));
    expect(rb.queryDecisions({ pass: 'safety', verdict: 'rollback' })).toHaveLength(1);
    expect(rb.queryDecisions({ pass: 'safety', cycleIds: [C(5)] })).toHaveLength(1);
    expect(rb.queryDecisions({ pass: 'safety', limit: 2 })).toHaveLength(2);
    expect(rb.queryFirst({ pass: 'safety', verdict: 'rollback' })?.cycleId).toBe(C(4));
    expect(rb.queryFirst({ pass: 'resource' })).toBeNull();
  });

  it('recentCycleIds/recentCycleCount + countAlerts + trace + recentSafetyHistory', () => {
    const ev: AlertEventRecordInput = {
      cycleId: C(1),
      kind: 'scale-rejected',
      occurredAt: '2026-05-02T10:00:00.000Z',
    };
    rb.appendAlert(ev);
    rb.appendAlert({ ...ev, kind: 'audit-critical-anomaly' });
    rb.appendAlert({ ...ev, cycleId: C(2) });
    rb.appendSafety(s(C(1), 'promote', '2026-05-02T10:00:00.000Z'));
    rb.appendResource(r(C(1)));
    rb.appendSafety(s(C(2), 'rollback', '2026-05-02T10:00:30.000Z'));
    rb.appendSafety(s(C(3), 'promote', '2026-05-02T10:01:00.000Z'));
    expect(rb.recentCycleIds(10)).toEqual([C(3), C(2), C(1)]);
    expect(rb.recentCycleCount()).toBe(3);
    expect(rb.countAlerts({ kind: 'scale-rejected' })).toBe(2);
    expect(rb.countAlerts({ kind: 'audit-critical-anomaly' })).toBe(1);
    expect(rb.countAlerts({ kind: 'scale-rejected', cycleIds: [C(1)] })).toBe(1);
    expect(rb.trace(C(1))?.resource?.verdict).toBe('scale-up');
    expect(rb.recentSafetyHistory(10)).toEqual([false, true, false]);
  });
});
