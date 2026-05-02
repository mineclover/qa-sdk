import { now } from '@qa-sdk/sdk';
import {
  recordIncidentEscalationDraftReset,
  recordIncidentEscalationSubmissionFailed,
  recordIncidentEscalationSubmissionStarted,
  recordIncidentEscalationSubmissionSucceeded,
  recordIncidentEscalationValidationFailed,
} from '../business/incidentEscalationActivity.js';
import { assessIncidentEscalationDraft } from '../business/incidentEscalationBusiness.js';
import { createIncidentEscalationDraft } from '../business/incidentEscalationDraft.js';
import { transitionIncidentEscalationStatus } from '../business/incidentEscalationStateMachine.js';
import { findFirstIncidentEscalationField } from '../business/incidentEscalationValidation.js';
import type { IncidentEscalationContext } from '../contexts/IncidentEscalationContexts.js';
import { updateIncidentEscalationState } from '../contexts/IncidentEscalationContexts.js';
import {
  appendIncidentEscalationActivity,
  flushIncidentEscalationBridge,
  focusIncidentEscalationField,
} from './incidentEscalationHandlerSupport.js';

export interface IncidentEscalationSubmissionHandlers {
  submit(): Promise<void>;
  reset(): Promise<void>;
}

export function createIncidentEscalationSubmissionHandlers(
  context: IncidentEscalationContext,
): IncidentEscalationSubmissionHandlers {
  return {
    async submit(): Promise<void> {
      const currentState = context.store.getState();
      if (currentState.status === 'submitting') {
        return;
      }

      const { issues, result } = assessIncidentEscalationDraft(currentState.draft);

      if (!result) {
        updateIncidentEscalationState(context, (state) => ({
          ...state,
          validationIssues: issues,
          result: null,
          status: transitionIncidentEscalationStatus(state.status, 'SUBMIT_INVALID'),
          submissionError: null,
        }));
        appendIncidentEscalationActivity(
          context,
          recordIncidentEscalationValidationFailed(
            issues.map((issue) => issue.field),
            issues.length,
          ),
        );
        context.bridge.emitEvent('incident_escalation_validation_failed', {
          fields: issues.map((issue) => issue.field),
          issue_count: issues.length,
        });
        context.bridge.emitMetric('incident_escalation_issue_count', issues.length, {
          type: 'gauge',
        });
        await flushIncidentEscalationBridge(context);

        const firstInvalidField = findFirstIncidentEscalationField(issues);
        if (firstInvalidField) {
          focusIncidentEscalationField(context, firstInvalidField);
        }
        return;
      }

      updateIncidentEscalationState(context, (state) => ({
        ...state,
        status: transitionIncidentEscalationStatus(state.status, 'SUBMIT_STARTED'),
        validationIssues: [],
        result: null,
        submissionError: null,
      }));
      appendIncidentEscalationActivity(
        context,
        recordIncidentEscalationSubmissionStarted(result.urgencyScore),
      );
      context.bridge.emitEvent('incident_escalation_submit_started', {
        severity: currentState.draft.severity,
        route: result.recommendedRoute,
        urgency_score: result.urgencyScore,
      });

      try {
        const receipt = await context.persistIncidentEscalation(
          currentState.draft,
          result,
        );
        const persistedAt = receipt.persistedAt ?? now();

        updateIncidentEscalationState(context, (state) => ({
          ...state,
          status: transitionIncidentEscalationStatus(state.status, 'SUBMIT_SUCCEEDED'),
          result,
          lastSubmittedAt: persistedAt,
          submissionError: null,
        }));
        appendIncidentEscalationActivity(
          context,
          recordIncidentEscalationSubmissionSucceeded(
            result.recommendedRoute,
            persistedAt,
          ),
        );
        context.bridge.emitEvent('incident_escalation_submitted', {
          incident_title: currentState.draft.incidentTitle,
          service_name: currentState.draft.serviceName,
          severity: currentState.draft.severity,
          route: result.recommendedRoute,
          urgency_score: result.urgencyScore,
          submission_id: receipt.submissionId,
        });
        context.bridge.emitMetric('incident_escalation_score', result.urgencyScore, {
          type: 'gauge',
          labels: {
            route: result.recommendedRoute,
            severity: currentState.draft.severity || 'unset',
          },
        });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        updateIncidentEscalationState(context, (state) => ({
          ...state,
          status: transitionIncidentEscalationStatus(state.status, 'SUBMIT_FAILED'),
          result: null,
          submissionError: message,
        }));
        appendIncidentEscalationActivity(
          context,
          recordIncidentEscalationSubmissionFailed(message),
        );
        context.bridge.emitEvent('incident_escalation_submit_failed', {
          message,
        });
      }

      await flushIncidentEscalationBridge(context);
    },

    async reset(): Promise<void> {
      updateIncidentEscalationState(context, (state) => ({
        ...state,
        draft: createIncidentEscalationDraft(),
        validationIssues: [],
        result: null,
        status: transitionIncidentEscalationStatus(state.status, 'RESET'),
        submissionError: null,
        lastSubmittedAt: null,
      }));
      appendIncidentEscalationActivity(
        context,
        recordIncidentEscalationDraftReset(),
      );
      context.bridge.emitEvent('incident_escalation_reset');
      await flushIncidentEscalationBridge(context);
    },
  };
}
