import {
  recordCanonicalReviewDraftReopened,
} from '../business/canonicalReviewActivity.js';
import type { CanonicalReviewDraft, CanonicalRiskLevel } from '../business/canonicalReviewDraft.js';
import { transitionCanonicalReviewStatus } from '../business/canonicalReviewStateMachine.js';
import { validateCanonicalReviewDraft } from '../business/canonicalReviewValidation.js';
import type { CanonicalReviewContext } from '../contexts/CanonicalReviewContexts.js';
import { updateCanonicalReviewState } from '../contexts/CanonicalReviewContexts.js';
import {
  appendCanonicalReviewActivity,
  flushCanonicalReviewBridge,
} from './canonicalReviewHandlerSupport.js';

type CanonicalReviewTextField = 'changeTitle' | 'owner' | 'rollbackPlan' | 'summary';

export interface CanonicalReviewDraftHandlers {
  updateTextField(field: CanonicalReviewTextField, value: string): void;
  updateRiskLevel(value: CanonicalRiskLevel): void;
}

export function createCanonicalReviewDraftHandlers(
  context: CanonicalReviewContext,
): CanonicalReviewDraftHandlers {
  return {
    updateTextField(field: CanonicalReviewTextField, value: string): void {
      applyDraftUpdate(context, (draft) => ({ ...draft, [field]: value }), field);
    },
    updateRiskLevel(value: CanonicalRiskLevel): void {
      applyDraftUpdate(context, (draft) => ({ ...draft, riskLevel: value }), 'riskLevel');
    },
  };
}

function applyDraftUpdate(
  context: CanonicalReviewContext,
  updater: (draft: CanonicalReviewDraft) => CanonicalReviewDraft,
  changedField: string,
): void {
  const currentState = context.store.getState();
  const reopenedFromSuccess = currentState.status === 'success';
  const nextDraft = updater(currentState.draft);
  const nextValidationIssues =
    currentState.status === 'invalid' || currentState.status === 'error'
      ? validateCanonicalReviewDraft(nextDraft)
      : [];

  updateCanonicalReviewState(context, (state) => ({
    ...state,
    draft: nextDraft,
    validationIssues: nextValidationIssues,
    result: state.status === 'success' ? null : state.result,
    status: transitionCanonicalReviewStatus(state.status, 'DRAFT_CHANGED'),
    submissionError: null,
    lastSubmittedAt: state.status === 'success' ? null : state.lastSubmittedAt,
  }));

  if (!reopenedFromSuccess) {
    return;
  }

  const activity = recordCanonicalReviewDraftReopened(changedField);
  appendCanonicalReviewActivity(context, activity);
  context.bridge.emitEvent('canonical_review_reopened', {
    field: changedField,
  });
  void flushCanonicalReviewBridge(context);
}
