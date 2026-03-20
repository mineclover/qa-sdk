/**
 * safe-entry-add — headroom 확인 + entry 추가 안전성 판정 + chain 연결.
 *
 * skill chain의 진입점.
 * "이 entry를 추가해도 안전한가?" → impact → 결과 종합.
 */

import type { DemoCatalog } from "demo-snapshot";
import type { GraphRegistry } from "../graph-registry.js";
import { analyzeImpact } from "./analyze-impact.js";
import { checkAllConstraints, type ConstraintCheckResult } from "./constraint-check.js";
import type { ImpactAnalysisResult, AffectedPrefix } from "../dkg.types.js";

export interface SafeEntryAddInput {
  readonly axisId: string;
  readonly entry: string;
}

export interface SafeEntryAddResult {
  readonly axisId: string;
  readonly entry: string;
  /** 이미 존재하는가 */
  readonly alreadyExists: boolean;
  /** headroom 상태 */
  readonly headroom: {
    readonly current: number;
    readonly capacity: number;
    readonly remaining: number;
    readonly sufficient: boolean;
  };
  /** 추가 시 stride-break 발생 여부 */
  readonly strideBreak: boolean;
  /** 영향받는 prefix */
  readonly affectedPrefixes: readonly AffectedPrefix[];
  /** constraint 위반 */
  readonly constraintResults: readonly ConstraintCheckResult[];
  /** 최종 판정 */
  readonly verdict: "safe" | "needs-capacity" | "constraint-violation" | "already-exists";
  readonly summary: string;
}

/**
 * entry 추가의 안전성을 종합 판정한다.
 */
export function safeEntryAdd(
  catalog: DemoCatalog,
  graph: GraphRegistry,
  input: SafeEntryAddInput,
): SafeEntryAddResult {
  const axis = (catalog.axes as Record<string, {
    versions: Record<string, { entries: readonly string[]; capacity?: number }>;
  }>)[input.axisId];

  if (!axis) {
    return {
      ...input,
      alreadyExists: false,
      headroom: { current: 0, capacity: 0, remaining: 0, sufficient: false },
      strideBreak: false,
      affectedPrefixes: [],
      constraintResults: [],
      verdict: "constraint-violation",
      summary: `Unknown axis: ${input.axisId}`,
    };
  }

  // 최신 version
  const versions = Object.keys(axis.versions);
  const latest = axis.versions[versions[versions.length - 1]];
  const entries = latest.entries;
  const capacity = latest.capacity ?? entries.length;

  // 이미 존재?
  const alreadyExists = entries.includes(input.entry);
  if (alreadyExists) {
    return {
      ...input,
      alreadyExists: true,
      headroom: { current: entries.length, capacity, remaining: capacity - entries.length, sufficient: true },
      strideBreak: false,
      affectedPrefixes: [],
      constraintResults: [],
      verdict: "already-exists",
      summary: `"${input.entry}" already exists in ${input.axisId} (position ${entries.indexOf(input.entry)})`,
    };
  }

  // headroom
  const remaining = capacity - entries.length;
  const sufficient = remaining > 0;

  // impact 분석
  const impact = analyzeImpact(graph, {
    type: sufficient ? "entry-added" : "capacity-changed",
    target: { axis: input.axisId },
    detail: `"${input.entry}" 추가`,
  });

  // constraint 검사
  const affectedIds = [input.axisId, ...impact.affectedPrefixes.map(p => p.id)];
  const constraintResults = checkAllConstraints(graph, affectedIds);
  const hasViolation = constraintResults.some(r => r.violations.length > 0);

  // 판정
  let verdict: SafeEntryAddResult["verdict"];
  let summary: string;

  if (hasViolation) {
    verdict = "constraint-violation";
    const violations = constraintResults.flatMap(r => r.violations);
    summary = `Constraint violation: ${violations.map(v => v.rule).join("; ")}`;
  } else if (!sufficient) {
    verdict = "needs-capacity";
    summary = `Headroom 0. capacity ${capacity} → ${capacity * 2} 확장 필요 (stride-break 발생).`;
  } else {
    verdict = "safe";
    summary = `Safe to add. headroom ${remaining}→${remaining - 1}. ${impact.affectedPrefixes.length} prefix 영향. stride-break: false.`;
  }

  return {
    ...input,
    alreadyExists: false,
    headroom: { current: entries.length, capacity, remaining, sufficient },
    strideBreak: !sufficient,
    affectedPrefixes: impact.affectedPrefixes,
    constraintResults,
    verdict,
    summary,
  };
}
