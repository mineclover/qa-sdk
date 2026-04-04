/**
 * Scope Nesting — 상태 전이 검증
 *
 * state-transition.spec.md에 정의된 전이 규칙과 불변량을 기계적으로 검증한다.
 * 순수 함수 — UI/DOM 의존 없음.
 */

// ── 상태 머신 타입 ────────────────────────────────────

/** playbook status 상태 */
export type PlaybookStatus =
  | "idle"
  | "editing"
  | "invalid"
  | "submitting"
  | "success"
  | "error";

/** 상태 전이 트리거 */
export type TransitionTrigger =
  | "draft-change"
  | "invalid-submit"
  | "valid-submit"
  | "submit-success"
  | "submit-failure"
  | "reset";

/** 전이 결과 */
export interface TransitionResult {
  /** 전이 후 상태 */
  next: PlaybookStatus;
  /** 부수효과 */
  sideEffects: SideEffect[];
}

export type SideEffect =
  | "clear-stale-result"
  | "update-validation-issues"
  | "focus-first-invalid"
  | "disable-submit-button"
  | "update-result"
  | "update-last-submitted"
  | "update-submission-error"
  | "reset-all-to-baseline";

/** 전이 규칙 위반 */
export interface TransitionViolation {
  from: PlaybookStatus;
  trigger: TransitionTrigger;
  message: string;
}

// ── 전이 함수 ─────────────────────────────────────────

/** 전이 규칙 테이블 — state-transition.spec.md 기준 */
const TRANSITION_TABLE: Record<TransitionTrigger, (from: PlaybookStatus) => TransitionResult | TransitionViolation> = {
  "draft-change": (from) => {
    if (from === "submitting") {
      return { from, trigger: "draft-change", message: "submitting 상태에서 draft 변경 불가" };
    }
    const sideEffects: SideEffect[] = [];
    if (from === "success") {
      sideEffects.push("clear-stale-result");
    }
    return { next: "editing", sideEffects };
  },

  "invalid-submit": (_from) => ({
    next: "invalid",
    sideEffects: ["update-validation-issues", "focus-first-invalid"],
  }),

  "valid-submit": (_from) => ({
    next: "submitting",
    sideEffects: ["disable-submit-button"],
  }),

  "submit-success": (_from) => ({
    next: "success",
    sideEffects: ["update-result", "update-last-submitted"],
  }),

  "submit-failure": (_from) => ({
    next: "error",
    sideEffects: ["update-submission-error"],
  }),

  "reset": (_from) => ({
    next: "idle",
    sideEffects: ["reset-all-to-baseline"],
  }),
};

/**
 * 상태 전이를 실행한다.
 * 불변량 위반 시 TransitionViolation 반환.
 */
export function transition(
  from: PlaybookStatus,
  trigger: TransitionTrigger,
): TransitionResult | TransitionViolation {
  return TRANSITION_TABLE[trigger](from);
}

/** TransitionViolation 타입 가드 */
export function isViolation(
  result: TransitionResult | TransitionViolation,
): result is TransitionViolation {
  return !("next" in result);
}

// ── 불변량 검증 ───────────────────────────────────────

/** 모든 상태 */
const ALL_STATUSES: PlaybookStatus[] = [
  "idle", "editing", "invalid", "submitting", "success", "error",
];

/**
 * 전체 전이 테이블의 불변량을 검증한다.
 *
 * 불변량:
 * 1. submitting에서 draft-change → violation
 * 2. success에서 draft-change → editing + clear-stale-result
 * 3. 어떤 상태에서든 reset → idle
 */
export function verifyInvariants(): TransitionViolation[] {
  const violations: TransitionViolation[] = [];

  for (const status of ALL_STATUSES) {
    // 불변량 3: reset은 어디서든 idle
    const resetResult = transition(status, "reset");
    if (isViolation(resetResult)) {
      violations.push({
        from: status,
        trigger: "reset",
        message: `reset이 ${status}에서 violation 발생 — 어디서든 idle이어야 함`,
      });
    } else if (resetResult.next !== "idle") {
      violations.push({
        from: status,
        trigger: "reset",
        message: `reset이 ${status}에서 ${resetResult.next}로 전이 — idle이어야 함`,
      });
    }
  }

  // 불변량 1: submitting에서 draft-change는 violation
  const submittingDraft = transition("submitting", "draft-change");
  if (!isViolation(submittingDraft)) {
    violations.push({
      from: "submitting",
      trigger: "draft-change",
      message: "submitting에서 draft-change가 violation이 아님",
    });
  }

  // 불변량 2: success에서 draft-change → editing + clear-stale-result
  const successDraft = transition("success", "draft-change");
  if (isViolation(successDraft)) {
    violations.push({
      from: "success",
      trigger: "draft-change",
      message: "success에서 draft-change가 violation — editing이어야 함",
    });
  } else {
    if (successDraft.next !== "editing") {
      violations.push({
        from: "success",
        trigger: "draft-change",
        message: `success에서 ${successDraft.next}로 전이 — editing이어야 함`,
      });
    }
    if (!successDraft.sideEffects.includes("clear-stale-result")) {
      violations.push({
        from: "success",
        trigger: "draft-change",
        message: "success→editing에서 clear-stale-result 부수효과 누락",
      });
    }
  }

  return violations;
}
