export type IncidentSeverity = '' | 'sev2' | 'sev1' | 'sev0';

export interface IncidentEscalationDraft {
  incidentTitle: string;
  serviceName: string;
  severity: IncidentSeverity;
  customerImpact: string;
  mitigationPlan: string;
  stakeholderNote: string;
}

export function createIncidentEscalationDraft(): IncidentEscalationDraft {
  return {
    incidentTitle: '',
    serviceName: '',
    severity: '',
    customerImpact: '',
    mitigationPlan: '',
    stakeholderNote: '',
  };
}
