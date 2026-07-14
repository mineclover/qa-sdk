// @def.boundary sim-approval-api
// @def.doc sim-erp-pm-design

import { InvalidTransitionError } from './errors.js';
import type { RequestStatus } from './types.js';

/** state machine 입력에 필요한 최소 형태. */
export interface BudgetRequestDraft {
  status: RequestStatus;
  currentStage: number;
  totalStages: number;
}

/**
 * design.md §3 — amount-based stage 결정.
 *
 *   amount < 1,000,000   → 1 stage  (manager)
 *   1M ≤ amount < 10M    → 2 stages (manager → director)
 *   amount ≥ 10M         → 3 stages (manager → director → cfo)
 *
 * 방어: 음수/0은 1 stage.
 */
export function determineStages(amount: number): number {
  if (amount < 1_000_000) return 1;
  if (amount < 10_000_000) return 2;
  return 3;
}

const TRANSITIONS: Record<RequestStatus, Record<string, RequestStatus>> = {
  draft: { submit: 'submitted' },
  submitted: { review: 'in_review', cancel: 'draft' },
  in_review: { approve: 'approved', reject: 'rejected', request_revision: 'revision_requested' },
  revision_requested: { submit: 'submitted', cancel: 'draft' },
  approved: {},
  rejected: {},
};

export function transitionRequest(cur: BudgetRequestDraft, action: string): BudgetRequestDraft {
  const next = TRANSITIONS[cur.status]?.[action];
  if (!next) throw new InvalidTransitionError(cur.status, action);
  return { ...cur, status: next };
}

/**
 * 단계 결정 적용.
 *
 * - decision="approved":
 *   - currentStage < totalStages → currentStage++ + 상태 유지(in_review)
 *   - currentStage === totalStages → status = "approved"
 * - decision="rejected" → 즉시 status = "rejected" (단계 무관)
 *
 * 호출자(BudgetService)는 요청 status가 in_review여야 함을 확인.
 */
export function applyDecision(
  cur: BudgetRequestDraft,
  decision: 'approved' | 'rejected',
): BudgetRequestDraft {
  if (decision === 'rejected') {
    return { ...cur, status: 'rejected' };
  }
  if (cur.currentStage >= cur.totalStages) {
    return { ...cur, status: 'approved' };
  }
  return { ...cur, currentStage: cur.currentStage + 1 };
}
