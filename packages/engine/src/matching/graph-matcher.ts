import type {
  SpecGraph,
  RuntimeGraph,
  RuntimeNode,
  SpecNode,
  StepMatch,
  MatchResult,
  OrderingViolation,
  Verdict,
} from "@qa-sdk/core";
import { evaluateConstraints } from "./constraint-evaluator.js";

/**
 * SpecGraph와 RuntimeGraph를 매칭하여 MatchResult를 생성한다.
 *
 * 알고리즘:
 *   1. 각 spec step에 대해 candidate runtime node를 찾는다
 *   2. event_key + event_version + source + constraints로 필터
 *   3. 매칭 결과를 step_matches, missing_steps, unmatched_nodes로 분류
 *   4. sequence 엣지에 대해 timestamp 순서 위반을 검사한다
 *
 * entry_conditions 평가는 computeTraceVerdict에서 matchGraphs 호출 전에 수행된다.
 * 조건 미충족 시 "skipped" verdict가 즉시 저장되고 matchGraphs는 호출되지 않는다.
 *
 * TODO: 현재 매칭은 spec 노드 순서(nodes 배열 순)로 greedy first-match를 수행하며
 * spec의 edge 구조(branch 분기, optional 경로 선택)를 실제로 탐색하지 않는다.
 * 복잡한 분기 시나리오에서는 full graph traversal 기반 매칭이 필요하다.
 */
export function matchGraphs(
  spec: SpecGraph,
  runtime: RuntimeGraph,
): MatchResult {
  const matchedNodeIds = new Set<string>();
  const stepMatches: StepMatch[] = [];
  const missingSteps: string[] = [];

  for (const specNode of spec.nodes) {
    const match = findBestCandidate(specNode, runtime.nodes, matchedNodeIds);

    if (match) {
      matchedNodeIds.add(match.nodeId);
      stepMatches.push({
        step_id: specNode.step_id,
        matched_node_id: match.nodeId,
        verdict: match.verdict,
        constraint_results: match.constraint_results,
      });
    } else {
      missingSteps.push(specNode.step_id);
      stepMatches.push({
        step_id: specNode.step_id,
        verdict: specNode.required ? "fail" : "warn",
        constraint_results: [],
      });
    }
  }

  // runtime에 있지만 spec에 매칭되지 않은 노드
  const unmatchedNodes = runtime.nodes
    .filter((n) => !matchedNodeIds.has(n.id))
    .map((n) => n.id);

  // sequence 엣지의 timestamp 순서 위반 검사
  const ordering_violations = detectOrderingViolations(spec, stepMatches, runtime);

  return {
    scenario_id: spec.scenario_id,
    trace_id: runtime.trace_id,
    step_matches: stepMatches,
    missing_steps: missingSteps,
    unmatched_nodes: unmatchedNodes,
    ordering_violations,
  };
}

/**
 * sequence 엣지로 연결된 step 쌍의 timestamp 순서를 검사한다.
 * source step의 timestamp가 target step보다 늦으면 위반.
 */
function detectOrderingViolations(
  spec: SpecGraph,
  stepMatches: StepMatch[],
  runtime: RuntimeGraph,
): OrderingViolation[] {
  const nodeByStepId = new Map<string, RuntimeNode>();
  for (const sm of stepMatches) {
    if (!sm.matched_node_id) continue;
    const node = runtime.nodes.find((n) => n.id === sm.matched_node_id);
    if (node) nodeByStepId.set(sm.step_id, node);
  }

  const violations: OrderingViolation[] = [];

  for (const edge of spec.edges) {
    if (edge.type !== "sequence") continue;

    const predecessorNode = nodeByStepId.get(edge.source);
    const targetNode = nodeByStepId.get(edge.target);
    if (!predecessorNode || !targetNode) continue;

    if (
      new Date(targetNode.timestamp).getTime() <=
      new Date(predecessorNode.timestamp).getTime()
    ) {
      violations.push({
        step_id: edge.target,
        should_follow: edge.source,
        actual_timestamp: targetNode.timestamp,
        predecessor_timestamp: predecessorNode.timestamp,
      });
    }
  }

  return violations;
}

interface CandidateMatch {
  nodeId: string;
  verdict: Verdict;
  constraint_results: StepMatch["constraint_results"];
}

function findBestCandidate(
  specNode: SpecNode,
  runtimeNodes: RuntimeNode[],
  alreadyMatched: Set<string>,
): CandidateMatch | null {
  const candidates = runtimeNodes.filter((n) => {
    if (alreadyMatched.has(n.id)) return false;
    if (n.event_key !== specNode.event_key) return false;
    if (specNode.event_version && n.event_version !== specNode.event_version) return false;
    if (specNode.source && n.service_name !== specNode.source) return false;
    if (specNode.record_kind && n.record_kind !== specNode.record_kind) return false;
    return true;
  });

  if (candidates.length === 0) return null;

  // constraint가 있으면 평가
  let firstFailedMatch: CandidateMatch | null = null;

  for (const candidate of candidates) {
    if (!specNode.constraints || specNode.constraints.length === 0) {
      return {
        nodeId: candidate.id,
        verdict: "pass",
        constraint_results: [],
      };
    }

    const constraintResults = evaluateConstraints(specNode.constraints, candidate);
    if (constraintResults.every((result) => result.passed)) {
      return {
        nodeId: candidate.id,
        verdict: "pass",
        constraint_results: constraintResults,
      };
    }

    if (!firstFailedMatch) {
      firstFailedMatch = {
        nodeId: candidate.id,
        verdict: "fail",
        constraint_results: constraintResults,
      };
    }
  }

  // candidate는 있지만 constraint 실패
  return firstFailedMatch;
}
