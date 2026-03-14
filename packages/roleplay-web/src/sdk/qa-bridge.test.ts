import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createQaBridge } from "./qa-bridge.js";

function setupFetch(ok = true): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 500,
    statusText: ok ? "OK" : "Internal Server Error",
  });
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("navigator", { userAgent: "vitest/1.0" });
  return fetchMock;
}

function parseSentRecords(fetchMock: ReturnType<typeof vi.fn>, callIndex = 0) {
  const body = JSON.parse((fetchMock.mock.calls[callIndex][1] as RequestInit).body as string);
  return body.records as Array<Record<string, unknown>>;
}

describe("QaBridge — startSession", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

  it("새 traceId와 sessionId를 반환한다", () => {
    setupFetch();
    const bridge = createQaBridge({ ingestUrl: "http://test" });
    const { traceId, sessionId } = bridge.startSession();

    expect(typeof traceId).toBe("string");
    expect(traceId.length).toBeGreaterThan(0);
    expect(typeof sessionId).toBe("string");
    expect(sessionId.length).toBeGreaterThan(0);
    void bridge.shutdown();
  });

  it("existingSessionId를 전달하면 그 값이 sessionId로 사용된다", () => {
    setupFetch();
    const bridge = createQaBridge({ ingestUrl: "http://test" });
    const { sessionId } = bridge.startSession(undefined, "ses_provided");

    expect(sessionId).toBe("ses_provided");
    void bridge.shutdown();
  });

  it("scenarioId 제공 시 session_start 이벤트가 전송된다", async () => {
    const fetchMock = setupFetch();
    const bridge = createQaBridge({ ingestUrl: "http://test" });
    bridge.startSession("checkout_v1");
    await bridge.flush();

    const records = parseSentRecords(fetchMock);
    const sessionStart = records.find(r => r.event_key === "session_start");
    expect(sessionStart).toBeDefined();
    expect(sessionStart?.payload).toMatchObject({ scenario_id: "checkout_v1" });
  });

  it("scenarioId 미제공 시 session_start 이벤트가 전송되지 않는다", async () => {
    const fetchMock = setupFetch();
    const bridge = createQaBridge({ ingestUrl: "http://test" });
    bridge.startSession();
    bridge.emitEvent("page_view", { page: "/" });
    await bridge.flush();

    const records = parseSentRecords(fetchMock);
    const sessionStart = records.find(r => r.event_key === "session_start");
    expect(sessionStart).toBeUndefined();
  });
});

describe("QaBridge — emitEvent", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

  it("알려진 이벤트 키는 event-catalog의 버전을 3자리로 패딩해 사용한다", async () => {
    const fetchMock = setupFetch();
    const bridge = createQaBridge({ ingestUrl: "http://test" });
    bridge.startSession();
    bridge.emitEvent("click", { element_id: "btn" });
    await bridge.flush();

    const records = parseSentRecords(fetchMock);
    const clickRecord = records.find(r => r.event_key === "click");
    expect(clickRecord?.event_version).toBe("001");
  });

  it("미등록 이벤트 키는 '001'로 fallback된다", async () => {
    const fetchMock = setupFetch();
    const bridge = createQaBridge({ ingestUrl: "http://test" });
    bridge.startSession();
    bridge.emitEvent("completely_unknown_event_xyz");
    await bridge.flush();

    const records = parseSentRecords(fetchMock);
    const record = records.find(r => r.event_key === "completely_unknown_event_xyz");
    expect(record?.event_version).toBe("001");
  });

  it("emit한 이벤트가 올바른 엔드포인트로 전송된다", async () => {
    const fetchMock = setupFetch();
    const bridge = createQaBridge({ ingestUrl: "http://ingest-server:3100" });
    bridge.startSession();
    bridge.emitEvent("page_view", { page: "/home" });
    await bridge.flush();

    expect(fetchMock.mock.calls[0][0]).toBe("http://ingest-server:3100/v1/ingest");
  });

  it("startSession으로 설정된 sessionId가 각 레코드의 qa_session_id에 포함된다", async () => {
    const fetchMock = setupFetch();
    const bridge = createQaBridge({ ingestUrl: "http://test" });
    const { sessionId } = bridge.startSession();
    bridge.emitEvent("click");
    await bridge.flush();

    const records = parseSentRecords(fetchMock);
    const clickRecord = records.find(r => r.event_key === "click");
    expect(clickRecord?.qa_session_id).toBe(sessionId);
  });
});

describe("QaBridge — flush & shutdown", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

  it("flush()는 버퍼의 이벤트를 즉시 전송한다", async () => {
    const fetchMock = setupFetch();
    const bridge = createQaBridge({ ingestUrl: "http://test" });
    bridge.startSession();
    bridge.emitEvent("page_view", { page: "/" });
    bridge.emitEvent("click");

    expect(fetchMock).not.toHaveBeenCalled();
    await bridge.flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("shutdown()은 남은 이벤트를 전송하고 완료한다", async () => {
    const fetchMock = setupFetch();
    const bridge = createQaBridge({ ingestUrl: "http://test" });
    bridge.startSession();
    bridge.emitEvent("session_end");

    await bridge.shutdown();

    expect(fetchMock).toHaveBeenCalled();
  });

  it("onError 콜백은 자동 flush 실패 시 호출된다", async () => {
    setupFetch(false);
    const onError = vi.fn();
    const bridge = createQaBridge({ ingestUrl: "http://test", onError });
    bridge.startSession();
    bridge.emitEvent("click");

    await vi.advanceTimersByTimeAsync(3_000);

    expect(onError).toHaveBeenCalled();
  });
});
