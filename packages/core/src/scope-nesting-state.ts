// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

/**
 * Scope Nesting — 상태 전이 검증
 *
 * state-transition.spec.md에 정의된 전이 규칙과 불변량을 기계적으로 검증한다.
 * 순수 함수 — UI/DOM 의존 없음.
 */

// ── 타입 ─────────────────────────────────────────────

export type PlaybookStatus = 'idle' | 'editing' | 'invalid' | 'submitting' | 'success' | 'error';

export type TransitionTrigger =
  | 'draft-change'
  | 'invalid-submit'
  | 'valid-submit'
  | 'submit-success'
  | 'submit-failure'
  | 'reset';

export interface TransitionResult {
  next: PlaybookStatus;
  sideEffects: SideEffect[];
}

export type SideEffect =
  | 'clear-stale-result'
  | 'update-validation-issues'
  | 'focus-first-invalid'
  | 'disable-submit-button'
  | 'update-result'
  | 'update-last-submitted'
  | 'update-submission-error'
  | 'reset-all-to-baseline';

export interface TransitionViolation {
  from: PlaybookStatus;
  trigger: TransitionTrigger;
  message: string;
}

// ── 전이 테이블 ──────────────────────────────────────

const TRANSITION_TABLE: Record<
  TransitionTrigger,
  (from: PlaybookStatus) => TransitionResult | TransitionViolation
> = {
  'draft-change': (from) => {
    if (from === 'submitting') {
      return { from, trigger: 'draft-change', message: 'submitting 상태에서 draft 변경 불가' };
    }
    const sideEffects: SideEffect[] = from === 'success' ? ['clear-stale-result'] : [];
    return { next: 'editing', sideEffects };
  },

  'invalid-submit': () => ({
    next: 'invalid',
    sideEffects: ['update-validation-issues', 'focus-first-invalid'],
  }),

  'valid-submit': () => ({
    next: 'submitting',
    sideEffects: ['disable-submit-button'],
  }),

  'submit-success': () => ({
    next: 'success',
    sideEffects: ['update-result', 'update-last-submitted'],
  }),

  'submit-failure': () => ({
    next: 'error',
    sideEffects: ['update-submission-error'],
  }),

  reset: () => ({
    next: 'idle',
    sideEffects: ['reset-all-to-baseline'],
  }),
};

// ── 전이 함수 ─────────────────────────────────────────

/** 불변량 위반 시 TransitionViolation 반환 */
export function transition(
  from: PlaybookStatus,
  trigger: TransitionTrigger,
): TransitionResult | TransitionViolation {
  return TRANSITION_TABLE[trigger](from);
}

export function isViolation(
  result: TransitionResult | TransitionViolation,
): result is TransitionViolation {
  return !('next' in result);
}

// ── 불변량 검증 ───────────────────────────────────────

const ALL_STATUSES: PlaybookStatus[] = [
  'idle',
  'editing',
  'invalid',
  'submitting',
  'success',
  'error',
];

/**
 * 전체 전이 테이블의 불변량을 검증한다.
 *
 * 1. submitting에서 draft-change → violation
 * 2. success에서 draft-change → editing + clear-stale-result
 * 3. 어떤 상태에서든 reset → idle
 */
export interface InvariantValidation {
  valid: boolean;
  violations: TransitionViolation[];
}

export function verifyInvariants(): InvariantValidation {
  const violations: TransitionViolation[] = [];

  for (const status of ALL_STATUSES) {
    // 불변량 3: reset은 어디서든 idle
    const resetResult = transition(status, 'reset');
    if (isViolation(resetResult)) {
      violations.push({
        from: status,
        trigger: 'reset',
        message: `reset이 ${status}에서 violation 발생 — 어디서든 idle이어야 함`,
      });
    } else if (resetResult.next !== 'idle') {
      violations.push({
        from: status,
        trigger: 'reset',
        message: `reset이 ${status}에서 ${resetResult.next}로 전이 — idle이어야 함`,
      });
    }
  }

  // 불변량 1: submitting에서 draft-change는 violation
  const submittingDraft = transition('submitting', 'draft-change');
  if (!isViolation(submittingDraft)) {
    violations.push({
      from: 'submitting',
      trigger: 'draft-change',
      message: 'submitting에서 draft-change가 violation이 아님',
    });
  }

  // 불변량 2: success에서 draft-change → editing + clear-stale-result
  const successDraft = transition('success', 'draft-change');
  if (isViolation(successDraft)) {
    violations.push({
      from: 'success',
      trigger: 'draft-change',
      message: 'success에서 draft-change가 violation — editing이어야 함',
    });
  } else {
    if (successDraft.next !== 'editing') {
      violations.push({
        from: 'success',
        trigger: 'draft-change',
        message: `success에서 ${successDraft.next}로 전이 — editing이어야 함`,
      });
    }
    if (!successDraft.sideEffects.includes('clear-stale-result')) {
      violations.push({
        from: 'success',
        trigger: 'draft-change',
        message: 'success→editing에서 clear-stale-result 부수효과 누락',
      });
    }
  }

  return { valid: violations.length === 0, violations };
}
