import { describe, expect, it } from 'vitest';
import {
  determineStages,
  transitionRequest,
  applyDecision,
  type BudgetRequestDraft,
} from './budget-state.js';

describe('determineStages — design.md §3', () => {
  it('amount < 1,000,000 → 1 stage', () => {
    expect(determineStages(999_999)).toBe(1);
    expect(determineStages(1)).toBe(1);
  });
  it('1M ≤ amount < 10M → 2 stages', () => {
    expect(determineStages(1_000_000)).toBe(2);
    expect(determineStages(9_999_999)).toBe(2);
  });
  it('amount ≥ 10M → 3 stages', () => {
    expect(determineStages(10_000_000)).toBe(3);
    expect(determineStages(100_000_000)).toBe(3);
  });
  it('음수/0 → 1 stage (방어)', () => {
    expect(determineStages(0)).toBe(1);
    expect(determineStages(-1)).toBe(1);
  });
});

describe('transitionRequest — 상태 전이', () => {
  const draft = (status: string): BudgetRequestDraft => ({
    status: status as BudgetRequestDraft['status'],
    currentStage: 1,
    totalStages: 2,
  });

  it('draft → submit → submitted', () => {
    expect(transitionRequest(draft('draft'), 'submit').status).toBe('submitted');
  });
  it('submitted → review → in_review', () => {
    expect(transitionRequest(draft('submitted'), 'review').status).toBe('in_review');
  });
  it('revision_requested → submit → submitted (재제출)', () => {
    expect(transitionRequest(draft('revision_requested'), 'submit').status).toBe('submitted');
  });
  it('approved 상태에서 submit → InvalidTransitionError', () => {
    expect(() => transitionRequest(draft('approved'), 'submit')).toThrow('Invalid transition');
  });
});

describe('applyDecision — 단계 진행', () => {
  it('1단계만 + approve → 즉시 approved', () => {
    const r: BudgetRequestDraft = { status: 'in_review', currentStage: 1, totalStages: 1 };
    const next = applyDecision(r, 'approved');
    expect(next.status).toBe('approved');
    expect(next.currentStage).toBe(1);
  });
  it('2단계 첫 승인 → currentStage++ + 여전히 in_review', () => {
    const r: BudgetRequestDraft = { status: 'in_review', currentStage: 1, totalStages: 2 };
    const next = applyDecision(r, 'approved');
    expect(next.status).toBe('in_review');
    expect(next.currentStage).toBe(2);
  });
  it('3단계 마지막 승인 → approved', () => {
    const r: BudgetRequestDraft = { status: 'in_review', currentStage: 3, totalStages: 3 };
    const next = applyDecision(r, 'approved');
    expect(next.status).toBe('approved');
  });
  it('어느 단계든 reject → 즉시 rejected', () => {
    const r: BudgetRequestDraft = { status: 'in_review', currentStage: 2, totalStages: 3 };
    const next = applyDecision(r, 'rejected');
    expect(next.status).toBe('rejected');
  });
});
