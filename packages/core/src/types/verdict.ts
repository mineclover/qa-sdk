// ── Verdict ─────────────────────────────────────────────

export type Verdict = "pass" | "fail" | "warn" | "degraded" | "unknown";

// ── Step Match ──────────────────────────────────────────

export interface StepMatch {
  step_id: string;
  matched_node_id?: string;
  verdict: Verdict;
  reason?: string;
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
  passed_steps: string[];
  failed_steps: string[];
  warning_steps: string[];
  missing_steps: string[];
  unexpected_nodes: string[];
  latency_violations: LatencyViolation[];
  summary: string;
}

export interface LatencyViolation {
  step_id: string;
  expected_ms: number;
  actual_ms: number;
}
