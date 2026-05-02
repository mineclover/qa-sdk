// @def.boundary ingest-system
// @def.doc ingest-system

/**
 * /v1/debug-ws — 개발환경 실시간 디버깅 WebSocket.
 *
 * 바이너리 프레임: tag(1) + msgpack payload
 * - 클라이언트 → 서버: DebugCommand (subscribe, filter, resolve 등)
 * - 서버 → 클라이언트: EventRecord 스트림 + DebugResponse
 *
 * JSON fallback: 클라이언트가 텍스트 메시지를 보내면 JSON으로 처리.
 */
import type { Context } from "hono";
import type { WSContext, WSEvents } from "hono/ws";
import { encode as msgpackEncode, decode as msgpackDecode } from "@msgpack/msgpack";
import type { RecordStreamBroker } from "../lib/record-stream-broker.js";
import {
  TAG_EVENT_RECORD, TAG_DEBUG_COMMAND, TAG_HEARTBEAT,
  encodeFrame, decodeFrame, encodeResponse,
  type TraceStore, type RecordStore, type StoredRecord, type MsgpackDecode,
  type DebugCommand, type DebugEventRecord, type StreamFilter, type DebugResponse,
} from "@qa-sdk/core";
import type { Logger } from "pino";

export interface DebugWsDeps {
  recordStreamBroker: RecordStreamBroker;
  traceStore?: TraceStore;
  recordStore?: RecordStore;
  logger?: Logger;
}

export function createDebugWsHandler(deps: DebugWsDeps): (c: Context) => WSEvents {
  return (_c: Context): WSEvents => {
    let currentFilter: StreamFilter = { decodeAddresses: true };
    let unsubscribe: (() => void) | null = null;
    let heartbeatInterval: ReturnType<typeof setInterval> | null = null;

    function sendBinary(ws: WSContext, data: Uint8Array) {
      try { ws.send(new Uint8Array(data)); } catch { /* connection closed */ }
    }

    function sendResponse(ws: WSContext, resp: DebugResponse) {
      sendBinary(ws, encodeResponse(resp, msgpackEncode));
    }

    function sendJson(ws: WSContext, data: unknown) {
      try { ws.send(JSON.stringify(data)); } catch { /* */ }
    }

    /** RecordStreamBroker의 레코드를 DebugEventRecord로 변환 */
    function toDebugRecord(record: StoredRecord): DebugEventRecord {
      return {
        logId: record.logId ?? "",
        traceId: record.traceId ?? "",
        spanId: record.spanId ?? "",
        parentSpanId: record.parentSpanId,
        timestampMs: record.timestamp instanceof Date
          ? record.timestamp.getTime()
          : new Date(record.timestamp ?? Date.now()).getTime(),
        recordKind: (record.recordKind ?? "log") as DebugEventRecord["recordKind"],
        eventKey: record.eventKey ?? "",
        eventVersion: record.eventVersion ?? "",
        addressContext: record.addressContext,
        serviceName: undefined,
        qaSessionId: record.qaSessionId,
        actorId: record.actorId,
        payloadJson: record.payload ? JSON.stringify(record.payload) : undefined,
        metricName: record.metricName,
        metricValue: record.metricValue,
        metricUnit: record.metricUnit,
      };
    }

    /** 필터 매칭 */
    function matchesFilter(record: DebugEventRecord, filter: StreamFilter): boolean {
      if (filter.eventKeys?.length && !filter.eventKeys.includes(record.eventKey)) return false;
      if (filter.serviceIds?.length && record.serviceName && !filter.serviceIds.includes(record.serviceName)) return false;
      if (filter.traceId && record.traceId !== filter.traceId) return false;
      if (filter.sessionId && record.qaSessionId !== filter.sessionId) return false;
      if (filter.prefixIds?.length && record.addressContext) {
        const prefixes = Object.keys(record.addressContext);
        const filterPrefixIds = filter.prefixIds;
        if (!prefixes.some(p => filterPrefixIds.includes(p))) return false;
      }
      return true;
    }

    /** 스트림 구독 시작 */
    function startSubscription(ws: WSContext, filter: StreamFilter) {
      stopSubscription();
      currentFilter = filter;

      unsubscribe = deps.recordStreamBroker.subscribeToScenario("*", (record: StoredRecord) => {
        const debugRecord = toDebugRecord(record);
        if (!matchesFilter(debugRecord, currentFilter)) return;

        // 바이너리 프레임으로 전송
        const frame = encodeFrame(TAG_EVENT_RECORD, debugRecord, msgpackEncode);
        sendBinary(ws, frame);
      });
    }

    function stopSubscription() {
      if (unsubscribe) { unsubscribe(); unsubscribe = null; }
    }

    /** 명령 처리 */
    async function handleCommand(ws: WSContext, cmd: DebugCommand) {
      switch (cmd.type) {
        case "subscribe": {
          startSubscription(ws, cmd.filter);
          sendResponse(ws, {
            type: "subscribe-ack",
            subscriptionId: `debug-${Date.now()}`,
            filter: cmd.filter,
          });
          break;
        }
        case "unsubscribe": {
          stopSubscription();
          sendResponse(ws, { type: "subscribe-ack", subscriptionId: "", filter: {} });
          break;
        }
        case "set-filter": {
          currentFilter = cmd.filter;
          sendResponse(ws, {
            type: "subscribe-ack",
            subscriptionId: `debug-${Date.now()}`,
            filter: cmd.filter,
          });
          break;
        }
        case "get-active-traces": {
          if (deps.traceStore) {
            const traces = await deps.traceStore.findUnreconstructed(50);
            sendResponse(ws, {
              type: "active-traces",
              traces: traces.map(t => ({
                traceId: t.traceId,
                sessionId: t.sessionId ?? undefined,
                serviceName: t.serviceName ?? undefined,
                recordCount: t.recordCount,
                firstTimestampMs: t.firstTimestamp?.getTime(),
                lastTimestampMs: t.lastTimestamp?.getTime(),
              })),
            });
          } else {
            sendResponse(ws, { type: "active-traces", traces: [] });
          }
          break;
        }
        case "ping": {
          sendResponse(ws, {
            type: "pong",
            timestampMs: cmd.timestampMs,
            serverTimestampMs: Date.now(),
          });
          break;
        }
        default:
          sendResponse(ws, { type: "error", code: "UNKNOWN_COMMAND", message: `Unknown command: ${(cmd as unknown as Record<string, unknown>).type}` });
      }
    }

    return {
      onOpen(_evt: Event, ws: WSContext) {
        deps.logger?.info("debug-ws client connected");

        // 기본 구독 시작 (필터 없음 = 전체 스트림)
        startSubscription(ws, { decodeAddresses: true });

        // Heartbeat 10초
        heartbeatInterval = setInterval(() => {
          sendBinary(ws, encodeFrame(TAG_HEARTBEAT, { ts: Date.now() }, msgpackEncode));
        }, 10_000);
      },

      async onMessage(evt: MessageEvent, ws: WSContext) {
        // 바이너리 프레임
        if (evt.data instanceof ArrayBuffer || evt.data instanceof Uint8Array) {
          try {
            const bytes = evt.data instanceof ArrayBuffer ? new Uint8Array(evt.data) : evt.data;
            const { tag, payload } = decodeFrame(bytes, msgpackDecode as MsgpackDecode);
            if (tag === TAG_DEBUG_COMMAND) {
              await handleCommand(ws, payload as DebugCommand);
            } else if (tag === TAG_HEARTBEAT) {
              // pong
              sendBinary(ws, encodeFrame(TAG_HEARTBEAT, { ts: Date.now() }, msgpackEncode));
            }
          } catch (e) {
            sendResponse(ws, { type: "error", code: "DECODE_ERROR", message: String(e) });
          }
          return;
        }

        // JSON fallback (텍스트 메시지)
        try {
          const cmd = JSON.parse(typeof evt.data === "string" ? evt.data : String(evt.data)) as DebugCommand;
          await handleCommand(ws, cmd);
        } catch {
          sendJson(ws, { type: "error", code: "INVALID_MESSAGE", message: "Expected binary frame or JSON" });
        }
      },

      onClose() {
        deps.logger?.info("debug-ws client disconnected");
        stopSubscription();
        if (heartbeatInterval) { clearInterval(heartbeatInterval); heartbeatInterval = null; }
      },

      onError(evt: Event) {
        deps.logger?.warn({ error: evt }, "debug-ws error");
        stopSubscription();
        if (heartbeatInterval) { clearInterval(heartbeatInterval); heartbeatInterval = null; }
      },
    };
  };
}
