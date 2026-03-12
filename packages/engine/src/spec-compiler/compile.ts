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
  const nodes: SpecNode[] = spec.steps.map((step) => ({
    id: step.id,
    step,
  }));

  const edges: SpecEdge[] = [];

  for (const step of spec.steps) {
    // sequence / optional next
    if (step.next) {
      const edgeType: SpecEdgeType =
        step.kind === "optional" ? "optional" : "sequence";

      for (const targetId of step.next) {
        edges.push({
          from: step.id,
          to: targetId,
          type: edgeType,
        });
      }
    }

    // branch
    if (step.branches) {
      for (const branch of step.branches) {
        for (const targetId of branch.next) {
          edges.push({
            from: step.id,
            to: targetId,
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
