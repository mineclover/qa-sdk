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
import type { StoredRecord, TraceStore } from "@qa-sdk/core";
import type { Logger } from "pino";

/** gRPC 프로토 정의에서 동적 로드된 서비스 구조 */
interface GrpcProto {
  qa: {
    debug: {
      DebugService: {
        service: grpc.ServiceDefinition;
      };
    };
  };
}

/** StreamEvents / Subscribe 핸들러 명령 메시지 */
interface GrpcStreamCommand {
  filter?: {
    eventKeys?: string[];
    serviceIds?: string[];
    traceId?: string;
  };
}

/** GetActiveTraces 요청 메시지 */
interface GetActiveTracesRequest {
  limit?: number;
}

/** ResolveAddr 요청 메시지 */
interface ResolveAddrRequest {
  prefix: string;
  version: string;
  address: string;
}

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

  const proto = grpc.loadPackageDefinition(packageDef) as unknown as GrpcProto;
  const server = new grpc.Server();

  server.addService(proto.qa.debug.DebugService.service, {
    // ── 양방향 스트리밍 ──
    streamEvents(call: grpc.ServerDuplexStream<GrpcStreamCommand, unknown>) {
      const unsubscribers: (() => void)[] = [];

      // 기본 구독
      const unsub = deps.recordStreamBroker.subscribeToScenario("*", (record: StoredRecord) => {
        try {
          call.write(toGrpcEvent(record));
        } catch { /* stream closed */ }
      });
      unsubscribers.push(unsub);

      call.on("data", (cmd: GrpcStreamCommand) => {
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
    async getActiveTraces(call: grpc.ServerUnaryCall<GetActiveTracesRequest, unknown>, callback: grpc.sendUnaryData<unknown>) {
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
    async resolveAddr(call: grpc.ServerUnaryCall<ResolveAddrRequest, unknown>, callback: grpc.sendUnaryData<unknown>) {
      // 기본 구현: decode-service로 위임 (또는 로컬 catalog)
      callback(null, {
        prefix: call.request.prefix,
        version: call.request.version,
        address: call.request.address,
        dims: {},
      });
    },

    // ── 서버 스트리밍 구독 ──
    subscribe(call: grpc.ServerWritableStream<GrpcStreamCommand, unknown>) {
      const filter = call.request.filter || {};
      deps.logger?.info({ filter }, "grpc: subscribe");

      const unsub = deps.recordStreamBroker.subscribeToScenario("*", (record: StoredRecord) => {
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

  return new Promise((res, reject) => {
    server.bindAsync(`0.0.0.0:${port}`, grpc.ServerCredentials.createInsecure(), (err) => {
      if (err) return reject(err);
      deps.logger?.info({ port }, "gRPC debug server listening");
      res(server);
    });
  });
}

/** 레코드 → gRPC EventRecord 변환 */
function toGrpcEvent(record: StoredRecord) {
  return {
    logId: record.logId ?? "",
    traceId: record.traceId ?? "",
    spanId: record.spanId ?? "",
    parentSpanId: record.parentSpanId ?? "",
    timestampMs: record.timestamp instanceof Date ? record.timestamp.getTime() : Date.now(),
    recordKind: record.recordKind ?? "log",
    eventKey: record.eventKey ?? "",
    eventVersion: record.eventVersion ?? "",
    addressContext: record.addressContext ?? {},
    serviceName: "",
    qaSessionId: record.qaSessionId ?? "",
    payloadJson: record.payload ? JSON.stringify(record.payload) : "",
  };
}
