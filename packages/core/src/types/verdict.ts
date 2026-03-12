import type { StepConstraint } from "./scenario.js";

// ── Verdict ─────────────────────────────────────────────

export type Verdict = "pass" | "fail" | "warn" | "degraded" | "unknown";

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
  summary: string;
  computed_at: string;
}

export interface LatencyViolation {
  step_id: string;
  expected_ms: number;
  actual_ms: number;
}
