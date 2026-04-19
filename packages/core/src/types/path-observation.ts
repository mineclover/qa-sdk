// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

import type { SpecEdgeType } from "./graph.js";

// ── Path Observation ─────────────────────────────────────
// MatchResult를 기반으로 파생되는 경로 관측 결과.
// "어떤 순서로 어떤 노드를 통과했는가"를 추적한다.

export interface PathObservation {
  /** 매칭된 런타임 노드를 timestamp 순으로 정렬한 목록 */
  reached_nodes: ReachedNode[];
  /** 매칭된 노드 사이의 spec 엣지 목록 */
  traversed_edges: TraversedEdge[];
  /** 도달된 terminal spec 노드의 step_id 목록 */
  reached_goals: string[];
  /** 도달되지 못한 terminal spec 노드의 step_id 목록 */
  unreachable_goals: string[];
  /** 같은 event_key가 두 번 이상 관측됨 */
  loop_detected: boolean;
  /** optional 엣지를 실제로 통과했으면 true */
  recovery_used: boolean;
  /** 마지막으로 매칭된 런타임 노드의 id (없으면 null) */
  terminal_node: string | null;
  /** 종료 사유 */
  terminal_reason: TerminalReason | null;
}

export interface ReachedNode {
  /** 매칭된 spec 스텝 id */
  spec_step_id: string;
  /** 매칭된 런타임 노드 id */
  runtime_node_id: string;
  /** 런타임 노드의 event_key */
  event_key: string;
  /** 런타임 노드의 timestamp (ISO-8601) */
  timestamp: string;
}

export interface TraversedEdge {
  from_step_id: string;
  to_step_id: string;
  edge_type: SpecEdgeType;
}

/**
 * goal_reached  — 마지막 관측 노드가 terminal spec 노드(outgoing edge 없음)
 * partial       — 시나리오가 중간에 끝남
 */
export type TerminalReason = "goal_reached" | "partial";

// ── Branch Path Observation (비선형 경로) ────────────────

/** 분기 경로 하나 */
export interface BranchPath {
  /** 분기 대상 step (엣지 target) */
  targetStepId: string;
  /** 엣지 타입 */
  edgeType: import("./graph.js").SpecEdgeType;
  /** 이 분기가 실제로 관측되었는가 */
  taken: boolean;
  /** 이 분기 경로의 관측 노드 (taken=true일 때만 비어있지 않음) */
  reachedNodes: ReachedNode[];
}

/** 분기 지점 */
export interface BranchPoint {
  /** 분기 시작 step */
  sourceStepId: string;
  /** 분기별 경로 */
  branches: BranchPath[];
}

/** 비선형 경로 관측 — PathObservation + 분기 분석 */
export interface NonLinearPathObservation extends PathObservation {
  /** 분기 지점 목록 */
  branchPoints: BranchPoint[];
  /** 분기 커버리지 */
  branchCoverage: { taken: number; total: number; rate: number };
}
