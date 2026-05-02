import {
  transitionPlaybookStatus,
  type PlaybookEvent,
  type PlaybookStatus,
} from '../../shared/runtime/playbookStateMachine.js';

export type CanonicalReviewStatus = PlaybookStatus;
export type CanonicalReviewEvent = PlaybookEvent;

export const transitionCanonicalReviewStatus = transitionPlaybookStatus;
