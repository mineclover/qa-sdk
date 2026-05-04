// @def.boundary convergence-comparators
/**
 * 결정 비교 — 같은 대상에 대한 결정 간 충돌/중복을 검사한다.
 *
 * @layer 비교 (Comparison)
 */

import type { GraphPort } from "spec-schema";
import type { DecisionNode } from "./dkg-types.js";
import type { DecisionConflict } from "./convergence.types.js";

/**
 * 두 Decision이 충돌하는지 비교한다.
 */
export function compareDecisions(
  graph: GraphPort,
  aId: string,
  bId: string,
): DecisionConflict {
  const aNode = graph.getNodeOrThrow(aId) as DecisionNode;
  const bNode = graph.getNodeOrThrow(bId) as DecisionNode;

  // justifies 대상 교집합
  const aTargets = graph.neighbors(aId, "justifies");
  const bTargets = graph.neighbors(bId, "justifies");
  const shared = aTargets.filter(t => bTargets.includes(t));

  if (shared.length === 0) {
    return {
      a: aId, b: bId, sharedTargets: shared,
      conflict: "compatible",
      resolution: "서로 다른 대상에 대한 결정. 충돌 없음.",
    };
  }

  // lifecycle 기반 판정
  if (aNode.lifecycle === "superseded" || bNode.lifecycle === "superseded") {
    const superseded = aNode.lifecycle === "superseded" ? aId : bId;
    return {
      a: aId, b: bId, sharedTargets: shared,
      conflict: "superseding",
      resolution: `${superseded}가 이미 대체됨.`,
    };
  }

  // 둘 다 active이고 같은 대상 → contradictory 또는 redundant
  if (isContradictory(aNode, bNode)) {
    return {
      a: aId, b: bId, sharedTargets: shared,
      conflict: "contradictory",
      resolution: `같은 대상(${shared.join(", ")})에 상반된 결정. 인간 해소 필요.`,
    };
  }

  return {
    a: aId, b: bId, sharedTargets: shared,
    conflict: "redundant",
    resolution: `같은 대상(${shared.join(", ")})에 활성 결정이 2개. 통합 검토 필요.`,
  };
}

// 상반 신호 쌍: rationale에 한쪽이 있고 다른 쪽이 있으면 contradictory
const OPPOSING_PAIRS: readonly [RegExp, RegExp][] = [
  [/증가|확장|추가|활성화|merge|add|increase|expand/i, /감소|축소|제거|비활성화|split|remove|decrease|reduce/i],
];

function isContradictory(a: DecisionNode, b: DecisionNode): boolean {
  const aText = a.rationale;
  const bText = b.rationale;

  // 1. rationale 내 상반 신호
  for (const [pos, neg] of OPPOSING_PAIRS) {
    if ((pos.test(aText) && neg.test(bText)) || (neg.test(aText) && pos.test(bText))) {
      return true;
    }
  }

  // 2. 한쪽의 선택이 다른 쪽의 대안에 있으면 (명시적 갈등)
  if (a.alternatives && b.alternatives) {
    const aTitleLower = a.title.toLowerCase();
    const bTitleLower = b.title.toLowerCase();
    const aHasBAsAlt = a.alternatives.some(alt => alt.toLowerCase().includes(bTitleLower));
    const bHasAAsAlt = b.alternatives.some(alt => alt.toLowerCase().includes(aTitleLower));
    if (aHasBAsAlt || bHasAAsAlt) return true;
  }

  return false;
}

/**
 * 전체 활성 Decision에서 충돌/중복 쌍을 찾는다.
 */
export function scanDecisionConflicts(graph: GraphPort): DecisionConflict[] {
  const decisions = graph.findNodes("decision", d => (d as DecisionNode).lifecycle === "active");
  const results: DecisionConflict[] = [];

  for (let i = 0; i < decisions.length; i++) {
    for (let j = i + 1; j < decisions.length; j++) {
      const conflict = compareDecisions(graph, decisions[i].id, decisions[j].id);
      if (conflict.conflict !== "compatible") {
        results.push(conflict);
      }
    }
  }

  return results;
}
