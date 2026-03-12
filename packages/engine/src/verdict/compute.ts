import type {
  MatchResult,
  VerdictReport,
  Verdict,
  LatencyViolation,
  SpecGraph,
  RuntimeGraph,
} from "@qa-sdk/core";

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
  const passed: string[] = [];
  const failed: string[] = [];
  const warned: string[] = [];
  const latencyViolations: LatencyViolation[] = [];

  const requiredStepIds = new Set(
    specGraph.nodes
      .filter((n) => n.step.required)
      .map((n) => n.id),
  );

  for (const sm of matchResult.step_matches) {
    switch (sm.verdict) {
      case "pass":
        passed.push(sm.step_id);
        break;
      case "fail":
        failed.push(sm.step_id);
        break;
      case "warn":
        warned.push(sm.step_id);
        break;
    }

    // latency check
    if (sm.matched_node_id) {
      const specNode = specGraph.nodes.find((n) => n.id === sm.step_id);
      if (specNode?.step.timeout_ms) {
        const runtimeNode = runtimeGraph.nodes.find((n) => n.id === sm.matched_node_id);
        if (runtimeNode?.start_time && runtimeNode?.end_time) {
          const actual =
            new Date(runtimeNode.end_time).getTime() -
            new Date(runtimeNode.start_time).getTime();
          if (actual > specNode.step.timeout_ms) {
            latencyViolations.push({
              step_id: sm.step_id,
              expected_ms: specNode.step.timeout_ms,
              actual_ms: actual,
            });
          }
        }
      }
    }
  }

  // 판정
  const hasRequiredFailure = failed.some((id) => requiredStepIds.has(id));
  const hasRequiredMissing = matchResult.missing_steps.some((id) =>
    requiredStepIds.has(id),
  );

  let overall: Verdict;
  if (hasRequiredFailure || hasRequiredMissing) {
    overall = "fail";
  } else if (latencyViolations.length > 0) {
    overall = "degraded";
  } else if (warned.length > 0 || matchResult.missing_steps.length > 0) {
    overall = "warn";
  } else if (passed.length > 0) {
    overall = "pass";
  } else {
    overall = "unknown";
  }

  const summary = buildSummary(overall, passed, failed, matchResult.missing_steps);

  return {
    scenario_id: matchResult.scenario_id,
    trace_id: matchResult.trace_id,
    qa_session_id: qaSessionId,
    overall_verdict: overall,
    passed_steps: passed,
    failed_steps: failed,
    warning_steps: warned,
    missing_steps: matchResult.missing_steps,
    unexpected_nodes: matchResult.unmatched_nodes,
    latency_violations: latencyViolations,
    summary,
  };
}

function buildSummary(
  verdict: Verdict,
  passed: string[],
  failed: string[],
  missing: string[],
): string {
  const parts: string[] = [`verdict=${verdict}`];
  if (passed.length > 0) parts.push(`passed=${passed.length}`);
  if (failed.length > 0) parts.push(`failed=${failed.length}`);
  if (missing.length > 0) parts.push(`missing=${missing.length}`);
  return parts.join(", ");
}
