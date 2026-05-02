// @def.boundary sim-decision-view
// spec 2026-05-02 §4

import type { SafetyDecisionRecordView } from "./safety-decision-view.js";
import type { ResourceDecisionRecordView } from "./resource-decision-view.js";
import type { AlertEventView } from "./alert-event-view.js";
export interface AuditTraceView {
  cycleId: string; cycleAt: string;
  decisions: { safety?: SafetyDecisionRecordView; resource?: ResourceDecisionRecordView };
  events: AlertEventView[];
}
