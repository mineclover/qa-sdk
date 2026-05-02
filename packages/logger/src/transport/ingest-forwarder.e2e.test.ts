// @def.boundary observability-system-root
// @def.doc observability-system-root

/**
 * IngestForwarder 통합 테스트.
 *
 * 실제 HTTP 서버를 띄워서 createLogger → forwarder → HTTP → 수신 확인.
 * 서비스 배선과 동일한 패턴으로 동작을 검증한다.
 */
import { describe, it, expect, afterAll } from "vitest";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createLogger, type Logger } from "@qa-sdk/core";
import { createIngestForwarder, type IngestForwarder } from "./ingest-forwarder.js";

// ── 가짜 ingest 서버 ───────────────────────────────────

interface ReceivedEnvelope {
  transmission_id: string;
  source: { service_name: string };
  records: Array<{
    event_key: string;
    address_context?: Record<string, string>;
    payload: Record<string, unknown>;
  }>;
}

function createMockIngestServer(): {
  start: () => Promise<number>;
  stop: () => Promise<void>;
  envelopes: ReceivedEnvelope[];
} {
  const envelopes: ReceivedEnvelope[] = [];
  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    if (req.method === "POST" && req.url === "/v1/ingest") {
      let body = "";
      req.on("data", (chunk: Buffer) => { body += chunk.toString(); });
      req.on("end", () => {
        envelopes.push(JSON.parse(body) as ReceivedEnvelope);
        res.writeHead(202, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ accepted: true, record_count: 1 }));
      });
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  return {
    envelopes,
    start: () => new Promise<number>((resolve) => {
      server.listen(0, () => {
        const addr = server.address();
        resolve(typeof addr === "object" && addr ? addr.port : 0);
      });
    }),
    stop: () => new Promise<void>((resolve) => {
      server.close(() => resolve());
    }),
  };
}

// ── 테스트 ──────────────────────────────────────────────

describe("IngestForwarder 통합 (실제 HTTP)", () => {
  const mockServer = createMockIngestServer();
  let port: number;
  let forwarder: IngestForwarder;
  let logger: Logger;

  afterAll(async () => {
    await forwarder.shutdown();
    await mockServer.stop();
  });

  it("서비스 배선 패턴으로 forwarder 동작 확인", async () => {
    // 1. 가짜 ingest 서버 시작
    port = await mockServer.start();
    const endpoint = `http://localhost:${port}/v1/ingest`;

    // 2. 서비스 lib/logger.ts와 동일한 패턴으로 logger 생성
    forwarder = createIngestForwarder({
      endpoint,
      serviceName: "test-integration",
      batchSize: 2,
      flushIntervalMs: 0,
    });
    logger = createLogger("test-integration", {
      destinations: [{ stream: forwarder, level: "info" }],
    });

    // 3. 좌표 없는 일반 로그 → forwarder에 도달하지만 필터에서 skip
    logger.info({ userId: "u123" }, "일반 로그");
    logger.warn("경고 로그");

    // 4. 좌표 있는 로그 2건 → batchSize=2이므로 즉시 flush
    logger.info(
      { addressContext: { service: "service:v1:42" }, action: "start" },
      "서비스 시작",
    );
    logger.warn(
      { addressContext: { permission: "permission:v1:7" }, userId: "u1" },
      "권한 부족",
    );

    // 5. flush 완료 대기
    await new Promise((r) => setTimeout(r, 500));

    // 6. 검증: 가짜 서버에 envelope 1개 도착
    expect(mockServer.envelopes.length).toBe(1);

    const env = mockServer.envelopes[0];

    // envelope 메타데이터
    expect(env.transmission_id).toMatch(/^txm_/);
    expect(env.source.service_name).toBe("test-integration");

    // record 2건 (좌표 있는 것만)
    expect(env.records.length).toBe(2);

    // 첫번째: svc_log.info, service 좌표
    expect(env.records[0].event_key).toBe("svc_log.info");
    expect(env.records[0].address_context).toEqual({ service: "service:v1:42" });
    expect(env.records[0].payload.msg).toBe("서비스 시작");
    expect(env.records[0].payload.action).toBe("start");

    // 두번째: svc_log.warn, permission 좌표
    expect(env.records[1].event_key).toBe("svc_log.warn");
    expect(env.records[1].address_context).toEqual({ permission: "permission:v1:7" });
    expect(env.records[1].payload.msg).toBe("권한 부족");
    expect(env.records[1].payload.userId).toBe("u1");

    // forwarder 통계
    const stats = forwarder.getStats();
    expect(stats.forwarded).toBe(2);
    expect(stats.filtered).toBe(2); // 좌표 없는 로그 2건
    expect(stats.dropped).toBe(0);
  });

  it("좌표 없는 로그는 ingest에 전달되지 않는다", async () => {
    const before = mockServer.envelopes.length;

    // 좌표 없는 로그만 대량 발생
    for (let i = 0; i < 10; i++) {
      logger.info({ counter: i }, `반복 ${i}`);
    }

    await new Promise((r) => setTimeout(r, 300));

    // envelope 추가 없음
    expect(mockServer.envelopes.length).toBe(before);
  });

  it("명시적 eventKey가 그대로 전달된다", async () => {
    const before = mockServer.envelopes.length;

    logger.info(
      { addressContext: { service: "service:v1:1" }, eventKey: "auth.login.success" },
      "로그인",
    );
    logger.info(
      { addressContext: { service: "service:v1:1" }, eventKey: "auth.login.fail" },
      "실패",
    );

    await new Promise((r) => setTimeout(r, 500));

    expect(mockServer.envelopes.length).toBe(before + 1);
    const env = mockServer.envelopes[mockServer.envelopes.length - 1];
    expect(env.records[0].event_key).toBe("auth.login.success");
    expect(env.records[1].event_key).toBe("auth.login.fail");
  });
});
