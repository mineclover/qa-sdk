import { describe, expect, it } from 'vitest';
import { transitionCanonicalReviewStatus } from './canonicalReviewStateMachine.js';

describe('transitionCanonicalReviewStatus', () => {
  it('success 이후 draft 변경은 editing으로 되돌린다', () => {
    expect(transitionCanonicalReviewStatus('success', 'DRAFT_CHANGED')).toBe(
      'editing',
    );
  });

  it('submit invalid는 invalid 상태로 고정한다', () => {
    expect(transitionCanonicalReviewStatus('editing', 'SUBMIT_INVALID')).toBe(
      'invalid',
    );
  });

  it('submit started는 submitting으로 전이한다', () => {
    expect(transitionCanonicalReviewStatus('editing', 'SUBMIT_STARTED')).toBe(
      'submitting',
    );
  });

  it('submit succeeded는 success로 전이한다', () => {
    expect(
      transitionCanonicalReviewStatus('submitting', 'SUBMIT_SUCCEEDED'),
    ).toBe('success');
  });

  it('submit failed는 error로 전이한다', () => {
    expect(transitionCanonicalReviewStatus('submitting', 'SUBMIT_FAILED')).toBe(
      'error',
    );
  });

  it('reset은 언제나 idle로 복귀한다', () => {
    expect(transitionCanonicalReviewStatus('invalid', 'RESET')).toBe('idle');
  });
});
