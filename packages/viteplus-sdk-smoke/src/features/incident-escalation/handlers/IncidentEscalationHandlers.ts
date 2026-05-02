import type { IncidentEscalationContext } from '../contexts/IncidentEscalationContexts.js';
import {
  createIncidentEscalationDraftHandlers,
  type IncidentEscalationDraftHandlers,
} from './createIncidentEscalationDraftHandlers.js';
import {
  createIncidentEscalationSubmissionHandlers,
  type IncidentEscalationSubmissionHandlers,
} from './createIncidentEscalationSubmissionHandlers.js';

export type IncidentEscalationHandlers = IncidentEscalationDraftHandlers &
  IncidentEscalationSubmissionHandlers;

export function createIncidentEscalationHandlers(
  context: IncidentEscalationContext,
): IncidentEscalationHandlers {
  return {
    ...createIncidentEscalationDraftHandlers(context),
    ...createIncidentEscalationSubmissionHandlers(context),
  };
}
