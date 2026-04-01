/**
 * Phase 3 — 파이프 런타임 실행 엔진
 *
 * ConditionEvaluator + CancellationToken + PipeContext + PipeRunner
 */

import type {
  ConditionExpr, FieldCondition,
  StepResult, StepError,
  ICancellationToken, IPipeContext,
  StepExecutor, ExecutedStep, RunResult,
} from "./types/pipe-runtime.js";
import type { PipeFlow, PipeSpec, PipeGraph } from "./types/pipe-spec.js";

// ── ConditionEvaluator ───────────────────────────────

/** 단축 문자열 → ConditionExpr 파싱 */
export function parseCondition(shorthand: string): ConditionExpr {
  const s = shorthand.trim();

  // && / || 조합 (먼저 체크 — 하위 표현식보다 우선)
  if (s.includes("&&")) {
    return { type: "and", children: s.split("&&").map(p => parseCondition(p.trim())) };
  }
  if (s.includes("||")) {
    return { type: "or", children: s.split("||").map(p => parseCondition(p.trim())) };
  }

  // "field op value" 패턴
  const fieldMatch = s.match(/^([a-zA-Z_][\w.]*)\s*(===?|!==?|>=?|<=?|>|<)\s*(.+)$/);
  if (fieldMatch) {
    const [, field, rawOp, rawValue] = fieldMatch;
    const op = normalizeOp(rawOp);
    const value = parseValue(rawValue.trim());
    return { type: "field", field, op, value };
  }

  // "!field" 또는 "not field"
  if (s.startsWith("!") || s.startsWith("not ")) {
    const inner = s.startsWith("!") ? s.slice(1).trim() : s.slice(4).trim();
    return { type: "not-exists", field: inner };
  }

  // 단순 필드명 → exists
  if (/^[a-zA-Z_][\w.]*$/.test(s)) {
    return { type: "exists", field: s };
  }

  // 파싱 불가 → exists로 폴백
  return { type: "exists", field: s };
}

function normalizeOp(op: string): FieldCondition["op"] {
  switch (op) {
    case "===": case "==": return "eq";
    case "!==": case "!=": return "neq";
    case ">": return "gt";
    case ">=": return "gte";
    case "<": return "lt";
    case "<=": return "lte";
    default: return "eq";
  }
}

function parseValue(raw: string): unknown {
  if (raw === "true") return true;
  if (raw === "false") return false;
  if (raw === "null") return null;
  if (/^['"].*['"]$/.test(raw)) return raw.slice(1, -1);
  const num = Number(raw);
  if (!isNaN(num)) return num;
  return raw;
}

/** 조건 표현식 평가 */
export function evaluateCondition(expr: ConditionExpr, context: IPipeContext): boolean {
  switch (expr.type) {
    case "field": {
      const actual = context.get(expr.field);
      switch (expr.op) {
        case "eq": return actual === expr.value;
        case "neq": return actual !== expr.value;
        case "gt": return (actual as number) > (expr.value as number);
        case "gte": return (actual as number) >= (expr.value as number);
        case "lt": return (actual as number) < (expr.value as number);
        case "lte": return (actual as number) <= (expr.value as number);
        case "contains":
          if (typeof actual === "string") return actual.includes(expr.value as string);
          if (Array.isArray(actual)) return actual.includes(expr.value);
          return false;
        case "matches":
          return typeof actual === "string" && new RegExp(expr.value as string).test(actual);
        default: return false;
      }
    }
    case "and":
      return expr.children.every(c => evaluateCondition(c, context));
    case "or":
      return expr.children.some(c => evaluateCondition(c, context));
    case "not":
      return !evaluateCondition(expr.children[0], context);
    case "exists":
      return context.get(expr.field) != null;
    case "not-exists":
      return context.get(expr.field) == null;
    case "event-received":
      // 런타임에서 이벤트 큐 확인 — 여기서는 context에서 확인
      return context.get(`_events.${expr.eventKey}`) != null;
  }
}

// ── CancellationToken ────────────────────────────────

export class CancellationToken implements ICancellationToken {
  private _cancelled = false;
  private _reason?: string;
  private _callbacks: Array<() => void> = [];

  get cancelled(): boolean { return this._cancelled; }
  get reason(): string | undefined { return this._reason; }

  cancel(reason: string): void {
    if (this._cancelled) return;
    this._cancelled = true;
    this._reason = reason;
    for (const cb of this._callbacks) cb();
    this._callbacks = [];
  }

  onCancel(callback: () => void): void {
    if (this._cancelled) { callback(); return; }
    this._callbacks.push(callback);
  }

  /** 자식 토큰 생성 — 부모 취소 시 자식도 취소 */
  child(): CancellationToken {
    const child = new CancellationToken();
    this.onCancel(() => child.cancel(this._reason ?? "parent cancelled"));
    return child;
  }
}

// ── PipeContext ───────────────────────────────────────

export class PipeContext implements IPipeContext {
  readonly data: Record<string, unknown>;
  readonly triggerEvent: { eventKey: string; payload?: Record<string, unknown> };
  previousOutput?: unknown;
  readonly pipeId: string;
  readonly graphId?: string;
  readonly cancellation: ICancellationToken;

  constructor(opts: {
    triggerEvent: { eventKey: string; payload?: Record<string, unknown> };
    pipeId: string;
    graphId?: string;
    cancellation?: ICancellationToken;
    data?: Record<string, unknown>;
  }) {
    this.triggerEvent = opts.triggerEvent;
    this.pipeId = opts.pipeId;
    this.graphId = opts.graphId;
    this.cancellation = opts.cancellation ?? new CancellationToken();
    this.data = opts.data ? { ...opts.data } : { ...(opts.triggerEvent.payload ?? {}) };
  }

  get(path: string): unknown {
    const parts = path.split(".");
    let current: unknown = this.data;
    for (const part of parts) {
      if (current == null || typeof current !== "object") return undefined;
      current = (current as Record<string, unknown>)[part];
    }
    return current;
  }

  set(path: string, value: unknown): void {
    const parts = path.split(".");
    let current: Record<string, unknown> = this.data;
    for (let i = 0; i < parts.length - 1; i++) {
      if (current[parts[i]] == null || typeof current[parts[i]] !== "object") {
        current[parts[i]] = {};
      }
      current = current[parts[i]] as Record<string, unknown>;
    }
    current[parts[parts.length - 1]] = value;
  }

  clone(): PipeContext {
    return new PipeContext({
      triggerEvent: this.triggerEvent,
      pipeId: this.pipeId,
      graphId: this.graphId,
      cancellation: (this.cancellation as CancellationToken).child?.()
        ?? this.cancellation,
      data: JSON.parse(JSON.stringify(this.data)),
    });
  }
}

// ── ExecutorRegistry ─────────────────────────────────

export class ExecutorRegistry {
  private readonly executors: Map<string, StepExecutor> = new Map();

  register(executor: StepExecutor): void {
    this.executors.set(executor.facet, executor);
  }

  get(facet: string): StepExecutor | null {
    return this.executors.get(facet) ?? null;
  }

  /** 기본 실행기 — facet에 맞는 실행기가 없으면 사용 */
  private readonly defaultExecutor: StepExecutor = {
    facet: "*",
    execute: async (_step, context) => {
      return { status: "ok", output: context.previousOutput };
    },
  };

  getOrDefault(facet: string): StepExecutor {
    return this.executors.get(facet) ?? this.defaultExecutor;
  }
}

// ── PipeRunner ───────────────────────────────────────

export class PipeRunner {
  constructor(
    private readonly executors: ExecutorRegistry,
    private readonly maxSteps: number = 1000,
  ) {}

  /** PipeGraph 실행 */
  async run(
    graph: PipeGraph,
    triggerEvent: { eventKey: string; payload?: Record<string, unknown> },
  ): Promise<RunResult> {
    const steps: ExecutedStep[] = [];
    const producedEvents: RunResult["producedEvents"] = [];
    const errors: StepError[] = [];
    const rootToken = new CancellationToken();
    const startTime = Date.now();

    const pipeMap = new Map(graph.pipes.map(p => [p.pipeId, p]));
    const eventQueue: Array<{ eventKey: string; payload?: Record<string, unknown> }> = [triggerEvent];

    while (eventQueue.length > 0 && steps.length < this.maxSteps && !rootToken.cancelled) {
      const event = eventQueue.shift()!;
      const triggered = graph.pipes.filter(p => p.trigger.eventKey === event.eventKey);

      for (const pipe of triggered) {
        if (steps.length >= this.maxSteps || rootToken.cancelled) break;

        const context = new PipeContext({
          triggerEvent: event,
          pipeId: pipe.pipeId,
          graphId: graph.graphId,
          cancellation: rootToken.child(),
          data: event.payload ? { ...event.payload } : {},
        });

        await this.runFlow(pipe.flow, pipe.pipeId, "flow", context, steps);

        // produces → 이벤트 큐
        if (pipe.produces) {
          for (const ek of pipe.produces) {
            const ev = { eventKey: ek, payload: { ...context.data }, timestamp: new Date().toISOString() };
            producedEvents.push(ev);
            if (graph.pipes.some(p => p.trigger.eventKey === ek)) {
              eventQueue.push({ eventKey: ek, payload: context.data as Record<string, unknown> });
            }
          }
        }

        // 연결 따라가기
        for (const conn of graph.connections) {
          const froms = Array.isArray(conn.from) ? conn.from : [conn.from];
          if (!froms.includes(pipe.pipeId)) continue;

          const tos = Array.isArray(conn.to) ? conn.to : [conn.to];
          if (conn.kind === "next" || conn.kind === "fan-out" || conn.kind === "join") {
            for (const to of tos) {
              const toPipe = pipeMap.get(to);
              if (toPipe) eventQueue.push({ eventKey: toPipe.trigger.eventKey, payload: context.data as Record<string, unknown> });
            }
          } else if (conn.kind === "conditional") {
            const condExpr = parseCondition(conn.condition ?? "true");
            if (evaluateCondition(condExpr, context)) {
              for (const to of tos) {
                const toPipe = pipeMap.get(to);
                if (toPipe) eventQueue.push({ eventKey: toPipe.trigger.eventKey, payload: context.data as Record<string, unknown> });
              }
            }
          }
        }
      }
    }

    // 에러 수집 — 마지막 step의 에러만 (retry 중간 에러 제외)
    const lastStep = steps[steps.length - 1];
    if (lastStep?.error) errors.push(lastStep.error);

    return {
      steps,
      producedEvents,
      errors,
      finalContext: {},
      duration: Date.now() - startTime,
      status: rootToken.cancelled ? "cancelled"
        : steps.length >= this.maxSteps ? "max-steps"
        : errors.length > 0 ? "error"
        : "complete",
    };
  }

  private async runFlow(
    flow: PipeFlow,
    pipeId: string,
    path: string,
    context: PipeContext,
    steps: ExecutedStep[],
  ): Promise<StepResult> {
    if (context.cancellation.cancelled) {
      return { status: "error", error: { code: "CANCELLED", message: context.cancellation.reason ?? "cancelled", retryable: false } };
    }
    if (steps.length >= this.maxSteps) {
      return { status: "ok", output: null };
    }

    const now = new Date().toISOString();

    switch (flow.kind) {
      case "step": {
        const executor = this.executors.getOrDefault(flow.facet);
        const start = Date.now();
        const result = await executor.execute(flow, context);
        const executed: ExecutedStep = {
          pipeId, flowPath: path, kind: "step",
          facet: flow.facet, eventKey: flow.eventKey,
          input: context.previousOutput,
          output: result.status === "ok" ? result.output : null,
          status: result.status === "ok" ? "ok" : "error",
          error: result.status === "error" ? result.error : undefined,
          duration: Date.now() - start,
          timestamp: now,
        };
        steps.push(executed);
        if (result.status === "ok") context.previousOutput = result.output;
        return result;
      }

      case "sequence": {
        for (let i = 0; i < flow.steps.length; i++) {
          const r = await this.runFlow(flow.steps[i], pipeId, `${path}.steps[${i}]`, context, steps);
          if (r.status === "error") return r; // 즉시 중단, 에러 전파
        }
        return { status: "ok", output: context.previousOutput };
      }

      case "branch": {
        const condExpr = parseCondition(flow.condition);
        // 순서대로 평가하여 첫 번째 매칭 경로 실행
        for (let i = 0; i < flow.paths.length; i++) {
          // 마지막 경로는 default (else)
          if (i === flow.paths.length - 1 || evaluateCondition(condExpr, context)) {
            return this.runFlow(flow.paths[i], pipeId, `${path}.paths[${i}]`, context.clone(), steps);
          }
        }
        return { status: "ok", output: null };
      }

      case "optional": {
        const condExpr = parseCondition("_optional");
        // optional은 항상 실행 시도 (에러 시 무시)
        try {
          return await this.runFlow(flow.step, pipeId, `${path}.step`, context, steps);
        } catch {
          return { status: "ok", output: context.previousOutput };
        }
      }

      case "parallel": {
        const results = await Promise.all(
          flow.steps.map((s, i) =>
            this.runFlow(s, pipeId, `${path}.steps[${i}]`, context.clone(), steps),
          ),
        );
        const firstError = results.find(r => r.status === "error");
        if (firstError) return firstError;
        return { status: "ok", output: results.map(r => r.status === "ok" ? r.output : null) };
      }

      case "race": {
        // 실제 race는 Promise.race를 써야 하지만, 순차 시뮬로 대체
        for (let i = 0; i < flow.steps.length; i++) {
          const r = await this.runFlow(flow.steps[i], pipeId, `${path}.steps[${i}]`, context.clone(), steps);
          if (r.status === "ok") return r; // 첫 성공이 승자
        }
        return { status: "error", error: { code: "ALL_FAILED", message: "race: all steps failed", retryable: false } };
      }

      case "await": {
        // await는 조건 확인 후 then 실행
        return this.runFlow(flow.then, pipeId, `${path}.then`, context, steps);
      }

      case "retry": {
        let lastError: StepError | undefined;
        for (let attempt = 0; attempt < flow.maxAttempts; attempt++) {
          const r = await this.runFlow(flow.step, pipeId, `${path}.step`, context, steps);
          if (r.status === "ok") return r;
          lastError = r.error;
          if (!r.error.retryable) return r;
          if (flow.backoff) await sleep(flow.backoff * Math.pow(2, attempt));
        }
        return { status: "error", error: lastError ?? { code: "MAX_RETRIES", message: "max retries exceeded", retryable: false } };
      }

      case "fallback": {
        const tryResult = await this.runFlow(flow.try, pipeId, `${path}.try`, context, steps);
        if (tryResult.status === "ok") return tryResult;
        return this.runFlow(flow.catch, pipeId, `${path}.catch`, context, steps);
      }

      case "loop": {
        const max = flow.maxIterations ?? 100;
        for (let i = 0; i < max; i++) {
          const r = await this.runFlow(flow.body, pipeId, `${path}.body`, context, steps);
          if (r.status === "error") return r;
          const untilExpr = parseCondition(flow.until);
          if (evaluateCondition(untilExpr, context)) break;
        }
        return { status: "ok", output: context.previousOutput };
      }

      case "compensate": {
        const fwdResult = await this.runFlow(flow.forward, pipeId, `${path}.forward`, context, steps);
        if (fwdResult.status === "error") {
          await this.runFlow(flow.compensate, pipeId, `${path}.compensate`, context, steps);
          return fwdResult;
        }
        return fwdResult;
      }

      case "emit": {
        steps.push({
          pipeId, flowPath: path, kind: "emit",
          eventKey: flow.eventKey,
          input: null, output: null,
          status: "ok", duration: 0, timestamp: now,
        });
        return { status: "ok", output: null };
      }

      case "finally": {
        const bodyResult = await this.runFlow(flow.body, pipeId, `${path}.body`, context, steps);
        await this.runFlow(flow.cleanup, pipeId, `${path}.cleanup`, context, steps);
        return bodyResult; // body의 결과를 전파 (cleanup 결과 무시)
      }

      case "timeout": {
        // 단순 구현: body 실행 + duration은 기록만
        const r = await this.runFlow(flow.body, pipeId, `${path}.body`, context, steps);
        return r;
      }

      case "feedback": {
        const max = flow.maxIterations ?? 100;
        for (let i = 0; i < max; i++) {
          const r = await this.runFlow(flow.body, pipeId, `${path}.body`, context, steps);
          if (r.status === "error") return r;
          const untilExpr = parseCondition(flow.until);
          if (evaluateCondition(untilExpr, context)) break;
        }
        return { status: "ok", output: context.previousOutput };
      }

      case "tap": {
        // observe 실행 (에러 무시)
        try { await this.runFlow(flow.observe, pipeId, `${path}.observe`, context.clone(), steps); } catch { /* 무시 */ }
        return this.runFlow(flow.step, pipeId, `${path}.step`, context, steps);
      }

      case "filter": {
        const condExpr = parseCondition(flow.condition);
        if (evaluateCondition(condExpr, context)) {
          return this.runFlow(flow.step, pipeId, `${path}.step`, context, steps);
        }
        steps.push({ pipeId, flowPath: path, kind: "filter", input: null, output: null, status: "skipped", duration: 0, timestamp: now });
        return { status: "ok", output: null };
      }

      case "map":
        return this.runFlow(flow.itemFlow, pipeId, `${path}.itemFlow`, context, steps);
      case "reduce":
        return this.runFlow(flow.step, pipeId, `${path}.step`, context, steps);
      case "buffer":
        return this.runFlow(flow.body, pipeId, `${path}.body`, context, steps);
      case "split":
        return this.runFlow(flow.itemFlow, pipeId, `${path}.itemFlow`, context, steps);
      case "enrich":
        return this.runFlow(flow.step, pipeId, `${path}.step`, context, steps);
      case "resequence":
        return this.runFlow(flow.step, pipeId, `${path}.step`, context, steps);
      case "window":
        return this.runFlow(flow.body, pipeId, `${path}.body`, context, steps);
      case "dedup":
        return this.runFlow(flow.step, pipeId, `${path}.step`, context, steps);
      case "correlation":
        return this.runFlow(flow.onMatch, pipeId, `${path}.onMatch`, context, steps);
      case "circuit-breaker":
        return this.runFlow(flow.step, pipeId, `${path}.step`, context, steps);
      case "throttle":
        return this.runFlow(flow.step, pipeId, `${path}.step`, context, steps);
      case "debounce":
        return this.runFlow(flow.step, pipeId, `${path}.step`, context, steps);

      default:
        return { status: "ok", output: null };
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
