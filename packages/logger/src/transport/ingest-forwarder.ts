// @def.boundary observability-system-root
// @def.doc observability-system-root

/**
 * IngestForwarder — pino destination → ingest 파이프라인 브릿지.
 *
 * pino 구조화 로그 중 addressContext가 포함된 로그만 필터링하여
 * EventRecord로 변환, 배치로 모아 ingest-server에 전달한다.
 *
 * fail-open: 어떤 실패도 throw하지 않는다.
 */

import type {
  EventRecord,
  TransmissionEnvelope,
} from "@qa-sdk/core";
import {
  newLogId,
  newTransmissionId,
  newTraceId,
  newSpanId,
  now,
} from "@qa-sdk/core";

// ── Config ──────────────────────────────────────────────

export interface LogIngestBridgeConfig {
  /** ingest 서버 엔드포인트 (예: "http://localhost:3200/v1/ingest") */
  endpoint: string;

  /** 서비스 식별 (envelope source/owner 구성용) */
  serviceName: string;

  /** 배포 환경 */
  buildEnv?: string;

  /** 배치 크기. 이 수에 도달하면 즉시 flush */
  batchSize?: number;

  /** 자동 flush 주기 (ms). 0이면 비활성 */
  flushIntervalMs?: number;

  /** 버퍼 상한. 초과 시 oldest drop */
  maxBufferSize?: number;

  /** HTTP timeout (ms) */
  timeoutMs?: number;

  /** 엔벨로프에 주입할 인프라 주소 컨텍스트 */
  infraContext?: Record<string, string>;

  /** 에러 콜백. 기본: silent drop */
  onError?: (err: unknown) => void;
}

const DEFAULT_BATCH_SIZE = 50;
const DEFAULT_FLUSH_INTERVAL_MS = 5_000;
const DEFAULT_MAX_BUFFER_SIZE = 500;
const DEFAULT_TIMEOUT_MS = 10_000;

// ── Stats ───────────────────────────────────────────────

export interface ForwarderStats {
  forwarded: number;
  filtered: number;
  dropped: number;
  flushCount: number;
  lastFlushAt: string | null;
}

// ── pino level → label ──────────────────────────────────

const PINO_LEVELS: Record<number, string> = {
  10: "trace",
  20: "debug",
  30: "info",
  40: "warn",
  50: "error",
  60: "fatal",
};

// ── 예약 필드 (payload에서 제외) ────────────────────────

const RESERVED_KEYS = new Set([
  "addressContext", "traceId", "spanId", "parentSpanId",
  "qaSessionId", "eventKey",
  "time", "level", "pid", "hostname", "name", "msg", "timestamp",
]);

// ── Filter ──────────────────────────────────────────────

function shouldForward(log: Record<string, unknown>): boolean {
  const ctx = log.addressContext;
  return ctx != null
    && typeof ctx === "object"
    && Object.keys(ctx as object).length > 0;
}

// ── Transform ───────────────────────────────────────────

function toEventRecord(log: Record<string, unknown>): EventRecord {
  const level = typeof log.level === "number" ? log.level : 30;
  const levelLabel = (typeof log.level === "string" ? log.level : PINO_LEVELS[level]) ?? "info";

  // event_key: 명시 > 자동
  const eventKey = typeof log.eventKey === "string"
    ? log.eventKey
    : `svc_log.${levelLabel}`;

  // timestamp
  const ts = typeof log.time === "number"
    ? new Date(log.time).toISOString()
    : (typeof log.timestamp === "string" ? log.timestamp : now());

  // payload: 예약 필드 제외
  const payload: Record<string, unknown> = {};
  if (typeof log.msg === "string") payload.msg = log.msg;
  if (typeof log.name === "string") payload.service = log.name;
  for (const [k, v] of Object.entries(log)) {
    if (!RESERVED_KEYS.has(k)) {
      payload[k] = v;
    }
  }

  return {
    log_id: newLogId(),
    timestamp: ts,
    record_kind: "log",
    trace_id: (typeof log.traceId === "string" ? log.traceId : undefined) ?? newTraceId(),
    span_id: (typeof log.spanId === "string" ? log.spanId : undefined) ?? newSpanId(),
    parent_span_id: typeof log.parentSpanId === "string" ? log.parentSpanId : undefined,
    event_key: eventKey,
    event_version: "1",
    payload_format: "json",
    payload_encoding: "raw",
    payload_masking_applied: false,
    payload_masked_fields: [],
    payload,
    qa_session_id: typeof log.qaSessionId === "string" ? log.qaSessionId : undefined,
    address_context: log.addressContext as Record<string, string>,
  };
}

// ── Envelope ────────────────────────────────────────────

function buildEnvelope(
  records: EventRecord[],
  config: LogIngestBridgeConfig,
): TransmissionEnvelope {
  return {
    transmission_id: newTransmissionId(),
    sent_at: now(),
    owner: {
      owner_type: "agent",
      owner_id: `svc:${config.serviceName}`,
    },
    source: {
      service_name: config.serviceName,
      sdk_name: "@qa-sdk/logger",
      sdk_version: "0.1.0",
    },
    runtime: {
      platform: "node",
    },
    build: {
      env: config.buildEnv ?? process.env.NODE_ENV ?? "local",
    },
    infra_context: config.infraContext,
    records,
  };
}

// ── IngestForwarder ─────────────────────────────────────

/**
 * pino.DestinationStream 호환 객체.
 *
 * pino.multistream의 destination으로 등록하면,
 * addressContext가 포함된 로그만 ingest-server에 전달한다.
 *
 * 사용:
 *   const forwarder = createIngestForwarder({ endpoint, serviceName });
 *   const logger = pino({...}, pino.multistream([
 *     { stream: pino.destination(1) },
 *     { stream: forwarder, level: "info" },
 *   ]));
 */
export class IngestForwarder {
  private readonly config: LogIngestBridgeConfig;
  private readonly batchSize: number;
  private readonly flushIntervalMs: number;
  private readonly maxBufferSize: number;
  private readonly timeoutMs: number;

  private buffer: EventRecord[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private flushInProgress = false;
  private closed = false;

  private readonly stats: ForwarderStats = {
    forwarded: 0,
    filtered: 0,
    dropped: 0,
    flushCount: 0,
    lastFlushAt: null,
  };

  constructor(config: LogIngestBridgeConfig) {
    this.config = config;
    this.batchSize = config.batchSize ?? DEFAULT_BATCH_SIZE;
    this.flushIntervalMs = config.flushIntervalMs ?? DEFAULT_FLUSH_INTERVAL_MS;
    this.maxBufferSize = config.maxBufferSize ?? DEFAULT_MAX_BUFFER_SIZE;
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    if (this.flushIntervalMs > 0) {
      this.flushTimer = setInterval(() => {
        void this.flush();
      }, this.flushIntervalMs);
      // interval이 프로세스 종료를 막지 않도록
      if (this.flushTimer.unref) this.flushTimer.unref();
    }
  }

  // ── pino.DestinationStream 계약 ───────────────────────

  /** pino가 호출하는 write. JSON 문자열을 받는다. */
  write(chunk: string): void {
    if (this.closed) return;

    let log: Record<string, unknown>;
    try {
      log = JSON.parse(chunk) as Record<string, unknown>;
    } catch {
      this.stats.dropped++;
      return;
    }

    if (!shouldForward(log)) {
      this.stats.filtered++;
      return;
    }

    try {
      const record = toEventRecord(log);
      this.push(record);
    } catch {
      this.stats.dropped++;
      this.config.onError?.("변환 실패");
    }
  }

  // ── Buffer ────────────────────────────────────────────

  private push(record: EventRecord): void {
    if (this.buffer.length >= this.maxBufferSize) {
      // ring buffer: oldest drop
      this.buffer.shift();
      this.stats.dropped++;
    }
    this.buffer.push(record);

    if (this.buffer.length >= this.batchSize) {
      void this.flush();
    }
  }

  /** 버퍼를 ingest-server에 전송. concurrent 방지. */
  async flush(): Promise<void> {
    if (this.flushInProgress || this.buffer.length === 0) return;
    this.flushInProgress = true;

    const batch = this.buffer.splice(0, this.batchSize);

    try {
      const envelope = buildEnvelope(batch, this.config);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const res = await fetch(this.config.endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(envelope),
          signal: controller.signal,
        });

        if (res.ok) {
          this.stats.forwarded += batch.length;
        } else {
          // HTTP 에러 → batch drop
          this.stats.dropped += batch.length;
          this.config.onError?.(`ingest 응답 ${res.status}`);
        }
      } finally {
        clearTimeout(timer);
      }
    } catch (err) {
      // 네트워크 에러, timeout → batch drop
      this.stats.dropped += batch.length;
      this.config.onError?.(err);
    } finally {
      this.stats.flushCount++;
      this.stats.lastFlushAt = now();
      this.flushInProgress = false;

      // flush 중 쌓인 레코드가 batchSize 이상이면 재귀 flush
      if (this.buffer.length >= this.batchSize) {
        void this.flush();
      }
    }
  }

  /** 종료. 잔여 버퍼를 drain한 뒤 timer 해제. */
  async shutdown(): Promise<void> {
    this.closed = true;
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    // 잔여 버퍼 drain (최대 1회)
    if (this.buffer.length > 0) {
      this.flushInProgress = false; // 강제 해제
      await this.flush();
    }
  }

  /** 진단용 통계 조회 */
  getStats(): Readonly<ForwarderStats> {
    return { ...this.stats };
  }
}

// ── Factory ─────────────────────────────────────────────

export function createIngestForwarder(config: LogIngestBridgeConfig): IngestForwarder {
  return new IngestForwarder(config);
}
