import { describe, it, expect, beforeEach } from 'vitest';
import {
  registerTransitions,
  getTransition,
  getAllTransitions,
  clearTransitions,
  validateTransitionEvents,
} from './transition.js';

beforeEach(() => {
  clearTransitions();
});

describe('transition registry', () => {
  it('등록 + 조회', () => {
    registerTransitions([
      { transitionId: 'transfer.execute', events: ['account.debit', 'account.credit'] },
    ]);
    const def = getTransition('transfer.execute');
    expect(def).toBeDefined();
    expect(def!.events).toEqual(['account.debit', 'account.credit']);
  });

  it('전체 조회', () => {
    registerTransitions([
      { transitionId: 't1', events: ['e1'] },
      { transitionId: 't2', events: ['e2', 'e3'] },
    ]);
    expect(getAllTransitions()).toHaveLength(2);
  });

  it('미등록 → undefined', () => {
    expect(getTransition('nonexistent')).toBeUndefined();
  });
});

describe('validateTransitionEvents', () => {
  it('정합 — pipe와 def가 동일 → 이슈 없음', () => {
    registerTransitions([
      { transitionId: 'transfer', events: ['account.debit', 'account.credit'] },
    ]);
    const issues = validateTransitionEvents('transfer', ['account.debit', 'account.credit']);
    expect(issues).toEqual([]);
  });

  it('미등록 transition → warning', () => {
    const issues = validateTransitionEvents('ghost', ['e1']);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.message).toContain('등록되지 않음');
  });

  it('pipe에만 있는 이벤트 → warning', () => {
    registerTransitions([{ transitionId: 't1', events: ['e1'] }]);
    const issues = validateTransitionEvents('t1', ['e1', 'e2']);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.message).toContain('e2');
    expect(issues[0]!.message).toContain('TransitionDef에는 없음');
  });

  it('def에만 있는 이벤트 → warning', () => {
    registerTransitions([{ transitionId: 't1', events: ['e1', 'e2'] }]);
    const issues = validateTransitionEvents('t1', ['e1']);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.message).toContain('e2');
    expect(issues[0]!.message).toContain('PipeTransitionScope에는 없음');
  });

  it('양방향 불일치', () => {
    registerTransitions([{ transitionId: 't1', events: ['shared', 'def_only'] }]);
    const issues = validateTransitionEvents('t1', ['shared', 'pipe_only']);
    expect(issues).toHaveLength(2);
  });
});
