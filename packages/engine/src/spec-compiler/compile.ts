import type {
  ScenarioSpec,
  ScenarioStep,
  SpecGraph,
  SpecNode,
  SpecEdge,
  SpecEdgeType,
} from "@qa-sdk/core";

/**
 * ScenarioSpec DSL → SpecGraph 변환.
 * steps의 next/branches 정의를 기반으로 노드·엣지를 생성한다.
 */
export function compileSpec(spec: ScenarioSpec): SpecGraph {
  const nodes: SpecNode[] = spec.steps.map(projectStep);

  const edges: SpecEdge[] = [];

  for (const step of spec.steps) {
    // sequence / optional next
    if (step.next) {
      const edgeType: SpecEdgeType =
        step.kind === "optional" ? "optional" : "sequence";

      for (const targetId of step.next) {
        edges.push({
          source: step.id,
          target: targetId,
          type: edgeType,
        });
      }
    }

    // branch
    if (step.branches) {
      for (const branch of step.branches) {
        for (const targetId of branch.next) {
          edges.push({
            source: step.id,
            target: targetId,
            type: "branch",
            condition: branch.condition,
          });
        }
      }
    }
  }

  return {
    scenario_id: spec.scenario_id,
    version: spec.version,
    nodes,
    edges,
  };
}

function projectStep(step: ScenarioStep): SpecNode {
  return {
    step_id: step.id,
    event_key: step.event_key,
    required: step.required,
    kind: step.kind,
    ...(step.event_version !== undefined ? { event_version: step.event_version } : {}),
    ...(step.source !== undefined ? { source: step.source } : {}),
    ...(step.record_kind !== undefined ? { record_kind: step.record_kind } : {}),
    ...(step.constraints !== undefined ? { constraints: step.constraints } : {}),
    ...(step.timeout_ms !== undefined ? { timeout_ms: step.timeout_ms } : {}),
  };
}
