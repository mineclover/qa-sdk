// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

// ── Scenario Spec DSL ───────────────────────────────────

export interface ScenarioSpec {
  scenario_id: string;
  version: string;
  domain: string;
  description?: string;
  entry_conditions?: EntryCondition[];
  steps: ScenarioStep[];
}

// ── Entry Condition ─────────────────────────────────────

export interface EntryCondition {
  field: string;
  op: 'eq' | 'neq' | 'exists' | 'gt' | 'lt' | 'contains';
  value?: unknown;
}

// ── Step ────────────────────────────────────────────────

export type StepKind = 'sequence' | 'optional' | 'branch';

export interface ScenarioStep {
  id: string;
  event_key: string;
  event_version?: string;
  source?: string;
  record_kind?: 'log' | 'span';
  required: boolean;
  kind: StepKind;
  constraints?: StepConstraint[];
  timeout_ms?: number;
  next?: string[];
  branches?: BranchDef[];
}

// ── Step Constraint ─────────────────────────────────────

export interface StepConstraint {
  field: string;
  op: 'eq' | 'neq' | 'exists' | 'gt' | 'lt' | 'contains' | 'masked';
  value?: unknown;
}

// ── Branch ──────────────────────────────────────────────

export interface BranchDef {
  condition: StepConstraint;
  next: string[];
}
