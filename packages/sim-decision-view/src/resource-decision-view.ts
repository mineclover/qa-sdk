// @def.boundary sim-decision-view
// spec 2026-05-02 §4

import type { CategoryVerdict } from "./safety-decision-view.js";
export type ResourceVerdict = "scale-up" | "scale-down" | "hold" | "rejected";
export type ResourceCategory = "loadPressure" | "resourceHeadroom" | "stability";
export type ResourceRejection = "loadPressure" | "resourceHeadroom" | "stability";
export type ResourceAction =
  | { kind: "scale"; target: { v1: number; v2: number } }
  | { kind: "rejected"; reason: string }
  | { kind: "hold" };
export interface ResourceDecisionRecordView {
  cycleId: string; decisionId: string; pass: "resource";
  verdict: ResourceVerdict; rejectedBy?: ResourceRejection; triggerSignals: string[];
  categoryVerdicts: Record<ResourceCategory, CategoryVerdict>;
  confidence: number; cycleAt: string; action?: ResourceAction;
}
