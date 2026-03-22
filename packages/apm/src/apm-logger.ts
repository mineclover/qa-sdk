/**
 * apm-logger.ts — QaLogger + PartialBinder 브릿지.
 *
 * 수학/인코딩 그룹(weighted-index)과 QA 플랫폼 그룹(@qa-sdk)을
 * 연결하는 핵심 클래스.
 *
 * SDK 부트 시 고정 차원을 캐시하고, 런타임에 자유 차원만 받아
 * address_context를 자동으로 생성한다.
 */

import type { EventRecord, MetricType, PayloadFormat, PayloadEncoding, SpanStatusCode } from "@qa-sdk/core";
import { toServiceDims, toTransmissionSource, toTransmissionBuild } from "@qa-sdk/core";
import { QaLogger, TraceContext } from "@qa-sdk/sdk";
import type { SpanHandle } from "@qa-sdk/sdk";
import { createBinder, type PartialBinder } from "weighted-index";
import type { ApmLoggerConfig, ApmBootConfig } from "./config.js";

export class ApmLogger {
  private readonly logger: QaLogger;
  private readonly binder: PartialBinder;
  private readonly _prefix: string;
  private readonly _generation: string;

  constructor(config: ApmLoggerConfig) {
    const { codec, prefix, fixedDims, generation, entrySnapshot, ...loggerConfig } = config;

    this._prefix = prefix;
    this._generation = generation ?? codec.getCurrentVersion(prefix);
    this.binder = createBinder(codec, prefix, fixedDims, this._generation);

    // 자유 차원이 없으면 (fully bound) → infra_context로 설정
    const infraContext = this.binder.free.length === 0
      ? { [prefix]: this.formatAddress(this.binder.resolveId({})) }
      : undefined;

    this.logger = new QaLogger({
      ...loggerConfig,
      ...(infraContext ? { infraContext } : {}),
      ...(entrySnapshot ? { entrySnapshot } : {}),
    });
  }

  // ── Context ─────────────────────────────────────────

  /** Start a new trace context. */
  startTrace(options?: {
    trace_id?: string;
    qa_session_id?: string;
  }): TraceContext {
    return this.logger.startTrace(options);
  }

  /** Get the current trace context. */
  get context(): TraceContext | null {
    return this.logger.context;
  }

  // ── Log ─────────────────────────────────────────────

  /** 로그 이벤트 기록. dims로 자유 차원을 전달하면 address_context가 자동 생성된다. */
  log(params: {
    event_key: string;
    event_version: string;
    payload?: Record<string, unknown>;
    payload_format?: PayloadFormat;
    payload_encoding?: PayloadEncoding;
    dims?: Record<string, string>;
  }): EventRecord {
    return this.logger.log({
      event_key: params.event_key,
      event_version: params.event_version,
      payload: params.payload,
      payload_format: params.payload_format,
      payload_encoding: params.payload_encoding,
      ...(params.dims ? { address_context: this.resolveContext(params.dims) } : {}),
    });
  }

  /** 편의 메서드: info 레벨 로그 */
  info(eventKey: string, payload?: Record<string, unknown>, dims?: Record<string, string>): EventRecord {
    return this.log({ event_key: eventKey, event_version: "1", payload, dims });
  }

  /** 편의 메서드: warn 레벨 로그 */
  warn(eventKey: string, payload?: Record<string, unknown>, dims?: Record<string, string>): EventRecord {
    return this.log({ event_key: eventKey, event_version: "1", payload, dims });
  }

  /** 편의 메서드: error 레벨 로그 */
  error(eventKey: string, payload?: Record<string, unknown>, dims?: Record<string, string>): EventRecord {
    return this.log({ event_key: eventKey, event_version: "1", payload, dims });
  }

  // ── Span ────────────────────────────────────────────

  /** Start a span with optional dimension binding. */
  startSpan(params: {
    event_key: string;
    event_version: string;
    span_name: string;
    payload?: Record<string, unknown>;
    dims?: Record<string, string>;
  }): SpanHandle {
    return this.logger.startSpan({
      event_key: params.event_key,
      event_version: params.event_version,
      span_name: params.span_name,
      payload: params.payload,
      ...(params.dims ? { address_context: this.resolveContext(params.dims) } : {}),
    });
  }

  // ── Metric ──────────────────────────────────────────

  /** 메트릭 이벤트 기록. dims로 address_context 자동 생성. */
  metric(name: string, value: number, opts?: {
    type?: MetricType;
    unit?: string;
    labels?: Record<string, string>;
    buckets?: number[];
    quantiles?: number[];
    dims?: Record<string, string>;
  }): EventRecord {
    return this.logger.metric(name, value, {
      type: opts?.type,
      unit: opts?.unit,
      labels: opts?.labels,
      buckets: opts?.buckets,
      quantiles: opts?.quantiles,
      ...(opts?.dims ? { address_context: this.resolveContext(opts.dims) } : {}),
    });
  }

  // ── Flush / Shutdown ────────────────────────────────

  async flush(): Promise<void> {
    await this.logger.flush();
  }

  async shutdown(): Promise<void> {
    await this.logger.shutdown();
  }

  // ── Accessors ───────────────────────────────────────

  /** 내부 PartialBinder 접근 */
  get partialBinder(): PartialBinder {
    return this.binder;
  }

  /** 내부 QaLogger 접근 */
  get baseLogger(): QaLogger {
    return this.logger;
  }

  // ── Internal ────────────────────────────────────────

  private resolveContext(dims: Record<string, string>): Record<string, string> {
    const id = this.binder.resolveId(dims);
    return { [this._prefix]: this.formatAddress(id) };
  }

  private formatAddress(id: number): string {
    return `${this._prefix}:${this._generation}:${id}`;
  }
}

/** Factory function */
export function createApmLogger(config: ApmLoggerConfig): ApmLogger {
  return new ApmLogger(config);
}

/**
 * ServiceBootConfig 기반 편의 팩토리.
 *
 * ServiceBootConfig 하나로 source, build, fixedDims를 자동 파생.
 * 기존 createApmLogger()와 동일한 ApmLogger를 반환한다.
 */
export function createApmLoggerFromBoot(boot: ApmBootConfig): ApmLogger {
  const { service } = boot;
  return createApmLogger({
    transport: boot.transport,
    owner: boot.owner,
    source: toTransmissionSource(service, "@qa-sdk/apm", "0.1.0"),
    build: toTransmissionBuild(service),
    runtime: { platform: "node", ...boot.runtime },
    codec: boot.codec,
    prefix: boot.prefix ?? "service",
    fixedDims: toServiceDims(service),
    generation: boot.generation,
    actor: boot.actor,
    entrySnapshot: boot.entrySnapshot,
  });
}
