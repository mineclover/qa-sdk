import type { CanonicalReviewContext } from '../contexts/CanonicalReviewContexts.js';
import {
  createCanonicalReviewDraftHandlers,
  type CanonicalReviewDraftHandlers,
} from './createCanonicalReviewDraftHandlers.js';
import {
  createCanonicalReviewSubmissionHandlers,
  type CanonicalReviewSubmissionHandlers,
} from './createCanonicalReviewSubmissionHandlers.js';

export type CanonicalReviewHandlers = CanonicalReviewDraftHandlers &
  CanonicalReviewSubmissionHandlers;

export function createCanonicalReviewHandlers(
  context: CanonicalReviewContext,
): CanonicalReviewHandlers {
  return {
    ...createCanonicalReviewDraftHandlers(context),
    ...createCanonicalReviewSubmissionHandlers(context),
  };
}
