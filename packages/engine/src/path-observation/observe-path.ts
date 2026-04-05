import type {
  MatchResult,
  SpecGraph,
  RuntimeGraph,
  RuntimeNode,
  PathObservation,
  ReachedNode,
  TraversedEdge,
  TerminalReason,
  BranchPoint,
  BranchPath,
  NonLinearPathObservation,
} from "@qa-sdk/core";

/**
 * MatchResult를 기반으로 PathObservation을 파생한다.
 *
 * 알고리즘:
 *   1. 매칭된 (step_id → RuntimeNode) 쌍을 수집
 *   2. timestamp 순 정렬 → reached_nodes
 *   3. 같은 event_key 반복 → loop_detected
 *   4. outgoing edge 없는 spec 노드 = terminal (goal) 노드
 *   5. 도달/미도달 goal 분류
 *   6. 마지막 도달 노드 + 종료 사유 결정
 *   7. 양쪽 모두 매칭된 spec 엣지 = traversed_edges
 */
export function derivePathObservation(
  matchResult: MatchResult,
  specGraph: SpecGraph,
  runtimeGraph: RuntimeGraph,
): PathObservation {
  // 1. Matched pairs (step_id → RuntimeNode)
  const matchedPairs: Array<{ step_id: string; node: RuntimeNode }> = [];

  for (const sm of matchResult.step_matches) {
    if (!sm.matched_node_id) continue;
    const node = runtimeGraph.nodes.find((n) => n.id === sm.matched_node_id);
    if (node) matchedPairs.push({ step_id: sm.step_id, node });
  }

  // 2. timestamp 순 정렬
  const sorted = [...matchedPairs].toSorted(
    (a, b) =>
      new Date(a.node.timestamp).getTime() - new Date(b.node.timestamp).getTime(),
  );

  const reached_nodes: ReachedNode[] = sorted.map((p) => ({
    spec_step_id: p.step_id,
    runtime_node_id: p.node.id,
    event_key: p.node.event_key,
    timestamp: p.node.timestamp,
  }));

  // 3. Loop detection: 같은 event_key가 두 번 이상
  const eventKeyCounts = new Map<string, number>();
  for (const n of reached_nodes) {
    eventKeyCounts.set(n.event_key, (eventKeyCounts.get(n.event_key) ?? 0) + 1);
  }
  const loop_detected = [...eventKeyCounts.values()].some((c) => c > 1);

  // 4. Terminal spec 노드: outgoing edge가 없는 노드
  const nodesWithOutgoing = new Set(specGraph.edges.map((e) => e.source));
  const terminalStepIds = new Set(
    specGraph.nodes
      .filter((n) => !nodesWithOutgoing.has(n.step_id))
      .map((n) => n.step_id),
  );

  // 5. Reached / unreachable goals
  const reachedStepIds = new Set(sorted.map((p) => p.step_id));
  const reached_goals = [...terminalStepIds].filter((id) => reachedStepIds.has(id));
  const unreachable_goals = [...terminalStepIds].filter(
    (id) => !reachedStepIds.has(id),
  );

  // 6. Terminal node + reason
  const lastPair = sorted[sorted.length - 1] ?? null;
  const terminal_node = lastPair?.node.id ?? null;
  let terminal_reason: TerminalReason | null = null;
  if (terminal_node != null && lastPair) {
    terminal_reason = terminalStepIds.has(lastPair.step_id)
      ? "goal_reached"
      : "partial";
  }

  // 7. Traversed edges: 양쪽 endpoint가 모두 매칭된 spec 엣지
  const traversed_edges: TraversedEdge[] = specGraph.edges
    .filter((e) => reachedStepIds.has(e.source) && reachedStepIds.has(e.target))
    .map((e) => ({
      from_step_id: e.source,
      to_step_id: e.target,
      edge_type: e.type,
    }));

  return {
    reached_nodes,
    traversed_edges,
    reached_goals,
    unreachable_goals,
    loop_detected,
    // optional 엣지를 실제로 통과했으면 recovery 경로 사용
    recovery_used: traversed_edges.some((e) => e.edge_type === "optional"),
    terminal_node,
    terminal_reason,
  };
}

// ── 비선형 경로 관측 ────────────────────────────────────

/**
 * spec graph에서 분기 지점을 탐지하고,
 * 각 분기가 실제로 관측되었는지 분석한다.
 *
 * 분기 지점: 같은 source에서 2개 이상의 branch/optional 엣지가 나가는 노드
 */
export function deriveBranchPaths(
  specGraph: SpecGraph,
  observation: PathObservation,
): BranchPoint[] {
  const reachedStepIds = new Set(observation.reached_nodes.map(n => n.spec_step_id));
  const reachedNodeMap = new Map(
    observation.reached_nodes.map(n => [n.spec_step_id, n]),
  );

  // source별 outgoing 엣지 그룹핑
  const outgoing = new Map<string, typeof specGraph.edges>();
  for (const edge of specGraph.edges) {
    const list = outgoing.get(edge.source) ?? [];
    list.push(edge);
    outgoing.set(edge.source, list);
  }

  const branchPoints: BranchPoint[] = [];

  for (const [sourceStepId, edges] of outgoing) {
    // 분기 지점: 2개 이상 outgoing 엣지
    if (edges.length < 2) continue;

    const branches: BranchPath[] = edges.map(edge => {
      const taken = reachedStepIds.has(edge.target);
      // taken인 분기의 후속 노드 수집 (BFS로 해당 분기 서브트리)
      const branchReached: ReachedNode[] = [];
      if (taken) {
        collectBranchNodes(edge.target, specGraph, reachedStepIds, reachedNodeMap, branchReached, sourceStepId);
      }
      return {
        targetStepId: edge.target,
        edgeType: edge.type,
        taken,
        reachedNodes: branchReached,
      };
    });

    branchPoints.push({ sourceStepId, branches });
  }

  return branchPoints;
}

/**
 * 분기 시작점부터 도달 가능한 관측 노드를 수집한다 (DFS).
 * 다른 분기 지점의 서브트리에는 진입하지 않음.
 */
function collectBranchNodes(
  stepId: string,
  specGraph: SpecGraph,
  reachedStepIds: Set<string>,
  reachedNodeMap: Map<string, ReachedNode>,
  result: ReachedNode[],
  excludeSource: string,
): void {
  if (!reachedStepIds.has(stepId)) return;
  const node = reachedNodeMap.get(stepId);
  if (node) result.push(node);

  // 후속 엣지 탐색
  for (const edge of specGraph.edges) {
    if (edge.source !== stepId) continue;
    if (edge.target === excludeSource) continue; // 역방향 방지
    collectBranchNodes(edge.target, specGraph, reachedStepIds, reachedNodeMap, result, excludeSource);
  }
}

/**
 * PathObservation + 분기 분석을 합성하여 NonLinearPathObservation을 반환한다.
 */
export function deriveNonLinearObservation(
  matchResult: MatchResult,
  specGraph: SpecGraph,
  runtimeGraph: RuntimeGraph,
): NonLinearPathObservation {
  const observation = derivePathObservation(matchResult, specGraph, runtimeGraph);
  const branchPoints = deriveBranchPaths(specGraph, observation);

  const total = branchPoints.reduce((sum, bp) => sum + bp.branches.length, 0);
  const taken = branchPoints.reduce(
    (sum, bp) => sum + bp.branches.filter(b => b.taken).length, 0,
  );

  return {
    ...observation,
    branchPoints,
    branchCoverage: {
      taken,
      total,
      rate: total > 0 ? Math.round((taken / total) * 100) : 0,
    },
  };
}
