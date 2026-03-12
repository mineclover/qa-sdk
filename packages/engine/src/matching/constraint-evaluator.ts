import type { StepConstraint, RuntimeNode } from "@qa-sdk/core";

/**
 * 단일 constraint를 runtime node의 payload에 대해 평가한다.
 */
export function evaluateConstraint(
  constraint: StepConstraint,
  node: RuntimeNode,
): boolean {
  const value = resolveField(constraint.field, node);

  switch (constraint.op) {
    case "eq":
      return value === constraint.value;
    case "neq":
      return value !== constraint.value;
    case "exists":
      return value !== undefined && value !== null;
    case "gt":
      return typeof value === "number" && typeof constraint.value === "number"
        && value > constraint.value;
    case "lt":
      return typeof value === "number" && typeof constraint.value === "number"
        && value < constraint.value;
    case "contains":
      return typeof value === "string" && typeof constraint.value === "string"
        && value.includes(constraint.value);
    case "masked":
      return isMaskedField(constraint.field, node);
    default:
      return false;
  }
}

/** constraint 배열 전체 평가 (AND 조건) */
export function evaluateConstraints(
  constraints: StepConstraint[],
  node: RuntimeNode,
): boolean {
  return constraints.every((c) => evaluateConstraint(c, node));
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
