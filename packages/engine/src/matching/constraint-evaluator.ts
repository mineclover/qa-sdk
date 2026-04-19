// @def.boundary qa-sdk-engine-system
// @def.doc qa-sdk-engine-system

import type { ConstraintResult, RuntimeNode, StepConstraint } from "@qa-sdk/core";

/**
 * 단일 constraint를 runtime node의 payload에 대해 평가한다.
 */
export function evaluateConstraint(
  constraint: StepConstraint,
  node: RuntimeNode,
): boolean {
  return evaluateConstraintResult(constraint, node).passed;
}

function evaluateConstraintResult(
  constraint: StepConstraint,
  node: RuntimeNode,
): ConstraintResult {
  const actual = resolveField(constraint.field, node);

  switch (constraint.op) {
    case "eq":
      return { constraint, passed: actual === constraint.value, actual };
    case "neq":
      return { constraint, passed: actual !== constraint.value, actual };
    case "exists":
      return {
        constraint,
        passed: actual !== undefined && actual !== null,
        actual,
      };
    case "gt":
      return {
        constraint,
        passed: typeof actual === "number" && typeof constraint.value === "number"
          && actual > constraint.value,
        actual,
      };
    case "lt":
      return {
        constraint,
        passed: typeof actual === "number" && typeof constraint.value === "number"
          && actual < constraint.value,
        actual,
      };
    case "contains":
      return {
        constraint,
        passed: typeof actual === "string" && typeof constraint.value === "string"
          && actual.includes(constraint.value),
        actual,
      };
    case "masked":
      return {
        constraint,
        passed: isMaskedField(constraint.field, node),
        actual,
      };
    default:
      return { constraint, passed: false, actual };
  }
}

/** constraint 배열 전체 평가 결과를 개별 constraint 단위로 반환한다. */
export function evaluateConstraints(
  constraints: StepConstraint[],
  node: RuntimeNode,
): ConstraintResult[] {
  return constraints.map((constraint) => evaluateConstraintResult(constraint, node));
}

/**
 * node에서 필드 값을 해석한다.
 * "payload.xxx" → payload 내부, 그 외 → node 직접 필드
 */
function resolveField(field: string, node: RuntimeNode): unknown {
  if (field.startsWith("payload.")) {
    const key = field.slice("payload.".length);
    if (node.payload && typeof node.payload === "object") {
      return (node.payload as Record<string, unknown>)[key];
    }
    return undefined;
  }

  return (node as unknown as Record<string, unknown>)[field];
}

/** masking 여부 확인 */
function isMaskedField(field: string, node: RuntimeNode): boolean {
  const key = field.startsWith("payload.") ? field.slice("payload.".length) : field;
  return node.payload_masked_fields.includes(key);
}
