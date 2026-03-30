import type { IncidentEscalationField } from './incidentEscalationValidation.js';
import type { IncidentEscalationRoute } from './incidentEscalationResult.js';

export type IncidentEscalationActivity =
  | {
      id: string;
      kind: 'session_ready';
      occurredAt: string;
      sessionId: string;
    }
  | {
      id: string;
      kind: 'validation_failed';
      occurredAt: string;
      fields: IncidentEscalationField[];
      issueCount: number;
    }
  | {
      id: string;
      kind: 'submission_started';
      occurredAt: string;
      urgencyScore: number;
    }
  | {
      id: string;
      kind: 'submission_succeeded';
      occurredAt: string;
      route: IncidentEscalationRoute;
      persistedAt: string;
    }
  | {
      id: string;
      kind: 'submission_failed';
      occurredAt: string;
      message: string;
    }
  | {
      id: string;
      kind: 'draft_reopened';
      occurredAt: string;
      field: string;
    }
  | {
      id: string;
      kind: 'draft_reset';
      occurredAt: string;
    };

let activitySequence = 0;

export function recordIncidentEscalationSessionReady(
  sessionId: string,
  occurredAt = new Date().toISOString(),
): IncidentEscalationActivity {
  return {
    id: nextActivityId(),
    kind: 'session_ready',
    occurredAt,
    sessionId,
  };
}

export function recordIncidentEscalationValidationFailed(
  fields: IncidentEscalationField[],
  issueCount: number,
  occurredAt = new Date().toISOString(),
): IncidentEscalationActivity {
  return {
    id: nextActivityId(),
    kind: 'validation_failed',
    occurredAt,
    fields,
    issueCount,
  };
}

export function recordIncidentEscalationSubmissionStarted(
  urgencyScore: number,
  occurredAt = new Date().toISOString(),
): IncidentEscalationActivity {
  return {
    id: nextActivityId(),
    kind: 'submission_started',
    occurredAt,
    urgencyScore,
  };
}

export function recordIncidentEscalationSubmissionSucceeded(
  route: IncidentEscalationRoute,
  persistedAt: string,
  occurredAt = new Date().toISOString(),
): IncidentEscalationActivity {
  return {
    id: nextActivityId(),
    kind: 'submission_succeeded',
    occurredAt,
    route,
    persistedAt,
  };
}

export function recordIncidentEscalationSubmissionFailed(
  message: string,
  occurredAt = new Date().toISOString(),
): IncidentEscalationActivity {
  return {
    id: nextActivityId(),
    kind: 'submission_failed',
    occurredAt,
    message,
  };
}

export function recordIncidentEscalationDraftReopened(
  field: string,
  occurredAt = new Date().toISOString(),
): IncidentEscalationActivity {
  return {
    id: nextActivityId(),
    kind: 'draft_reopened',
    occurredAt,
    field,
  };
}

export function recordIncidentEscalationDraftReset(
  occurredAt = new Date().toISOString(),
): IncidentEscalationActivity {
  return {
    id: nextActivityId(),
    kind: 'draft_reset',
    occurredAt,
  };
}

function nextActivityId(): string {
  activitySequence += 1;
  return `incident_activity_${activitySequence}`;
}
