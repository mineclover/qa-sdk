import type { QaBridge } from '../../../qa-bridge.js';
import {
  createDefaultPersistPlaybookSubmission,
  createPlaybookRefs,
  type PlaybookFocusable,
  type PlaybookSubmissionReceipt,
} from '../../shared/runtime/playbookPersist.js';
import { createPlaybookStore, type PlaybookStore } from '../../shared/runtime/playbookStore.js';
import type { IncidentEscalationActivity } from '../business/incidentEscalationActivity.js';
import type { IncidentEscalationDraft } from '../business/incidentEscalationDraft.js';
import type { IncidentEscalationResult } from '../business/incidentEscalationResult.js';
import type { IncidentEscalationStatus } from '../business/incidentEscalationStateMachine.js';
import type {
  IncidentEscalationField,
  IncidentEscalationValidationIssue,
} from '../business/incidentEscalationValidation.js';

export interface IncidentEscalationState {
  sessionId: string;
  traceId: string;
  draft: IncidentEscalationDraft;
  validationIssues: IncidentEscalationValidationIssue[];
  result: IncidentEscalationResult | null;
  status: IncidentEscalationStatus;
  activity: IncidentEscalationActivity[];
  debugRevision: number;
  submissionError: string | null;
  lastSubmittedAt: string | null;
}

export type IncidentEscalationRefs = Record<IncidentEscalationField, PlaybookFocusable | null>;

export type PersistIncidentEscalation = (
  draft: IncidentEscalationDraft,
  result: IncidentEscalationResult,
) => Promise<PlaybookSubmissionReceipt>;

export type IncidentEscalationStore = PlaybookStore<IncidentEscalationState>;

export interface IncidentEscalationContext {
  bridge: QaBridge;
  store: IncidentEscalationStore;
  refs: IncidentEscalationRefs;
  persistIncidentEscalation: PersistIncidentEscalation;
}

export interface CreateIncidentEscalationContextOptions {
  bridge: QaBridge;
  initialState: IncidentEscalationState;
  persistIncidentEscalation?: PersistIncidentEscalation;
}

export function createIncidentEscalationContext(
  options: CreateIncidentEscalationContextOptions,
): IncidentEscalationContext {
  return {
    bridge: options.bridge,
    store: createPlaybookStore(options.initialState),
    refs: createPlaybookRefs<IncidentEscalationField>([
      'incidentTitle',
      'serviceName',
      'severity',
      'customerImpact',
      'mitigationPlan',
    ]),
    persistIncidentEscalation:
      options.persistIncidentEscalation ??
      createDefaultPersistPlaybookSubmission<IncidentEscalationDraft, IncidentEscalationResult>(
        'incident_submission',
      ),
  };
}

export function updateIncidentEscalationState(
  context: IncidentEscalationContext,
  updater: (state: IncidentEscalationState) => IncidentEscalationState,
): void {
  context.store.update(updater);
}
