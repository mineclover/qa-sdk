import {
  recordCanonicalReviewSessionReady,
  type CanonicalReviewActivity,
} from './canonicalReviewActivity.js';
import { createCanonicalReviewDraft, type CanonicalReviewDraft } from './canonicalReviewDraft.js';
import { buildCanonicalReviewResult } from './canonicalReviewResult.js';
import { validateCanonicalReviewDraft } from './canonicalReviewValidation.js';
import type { CanonicalReviewState } from '../contexts/CanonicalReviewContexts.js';

export function createCanonicalReviewInitialState(
  sessionId: string,
  traceId: string,
): CanonicalReviewState {
  const activity: CanonicalReviewActivity[] = [recordCanonicalReviewSessionReady(sessionId)];

  return {
    sessionId,
    traceId,
    draft: createCanonicalReviewDraft(),
    validationIssues: [],
    result: null,
    status: 'idle',
    activity,
    debugRevision: 0,
    submissionError: null,
    lastSubmittedAt: null,
  };
}

export function assessCanonicalReviewDraft(draft: CanonicalReviewDraft): {
  issues: ReturnType<typeof validateCanonicalReviewDraft>;
  result: ReturnType<typeof buildCanonicalReviewResult> | null;
} {
  const issues = validateCanonicalReviewDraft(draft);

  return {
    issues,
    result: issues.length === 0 ? buildCanonicalReviewResult(draft) : null,
  };
}
