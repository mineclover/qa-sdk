import { now } from '@qa-sdk/sdk';
import {
  recordCanonicalReviewDraftReset,
  recordCanonicalReviewSubmissionFailed,
  recordCanonicalReviewSubmissionStarted,
  recordCanonicalReviewSubmissionSucceeded,
  recordCanonicalReviewValidationFailed,
} from '../business/canonicalReviewActivity.js';
import { assessCanonicalReviewDraft } from '../business/canonicalReviewBusiness.js';
import { createCanonicalReviewDraft } from '../business/canonicalReviewDraft.js';
import { transitionCanonicalReviewStatus } from '../business/canonicalReviewStateMachine.js';
import { findFirstInvalidField } from '../business/canonicalReviewValidation.js';
import type { CanonicalReviewContext } from '../contexts/CanonicalReviewContexts.js';
import { updateCanonicalReviewState } from '../contexts/CanonicalReviewContexts.js';
import {
  appendCanonicalReviewActivity,
  flushCanonicalReviewBridge,
  focusCanonicalReviewField,
} from './canonicalReviewHandlerSupport.js';

export interface CanonicalReviewSubmissionHandlers {
  submit(): Promise<void>;
  reset(): Promise<void>;
}

export function createCanonicalReviewSubmissionHandlers(
  context: CanonicalReviewContext,
): CanonicalReviewSubmissionHandlers {
  return {
    async submit(): Promise<void> {
      const currentState = context.store.getState();
      if (currentState.status === 'submitting') {
        return;
      }

      const { issues, result } = assessCanonicalReviewDraft(currentState.draft);

      if (!result) {
        updateCanonicalReviewState(context, (state) => ({
          ...state,
          validationIssues: issues,
          result: null,
          status: transitionCanonicalReviewStatus(state.status, 'SUBMIT_INVALID'),
          submissionError: null,
        }));
        appendCanonicalReviewActivity(
          context,
          recordCanonicalReviewValidationFailed(
            issues.map((issue) => issue.field),
            issues.length,
          ),
        );
        context.bridge.emitEvent('canonical_review_validation_failed', {
          fields: issues.map((issue) => issue.field),
          issue_count: issues.length,
        });
        context.bridge.emitMetric('canonical_review_issue_count', issues.length, {
          type: 'gauge',
        });
        await flushCanonicalReviewBridge(context);

        const firstInvalidField = findFirstInvalidField(issues);
        if (firstInvalidField) {
          focusCanonicalReviewField(context, firstInvalidField);
        }
        return;
      }

      updateCanonicalReviewState(context, (state) => ({
        ...state,
        status: transitionCanonicalReviewStatus(state.status, 'SUBMIT_STARTED'),
        validationIssues: [],
        result: null,
        submissionError: null,
      }));
      appendCanonicalReviewActivity(
        context,
        recordCanonicalReviewSubmissionStarted(result.score),
      );
      context.bridge.emitEvent('canonical_review_submit_started', {
        risk_level: currentState.draft.riskLevel,
        route: result.recommendedRoute,
        score: result.score,
      });

      try {
        const receipt = await context.persistCanonicalReview(
          currentState.draft,
          result,
        );
        const persistedAt = receipt.persistedAt ?? now();

        updateCanonicalReviewState(context, (state) => ({
          ...state,
          status: transitionCanonicalReviewStatus(state.status, 'SUBMIT_SUCCEEDED'),
          result,
          lastSubmittedAt: persistedAt,
          submissionError: null,
        }));
        appendCanonicalReviewActivity(
          context,
          recordCanonicalReviewSubmissionSucceeded(
            result.recommendedRoute,
            persistedAt,
          ),
        );
        context.bridge.emitEvent('form_submit', {
          change_title: currentState.draft.changeTitle,
          owner: currentState.draft.owner,
          risk_level: currentState.draft.riskLevel,
          route: result.recommendedRoute,
          score: result.score,
          submission_id: receipt.submissionId,
        });
        context.bridge.emitMetric('canonical_review_score', result.score, {
          type: 'gauge',
          labels: {
            route: result.recommendedRoute,
            risk_level: currentState.draft.riskLevel || 'unset',
          },
        });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        updateCanonicalReviewState(context, (state) => ({
          ...state,
          status: transitionCanonicalReviewStatus(state.status, 'SUBMIT_FAILED'),
          result: null,
          submissionError: message,
        }));
        appendCanonicalReviewActivity(
          context,
          recordCanonicalReviewSubmissionFailed(message),
        );
        context.bridge.emitEvent('canonical_review_submit_failed', {
          message,
        });
      }

      await flushCanonicalReviewBridge(context);
    },

    async reset(): Promise<void> {
      updateCanonicalReviewState(context, (state) => ({
        ...state,
        draft: createCanonicalReviewDraft(),
        validationIssues: [],
        result: null,
        status: transitionCanonicalReviewStatus(state.status, 'RESET'),
        submissionError: null,
        lastSubmittedAt: null,
      }));
      appendCanonicalReviewActivity(context, recordCanonicalReviewDraftReset());
      context.bridge.emitEvent('canonical_review_reset');
      await flushCanonicalReviewBridge(context);
    },
  };
}
