import { describe, it, expect } from 'vitest';
import {
  toSafetyDecisionView,
  toResourceDecisionView,
  toAlertEventView,
  toAuditTraceView,
  type SafetyDecisionRecordInput,
  type ResourceDecisionRecordInput,
  type AlertEventRecordInput,
} from './conversion.js';

const ID = '01HXYZ0000000000000000',
  AT = '2026-05-02T10:00:00.000Z';

// 기본 promote safety record (action passthrough 기준 fixture)
const safety: SafetyDecisionRecordInput = {
  decisionId: `sim.dec.safety.${ID}`,
  cycleId: `sim.cyc.${ID}`,
  cycleAt: AT,
  pass: 'safety',
  verdict: 'promote',
  triggerSignals: [],
  confidence: 0.92,
  categoryVerdicts: {
    perf: 'PASS',
    compatibility: 'PASS',
    decisionQuality: 'PASS',
    auditSafety: 'PASS',
    replicationHealth: 'PASS',
  },
  evidence: [{ kind: 'data', source: 'metrics:perf', content: { ok: true }, weight: 1 }],
  action: { kind: 'weight-update', revision: 2, weight: 25 },
};
// 기본 rejected resource record (noop+rejected → view rejected fixture)
const resource: ResourceDecisionRecordInput = {
  decisionId: `sim.dec.resource.${ID}`,
  cycleId: safety.cycleId,
  cycleAt: '2026-05-02T10:00:30.000Z',
  pass: 'resource',
  verdict: 'rejected',
  rejectedBy: 'resourceHeadroom',
  triggerSignals: ['resourceHeadroom'],
  confidence: 0.81,
  categoryVerdicts: { loadPressure: 'FAIL', resourceHeadroom: 'FAIL', stability: 'PASS' },
  evidence: [],
  action: { kind: 'noop' },
};
const alert: AlertEventRecordInput = {
  cycleId: safety.cycleId,
  kind: 'scale-rejected',
  occurredAt: '2026-05-02T10:00:30.500Z',
  details: { rejectedBy: 'resourceHeadroom' },
  internalSeq: 17,
};

describe('conversion (sim-decision-view §4)', () => {
  it('4 view 변환: 필드 보존 + evidence/internalSeq drop + audit trace 합성/undefined', () => {
    const s = toSafetyDecisionView(safety),
      r = toResourceDecisionView(resource),
      a = toAlertEventView(alert);
    expect(s.action).toEqual({ kind: 'weight-update', revision: 2, weight: 25 });
    expect(r.rejectedBy).toBe('resourceHeadroom');
    expect(a.kind).toBe('scale-rejected');
    for (const v of [s, r])
      expect((v as unknown as { evidence?: unknown }).evidence).toBeUndefined();
    expect((a as unknown as { internalSeq?: unknown }).internalSeq).toBeUndefined();
    const t = toAuditTraceView({
      cycleId: safety.cycleId,
      cycleAt: AT,
      safety,
      resource,
      events: [alert],
    });
    expect(t.decisions.safety?.verdict).toBe('promote');
    expect(t.decisions.resource?.verdict).toBe('rejected');
    expect(t.events).toHaveLength(1);
    const t2 = toAuditTraceView({
      cycleId: safety.cycleId,
      cycleAt: AT,
      safety: undefined,
      resource: undefined,
      events: [],
    });
    expect(t2.decisions.safety).toBeUndefined();
    expect(t2.decisions.resource).toBeUndefined();
  });

  it('safety: noop + verdict=hold → view action hold', () => {
    const r: SafetyDecisionRecordInput = {
      ...safety,
      verdict: 'hold',
      action: { kind: 'noop' },
    };
    expect(toSafetyDecisionView(r).action).toEqual({ kind: 'hold' });
  });

  it('safety: weight-update(weight=0) + verdict=rollback + triggerSignals → view rollback', () => {
    const r: SafetyDecisionRecordInput = {
      ...safety,
      verdict: 'rollback',
      triggerSignals: ['perf-regression'],
      action: { kind: 'weight-update', weight: 0, revision: 3 },
    };
    expect(toSafetyDecisionView(r).action).toEqual({
      kind: 'rollback',
      revision: 3,
      reason: 'perf-regression',
    });
  });

  it('safety: weight-update + verdict=promote → view weight-update 그대로', () => {
    const r: SafetyDecisionRecordInput = {
      ...safety,
      verdict: 'promote',
      action: { kind: 'weight-update', revision: 2, weight: 25 },
    };
    expect(toSafetyDecisionView(r).action).toEqual({
      kind: 'weight-update',
      revision: 2,
      weight: 25,
    });
  });

  it('resource: scale + verdict=scale-up → view scale (reason drop)', () => {
    const r: ResourceDecisionRecordInput = {
      ...resource,
      verdict: 'scale-up',
      rejectedBy: undefined,
      triggerSignals: [],
      categoryVerdicts: { loadPressure: 'FAIL', resourceHeadroom: 'PASS', stability: 'PASS' },
      action: { kind: 'scale', target: { v1: 80, v2: 20 }, reason: 'load-pressure' },
    };
    expect(toResourceDecisionView(r).action).toEqual({
      kind: 'scale',
      target: { v1: 80, v2: 20 },
    });
  });

  it('resource: noop + verdict=rejected + triggerSignals → view rejected', () => {
    const r: ResourceDecisionRecordInput = {
      ...resource,
      verdict: 'rejected',
      triggerSignals: ['resource-headroom'],
      action: { kind: 'noop' },
    };
    expect(toResourceDecisionView(r).action).toEqual({
      kind: 'rejected',
      reason: 'resource-headroom',
    });
  });

  it('resource: noop + verdict=hold → view hold', () => {
    const r: ResourceDecisionRecordInput = {
      ...resource,
      verdict: 'hold',
      rejectedBy: undefined,
      triggerSignals: [],
      categoryVerdicts: { loadPressure: 'PASS', resourceHeadroom: 'PASS', stability: 'WARN' },
      action: { kind: 'noop' },
    };
    expect(toResourceDecisionView(r).action).toEqual({ kind: 'hold' });
  });
});
