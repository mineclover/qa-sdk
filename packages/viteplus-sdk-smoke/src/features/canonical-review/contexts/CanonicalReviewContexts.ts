import type { QaBridge } from '../../../qa-bridge.js';
import {
  createDefaultPersistPlaybookSubmission,
  createPlaybookRefs,
  type PlaybookFocusable,
  type PlaybookSubmissionReceipt,
} from '../../shared/runtime/playbookPersist.js';
import {
  createPlaybookStore,
  type PlaybookStore,
} from '../../shared/runtime/playbookStore.js';
import type { CanonicalReviewActivity } from '../business/canonicalReviewActivity.js';
import type { CanonicalReviewDraft } from '../business/canonicalReviewDraft.js';
import type { CanonicalReviewResult } from '../business/canonicalReviewResult.js';
import type { CanonicalReviewStatus } from '../business/canonicalReviewStateMachine.js';
import type {
  CanonicalReviewField,
  CanonicalReviewValidationIssue,
} from '../business/canonicalReviewValidation.js';

export interface CanonicalReviewState {
  sessionId: string;
  traceId: string;
  draft: CanonicalReviewDraft;
  validationIssues: CanonicalReviewValidationIssue[];
  result: CanonicalReviewResult | null;
  status: CanonicalReviewStatus;
  activity: CanonicalReviewActivity[];
  debugRevision: number;
  submissionError: string | null;
  lastSubmittedAt: string | null;
}

export type CanonicalReviewRefs = Record<
  CanonicalReviewField,
  PlaybookFocusable | null
>;

export type PersistCanonicalReview = (
  draft: CanonicalReviewDraft,
  result: CanonicalReviewResult,
) => Promise<PlaybookSubmissionReceipt>;

export type CanonicalReviewStore = PlaybookStore<CanonicalReviewState>;

export interface CanonicalReviewContext {
  bridge: QaBridge;
  store: CanonicalReviewStore;
  refs: CanonicalReviewRefs;
  persistCanonicalReview: PersistCanonicalReview;
}

export interface CreateCanonicalReviewContextOptions {
  bridge: QaBridge;
  initialState: CanonicalReviewState;
  persistCanonicalReview?: PersistCanonicalReview;
}

export function createCanonicalReviewContext(
  options: CreateCanonicalReviewContextOptions,
): CanonicalReviewContext {
  return {
    bridge: options.bridge,
    store: createPlaybookStore(options.initialState),
    refs: createPlaybookRefs<CanonicalReviewField>([
      'changeTitle',
      'owner',
      'riskLevel',
      'rollbackPlan',
    ]),
    persistCanonicalReview:
      options.persistCanonicalReview ??
      createDefaultPersistPlaybookSubmission<CanonicalReviewDraft, CanonicalReviewResult>(
        'submission',
      ),
  };
}

export function updateCanonicalReviewState(
  context: CanonicalReviewContext,
  updater: (state: CanonicalReviewState) => CanonicalReviewState,
): void {
  context.store.update(updater);
}
