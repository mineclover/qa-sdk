import {
  transitionPlaybookStatus,
  type PlaybookEvent,
  type PlaybookStatus,
} from '../../shared/runtime/playbookStateMachine.js';

export type IncidentEscalationStatus = PlaybookStatus;
export type IncidentEscalationEvent = PlaybookEvent;

export const transitionIncidentEscalationStatus = transitionPlaybookStatus;
