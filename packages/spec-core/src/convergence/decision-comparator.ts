/**
 * 결정 비교 — 같은 대상에 대한 결정 간 충돌/중복을 검사한다.
 */

import type { GraphRegistry } from "../dkg/graph-registry.js";
import type { DecisionNode } from "../dkg/dkg.types.js";
import type { DecisionConflict } from "./convergence.types.js";

/**
 * 두 Decision이 충돌하는지 비교한다.
 */
export function compareDecisions(
  graph: GraphRegistry,
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

  // 둘 다 active이고 같은 대상 → redundant 또는 contradictory
  // 간단한 heuristic: rationale 길이/내용 비교는 하지 않고
  // 같은 대상에 active 결정이 2개 있으면 redundant로 판정
  return {
    a: aId, b: bId, sharedTargets: shared,
    conflict: "redundant",
    resolution: `같은 대상(${shared.join(", ")})에 활성 결정이 2개. 통합 검토 필요.`,
  };
}

/**
 * 전체 활성 Decision에서 충돌/중복 쌍을 찾는다.
 */
export function scanDecisionConflicts(graph: GraphRegistry): DecisionConflict[] {
  const decisions = graph.findNodes("decision", d => d.lifecycle === "active");
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
