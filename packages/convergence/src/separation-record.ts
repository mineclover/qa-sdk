// @def.boundary convergence-layer-group
/**
 * 분리 유지 기록 — 중복이 발견됐지만 의도적으로 분리를 유지할 때
 * 그 근거를 Decision + Constraint로 DKG에 남긴다.
 *
 * 나중에 같은 중복이 재발견됐을 때 "이미 검토됨"을 확인할 수 있다.
 *
 * @layer 기록 (Recording)
 */

import type { GraphPort } from 'spec-schema';
import type { DecisionNode, ConstraintNode } from './dkg-types.js';
import type { AxisOverlap } from './convergence.types.js';
import { scaffoldDecision } from './decision-scaffold.js';

export interface SeparationRecord {
  readonly decision: DecisionNode;
  readonly constraint: ConstraintNode;
}

/**
 * 중복이 발견됐지만 분리를 유지하기로 결정했을 때,
 * Decision(왜 분리 유지) + Constraint(동시 사용 규칙)를 생성한다.
 */
export function recordSeparation(
  overlap: AxisOverlap,
  input: {
    id: string;
    date: string;
    rationale: string;
    /** 분리된 축들이 각각 속한 prefix */
    contextPrefixes?: Record<string, string[]>;
  },
): SeparationRecord {
  const decision = scaffoldDecision({
    type: 'merge',
    id: input.id,
    date: input.date,
    title: `${overlap.a}와 ${overlap.b} 분리 유지`,
    params: {
      targets: [overlap.a, overlap.b],
      into: overlap.a,
      overlapEntries: [...overlap.sharedEntries],
    },
    rationale: input.rationale,
    additionalAlternatives: ['분리 유지 (현재 선택) — 도메인 경계가 다르므로 독립 관리'],
  });

  // lifecycle을 active로 유지하되, 실제로는 "분리 유지"를 기록한 것
  const constraint: ConstraintNode = {
    kind: 'constraint',
    id: `CON-SEP-${overlap.a}-${overlap.b}`,
    rule: `${overlap.a}와 ${overlap.b}는 의도적으로 분리됨. 공유 entries [${overlap.sharedEntries.join(',')}]는 동명이의어.`,
    formal: `REVIEWED_OVERLAP(${overlap.a}, ${overlap.b}) = keep-separate`,
    scope: [overlap.a, overlap.b],
    lifecycle: 'active',
  };

  return { decision, constraint };
}

/**
 * SeparationRecord를 DKG에 등록한다.
 */
export function applySeparationRecord(graph: GraphPort, record: SeparationRecord): void {
  graph.addNode(record.decision);
  graph.addNode(record.constraint);

  // Decision → 양쪽 축 justifies
  for (const target of record.constraint.scope) {
    graph.addEdge('justifies', record.decision.id, target);
    graph.addEdge('constrains', record.constraint.id, target);
  }
}
