import { recordIncidentEscalationDraftReopened } from '../business/incidentEscalationActivity.js';
import type {
  IncidentEscalationDraft,
  IncidentSeverity,
} from '../business/incidentEscalationDraft.js';
import { transitionIncidentEscalationStatus } from '../business/incidentEscalationStateMachine.js';
import { validateIncidentEscalationDraft } from '../business/incidentEscalationValidation.js';
import type { IncidentEscalationContext } from '../contexts/IncidentEscalationContexts.js';
import { updateIncidentEscalationState } from '../contexts/IncidentEscalationContexts.js';
import {
  appendIncidentEscalationActivity,
  flushIncidentEscalationBridge,
} from './incidentEscalationHandlerSupport.js';

type IncidentEscalationTextField =
  | 'incidentTitle'
  | 'serviceName'
  | 'customerImpact'
  | 'mitigationPlan'
  | 'stakeholderNote';

export interface IncidentEscalationDraftHandlers {
  updateTextField(field: IncidentEscalationTextField, value: string): void;
  updateSeverity(value: IncidentSeverity): void;
}

export function createIncidentEscalationDraftHandlers(
  context: IncidentEscalationContext,
): IncidentEscalationDraftHandlers {
  return {
    updateTextField(field: IncidentEscalationTextField, value: string): void {
      applyDraftUpdate(context, (draft) => ({ ...draft, [field]: value }), field);
    },
    updateSeverity(value: IncidentSeverity): void {
      applyDraftUpdate(context, (draft) => ({ ...draft, severity: value }), 'severity');
    },
  };
}

function applyDraftUpdate(
  context: IncidentEscalationContext,
  updater: (draft: IncidentEscalationDraft) => IncidentEscalationDraft,
  changedField: string,
): void {
  const currentState = context.store.getState();
  const reopenedFromSuccess = currentState.status === 'success';
  const nextDraft = updater(currentState.draft);
  const nextValidationIssues =
    currentState.status === 'invalid' || currentState.status === 'error'
      ? validateIncidentEscalationDraft(nextDraft)
      : [];

  updateIncidentEscalationState(context, (state) => ({
    ...state,
    draft: nextDraft,
    validationIssues: nextValidationIssues,
    result: state.status === 'success' ? null : state.result,
    status: transitionIncidentEscalationStatus(state.status, 'DRAFT_CHANGED'),
    submissionError: null,
    lastSubmittedAt: state.status === 'success' ? null : state.lastSubmittedAt,
  }));

  if (!reopenedFromSuccess) {
    return;
  }

  appendIncidentEscalationActivity(context, recordIncidentEscalationDraftReopened(changedField));
  context.bridge.emitEvent('incident_escalation_reopened', {
    field: changedField,
  });
  void flushIncidentEscalationBridge(context);
}
