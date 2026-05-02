import {
  recordIncidentEscalationSessionReady,
  type IncidentEscalationActivity,
} from './incidentEscalationActivity.js';
import {
  createIncidentEscalationDraft,
  type IncidentEscalationDraft,
} from './incidentEscalationDraft.js';
import { buildIncidentEscalationResult } from './incidentEscalationResult.js';
import { validateIncidentEscalationDraft } from './incidentEscalationValidation.js';
import type { IncidentEscalationState } from '../contexts/IncidentEscalationContexts.js';

export function createIncidentEscalationInitialState(
  sessionId: string,
  traceId: string,
): IncidentEscalationState {
  const activity: IncidentEscalationActivity[] = [
    recordIncidentEscalationSessionReady(sessionId),
  ];

  return {
    sessionId,
    traceId,
    draft: createIncidentEscalationDraft(),
    validationIssues: [],
    result: null,
    status: 'idle',
    activity,
    debugRevision: 0,
    submissionError: null,
    lastSubmittedAt: null,
  };
}

export function assessIncidentEscalationDraft(draft: IncidentEscalationDraft): {
  issues: ReturnType<typeof validateIncidentEscalationDraft>;
  result: ReturnType<typeof buildIncidentEscalationResult> | null;
} {
  const issues = validateIncidentEscalationDraft(draft);

  return {
    issues,
    result: issues.length === 0 ? buildIncidentEscalationResult(draft) : null,
  };
}
