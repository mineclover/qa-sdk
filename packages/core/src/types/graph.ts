import type { ScenarioStep, StepConstraint } from "./scenario.js";

// ── Spec Graph (Expected Behavior Graph) ────────────────

export interface SpecGraph {
  scenario_id: string;
  version: string;
  nodes: SpecNode[];
  edges: SpecEdge[];
}

export interface SpecNode {
  id: string;
  step: ScenarioStep;
}

export type SpecEdgeType = "sequence" | "branch" | "optional";

export interface SpecEdge {
  from: string;
  to: string;
  type: SpecEdgeType;
  condition?: StepConstraint;
}

// ── Runtime Graph (Observed Behavior Graph) ─────────────

export interface RuntimeGraph {
  trace_id: string;
  nodes: RuntimeNode[];
  edges: RuntimeEdge[];
}

export interface RuntimeNode {
  id: string;
  log_id: string;
  timestamp: string;
  record_kind: "log" | "span";
  event_key: string;
  event_version: string;
  service_name?: string;
  span_name?: string;
  start_time?: string;
  end_time?: string;
  status_code?: string;
  payload: unknown;
  payload_masking_applied: boolean;
  payload_masked_fields: string[];
}

export type RuntimeEdgeType = "temporal" | "parent_child" | "derived";

export interface RuntimeEdge {
  from: string;
  to: string;
  type: RuntimeEdgeType;
}
