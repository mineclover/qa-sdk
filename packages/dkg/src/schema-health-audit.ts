// @def.boundary dkg-system-root
// @def.doc dkg-system-root

/**
 * schema-health-audit — 전체 prefix의 스키마 건전성 감사.
 *
 * coverage-audit.ts와 동일 패턴:
 * 1. 전체 prefix에 대해 category-rules 검증 실행
 * 2. 위반 건 → ObservationNode 생성
 * 3. 심각한 위반 → DecisionNode scaffold
 *
 * 순수 함수 — GraphRegistry에 직접 추가하지 않고 노드를 반환.
 *
 * @layer 측정 (Measurement)
 */

import type { GraphPort } from 'spec-schema';
import type { ObservationNode, DecisionNode } from './dkg.types.js';
import { validateAllCategories } from 'spec-schema';

// ═══════════════════════════════════════════════════════════════

export interface SchemaHealthReport {
  readonly totalPrefixes: number;
  readonly passed: number;
  readonly failed: number;
  readonly violations: readonly SchemaViolationEntry[];
  readonly observations: readonly ObservationNode[];
  readonly decisions: readonly DecisionNode[];
  readonly summary: string;
}

export interface SchemaViolationEntry {
  readonly prefixId: string;
  readonly category: string;
  readonly errors: readonly string[];
}

// ═══════════════════════════════════════════════════════════════

/**
 * 전체 prefix의 스키마 건전성을 감사한다.
 * category-rules의 validateAllCategories를 실행하고 결과를 DKG 노드로 변환.
 */
export function auditSchemaHealth(
  graph: GraphPort,
  options?: { date?: string },
): SchemaHealthReport {
  const date = options?.date ?? new Date().toISOString().slice(0, 10);
  const result = validateAllCategories(graph);

  const violations: SchemaViolationEntry[] = result.results
    .filter((r) => !r.valid)
    .map((r) => ({ prefixId: r.prefixId, category: r.category, errors: r.errors }));

  const observations: ObservationNode[] = [];
  const decisions: DecisionNode[] = [];

  for (const v of violations) {
    // 결정적 ID — 멱등 upsert
    const obsId = `OBS-SCHEMA-HEALTH-${v.prefixId}`;

    observations.push({
      kind: 'observation',
      id: obsId,
      date,
      source: 'metric',
      subjects: [v.prefixId],
      finding: `${v.prefixId} (${v.category}) 카테고리 규칙 위반: ${v.errors.join('; ')}`,
      intent: 'action-needed',
      suggestion: {
        kind: 'add-constraint',
        rule: `${v.prefixId} prefix 구조를 ${v.category} 카테고리 규칙에 맞게 수정`,
      },
    });

    // 심각한 위반 (dim 수 관련) → Decision scaffold
    const hasDimViolation = v.errors.some(
      (e) =>
        e.includes('dimension') || e.includes('dim') || e.includes('최소') || e.includes('최대'),
    );

    if (hasDimViolation) {
      decisions.push({
        kind: 'decision',
        id: `DEC-SCHEMA-${v.prefixId}`,
        date,
        title: `${v.prefixId} prefix 구조 수정`,
        context: `${v.category} 카테고리 규칙 위반 감지`,
        rationale: v.errors.join('; '),
        lifecycle: 'active',
      });
    }
  }

  const summary =
    violations.length === 0
      ? `${result.total}개 prefix 전체 통과`
      : `${result.total}개 중 ${violations.length}개 위반 (${observations.length} observation, ${decisions.length} decision)`;

  return {
    totalPrefixes: result.total,
    passed: result.passed,
    failed: result.failed,
    violations,
    observations,
    decisions,
    summary,
  };
}
