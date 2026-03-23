/**
 * gRPC Debug Server — proto/debug.proto 기반.
 *
 * 포트: 50051 (GRPC_PORT 환경변수)
 * 서비스: DebugService
 *   - StreamEvents: 양방향 스트리밍
 *   - GetActiveTraces: 단방향
 *   - ResolveAddr: 단방향
 *   - Subscribe: 서버 스트리밍
 */
import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { RecordStreamBroker } from "../lib/record-stream-broker.js";
import type { TraceStore } from "@qa-sdk/core";
import type { Logger } from "pino";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROTO_PATH = resolve(__dirname, "../../../../proto/debug.proto");

export interface GrpcDebugServerDeps {
  recordStreamBroker: RecordStreamBroker;
  traceStore?: TraceStore;
  logger?: Logger;
  port?: number;
}

/** gRPC Debug 서버 시작 */
export async function startGrpcDebugServer(deps: GrpcDebugServerDeps): Promise<grpc.Server> {
  const port = deps.port ?? 50051;

  const packageDef = protoLoader.loadSync(PROTO_PATH, {
    keepCase: false,
    longs: Number,
    enums: String,
    defaults: true,
    oneofs: true,
  });

  const proto = grpc.loadPackageDefinition(packageDef) as any;
  const server = new grpc.Server();

  server.addService(proto.qa.debug.DebugService.service, {
    // ── 양방향 스트리밍 ──
    streamEvents(call: any) {
      const unsubscribers: (() => void)[] = [];

      // 기본 구독
      const unsub = deps.recordStreamBroker.subscribeToScenario("*", (record: any) => {
        try {
          call.write(toGrpcEvent(record));
        } catch { /* stream closed */ }
      });
      unsubscribers.push(unsub);

      call.on("data", (cmd: any) => {
        deps.logger?.debug({ cmd }, "grpc: client command");
        // 명령 처리 (filter 등)
      });

      call.on("end", () => {
        for (const u of unsubscribers) u();
        call.end();
      });

      call.on("error", () => {
        for (const u of unsubscribers) u();
      });
    },

    // ── 활성 trace 조회 ──
    async getActiveTraces(call: any, callback: any) {
      try {
        if (!deps.traceStore) {
          return callback(null, { traces: [] });
        }
        const limit = call.request.limit || 50;
        const traces = await deps.traceStore.findUnreconstructed(limit);
        callback(null, {
          traces: traces.map(t => ({
            traceId: t.traceId,
            sessionId: t.sessionId ?? "",
            serviceName: t.serviceName ?? "",
            recordCount: t.recordCount,
            firstTimestampMs: t.firstTimestamp?.getTime() ?? 0,
            lastTimestampMs: t.lastTimestamp?.getTime() ?? 0,
          })),
        });
      } catch (err) {
        callback({ code: grpc.status.INTERNAL, message: String(err) });
      }
    },

    // ── 주소 resolve ──
    async resolveAddr(call: any, callback: any) {
      // 기본 구현: decode-service로 위임 (또는 로컬 catalog)
      callback(null, {
        prefix: call.request.prefix,
        version: call.request.version,
        address: call.request.address,
        dims: {},
      });
    },

    // ── 서버 스트리밍 구독 ──
    subscribe(call: any) {
      const filter = call.request.filter || {};
      deps.logger?.info({ filter }, "grpc: subscribe");

      const unsub = deps.recordStreamBroker.subscribeToScenario("*", (record: any) => {
        const evt = toGrpcEvent(record);

        // 필터 적용
        if (filter.eventKeys?.length && !filter.eventKeys.includes(evt.eventKey)) return;
        if (filter.serviceIds?.length && evt.serviceName && !filter.serviceIds.includes(evt.serviceName)) return;
        if (filter.traceId && evt.traceId !== filter.traceId) return;

        try { call.write(evt); } catch { /* closed */ }
      });

      call.on("cancelled", () => unsub());
      call.on("error", () => unsub());
    },
  });

  return new Promise((resolve, reject) => {
    server.bindAsync(`0.0.0.0:${port}`, grpc.ServerCredentials.createInsecure(), (err) => {
      if (err) return reject(err);
      deps.logger?.info({ port }, "gRPC debug server listening");
      resolve(server);
    });
  });
}

/** 레코드 → gRPC EventRecord 변환 */
function toGrpcEvent(record: any) {
  return {
    logId: record.logId ?? record.log_id ?? "",
    traceId: record.traceId ?? record.trace_id ?? "",
    spanId: record.spanId ?? record.span_id ?? "",
    parentSpanId: record.parentSpanId ?? record.parent_span_id ?? "",
    timestampMs: record.timestamp instanceof Date ? record.timestamp.getTime() : Date.now(),
    recordKind: record.recordKind ?? record.record_kind ?? "log",
    eventKey: record.eventKey ?? record.event_key ?? "",
    eventVersion: record.eventVersion ?? record.event_version ?? "",
    addressContext: record.addressContext ?? record.address_context ?? {},
    serviceName: record.serviceName ?? record.service_name ?? "",
    qaSessionId: record.qaSessionId ?? record.qa_session_id ?? "",
    payloadJson: record.payload ? JSON.stringify(record.payload) : "",
  };
}
