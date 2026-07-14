// @def.boundary sim-decision-view
// spec 2026-05-02 §4

export type SafetyVerdict = 'promote' | 'hold' | 'rollback';
export type SafetyCategory =
  | 'perf'
  | 'compatibility'
  | 'decisionQuality'
  | 'auditSafety'
  | 'replicationHealth';
export type CategoryVerdict = 'PASS' | 'WARN' | 'FAIL';
export type SafetyAction =
  | { kind: 'weight-update'; revision: number; weight: number }
  | { kind: 'rollback'; revision: number; reason: string }
  | { kind: 'hold' };
export interface SafetyDecisionRecordView {
  cycleId: string;
  decisionId: string;
  pass: 'safety';
  verdict: SafetyVerdict;
  triggerCategory?: SafetyCategory;
  triggerSignals: string[];
  categoryVerdicts: Record<SafetyCategory, CategoryVerdict>;
  confidence: number;
  cycleAt: string;
  action?: SafetyAction;
}
