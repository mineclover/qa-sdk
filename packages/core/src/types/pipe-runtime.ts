// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

// ── 조건 표현식 ──────────────────────────────────────

export type ConditionExpr =
  | FieldCondition
  | LogicalCondition
  | ExistsCondition
  | EventCondition;

export interface FieldCondition {
  type: "field";
  field: string;
  op: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "contains" | "matches";
  value: unknown;
}

export interface LogicalCondition {
  type: "and" | "or" | "not";
  children: ConditionExpr[];
}

export interface ExistsCondition {
  type: "exists" | "not-exists";
  field: string;
}

export interface EventCondition {
  type: "event-received";
  eventKey: string;
  timeout?: number;
}

// ── Step 실행 결과 ───────────────────────────────────

export type StepResult =
  | { status: "ok"; output: unknown }
  | { status: "error"; error: StepError };

export interface StepError {
  code: string;
  message: string;
  retryable: boolean;
  context?: unknown;
}

// ── 취소 토큰 ────────────────────────────────────────

export interface ICancellationToken {
  readonly cancelled: boolean;
  readonly reason?: string;
  cancel(reason: string): void;
  onCancel(callback: () => void): void;
}

// ── 파이프 컨텍스트 ──────────────────────────────────

export interface IPipeContext {
  readonly data: Record<string, unknown>;
  readonly triggerEvent: { eventKey: string; payload?: Record<string, unknown> };
  readonly previousOutput?: unknown;
  readonly pipeId: string;
  readonly graphId?: string;
  readonly cancellation: ICancellationToken;

  get(path: string): unknown;
  set(path: string, value: unknown): void;
  clone(): IPipeContext;
}

// ── Step 실행기 ──────────────────────────────────────

export interface StepExecutor {
  facet: string;
  execute(
    step: import("./pipe-spec.js").PipeStep,
    context: IPipeContext,
  ): Promise<StepResult>;
}

// ── 실행 결과 ────────────────────────────────────────

export interface ExecutedStep {
  pipeId: string;
  flowPath: string;
  kind: string;
  facet?: string;
  eventKey?: string;
  input: unknown;
  output: unknown;
  status: "ok" | "error" | "cancelled" | "skipped";
  error?: StepError;
  duration: number;
  timestamp: string;
}

export interface RunResult {
  steps: ExecutedStep[];
  producedEvents: Array<{ eventKey: string; payload?: unknown; timestamp: string }>;
  errors: StepError[];
  finalContext: Record<string, unknown>;
  duration: number;
  status: "complete" | "error" | "cancelled" | "max-steps";
}
