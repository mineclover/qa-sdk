// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

import type { EntryCondition, StepConstraint, StepKind } from "./scenario.js";

// ── Spec Graph (Expected Behavior Graph) ────────────────

export interface SpecGraph {
  scenario_id: string;
  version: string;
  nodes: SpecNode[];
  edges: SpecEdge[];
  /** compileSpec이 ScenarioSpec.entry_conditions를 여기에 전달한다. */
  entry_conditions?: EntryCondition[];
}

export interface SpecNode {
  step_id: string;
  event_key: string;
  event_version?: string;
  source?: string;
  record_kind?: "log" | "span";
  required: boolean;
  kind: StepKind;
  constraints?: StepConstraint[];
  timeout_ms?: number;
}

export type SpecEdgeType = "sequence" | "branch" | "optional";

export interface SpecEdge {
  source: string;
  target: string;
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

export type RuntimeEdgeType = "temporal" | "parent_child" | "causal";

export interface RuntimeEdge {
  source: string;
  target: string;
  type: RuntimeEdgeType;
}
