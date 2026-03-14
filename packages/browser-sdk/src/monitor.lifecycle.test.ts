/**
 * QaMonitor 생명주기 상태 전환 테스트
 *
 * ACTIVE ──shutdown()──→ STOPPED
 *        ──newSession()─→ ACTIVE (세션 교체)
 * STOPPED ──emit()──────→ STOPPED (warn + drop)
 *         ──shutdown()──→ STOPPED (no-op)
 *         ──newSession()→ STOPPED (warn + drop)
 *         ──flush()─────→ STOPPED (no-op)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { QaMonitor } from "./monitor.js";

function setupFetch(ok = true): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn().mockResolvedValue({ ok, status: ok ? 200 : 500, statusText: ok ? "OK" : "Error" });
  vi.stubGlobal("navigator", { userAgent: "vitest/1.0", sendBeacon: vi.fn().mockReturnValue(false) });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("생명주기 상태 — 초기값", () => {
  beforeEach(() => { sessionStorage.clear(); vi.useFakeTimers(); });
  afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

  it("생성 직후 status는 'active'", () => {
    setupFetch();
    const m = new QaMonitor({ ingestUrl: "http://localhost:3100" });
    expect(m.status).toBe("active");
    expect(m.isActive).toBe(true);
    void m.shutdown();
  });
});

describe("생명주기 상태 — ACTIVE → STOPPED", () => {
  beforeEach(() => { sessionStorage.clear(); vi.useFakeTimers(); });
  afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

  it("shutdown() 후 status가 'stopped'로 전환된다", async () => {
    setupFetch();
    const m = new QaMonitor({ ingestUrl: "http://localhost:3100" });
    await m.shutdown();

    expect(m.status).toBe("stopped");
    expect(m.isActive).toBe(false);
  });

  it("shutdown()은 멱등 — 두 번 호출해도 에러 없음", async () => {
    setupFetch();
    const m = new QaMonitor({ ingestUrl: "http://localhost:3100" });
    await m.shutdown();
    await expect(m.shutdown()).resolves.toBeUndefined();
    expect(m.status).toBe("stopped");
  });

  it("두 번째 shutdown()은 QaLogger.shutdown()을 재호출하지 않는다", async () => {
    const fetchMock = setupFetch();
    const m = new QaMonitor({ ingestUrl: "http://localhost:3100", scenarioId: "s1" });
    await m.flush();         // session_start 전송
    const callsAfterFirstFlush = fetchMock.mock.calls.length;

    await m.shutdown();      // 내부 flush (빈 버퍼 → no HTTP)
    await m.shutdown();      // 두 번째 — no-op

    // HTTP 호출 횟수 변화 없어야 함
    expect(fetchMock.mock.calls.length).toBe(callsAfterFirstFlush);
  });
});

describe("생명주기 상태 — STOPPED: emit 차단", () => {
  beforeEach(() => { sessionStorage.clear(); vi.useFakeTimers(); });
  afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

  it("shutdown 후 emit()은 이벤트를 버퍼에 추가하지 않는다", async () => {
    const fetchMock = setupFetch();
    const m = new QaMonitor({ ingestUrl: "http://localhost:3100" });
    await m.shutdown();

    m.emit("click", { id: "btn" });

    // flush는 no-op이므로 http 호출 없어야 함
    await m.flush();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shutdown 후 emit()은 console.warn을 출력한다", async () => {
    setupFetch();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const m = new QaMonitor({ ingestUrl: "http://localhost:3100" });
    await m.shutdown();

    m.emit("click");

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("click"));
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("shutdown"));
  });
});

describe("생명주기 상태 — STOPPED: flush no-op", () => {
  beforeEach(() => { sessionStorage.clear(); vi.useFakeTimers(); });
  afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

  it("shutdown 후 flush()는 HTTP 호출 없이 즉시 반환된다", async () => {
    const fetchMock = setupFetch();
    const m = new QaMonitor({ ingestUrl: "http://localhost:3100" });
    await m.shutdown();

    fetchMock.mockClear();
    await m.flush();

    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("생명주기 상태 — STOPPED: newSession 차단", () => {
  beforeEach(() => { sessionStorage.clear(); vi.useFakeTimers(); });
  afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

  it("shutdown 후 newSession()은 기존 세션을 반환하고 변경하지 않는다", async () => {
    setupFetch();
    const m = new QaMonitor({ ingestUrl: "http://localhost:3100" });
    const before = m.getSession();
    await m.shutdown();

    const result = m.newSession();

    expect(result.sessionId).toBe(before.sessionId);
    expect(m.getSession().sessionId).toBe(before.sessionId);
  });

  it("shutdown 후 newSession()은 console.warn을 출력한다", async () => {
    setupFetch();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const m = new QaMonitor({ ingestUrl: "http://localhost:3100" });
    await m.shutdown();

    m.newSession();

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("newSession"));
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("shutdown"));
  });

  it("shutdown 후 newSession()은 sessionStorage를 변경하지 않는다", async () => {
    setupFetch();
    const m = new QaMonitor({ ingestUrl: "http://localhost:3100" });
    const storageBefore = sessionStorage.getItem("qa_monitor");
    await m.shutdown();

    m.newSession();

    expect(sessionStorage.getItem("qa_monitor")).toBe(storageBefore);
  });
});

describe("생명주기 상태 — ACTIVE: newSession 정상 전환", () => {
  beforeEach(() => { sessionStorage.clear(); vi.useFakeTimers(); });
  afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

  it("newSession()은 상태를 'active'로 유지한다", () => {
    setupFetch();
    const m = new QaMonitor({ ingestUrl: "http://localhost:3100" });
    m.newSession();

    expect(m.status).toBe("active");
    expect(m.isActive).toBe(true);
    void m.shutdown();
  });

  it("newSession() 후에도 emit이 정상 동작한다", async () => {
    const fetchMock = setupFetch();
    const m = new QaMonitor({ ingestUrl: "http://localhost:3100" });
    const fresh = m.newSession();

    m.emit("click", { after: "newSession" });
    await m.flush();
    await m.shutdown();

    expect(fetchMock).toHaveBeenCalled();
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.records[0].qa_session_id).toBe(fresh.sessionId);
    expect(body.records[0].trace_id).toBe(fresh.traceId);
  });
});

describe("생명주기 — autoCapture 연동", () => {
  beforeEach(() => { sessionStorage.clear(); vi.useFakeTimers(); document.body.innerHTML = ""; });
  afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

  it("shutdown 후 autoCapture가 emit을 차단하므로 warn이 발생하지 않는다", async () => {
    setupFetch();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const m = new QaMonitor({ ingestUrl: "http://localhost:3100", autoCapture: { clicks: true } });
    await m.shutdown();

    // autoCapture 리스너가 제거되어 있으므로 클릭이 emit을 시도하지 않음
    const btn = document.createElement("button");
    document.body.appendChild(btn);
    btn.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(warnSpy).not.toHaveBeenCalled();
  });
});
