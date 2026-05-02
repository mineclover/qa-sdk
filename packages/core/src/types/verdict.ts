// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

import type { StepConstraint } from "./scenario.js";
import type { PathObservation } from "./path-observation.js";

// ── Verdict ─────────────────────────────────────────────

export type Verdict = "pass" | "fail" | "warn" | "degraded" | "unknown" | "skipped";

export interface ConstraintResult {
  constraint: StepConstraint;
  passed: boolean;
  actual?: unknown;
}

// ── Step Match ──────────────────────────────────────────

export interface StepMatch {
  step_id: string;
  matched_node_id?: string;
  verdict: Verdict;
  constraint_results: ConstraintResult[];
}

// ── Match Result ────────────────────────────────────────

export interface MatchResult {
  scenario_id: string;
  trace_id: string;
  step_matches: StepMatch[];
  missing_steps: string[];
  unmatched_nodes: string[];
  /** sequence 엣지 기준 순서 위반 목록. 매칭 엔진이 채우며, 직접 생성 시 생략 가능 */
  ordering_violations?: OrderingViolation[];
}

// ── Verdict Report ──────────────────────────────────────

export interface VerdictReport {
  scenario_id: string;
  trace_id: string;
  qa_session_id?: string;
  overall_verdict: Verdict;
  step_matches: StepMatch[];
  missing_steps: string[];
  unexpected_nodes: string[];
  latency_violations: LatencyViolation[];
  /** sequence 엣지 기준 순서 위반 목록 */
  ordering_violations: OrderingViolation[];
  summary: string;
  computed_at: string;
  /** 경로 관측 결과. MatchResult로부터 파생된다. */
  path_observation?: PathObservation;
}

export interface LatencyViolation {
  step_id: string;
  expected_ms: number;
  actual_ms: number;
}

// ── Ordering Violation ───────────────────────────────────

/**
 * sequence 엣지로 연결된 두 step의 실제 발생 순서가 반대인 경우.
 * should_follow 보다 step_id가 먼저 관측됨.
 */
export interface OrderingViolation {
  /** 순서가 어긋난 step (나중에 와야 하는데 먼저 온 step) */
  step_id: string;
  /** step_id 이전에 발생했어야 하는 step */
  should_follow: string;
  /** step_id 의 실제 관측 timestamp */
  actual_timestamp: string;
  /** should_follow 의 실제 관측 timestamp */
  predecessor_timestamp: string;
}
