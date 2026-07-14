// @def.boundary shared-utility-group
// @def.doc shared-utility-group

import { describe, it, expect } from 'vitest';
import { transitionGate, deriveBundleState } from './gate-fsm.js';
import type { GateState } from './gate-fsm.js';

describe('transitionGate', () => {
  it('idle → ready (schedule)', () => {
    expect(transitionGate('idle', { type: 'schedule' })).toBe('ready');
  });

  it('ready → gathering → running → passed', () => {
    let s: GateState = 'ready';
    s = transitionGate(s, { type: 'gather_start' });
    expect(s).toBe('gathering');
    s = transitionGate(s, { type: 'gather_done' });
    expect(s).toBe('running');
    s = transitionGate(s, { type: 'exit', code: 0 });
    expect(s).toBe('passed');
  });

  it('running → failed (exit code ≠ 0)', () => {
    expect(transitionGate('running', { type: 'exit', code: 1 })).toBe('failed');
  });

  it('passed → stale (source_changed)', () => {
    expect(transitionGate('passed', { type: 'source_changed' })).toBe('stale');
  });

  it('failed/stale → ready (retry)', () => {
    expect(transitionGate('failed', { type: 'retry' })).toBe('ready');
    expect(transitionGate('stale', { type: 'retry' })).toBe('ready');
  });

  it('skip/reset은 모든 상태에서 작동', () => {
    const states: GateState[] = [
      'idle',
      'blocked',
      'ready',
      'gathering',
      'running',
      'passed',
      'failed',
      'stale',
    ];
    for (const s of states) {
      expect(transitionGate(s, { type: 'skip' })).toBe('skipped');
      expect(transitionGate(s, { type: 'reset' })).toBe('idle');
    }
  });

  it('유효하지 않은 전이 → 현재 상태 유지', () => {
    expect(transitionGate('idle', { type: 'gather_start' })).toBe('idle');
    expect(transitionGate('passed', { type: 'schedule' })).toBe('passed');
  });
});

describe('deriveBundleState', () => {
  it('빈 배열 → empty', () => {
    expect(deriveBundleState([])).toBe('empty');
  });

  it('전부 passed → complete', () => {
    expect(deriveBundleState(['passed', 'passed'])).toBe('complete');
  });

  it('전부 skipped → complete', () => {
    expect(deriveBundleState(['skipped', 'skipped'])).toBe('complete');
  });

  it('failed 포함 → degraded', () => {
    expect(deriveBundleState(['passed', 'failed'])).toBe('degraded');
  });

  it('stale 포함 → degraded', () => {
    expect(deriveBundleState(['passed', 'stale'])).toBe('degraded');
  });

  it('passed + idle → partial', () => {
    expect(deriveBundleState(['passed', 'idle'])).toBe('partial');
  });

  it('gathering + idle → gathering', () => {
    expect(deriveBundleState(['gathering', 'idle'])).toBe('gathering');
  });

  it('전부 idle → pending', () => {
    expect(deriveBundleState(['idle', 'blocked'])).toBe('pending');
  });
});
