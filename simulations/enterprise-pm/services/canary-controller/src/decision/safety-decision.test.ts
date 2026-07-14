// @def.boundary sim-canary-controller
// @def.doc canary-controller-config
// spec 01 §3 의사 코드 1:1 — 우선순위 분기 8 케이스 검증.

import { describe, it, expect, beforeEach } from 'vitest';
import { SafetyDecisionService, type SafetyConfig } from './safety-decision.service.js';
import type { CategoryVerdicts, Verdict } from '../verdict/category-verdict.service.js';

const cfg: SafetyConfig = {
  weightSequence: [5, 25, 50, 100],
  dwellMs: 120_000,
  confidenceHold: 0.6,
  windowCycles: 10,
  failQuorum: 3,
};

function okVerdicts(overrides: Partial<CategoryVerdicts> = {}): CategoryVerdicts {
  return {
    perf: 'PASS',
    compatibility: 'PASS',
    decisionQuality: 'PASS',
    auditSafety: 'PASS',
    replicationHealth: 'PASS',
    loadPressure: 'PASS',
    resourceHeadroom: 'PASS',
    stability: 'PASS',
    hardFail: [],
    triggerSignals: [],
    ...overrides,
  };
}

describe('SafetyDecisionService (spec 01 §3)', () => {
  let svc: SafetyDecisionService;
  beforeEach(() => {
    svc = new SafetyDecisionService(cfg);
  });

  it('(a) hard rollback when compatibility hardFail', () => {
    const v = okVerdicts({
      compatibility: 'FAIL',
      hardFail: ['compatibility'],
      triggerSignals: ['compatibility.schemaCompatRate'],
    });
    const d = svc.decide({
      verdicts: v,
      confidence: 0.9,
      currentWeight: 25,
      history: [],
      timeSincePromotionMs: 200_000,
    });
    expect(d.verdict).toBe('rollback');
    expect(d.triggerCategory).toBe('compatibility');
    expect(d.action).toMatchObject({ kind: 'weight-update', weight: 0 });
  });

  it('(b) auditSafety hardFail → rollback (perf WARN과 동시여도 hardFail 우선)', () => {
    const v = okVerdicts({
      perf: 'WARN',
      auditSafety: 'FAIL',
      hardFail: ['auditSafety'],
      triggerSignals: ['auditSafety.criticalAnomalyRate'],
    });
    const d = svc.decide({
      verdicts: v,
      confidence: 0.9,
      currentWeight: 25,
      history: [],
      timeSincePromotionMs: 200_000,
    });
    expect(d.verdict).toBe('rollback');
    expect(d.triggerCategory).toBe('auditSafety');
  });

  it('(c) windowCycles 내 prior 2 FAIL + 현재 perf FAIL → soft rollback (≥3)', () => {
    const v = okVerdicts({ perf: 'FAIL' });
    const d = svc.decide({
      verdicts: v,
      confidence: 0.9,
      currentWeight: 25,
      history: [false, true, false, true, false, false], // 2 prior FAIL
      timeSincePromotionMs: 200_000,
    });
    expect(d.verdict).toBe('rollback');
    expect(d.triggerCategory).toBe('perf');
    expect(d.action).toMatchObject({ kind: 'weight-update', weight: 0 });
  });

  it('(d) confidence < 0.6 → hold', () => {
    const d = svc.decide({
      verdicts: okVerdicts(),
      confidence: 0.5,
      currentWeight: 5,
      history: [],
      timeSincePromotionMs: 200_000,
    });
    expect(d.verdict).toBe('hold');
    expect(d.action).toEqual({ kind: 'noop' });
  });

  it('(e) any WARN → hold (triggerCategory 비워둠)', () => {
    const v = okVerdicts({
      perf: 'WARN',
      triggerSignals: ['perf.p95LatencyDelta'],
    });
    const d = svc.decide({
      verdicts: v,
      confidence: 0.9,
      currentWeight: 25,
      history: [],
      timeSincePromotionMs: 200_000,
    });
    expect(d.verdict).toBe('hold');
    expect(d.triggerCategory).toBeUndefined();
    expect(d.triggerSignals).toContain('perf.p95LatencyDelta');
  });

  it('(f) all PASS + dwell 경과 + currentWeight=5 → promote weight=25', () => {
    const d = svc.decide({
      verdicts: okVerdicts(),
      confidence: 0.9,
      currentWeight: 5,
      history: [],
      timeSincePromotionMs: 130_000,
    });
    expect(d.verdict).toBe('promote');
    expect(d.action).toMatchObject({ kind: 'weight-update', weight: 25 });
  });

  it('(g) all PASS + dwell 미경과 → hold', () => {
    const d = svc.decide({
      verdicts: okVerdicts(),
      confidence: 0.9,
      currentWeight: 5,
      history: [],
      timeSincePromotionMs: 60_000,
    });
    expect(d.verdict).toBe('hold');
  });

  it('(h) currentWeight=100 + all PASS + dwell 경과 → hold + action=noop (terminal)', () => {
    const d = svc.decide({
      verdicts: okVerdicts(),
      confidence: 0.9,
      currentWeight: 100,
      history: [],
      timeSincePromotionMs: 130_000,
    });
    // 시퀀스 끝 (weight=100) 에서는 verdict=hold + action=noop (terminal) —
    // 시나리오 9 §3.1 압축 예시 (promote action 시퀀스 4 entry deepEqual) 의 단조 보장.
    // weight 100 도달 후 후속 사이클은 promote 필터에서 자동 제외.
    expect(d.verdict).toBe('hold');
    expect(d.action).toEqual({ kind: 'noop' });
  });
});
