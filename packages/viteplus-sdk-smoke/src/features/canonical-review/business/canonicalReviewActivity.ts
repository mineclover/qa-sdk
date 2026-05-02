import type { CanonicalReviewField } from './canonicalReviewValidation.js';
import type { CanonicalReviewRoute } from './canonicalReviewResult.js';

export type CanonicalReviewActivityKind =
  | 'session_ready'
  | 'validation_failed'
  | 'submission_started'
  | 'submission_succeeded'
  | 'submission_failed'
  | 'draft_reopened'
  | 'draft_reset';

export type CanonicalReviewActivity =
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
      fields: CanonicalReviewField[];
      issueCount: number;
    }
  | {
      id: string;
      kind: 'submission_started';
      occurredAt: string;
      score: number;
    }
  | {
      id: string;
      kind: 'submission_succeeded';
      occurredAt: string;
      route: CanonicalReviewRoute;
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

export function recordCanonicalReviewSessionReady(
  sessionId: string,
  occurredAt = new Date().toISOString(),
): CanonicalReviewActivity {
  return {
    id: nextActivityId(),
    kind: 'session_ready',
    occurredAt,
    sessionId,
  };
}

export function recordCanonicalReviewValidationFailed(
  fields: CanonicalReviewField[],
  issueCount: number,
  occurredAt = new Date().toISOString(),
): CanonicalReviewActivity {
  return {
    id: nextActivityId(),
    kind: 'validation_failed',
    occurredAt,
    fields,
    issueCount,
  };
}

export function recordCanonicalReviewSubmissionStarted(
  score: number,
  occurredAt = new Date().toISOString(),
): CanonicalReviewActivity {
  return {
    id: nextActivityId(),
    kind: 'submission_started',
    occurredAt,
    score,
  };
}

export function recordCanonicalReviewSubmissionSucceeded(
  route: CanonicalReviewRoute,
  persistedAt: string,
  occurredAt = new Date().toISOString(),
): CanonicalReviewActivity {
  return {
    id: nextActivityId(),
    kind: 'submission_succeeded',
    occurredAt,
    route,
    persistedAt,
  };
}

export function recordCanonicalReviewSubmissionFailed(
  message: string,
  occurredAt = new Date().toISOString(),
): CanonicalReviewActivity {
  return {
    id: nextActivityId(),
    kind: 'submission_failed',
    occurredAt,
    message,
  };
}

export function recordCanonicalReviewDraftReopened(
  field: string,
  occurredAt = new Date().toISOString(),
): CanonicalReviewActivity {
  return {
    id: nextActivityId(),
    kind: 'draft_reopened',
    occurredAt,
    field,
  };
}

export function recordCanonicalReviewDraftReset(
  occurredAt = new Date().toISOString(),
): CanonicalReviewActivity {
  return {
    id: nextActivityId(),
    kind: 'draft_reset',
    occurredAt,
  };
}

function nextActivityId(): string {
  activitySequence += 1;
  return `activity_${activitySequence}`;
}
