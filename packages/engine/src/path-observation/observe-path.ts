import type {
  MatchResult,
  SpecGraph,
  RuntimeGraph,
  RuntimeNode,
  PathObservation,
  ReachedNode,
  TraversedEdge,
  TerminalReason,
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
  const sorted = [...matchedPairs].sort(
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
  const terminal_reason: TerminalReason | null =
    terminal_node == null
      ? null
      : terminalStepIds.has(lastPair!.step_id)
        ? "goal_reached"
        : "partial";

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
    // TODO: recovery_used는 항상 false다.
    // 실제 graph traversal을 구현하면 recovery 엣지(optional/branch fallback)를
    // 실제로 통과했는지 감지하여 true로 설정할 수 있다.
    recovery_used: false,
    terminal_node,
    terminal_reason,
  };
}
