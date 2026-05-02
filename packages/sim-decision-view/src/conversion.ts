// @def.boundary sim-decision-view
// spec 2026-05-02 §4 — internal record → view DTO 매핑. evidence/internalSeq drop.

import type { SafetyDecisionRecordView, SafetyVerdict, SafetyCategory, CategoryVerdict, SafetyAction } from "./safety-decision-view.js";
import type { ResourceDecisionRecordView, ResourceVerdict, ResourceCategory, ResourceRejection, ResourceAction } from "./resource-decision-view.js";
import type { AlertEventView } from "./alert-event-view.js";
import type { AuditTraceView } from "./audit-trace-view.js";

export interface SafetyDecisionRecordInput {
  decisionId: string; cycleId: string; cycleAt: string; pass: "safety";
  verdict: SafetyVerdict; triggerCategory?: SafetyCategory; triggerSignals: string[];
  categoryVerdicts: Record<SafetyCategory, CategoryVerdict>;
  confidence: number; evidence?: unknown[]; action?: SafetyAction;
}
export interface ResourceDecisionRecordInput {
  decisionId: string; cycleId: string; cycleAt: string; pass: "resource";
  verdict: ResourceVerdict; rejectedBy?: ResourceRejection; triggerSignals: string[];
  categoryVerdicts: Record<ResourceCategory, CategoryVerdict>;
  confidence: number; evidence?: unknown[]; action?: ResourceAction;
}
export interface AlertEventRecordInput {
  cycleId: string; kind: string; occurredAt: string;
  details?: Record<string, unknown>;
  /** controller-internal sequence; view에서 drop. */
  internalSeq?: number;
}
export interface AuditTraceInput {
  cycleId: string; cycleAt: string;
  safety?: SafetyDecisionRecordInput; resource?: ResourceDecisionRecordInput;
  events: AlertEventRecordInput[];
}

export function toSafetyDecisionView(i: SafetyDecisionRecordInput): SafetyDecisionRecordView {
  return {
    cycleId: i.cycleId, decisionId: i.decisionId, pass: "safety", verdict: i.verdict,
    triggerCategory: i.triggerCategory, triggerSignals: [...i.triggerSignals],
    categoryVerdicts: { ...i.categoryVerdicts },
    confidence: i.confidence, cycleAt: i.cycleAt, action: i.action,
  };
}
export function toResourceDecisionView(i: ResourceDecisionRecordInput): ResourceDecisionRecordView {
  return {
    cycleId: i.cycleId, decisionId: i.decisionId, pass: "resource", verdict: i.verdict,
    rejectedBy: i.rejectedBy, triggerSignals: [...i.triggerSignals],
    categoryVerdicts: { ...i.categoryVerdicts },
    confidence: i.confidence, cycleAt: i.cycleAt, action: i.action,
  };
}
export function toAlertEventView(i: AlertEventRecordInput): AlertEventView {
  return { cycleId: i.cycleId, kind: i.kind, occurredAt: i.occurredAt, details: i.details };
}
export function toAuditTraceView(i: AuditTraceInput): AuditTraceView {
  return {
    cycleId: i.cycleId, cycleAt: i.cycleAt,
    decisions: {
      safety: i.safety ? toSafetyDecisionView(i.safety) : undefined,
      resource: i.resource ? toResourceDecisionView(i.resource) : undefined,
    },
    events: i.events.map(toAlertEventView),
  };
}
