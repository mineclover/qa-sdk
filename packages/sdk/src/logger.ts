import {
  type EventRecord,
  type TransmissionEnvelope,
  type RecordKind,
  type SpanStatusCode,
  type PayloadFormat,
  type PayloadEncoding,
  newTransmissionId,
  newLogId,
  newSpanId,
  now,
} from "@qa-sdk/core";

import { TraceContext } from "./context.js";
import { applyMasking } from "./masking.js";
import {
  type QaLoggerConfig,
  DEFAULT_BATCH_SIZE,
  DEFAULT_FLUSH_INTERVAL_MS,
  DEFAULT_MAX_BUFFER_SIZE,
} from "./config.js";

export class QaLogger {
  private readonly config: QaLoggerConfig;
  private readonly batchSize: number;
  private readonly flushIntervalMs: number;
  private readonly maxBufferSize: number;
  private buffer: EventRecord[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private activeContext: TraceContext | null = null;
  /** Prevents concurrent flush calls (interval + batch-size trigger). */
  private flushInProgress = false;

  constructor(config: QaLoggerConfig) {
    this.config = config;
    this.batchSize = config.batchSize ?? DEFAULT_BATCH_SIZE;
    this.flushIntervalMs = config.flushIntervalMs ?? DEFAULT_FLUSH_INTERVAL_MS;
    this.maxBufferSize = config.maxBufferSize ?? DEFAULT_MAX_BUFFER_SIZE;

    if (this.flushIntervalMs > 0) {
      this.flushTimer = setInterval(() => {
        this.flush().catch((err: unknown) => this.handleError(err, "interval-flush"));
      }, this.flushIntervalMs);
    }
  }

  // ── Context Management ─────────────────────────────

  /** Start a new trace context (or attach to existing trace). */
  startTrace(options?: {
    trace_id?: string;
    qa_session_id?: string;
  }): TraceContext {
    this.activeContext = new TraceContext(options);
    return this.activeContext;
  }

  /** Get the current trace context. */
  get context(): TraceContext | null {
    return this.activeContext;
  }

  /** Set an external trace context (e.g., propagated from upstream). */
  setContext(ctx: TraceContext): void {
    this.activeContext = ctx;
  }

  // ── Log ────────────────────────────────────────────

  /** Record a log event. */
  log(params: {
    event_key: string;
    event_version: string;
    payload?: Record<string, unknown>;
    payload_format?: PayloadFormat;
    payload_encoding?: PayloadEncoding;
    qa_session_id?: string;
  }): EventRecord {
    const ctx = this.ensureContext();
    const { payload, maskedFields, maskingApplied } =
      this.processPayload(params.payload);

    const record: EventRecord = {
      log_id: newLogId(),
      timestamp: now(),
      record_kind: "log",
      trace_id: ctx.trace_id,
      span_id: ctx.currentSpanId,
      parent_span_id: ctx.parentSpanId,
      event_key: params.event_key,
      event_version: params.event_version,
      payload_format: params.payload_format ?? "json",
      payload_encoding: params.payload_encoding ?? "raw",
      payload_masking_applied: maskingApplied,
      payload_masked_fields: maskedFields,
      payload,
      qa_session_id: params.qa_session_id ?? ctx.qa_session_id,
    };

    this.addRecord(record);
    return record;
  }

  // ── Span ───────────────────────────────────────────

  /** Start a span. Returns a handle to end it. */
  startSpan(params: {
    event_key: string;
    event_version: string;
    span_name: string;
    payload?: Record<string, unknown>;
    payload_format?: PayloadFormat;
    payload_encoding?: PayloadEncoding;
    qa_session_id?: string;
  }): SpanHandle {
    const ctx = this.ensureContext();
    const spanId = ctx.pushSpan();
    const parentSpanId = ctx.parentSpanId;
    const startTime = now();

    return {
      span_id: spanId,
      end: (endParams?: {
        status_code?: SpanStatusCode;
        payload?: Record<string, unknown>;
      }) => {
        ctx.popSpan();

        const mergedPayload = {
          ...params.payload,
          ...endParams?.payload,
        };
        const { payload, maskedFields, maskingApplied } =
          this.processPayload(
            Object.keys(mergedPayload).length > 0 ? mergedPayload : undefined,
          );

        const record: EventRecord = {
          log_id: newLogId(),
          timestamp: now(),
          record_kind: "span",
          trace_id: ctx.trace_id,
          span_id: spanId,
          parent_span_id: parentSpanId,
          event_key: params.event_key,
          event_version: params.event_version,
          span_name: params.span_name,
          start_time: startTime,
          end_time: now(),
          status_code: endParams?.status_code ?? "ok",
          payload_format: params.payload_format ?? "json",
          payload_encoding: params.payload_encoding ?? "raw",
          payload_masking_applied: maskingApplied,
          payload_masked_fields: maskedFields,
          payload,
          qa_session_id: params.qa_session_id ?? ctx.qa_session_id,
        };

        this.addRecord(record);
        return record;
      },
    };
  }

  // ── Flush / Shutdown ───────────────────────────────

  /** Flush buffered records as a transmission envelope. */
  async flush(): Promise<void> {
    if (this.flushInProgress || this.buffer.length === 0) return;

    this.flushInProgress = true;
    const records = this.buffer.splice(0, this.buffer.length);
    try {
      const envelope = this.buildEnvelope(records);
      await this.config.transport.send(envelope);
    } catch (err: unknown) {
      // Re-insert records only up to the buffer cap; drop excess oldest records.
      const combined = [...records, ...this.buffer];
      if (combined.length > this.maxBufferSize) {
        const dropped = combined.splice(0, combined.length - this.maxBufferSize);
        this.handleError(
          new Error(`[qa-sdk:flush] buffer overflow — dropped ${dropped.length} oldest records`),
          "buffer-overflow",
        );
      }
      this.buffer = combined;
      const error = err instanceof Error ? err : new Error(String(err));
      throw new Error(`[qa-sdk:flush] transport.send failed: ${error.message}`, { cause: error });
    } finally {
      this.flushInProgress = false;
    }
  }

  /** Flush remaining records and shut down. */
  async shutdown(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    await this.flush();
    await this.config.transport.shutdown();
  }

  // ── Internal ───────────────────────────────────────

  private ensureContext(): TraceContext {
    if (!this.activeContext) {
      this.activeContext = new TraceContext();
    }
    return this.activeContext;
  }

  private processPayload(payload?: Record<string, unknown>): {
    payload: unknown;
    maskedFields: string[];
    maskingApplied: boolean;
  } {
    if (!payload) {
      return { payload: null, maskedFields: [], maskingApplied: false };
    }

    const rules = this.config.maskingRules;
    if (!rules || rules.length === 0) {
      return { payload, maskedFields: [], maskingApplied: false };
    }

    const { masked, maskedFields } = applyMasking(payload, rules);
    return {
      payload: masked,
      maskedFields,
      maskingApplied: maskedFields.length > 0,
    };
  }

  private addRecord(record: EventRecord): void {
    if (this.buffer.length >= this.maxBufferSize) {
      // Buffer is at cap and no flush in progress — drop oldest to make room
      this.buffer.shift();
      this.handleError(
        new Error(`[qa-sdk:addRecord] buffer at cap (${this.maxBufferSize}) — dropping oldest record`),
        "buffer-overflow",
      );
    }
    this.buffer.push(record);
    if (!this.flushInProgress && this.buffer.length >= this.batchSize) {
      this.flush().catch((err: unknown) => this.handleError(err, "batch-flush"));
    }
  }

  private handleError(err: unknown, context: string): void {
    const error = err instanceof Error ? err : new Error(String(err));
    if (this.config.onError) {
      this.config.onError(error, context);
    } else {
      console.error(`[qa-sdk:${context}]`, error);
    }
  }

  private buildEnvelope(records: EventRecord[]): TransmissionEnvelope {
    return {
      transmission_id: newTransmissionId(),
      sent_at: now(),
      owner: this.config.owner,
      source: this.config.source,
      runtime: this.config.runtime,
      build: this.config.build,
      records,
    };
  }
}

export interface SpanHandle {
  span_id: string;
  end(params?: {
    status_code?: SpanStatusCode;
    payload?: Record<string, unknown>;
  }): EventRecord;
}
