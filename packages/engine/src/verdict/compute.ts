// @def.boundary qa-sdk-engine-system
// @def.doc qa-sdk-engine-system

import type {
  MatchResult,
  VerdictReport,
  Verdict,
  LatencyViolation,
  SpecGraph,
  RuntimeGraph,
} from "@qa-sdk/core";
import { now } from "@qa-sdk/core";
import { derivePathObservation } from "../path-observation/observe-path.js";

/**
 * MatchResult로부터 최종 VerdictReport를 생성한다.
 *
 * 판정 규칙:
 *   - 필수 step 전부 pass → PASS
 *   - 필수 step 누락/실패 → FAIL
 *   - optional step만 누락 → WARN
 *   - timeout 초과 → DEGRADED
 */
export function computeVerdict(
  matchResult: MatchResult,
  specGraph: SpecGraph,
  runtimeGraph: RuntimeGraph,
  qaSessionId?: string,
): VerdictReport {
  const stepMatches = matchResult.step_matches;
  const latencyViolations: LatencyViolation[] = [];
  const specNodesById = new Map(
    specGraph.nodes.map((node) => [node.step_id, node] as const),
  );

  const requiredStepIds = new Set(
    specGraph.nodes
      .filter((n) => n.required)
      .map((n) => n.step_id),
  );

  for (const sm of stepMatches) {
    // latency check
    if (sm.matched_node_id) {
      const specNode = specNodesById.get(sm.step_id);
      if (specNode?.timeout_ms !== undefined) {
        const runtimeNode = runtimeGraph.nodes.find((n) => n.id === sm.matched_node_id);
        if (runtimeNode?.start_time && runtimeNode?.end_time) {
          const actual =
            new Date(runtimeNode.end_time).getTime() -
            new Date(runtimeNode.start_time).getTime();
          if (actual > specNode.timeout_ms) {
            latencyViolations.push({
              step_id: sm.step_id,
              expected_ms: specNode.timeout_ms,
              actual_ms: actual,
            });
          }
        }
      }
    }
  }

  const orderingViolations = matchResult.ordering_violations ?? [];

  // 판정
  const hasRequiredFailure = stepMatches.some((stepMatch) =>
    stepMatch.verdict === "fail" && requiredStepIds.has(stepMatch.step_id)
  );
  const hasRequiredMissing = matchResult.missing_steps.some((id) =>
    requiredStepIds.has(id),
  );
  const warnedCount = stepMatches.filter((stepMatch) => stepMatch.verdict === "warn").length;
  const passedCount = stepMatches.filter((stepMatch) => stepMatch.verdict === "pass").length;
  const failedCount = stepMatches.filter((stepMatch) => stepMatch.verdict === "fail").length;

  let overall: Verdict;
  if (hasRequiredFailure || hasRequiredMissing) {
    overall = "fail";
  } else if (latencyViolations.length > 0) {
    overall = "degraded";
  } else if (warnedCount > 0 || matchResult.missing_steps.length > 0) {
    overall = "warn";
  } else if (passedCount > 0) {
    // 이벤트는 모두 포착됐지만 순서가 어긋난 경우 → warn
    overall = orderingViolations.length > 0 ? "warn" : "pass";
  } else {
    overall = "unknown";
  }

  const summary = buildSummary(overall, {
    passed: passedCount,
    failed: failedCount,
    warned: warnedCount,
    missing: matchResult.missing_steps.length,
    ordering: orderingViolations.length,
  });

  const path_observation = derivePathObservation(matchResult, specGraph, runtimeGraph);

  return {
    scenario_id: matchResult.scenario_id,
    trace_id: matchResult.trace_id,
    qa_session_id: qaSessionId,
    overall_verdict: overall,
    step_matches: stepMatches,
    missing_steps: matchResult.missing_steps,
    unexpected_nodes: matchResult.unmatched_nodes,
    latency_violations: latencyViolations,
    ordering_violations: orderingViolations,
    summary,
    computed_at: now(),
    path_observation,
  };
}

function buildSummary(
  verdict: Verdict,
  counts: {
    passed: number;
    failed: number;
    warned: number;
    missing: number;
    ordering: number;
  },
): string {
  const parts: string[] = [`verdict=${verdict}`];
  if (counts.passed > 0) parts.push(`passed=${counts.passed}`);
  if (counts.failed > 0) parts.push(`failed=${counts.failed}`);
  if (counts.warned > 0) parts.push(`warned=${counts.warned}`);
  if (counts.missing > 0) parts.push(`missing=${counts.missing}`);
  if (counts.ordering > 0) parts.push(`ordering_violations=${counts.ordering}`);
  return parts.join(", ");
}
