// @def.boundary permission-engine-spec
// @def.doc authorization-ontology-nested-audit-tracing

/**
 * OtelAuditRecorder — 임의의 AuditRecorder를 감싸 OTEL active span에서
 * spanId/traceId/parentSpanId를 자동으로 채워 위임한다.
 *
 * - 명시적 인자가 있으면 그 값 우선 (테스트·cron job용)
 * - active span이 있으면 spanContext()에서 추출
 * - 없으면 W3C-style random ID 생성 (16바이트 trace, 8바이트 span)
 *
 * 본 wrapper는 OTEL API에만 의존하며, 실제 SDK가 부재해도 동작한다
 * (`@opentelemetry/api`의 default tracer는 noop).
 */

import { trace, type Span } from "@opentelemetry/api";
import { randomBytes } from "node:crypto";

import type {
  AuditEntry,
  AuditOutcome,
  CheckEntry,
  ExecutionEntry,
  RecordCheckArgs,
  RecordExecutionArgs,
} from "./types.js";
import type { AuditRecorder } from "./recorder.js";

/**
 * Wrapper에 넘기는 인자 — 모든 ID 필드가 optional.
 */
export interface OtelRecordExecutionArgs
  extends Omit<RecordExecutionArgs, "spanId" | "traceId" | "parentSpanId"> {
  spanId?: string;
  traceId?: string;
  parentSpanId?: string | null;
}

export interface OtelRecordCheckArgs
  extends Omit<RecordCheckArgs, "spanId" | "traceId" | "parentSpanId"> {
  spanId?: string;
  traceId?: string;
  parentSpanId?: string;
}

function randomSpanId(): string {
  return randomBytes(8).toString("hex");
}

function randomTraceId(): string {
  return randomBytes(16).toString("hex");
}

/**
 * Active span의 context에서 ID를 추출. 없으면 random.
 *
 * 반환:
 *   - spanId: 새 entry의 식별자 (active span의 spanId 또는 random)
 *   - traceId: trace 식별자 (active span의 traceId 또는 random)
 *   - parentSpanId: active span의 parent (없으면 null)
 */
function resolveIds(): { spanId: string; traceId: string; parentSpanId: string | null } {
  const active = trace.getActiveSpan();
  if (!active) {
    return { spanId: randomSpanId(), traceId: randomTraceId(), parentSpanId: null };
  }
  const ctx = active.spanContext();
  // parent span ID는 OTEL API에 직접 노출 안 됨 — Span 객체의 parentSpanId 프로퍼티로 접근.
  // (BasicTracerProvider가 만든 Span은 parentSpanId 필드를 노출. SDK 종류마다 다를 수 있어 best-effort.)
  const parentSpanId = (active as Span & { parentSpanId?: string }).parentSpanId ?? null;
  return { spanId: ctx.spanId, traceId: ctx.traceId, parentSpanId };
}

export class OtelAuditRecorder implements AuditRecorder {
  constructor(private readonly inner: AuditRecorder) {}

  async startExecution(args: OtelRecordExecutionArgs): Promise<ExecutionEntry> {
    const auto = resolveIds();
    return this.inner.startExecution({
      ...args,
      spanId: args.spanId ?? auto.spanId,
      traceId: args.traceId ?? auto.traceId,
      parentSpanId: args.parentSpanId !== undefined ? args.parentSpanId : auto.parentSpanId,
    });
  }

  async finishExecution(spanId: string, outcome: AuditOutcome, now?: string) {
    return this.inner.finishExecution(spanId, outcome, now);
  }

  async recordCheck(args: OtelRecordCheckArgs): Promise<CheckEntry> {
    const auto = resolveIds();
    // check span 모델 (스펙 §3): check는 execution의 자식 span으로 별도 OTEL span을 가진다.
    // - 새 entry의 spanId = active span 자체 (checkSpan의 spanId)
    // - parentSpanId = active span의 parent (= execution span)
    // active span이 없으면 random spanId + parent는 호출자가 명시해야 함.
    const spanId = args.spanId ?? auto.spanId;
    const parentSpanId =
      args.parentSpanId ?? auto.parentSpanId ?? auto.spanId;
    return this.inner.recordCheck({
      ...args,
      spanId,
      traceId: args.traceId ?? auto.traceId,
      parentSpanId,
    });
  }

  async get(spanId: string): Promise<AuditEntry | null> {
    return this.inner.get(spanId);
  }

  async listByRoot(rootSpanId: string): Promise<AuditEntry[]> {
    return this.inner.listByRoot(rootSpanId);
  }

  async firstFailure(rootSpanId: string): Promise<AuditEntry | null> {
    return this.inner.firstFailure(rootSpanId);
  }
}
