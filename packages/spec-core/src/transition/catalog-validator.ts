/**
 * Catalog Validator — catalog 기반 축/entry 유효성 2단계 검증.
 *
 * Tier 1의 validateTransitionSpec(구조 검증)과 분리.
 * catalog를 받아 input/output에서 참조하는 축 이름과 entry 값이
 * 실제 catalog에 존재하는지 검증한다.
 */

import type { Catalog } from "@qa-sdk/core";
import type { TransitionSpec, ValidationResult, ValidationIssue } from "./transition.types.js";

/**
 * 축의 모든 버전에 걸친 전체 entry 집합을 반환한다.
 * 특정 버전이 아닌 전체 이력에서 검색 — transition spec은 버전 무관하게 축 이름을 참조.
 */
function allEntriesForAxis(catalog: Catalog, axisId: string): Set<string> | null {
  const axis = catalog.axes[axisId];
  if (!axis) return null;

  const entries = new Set<string>();
  for (const version of Object.values(axis.versions)) {
    for (const entry of version.entries) {
      entries.add(entry);
    }
  }
  return entries;
}

/**
 * TransitionSpec을 catalog에 대해 검증한다.
 *
 * 검증 항목:
 * - input.all[].axis가 catalog.axes에 존재하는지
 * - input.all[].eq/neq 값이 해당 축의 entries에 있는지
 * - input.all[].in 배열의 각 값이 해당 축의 entries에 있는지
 * - output.set[].axis가 catalog.axes에 존재하는지
 * - output.set[].value가 해당 축의 entries에 있는지 (null 제외)
 */
export function validateWithCatalog(
  spec: TransitionSpec,
  catalog: Catalog,
): ValidationResult {
  const issues: ValidationIssue[] = [];

  // input 조건 검증
  for (let i = 0; i < spec.input.all.length; i++) {
    const cond = spec.input.all[i];
    const entries = allEntriesForAxis(catalog, cond.axis);

    if (entries === null) {
      issues.push({
        path: `input.all[${i}].axis`,
        message: `axis "${cond.axis}" not found in catalog "${catalog.id}"`,
      });
      continue;
    }

    if (cond.eq !== undefined && cond.eq !== null && !entries.has(cond.eq)) {
      issues.push({
        path: `input.all[${i}].eq`,
        message: `entry "${cond.eq}" not found in axis "${cond.axis}" (valid: ${[...entries].slice(0, 5).join(", ")}${entries.size > 5 ? "..." : ""})`,
      });
    }

    if (cond.neq !== undefined && cond.neq !== null && !entries.has(cond.neq)) {
      issues.push({
        path: `input.all[${i}].neq`,
        message: `entry "${cond.neq}" not found in axis "${cond.axis}"`,
      });
    }

    if (cond.in !== undefined) {
      for (let j = 0; j < cond.in.length; j++) {
        if (!entries.has(cond.in[j])) {
          issues.push({
            path: `input.all[${i}].in[${j}]`,
            message: `entry "${cond.in[j]}" not found in axis "${cond.axis}"`,
          });
        }
      }
    }
  }

  // output 변경 검증
  for (let i = 0; i < spec.output.set.length; i++) {
    const assign = spec.output.set[i];
    const entries = allEntriesForAxis(catalog, assign.axis);

    if (entries === null) {
      issues.push({
        path: `output.set[${i}].axis`,
        message: `axis "${assign.axis}" not found in catalog "${catalog.id}"`,
      });
      continue;
    }

    if (assign.value !== null && !entries.has(assign.value)) {
      issues.push({
        path: `output.set[${i}].value`,
        message: `entry "${assign.value}" not found in axis "${assign.axis}" (valid: ${[...entries].slice(0, 5).join(", ")}${entries.size > 5 ? "..." : ""})`,
      });
    }
  }

  return { valid: issues.length === 0, issues };
}
