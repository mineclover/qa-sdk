// @def.boundary spec-engine-system
// @def.doc spec-engine-system

/**
 * Input Validator — 축 entry 기준 상태 조건 검증.
 *
 * 현재 StateStore 스냅샷을 기준으로 StateCondition[]을 평가한다.
 */

import type { InputCondition, StateCondition } from './transition.types.js';

export interface InputViolation {
  readonly transition: string;
  readonly context_id: string;
  readonly resource_id: string;
  readonly axis: string;
  readonly operator: string;
  readonly expected: unknown;
  readonly actual: string | null;
}

export interface InputValidationResult {
  readonly valid: boolean;
  readonly violations: readonly InputViolation[];
}

/** 단일 조건 평가 */
function evaluateCondition(
  cond: StateCondition,
  snapshot: Readonly<Record<string, string>>,
): boolean {
  const actual = snapshot[cond.axis] ?? null;

  if (cond.exists !== undefined) {
    return cond.exists ? actual !== null : actual === null;
  }

  if (cond.eq !== undefined) {
    return actual === cond.eq;
  }

  if (cond.neq !== undefined) {
    return actual !== cond.neq;
  }

  if (cond.in !== undefined) {
    if (actual === null) return false;
    return cond.in.includes(actual);
  }

  // 연산자 없음 — 항상 통과 (schema 검증에서 걸러야 함)
  return true;
}

/** 사용된 연산자와 기대값 추출 (위반 리포트용) */
function extractOperator(cond: StateCondition): { operator: string; expected: unknown } {
  if (cond.exists !== undefined) return { operator: 'exists', expected: cond.exists };
  if (cond.eq !== undefined) return { operator: 'eq', expected: cond.eq };
  if (cond.neq !== undefined) return { operator: 'neq', expected: cond.neq };
  if (cond.in !== undefined) return { operator: 'in', expected: cond.in };
  return { operator: 'unknown', expected: undefined };
}

/**
 * input 조건을 축 스냅샷에 대해 검증한다.
 * all 조건이 모두 만족해야 valid.
 */
export function validateInput(
  input: InputCondition,
  snapshot: Readonly<Record<string, string>>,
  meta: { transition: string; context_id: string; resource_id: string },
): InputValidationResult {
  const violations: InputViolation[] = [];

  for (const cond of input.all) {
    if (!evaluateCondition(cond, snapshot)) {
      const { operator, expected } = extractOperator(cond);
      violations.push({
        transition: meta.transition,
        context_id: meta.context_id,
        resource_id: meta.resource_id,
        axis: cond.axis,
        operator,
        expected,
        actual: snapshot[cond.axis] ?? null,
      });
    }
  }

  return { valid: violations.length === 0, violations };
}
