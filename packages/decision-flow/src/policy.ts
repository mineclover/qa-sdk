// @def.boundary df-system
/**
 * 정책 엔진 — 조건 평가 + 자동 분기 선택
 *
 * 반복되는 의사결정을 자동화한다.
 * 조건이 충족되면 해당 gate의 분기를 자동으로 선택한다.
 */

import type {
  Condition,
  FlowPolicy,
  GateSelection,
  PolicyAction,
} from "./types.js";

// ─── 조건 평가 ───────────────────────────────────────────

/**
 * 단일 조건을 컨텍스트에 대해 평가한다.
 *
 * field 경로는 dot-notation을 지원한다:
 * - "context.hours" → context 객체의 hours 필드
 * - "gate.risk.branch" → risk gate에서 선택된 branch ID
 */
export function evaluateCondition(
  condition: Condition,
  context: Record<string, unknown>,
): boolean {
  const fieldValue = resolvePath(context, condition.field);

  switch (condition.op) {
    case "eq":
      return fieldValue === condition.value;
    case "neq":
      return fieldValue !== condition.value;
    case "in":
      return Array.isArray(condition.value) && condition.value.includes(fieldValue);
    case "gt":
      return typeof fieldValue === "number" && fieldValue > (condition.value as number);
    case "lt":
      return typeof fieldValue === "number" && fieldValue < (condition.value as number);
    case "gte":
      return typeof fieldValue === "number" && fieldValue >= (condition.value as number);
    case "lte":
      return typeof fieldValue === "number" && fieldValue <= (condition.value as number);
    case "exists":
      return fieldValue !== undefined && fieldValue !== null;
    default:
      return false;
  }
}

/**
 * 모든 조건을 AND로 평가한다.
 */
export function evaluateAllConditions(
  conditions: readonly Condition[],
  context: Record<string, unknown>,
): boolean {
  return conditions.every((c) => evaluateCondition(c, context));
}

// ─── 정책 탐색 + 충돌 해소 ──────────────────────────────

/**
 * 주어진 gate에 적용 가능한 정책을 찾는다.
 *
 * 평가 컨텍스트에는 플로우 컨텍스트와 이전 선택이 병합된다:
 * - context.* — 플로우 시작 시 전달된 컨텍스트
 * - gate.{gateId}.branch — 이전 gate에서 선택된 branch ID
 */
export function findApplicablePolicies(
  policies: readonly FlowPolicy[],
  gateId: string,
  flowContext: Record<string, unknown>,
  priorSelections: readonly GateSelection[],
): PolicyAction[] {
  // 이전 선택을 gate.{id}.branch 형태로 병합
  const evalContext = buildEvalContext(flowContext, priorSelections);

  return policies
    .filter((p) => p.action.gateId === gateId)
    .filter((p) => evaluateAllConditions(p.conditions, evalContext))
    .toSorted((a, b) => b.priority - a.priority) // 높은 priority 우선
    .map((p) => p.action);
}

/**
 * 다중 적용 가능 정책 간 충돌을 해소한다.
 *
 * 규칙:
 * 1. priority가 가장 높은 정책 선택
 * 2. 동일 priority에 다른 branch → null (충돌, 수동 결정 필요)
 * 3. 동일 priority에 같은 branch → 해당 branch 선택
 */
export function resolvePolicyConflicts(
  actions: readonly PolicyAction[],
): PolicyAction | null {
  if (actions.length === 0) return null;
  if (actions.length === 1) return actions[0];

  // findApplicablePolicies가 이미 priority 내림차순 정렬
  const topAction = actions[0];

  // 같은 branch를 가리키면 충돌 없음
  const allSameBranch = actions.every((a) => a.branchId === topAction.branchId);
  if (allSameBranch) return topAction;

  // priority 동일 + 다른 branch → 충돌
  return null;
}

/**
 * 정책 평가 후 자동 선택을 시도한다.
 *
 * @returns 자동 선택된 PolicyAction, 또는 null (수동 결정 필요)
 */
export function tryAutoSelect(
  policies: readonly FlowPolicy[],
  gateId: string,
  flowContext: Record<string, unknown>,
  priorSelections: readonly GateSelection[],
): PolicyAction | null {
  const applicable = findApplicablePolicies(policies, gateId, flowContext, priorSelections);
  return resolvePolicyConflicts(applicable);
}

// ─── 내부 유틸 ───────────────────────────────────────────

/** dot-notation 경로 해석 */
function resolvePath(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/** 플로우 컨텍스트 + 이전 선택을 병합하여 평가용 컨텍스트 생성 */
function buildEvalContext(
  flowContext: Record<string, unknown>,
  priorSelections: readonly GateSelection[],
): Record<string, unknown> {
  const gateSelections: Record<string, unknown> = {};
  for (const sel of priorSelections) {
    gateSelections[sel.gateId] = { branch: sel.branchId };
  }

  return {
    ...flowContext,
    context: flowContext,
    gate: gateSelections,
  };
}
