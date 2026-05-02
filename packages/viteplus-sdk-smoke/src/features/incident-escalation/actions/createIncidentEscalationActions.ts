import type { IncidentSeverity } from '../business/incidentEscalationDraft.js';
import type { IncidentEscalationHandlers } from '../handlers/IncidentEscalationHandlers.js';

export interface IncidentEscalationActions {
  updateTextField(
    field:
      | 'incidentTitle'
      | 'serviceName'
      | 'customerImpact'
      | 'mitigationPlan'
      | 'stakeholderNote',
    value: string,
  ): void;
  updateSeverity(value: IncidentSeverity): void;
  submit(): Promise<void>;
  reset(): Promise<void>;
}

export function createIncidentEscalationActions(
  handlers: IncidentEscalationHandlers,
): IncidentEscalationActions {
  return {
    updateTextField(field, value): void {
      handlers.updateTextField(field, value);
    },
    updateSeverity(value): void {
      handlers.updateSeverity(value);
    },
    submit(): Promise<void> {
      return handlers.submit();
    },
    reset(): Promise<void> {
      return handlers.reset();
    },
  };
}
