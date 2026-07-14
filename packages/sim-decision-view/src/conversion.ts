// @def.boundary sim-decision-view
// spec 2026-05-02 §4 — internal record → view DTO 매핑. evidence/internalSeq drop.
//
// Input 타입은 producer (controller record) shape을 그대로 mirror,
// View 타입은 API consumer shape이며 conversion 함수가 normalize한다.
// 즉 Input.action 은 controller의 noop/weight-update/scale 어휘를 그대로 받고,
// View.action 은 API 친화적 hold/rollback/rejected 어휘로 변환된다.

import type {
  SafetyDecisionRecordView,
  SafetyVerdict,
  SafetyCategory,
  CategoryVerdict,
  SafetyAction,
} from './safety-decision-view.js';
import type {
  ResourceDecisionRecordView,
  ResourceVerdict,
  ResourceCategory,
  ResourceRejection,
  ResourceAction,
} from './resource-decision-view.js';
import type { AlertEventView } from './alert-event-view.js';
import type { AuditTraceView } from './audit-trace-view.js';

/**
 * controller 의 SafetyDecisionOutput.action shape mirror.
 * weight-update 의 weight 는 number 로 widen (controller WeightStep 0|5|25|50|100 호환).
 */
export type SafetyActionInput =
  | { kind: 'weight-update'; revision: number; weight: number }
  | { kind: 'noop' };

/**
 * controller 의 ResourceDecisionOutput.action shape mirror.
 */
export type ResourceActionInput =
  | { kind: 'scale'; target: { v1: number; v2: number }; reason: string }
  | { kind: 'noop' };

export interface SafetyDecisionRecordInput {
  decisionId: string;
  cycleId: string;
  cycleAt: string;
  pass: 'safety';
  verdict: SafetyVerdict;
  triggerCategory?: SafetyCategory;
  triggerSignals: string[];
  categoryVerdicts: Record<SafetyCategory, CategoryVerdict>;
  confidence: number;
  evidence?: unknown[];
  action?: SafetyActionInput;
}
export interface ResourceDecisionRecordInput {
  decisionId: string;
  cycleId: string;
  cycleAt: string;
  pass: 'resource';
  verdict: ResourceVerdict;
  rejectedBy?: ResourceRejection;
  triggerSignals: string[];
  categoryVerdicts: Record<ResourceCategory, CategoryVerdict>;
  confidence: number;
  evidence?: unknown[];
  action?: ResourceActionInput;
}
export interface AlertEventRecordInput {
  cycleId: string;
  kind: string;
  occurredAt: string;
  details?: Record<string, unknown>;
  /** controller-internal sequence; view에서 drop. */
  internalSeq?: number;
}
export interface AuditTraceInput {
  cycleId: string;
  cycleAt: string;
  safety?: SafetyDecisionRecordInput;
  resource?: ResourceDecisionRecordInput;
  events: AlertEventRecordInput[];
}

/**
 * Input safety action → View safety action.
 * - noop → hold
 * - weight-update + verdict=rollback → view rollback (reason = triggerSignals[0] ?? "rollback")
 * - weight-update 그 외 → 그대로 weight-update
 */
function normalizeSafetyAction(
  a: SafetyActionInput | undefined,
  verdict: SafetyVerdict,
  triggerSignals: readonly string[],
): SafetyAction | undefined {
  if (!a) return undefined;
  if (a.kind === 'noop') return { kind: 'hold' };
  if (verdict === 'rollback') {
    return { kind: 'rollback', revision: a.revision, reason: triggerSignals[0] ?? 'rollback' };
  }
  return { kind: 'weight-update', revision: a.revision, weight: a.weight };
}

/**
 * Input resource action → View resource action.
 * - noop + verdict=rejected → rejected (reason = triggerSignals[0] ?? "rejected")
 * - noop 그 외 → hold
 * - scale → 그대로 scale (reason drop — view shape 에 reason 필드 없음)
 */
function normalizeResourceAction(
  a: ResourceActionInput | undefined,
  verdict: ResourceVerdict,
  triggerSignals: readonly string[],
): ResourceAction | undefined {
  if (!a) return undefined;
  if (a.kind === 'noop') {
    if (verdict === 'rejected') {
      return { kind: 'rejected', reason: triggerSignals[0] ?? 'rejected' };
    }
    return { kind: 'hold' };
  }
  return { kind: 'scale', target: a.target };
}

export function toSafetyDecisionView(i: SafetyDecisionRecordInput): SafetyDecisionRecordView {
  return {
    cycleId: i.cycleId,
    decisionId: i.decisionId,
    pass: 'safety',
    verdict: i.verdict,
    triggerCategory: i.triggerCategory,
    triggerSignals: [...i.triggerSignals],
    categoryVerdicts: { ...i.categoryVerdicts },
    confidence: i.confidence,
    cycleAt: i.cycleAt,
    action: normalizeSafetyAction(i.action, i.verdict, i.triggerSignals),
  };
}
export function toResourceDecisionView(i: ResourceDecisionRecordInput): ResourceDecisionRecordView {
  return {
    cycleId: i.cycleId,
    decisionId: i.decisionId,
    pass: 'resource',
    verdict: i.verdict,
    rejectedBy: i.rejectedBy,
    triggerSignals: [...i.triggerSignals],
    categoryVerdicts: { ...i.categoryVerdicts },
    confidence: i.confidence,
    cycleAt: i.cycleAt,
    action: normalizeResourceAction(i.action, i.verdict, i.triggerSignals),
  };
}
export function toAlertEventView(i: AlertEventRecordInput): AlertEventView {
  return { cycleId: i.cycleId, kind: i.kind, occurredAt: i.occurredAt, details: i.details };
}
export function toAuditTraceView(i: AuditTraceInput): AuditTraceView {
  return {
    cycleId: i.cycleId,
    cycleAt: i.cycleAt,
    decisions: {
      safety: i.safety ? toSafetyDecisionView(i.safety) : undefined,
      resource: i.resource ? toResourceDecisionView(i.resource) : undefined,
    },
    events: i.events.map(toAlertEventView),
  };
}
