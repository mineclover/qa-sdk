import type {
  SpecGraph,
  RuntimeGraph,
  RuntimeNode,
  SpecNode,
  StepMatch,
  MatchResult,
  Verdict,
} from "@qa-sdk/core";
import { evaluateConstraints } from "./constraint-evaluator.js";

/**
 * SpecGraph와 RuntimeGraph를 매칭하여 MatchResult를 생성한다.
 *
 * 알고리즘:
 *   1. 각 spec step에 대해 candidate runtime node를 찾는다
 *   2. event_key + event_version + constraints로 필터
 *   3. 매칭 결과를 step_matches, missing_steps, unmatched_nodes로 분류
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

  return {
    scenario_id: spec.scenario_id,
    trace_id: runtime.trace_id,
    step_matches: stepMatches,
    missing_steps: missingSteps,
    unmatched_nodes: unmatchedNodes,
  };
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
