/**
 * Debug Protocol — 개발환경 실시간 로깅/디버깅 바이너리 프로토콜.
 *
 * 프레임 구조: tag(1 byte) + msgpack payload
 *
 * Tag:
 *   0x01 = EventRecord (server → client)
 *   0x02 = DebugCommand (client → server)
 *   0x03 = DebugResponse (server → client)
 *   0x04 = Heartbeat (양방향)
 *
 * 메시지 직렬화: MessagePack (msgpack)
 * 스키마 정의: proto/debug.proto (참조용)
 */

// ── Tags ───────────────────────────────────────────────

export const TAG_EVENT_RECORD = 0x01;
export const TAG_DEBUG_COMMAND = 0x02;
export const TAG_DEBUG_RESPONSE = 0x03;
export const TAG_HEARTBEAT = 0x04;

// ── 이벤트 레코드 (서버 → 클라이언트 스트리밍) ────────

export interface DebugEventRecord {
  logId: string;
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  timestampMs: number;
  recordKind: "log" | "span" | "metric";
  eventKey: string;
  eventVersion: string;
  /** 인코딩된 좌표 { prefix: "prefix:ver:addr" } */
  addressContext?: Record<string, string>;
  /** 서버에서 미리 디코딩한 축:값 맵 */
  decodedDims?: Record<string, string>;
  serviceName?: string;
  namespace?: string;
  env?: string;
  qaSessionId?: string;
  actorId?: string;
  /** JSON string */
  payloadJson?: string;
  /** 메트릭 */
  metricName?: string;
  metricValue?: number;
  metricUnit?: string;
  metricLabels?: Record<string, string>;
}

// ── 디버그 명령 (클라이언트 → 서버) ───────────────────

export interface StreamFilter {
  prefixIds?: string[];
  serviceIds?: string[];
  eventKeys?: string[];
  traceId?: string;
  sessionId?: string;
  decodeAddresses?: boolean;
  maxRecordsPerSec?: number;
}

export type DebugCommand =
  | { type: "subscribe"; filter: StreamFilter }
  | { type: "unsubscribe" }
  | { type: "get-active-traces" }
  | { type: "resolve-address"; prefix: string; version: string; address: number; deep?: boolean }
  | { type: "set-filter"; filter: StreamFilter }
  | { type: "ping"; timestampMs: number };

// ── 디버그 응답 (서버 → 클라이언트) ───────────────────

export interface TraceInfo {
  traceId: string;
  sessionId?: string;
  serviceName?: string;
  recordCount: number;
  firstTimestampMs?: number;
  lastTimestampMs?: number;
}

export interface ResolvedDim {
  label: string;
  kind: "axis" | "prefix_ref" | "table_ref";
  position: number;
  value: string;
  ko?: string;
  ref?: { prefix: string; version: string; address: number; dims: Record<string, ResolvedDim> };
}

export type DebugResponse =
  | { type: "subscribe-ack"; subscriptionId: string; filter: StreamFilter }
  | { type: "active-traces"; traces: TraceInfo[] }
  | { type: "resolved-address"; prefix: string; version: string; address: number; dims: Record<string, ResolvedDim> }
  | { type: "error"; code: string; message: string }
  | { type: "pong"; timestampMs: number; serverTimestampMs: number };

// ── 프레임 인코딩/디코딩 ──────────────────────────────

/** msgpack encode 함수 타입 (런타임 주입) */
export type MsgpackEncode = (value: unknown) => Uint8Array;
/** msgpack decode 함수 타입 (런타임 주입) */
export type MsgpackDecode = (buffer: Uint8Array) => unknown;

/** 바이너리 프레임 생성: tag(1) + msgpack payload */
export function encodeFrame(tag: number, payload: unknown, encode: MsgpackEncode): Uint8Array {
  const body = encode(payload);
  const frame = new Uint8Array(1 + body.length);
  frame[0] = tag;
  frame.set(body, 1);
  return frame;
}

/** 바이너리 프레임 파싱: tag + payload */
export function decodeFrame(frame: Uint8Array, decode: MsgpackDecode): { tag: number; payload: unknown } {
  if (frame.length < 2) throw new Error("Debug frame too short");
  const tag = frame[0];
  const payload = decode(frame.subarray(1));
  return { tag, payload };
}

// ── 편의 함수 ─────────────────────────────────────────

export function encodeEventRecord(record: DebugEventRecord, encode: MsgpackEncode): Uint8Array {
  return encodeFrame(TAG_EVENT_RECORD, record, encode);
}

export function encodeCommand(cmd: DebugCommand, encode: MsgpackEncode): Uint8Array {
  return encodeFrame(TAG_DEBUG_COMMAND, cmd, encode);
}

export function encodeResponse(resp: DebugResponse, encode: MsgpackEncode): Uint8Array {
  return encodeFrame(TAG_DEBUG_RESPONSE, resp, encode);
}

export function encodeHeartbeat(encode: MsgpackEncode): Uint8Array {
  return encodeFrame(TAG_HEARTBEAT, { ts: Date.now() }, encode);
}
