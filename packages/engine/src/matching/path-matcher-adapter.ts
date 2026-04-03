/**
 * PathMatcher 기반 매칭 엔진.
 *
 * SpecGraph + RuntimeGraph를 PipeGraph + RunResult로 변환하여
 * matchPath를 호출하고, 결과를 MatchResult로 역변환한다.
 */

import type {
  SpecGraph,
  RuntimeGraph,
  MatchResult,
  StepMatch,
  OrderingViolation,
  RuntimeNode,
} from "@qa-sdk/core";
import type { PipeGraph } from "@qa-sdk/core";
import type { RunResult, ExecutedStep } from "@qa-sdk/core";
import { matchPath } from "@qa-sdk/core";
import { evaluateConstraints } from "./constraint-evaluator.js";

// ── 공개 API ──────────────────────────────────────────

/**
 * PathMatcher를 통해 MatchResult를 생성한다.
 * SpecGraph + RuntimeGraph를 받아 MatchResult를 반환한다.
 */
export function matchViaPathMatcher(spec: SpecGraph, runtime: RuntimeGraph): MatchResult {
  // 빈 spec — 모든 runtime node가 unmatched
  if (spec.nodes.length === 0) {
    return {
      scenario_id: spec.scenario_id,
      trace_id: runtime.trace_id,
      step_matches: [],
      missing_steps: [],
      unmatched_nodes: runtime.nodes.map(n => n.id),
      ordering_violations: [],
    };
  }

  const { pipeGraph, runResult, stepNodeMap, constraintResultMap } =
    adaptInputs(spec, runtime);

  const pathMatch = matchPath(runResult, pipeGraph);

  // step_matches 구성
  const stepMatches: StepMatch[] = spec.nodes.map(specNode => {
    const nodeId = stepNodeMap.get(specNode.step_id);
    const isError = pathMatch.errorSteps.some(s => s.pipeId === specNode.step_id);
    const isMissing = pathMatch.missingPipes.includes(specNode.step_id);

    if (isError) {
      return {
        step_id: specNode.step_id,
        matched_node_id: nodeId,
        verdict: "fail" as const,
        constraint_results: constraintResultMap.get(specNode.step_id) ?? [],
      };
    }

    if (!isMissing && nodeId) {
      return {
        step_id: specNode.step_id,
        matched_node_id: nodeId,
        verdict: "pass" as const,
        constraint_results: constraintResultMap.get(specNode.step_id) ?? [],
      };
    }

    // 매칭 없음 (missing)
    return {
      step_id: specNode.step_id,
      verdict: (specNode.required ? "fail" : "warn") as "fail" | "warn",
      constraint_results: [],
    };
  });

  const orderingViolations = detectOrderingViolations(spec, stepMatches, runtime);
  const matchedNodeIds = new Set(stepNodeMap.values());
  const unmatchedNodes = runtime.nodes
    .filter(n => !matchedNodeIds.has(n.id))
    .map(n => n.id);

  return {
    scenario_id: spec.scenario_id,
    trace_id: runtime.trace_id,
    step_matches: stepMatches,
    missing_steps: pathMatch.missingPipes,
    unmatched_nodes: unmatchedNodes,
    ordering_violations: orderingViolations,
  };
}

// ── 내부 구현 ─────────────────────────────────────────

interface AdaptResult {
  pipeGraph: PipeGraph;
  runResult: RunResult;
  /** pipeId → matched nodeId */
  stepNodeMap: Map<string, string>;
  /** pipeId → constraint_results (pass 또는 fail) */
  constraintResultMap: Map<string, StepMatch["constraint_results"]>;
}

function adaptInputs(spec: SpecGraph, runtime: RuntimeGraph): AdaptResult {
  // SpecGraph → PipeGraph
  // edges가 없으면 순차 연결 생성 (PathMatcher의 reachability BFS가 모든 노드를 커버하도록)
  const connections =
    spec.edges.length > 0
      ? spec.edges.map(e => ({ from: e.source, to: e.target, kind: "next" as const }))
      : spec.nodes.slice(0, -1).map((n, i) => ({
          from: n.step_id,
          to: spec.nodes[i + 1].step_id,
          kind: "next" as const,
        }));

  const pipeGraph: PipeGraph = {
    graphId: spec.scenario_id,
    version: spec.version,
    pipes: spec.nodes.map(node => ({
      pipeId: node.step_id,
      version: "v1",
      trigger: { eventKey: node.event_key },
      flow: { kind: "step" as const, facet: node.step_id },
    })),
    connections,
    entryPipeId: spec.nodes[0]?.step_id ?? "",
  };

  // RuntimeGraph → RunResult: event_key 기반 매칭
  const matchedNodeIds = new Set<string>();
  const executedSteps: ExecutedStep[] = [];
  const stepNodeMap = new Map<string, string>();
  const constraintResultMap = new Map<string, StepMatch["constraint_results"]>();

  for (const specNode of spec.nodes) {
    const candidates = runtime.nodes.filter(n => {
      if (matchedNodeIds.has(n.id)) return false;
      if (n.event_key !== specNode.event_key) return false;
      if (specNode.event_version && n.event_version !== specNode.event_version) return false;
      if (specNode.source && n.service_name !== specNode.source) return false;
      if (specNode.record_kind && n.record_kind !== specNode.record_kind) return false;
      return true;
    });

    let firstFailed: { nodeId: string; results: StepMatch["constraint_results"] } | null = null;

    for (const candidate of candidates) {
      if (!specNode.constraints || specNode.constraints.length === 0) {
        matchedNodeIds.add(candidate.id);
        stepNodeMap.set(specNode.step_id, candidate.id);
        executedSteps.push(buildStep(specNode.step_id, candidate, "ok"));
        break;
      }

      const results = evaluateConstraints(specNode.constraints, candidate);
      if (results.every(r => r.passed)) {
        matchedNodeIds.add(candidate.id);
        stepNodeMap.set(specNode.step_id, candidate.id);
        constraintResultMap.set(specNode.step_id, results);
        executedSteps.push(buildStep(specNode.step_id, candidate, "ok"));
        break;
      }

      if (!firstFailed) {
        firstFailed = { nodeId: candidate.id, results };
      }
    }

    // constraint 실패 케이스: error step으로 포함 (PathMatcher가 fail 판정)
    if (!stepNodeMap.has(specNode.step_id) && firstFailed) {
      const node = runtime.nodes.find(n => n.id === firstFailed!.nodeId)!;
      matchedNodeIds.add(firstFailed.nodeId);
      stepNodeMap.set(specNode.step_id, firstFailed.nodeId);
      constraintResultMap.set(specNode.step_id, firstFailed.results);
      const errorStep = buildStep(specNode.step_id, node, "error");
      errorStep.error = {
        code: "CONSTRAINT_FAIL",
        message: "constraint evaluation failed",
        retryable: false,
      };
      executedSteps.push(errorStep);
    }
    // 후보 없음 → executedSteps 미포함 → PathMatcher가 missingPipes로 탐지
  }

  const runResult: RunResult = {
    steps: executedSteps,
    producedEvents: [],
    errors: [],
    finalContext: {},
    duration: 0,
    status: "complete",
  };

  return { pipeGraph, runResult, stepNodeMap, constraintResultMap };
}

function buildStep(
  pipeId: string,
  node: RuntimeNode,
  status: ExecutedStep["status"],
): ExecutedStep {
  return {
    pipeId,
    flowPath: node.event_key,
    kind: "step",
    facet: pipeId,
    input: (node as RuntimeNode & { payload?: unknown }).payload ?? null,
    output: null,
    status,
    duration: 0,
    timestamp: node.timestamp,
  };
}

function detectOrderingViolations(
  spec: SpecGraph,
  stepMatches: StepMatch[],
  runtime: RuntimeGraph,
): OrderingViolation[] {
  const nodeByStepId = new Map<string, RuntimeNode>();
  for (const sm of stepMatches) {
    if (!sm.matched_node_id) continue;
    const node = runtime.nodes.find(n => n.id === sm.matched_node_id);
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
