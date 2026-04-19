// @def.boundary observability-system-root
// @def.doc observability-system-root

/**
 * DebugWebSocketTransport — 개발환경 실시간 디버깅용 WebSocket Transport.
 *
 * QaLogger → DebugTransport → WebSocket binary → ingest-server /v1/debug-ws
 *
 * 특징:
 * - 바이너리 프레임 (tag + msgpack) — 기존 JSON Transport 대비 ~50% 작음
 * - 자동 재연결 (1초 → 2초 → 4초 backoff)
 * - 연결 실패 시 버퍼링 (최대 1000건, 초과 시 oldest 드랍)
 * - dev 환경에서만 활성화 권장
 *
 * @example
 * ```ts
 * const transport = new DebugWebSocketTransport("ws://localhost:3200/v1/debug-ws");
 * const logger = new QaLogger({ transports: [httpTransport, transport] });
 * ```
 */
import { TAG_EVENT_RECORD, encodeFrame, type TransmissionEnvelope, type MsgpackEncode } from "@qa-sdk/core";
import type { Transport } from "./transport.js";

const MAX_BUFFER = 1000;
const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 30_000;

export class DebugWebSocketTransport implements Transport {
  private ws: WebSocket | null = null;
  private buffer: Uint8Array[] = [];
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private closed = false;
  private readonly encode: MsgpackEncode;

  constructor(
    private readonly url: string,
    opts?: { encode?: MsgpackEncode },
  ) {
    // msgpack encode — 런타임 주입 또는 lazy import
    this.encode = opts?.encode ?? ((v: unknown) => {
      // fallback: JSON → Uint8Array (msgpack 미설치 환경)
      const json = JSON.stringify(v);
      return new TextEncoder().encode(json);
    });
    this.connect();
  }

  async send(envelope: TransmissionEnvelope): Promise<void> {
    for (const record of envelope.records) {
      const debugRecord = {
        logId: record.log_id,
        traceId: record.trace_id,
        spanId: record.span_id,
        timestampMs: new Date(record.timestamp).getTime(),
        recordKind: record.record_kind,
        eventKey: record.event_key,
        eventVersion: record.event_version,
        addressContext: record.address_context,
        serviceName: envelope.source.service_name,
        qaSessionId: record.qa_session_id,
        actorId: record.actor_id,
        payloadJson: record.payload ? JSON.stringify(record.payload) : undefined,
      };

      const frame = encodeFrame(TAG_EVENT_RECORD, debugRecord, this.encode);

      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(frame);
      } else {
        this.bufferFrame(frame);
      }
    }
  }

  async flush(): Promise<void> {
    this.drainBuffer();
  }

  async shutdown(): Promise<void> {
    this.closed = true;
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    if (this.ws) { this.ws.close(); this.ws = null; }
    this.buffer = [];
  }

  // ── 내부 ────────────────────────────────────────────

  private connect() {
    if (this.closed) return;
    try {
      this.ws = new WebSocket(this.url);
      this.ws.binaryType = "arraybuffer";

      this.ws.addEventListener("open", () => {
        this.reconnectAttempt = 0;
        this.drainBuffer();
      });

      this.ws.addEventListener("close", () => {
        this.ws = null;
        this.scheduleReconnect();
      });

      this.ws.addEventListener("error", () => {
        // close가 뒤따르므로 여기서는 무시
      });
    } catch {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.closed) return;
    const delay = Math.min(RECONNECT_BASE_MS * 2 ** this.reconnectAttempt, RECONNECT_MAX_MS);
    this.reconnectAttempt++;
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }

  private bufferFrame(frame: Uint8Array) {
    this.buffer.push(frame);
    if (this.buffer.length > MAX_BUFFER) {
      this.buffer.shift(); // oldest 드랍
    }
  }

  private drainBuffer() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    while (this.buffer.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- while (buffer.length > 0) 루프 내부
      const frame = this.buffer.shift()!;
      this.ws.send(frame);
    }
  }
}
