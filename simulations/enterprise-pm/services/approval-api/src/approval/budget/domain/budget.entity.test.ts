// @def.boundary sim-approval-api
// @def.doc domain-slice-architecture

import { describe, expect, it } from 'vitest';
import { BudgetEntity, determineStages } from './budget.entity.js';
import {
  BudgetStageConflictException,
  BudgetTransitionConflictException,
  InvalidBudgetAmountException,
  InvalidBudgetIdException,
} from './budget.exceptions.js';

const baseInput = {
  id: 'br_001',
  projectId: 'prj_001',
  projectDepartmentId: 'dept_eng',
  amount: 500_000,
  requesterId: 'user_001',
  now: new Date('2026-01-01T00:00:00.000Z'),
};

describe('BudgetEntity', () => {
  it('create() 는 draft + amount 기반 totalStages 로 시작한다', () => {
    const e = BudgetEntity.create(baseInput);
    expect(e.status).toBe('draft');
    expect(e.totalStages).toBe(1);
    expect(e.currentStage).toBe(1);
  });

  it('determineStages: <1M=1, 1M~10M=2, ≥10M=3', () => {
    expect(determineStages(0.5)).toBe(1);
    expect(determineStages(999_999)).toBe(1);
    expect(determineStages(1_000_000)).toBe(2);
    expect(determineStages(9_999_999)).toBe(2);
    expect(determineStages(10_000_000)).toBe(3);
  });

  it('create() 는 빈 id 에 대해 InvalidBudgetIdException 을 던진다', () => {
    expect(() => BudgetEntity.create({ ...baseInput, id: '  ' })).toThrow(InvalidBudgetIdException);
  });

  it('create() 는 amount<=0 에 대해 InvalidBudgetAmountException 을 던진다', () => {
    expect(() => BudgetEntity.create({ ...baseInput, amount: 0 })).toThrow(
      InvalidBudgetAmountException,
    );
  });

  it('submit: draft → submitted (불변)', () => {
    const draft = BudgetEntity.create(baseInput);
    const submitted = draft.submit(new Date('2026-01-02T00:00:00.000Z'));
    expect(draft.status).toBe('draft');
    expect(submitted.status).toBe('submitted');
  });

  it('submit: 잘못된 상태에서 호출 시 BudgetTransitionConflictException', () => {
    const draft = BudgetEntity.create(baseInput);
    const submitted = draft.submit();
    expect(() => submitted.submit()).toThrow(BudgetTransitionConflictException);
  });

  it('startReview: submitted → in_review', () => {
    const e = BudgetEntity.create(baseInput).submit().startReview();
    expect(e.status).toBe('in_review');
  });

  it('decide(approved): 마지막 단계면 approved', () => {
    const e = BudgetEntity.create(baseInput).submit().startReview();
    const decided = e.decide('approved');
    expect(decided.status).toBe('approved');
  });

  it('decide(approved): 중간 단계면 currentStage 증가', () => {
    const big = BudgetEntity.create({ ...baseInput, amount: 5_000_000 })
      .submit()
      .startReview();
    expect(big.totalStages).toBe(2);
    const next = big.decide('approved');
    expect(next.status).toBe('in_review');
    expect(next.currentStage).toBe(2);
  });

  it('decide(rejected): 즉시 rejected', () => {
    const e = BudgetEntity.create({ ...baseInput, amount: 20_000_000 })
      .submit()
      .startReview();
    const final = e.decide('rejected');
    expect(final.status).toBe('rejected');
  });

  it('decide: in_review 가 아니면 BudgetStageConflictException', () => {
    const submitted = BudgetEntity.create(baseInput).submit();
    expect(() => submitted.decide('approved')).toThrow(BudgetStageConflictException);
  });

  it('toSnapshot/rehydrate 라운드트립 보존', () => {
    const original = BudgetEntity.create(baseInput).submit().startReview();
    const snap = original.toSnapshot();
    const back = BudgetEntity.rehydrate(snap);
    expect(back.toSnapshot()).toEqual(snap);
  });

  it('예외 name 매핑 — kit 의 mapDomainErrorToHttp 와 호환', () => {
    expect(new InvalidBudgetIdException().name).toBe('ValidationError');
    expect(new InvalidBudgetAmountException(-1).name).toBe('ValidationError');
    expect(new BudgetTransitionConflictException('submitted', 'submit').name).toBe('ConflictError');
    expect(new BudgetStageConflictException('x').name).toBe('ConflictError');
  });
});
