import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { QaMonitor, createQaMonitor } from "./monitor.js";

function setupFetch(ok = true): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn().mockResolvedValue({ ok, status: ok ? 200 : 500, statusText: ok ? "OK" : "Server Error" });
  vi.stubGlobal("navigator", { userAgent: "test-agent", sendBeacon: vi.fn().mockReturnValue(false) });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("QaMonitor", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("createQaMonitor returns a QaMonitor instance", () => {
    setupFetch();
    const monitor = createQaMonitor({ ingestUrl: "http://localhost:3100" });
    expect(monitor).toBeInstanceOf(QaMonitor);
    void monitor.shutdown();
  });

  it("getSession returns a valid session with sessionId and traceId", () => {
    setupFetch();
    const monitor = new QaMonitor({ ingestUrl: "http://localhost:3100" });
    const { sessionId, traceId } = monitor.getSession();
    expect(sessionId).toBeTruthy();
    expect(traceId).toBeTruthy();
    void monitor.shutdown();
  });

  it("getSession returns a copy — mutations do not affect internal state", () => {
    setupFetch();
    const monitor = new QaMonitor({ ingestUrl: "http://localhost:3100" });
    const s1 = monitor.getSession();
    s1.sessionId = "tampered";
    expect(monitor.getSession().sessionId).not.toBe("tampered");
    void monitor.shutdown();
  });

  it("restores existing session from sessionStorage on second init", () => {
    setupFetch();
    const m1 = new QaMonitor({ ingestUrl: "http://localhost:3100" });
    const s1 = m1.getSession();
    void m1.shutdown();

    setupFetch();
    const m2 = new QaMonitor({ ingestUrl: "http://localhost:3100" });
    expect(m2.getSession().sessionId).toBe(s1.sessionId);
    void m2.shutdown();
  });

  it("newSession returns different sessionId and traceId", () => {
    setupFetch();
    const monitor = new QaMonitor({ ingestUrl: "http://localhost:3100" });
    const old = monitor.getSession();
    const fresh = monitor.newSession();

    expect(fresh.sessionId).not.toBe(old.sessionId);
    expect(fresh.traceId).not.toBe(old.traceId);
    void monitor.shutdown();
  });

  it("getSession reflects newSession — returns updated session", () => {
    setupFetch();
    const monitor = new QaMonitor({ ingestUrl: "http://localhost:3100" });
    const fresh = monitor.newSession();
    expect(monitor.getSession().sessionId).toBe(fresh.sessionId);
    void monitor.shutdown();
  });

  it("emits session_start event when scenarioId is provided", async () => {
    const fetchMock = setupFetch();
    const monitor = new QaMonitor({
      ingestUrl: "http://localhost:3100",
      scenarioId: "checkout_v1",
    });

    await monitor.flush();

    expect(fetchMock).toHaveBeenCalled();
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.records[0].event_key).toBe("session_start");
    expect(body.records[0].payload.scenario_id).toBe("checkout_v1");

    await monitor.shutdown();
  });

  it("does NOT emit session_start when scenarioId is omitted", async () => {
    const fetchMock = setupFetch();
    const monitor = new QaMonitor({ ingestUrl: "http://localhost:3100" });

    await monitor.flush();

    // flush with empty buffer → no fetch call
    expect(fetchMock).not.toHaveBeenCalled();
    await monitor.shutdown();
  });

  it("emit sends event on next flush", async () => {
    const fetchMock = setupFetch();
    const monitor = new QaMonitor({ ingestUrl: "http://localhost:3100" });

    monitor.emit("click", { target: "btn_buy" });
    await monitor.flush();

    expect(fetchMock).toHaveBeenCalledOnce();
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    const record = body.records[0] as { event_key: string; payload: Record<string, unknown> };
    expect(record.event_key).toBe("click");
    expect(record.payload.target).toBe("btn_buy");

    await monitor.shutdown();
  });

  it("shutdown resolves without error", async () => {
    setupFetch();
    const monitor = new QaMonitor({ ingestUrl: "http://localhost:3100" });
    await expect(monitor.shutdown()).resolves.toBeUndefined();
  });

  it("calling shutdown twice does not throw", async () => {
    setupFetch();
    const monitor = new QaMonitor({ ingestUrl: "http://localhost:3100" });
    await monitor.shutdown();
    await expect(monitor.shutdown()).resolves.toBeUndefined();
  });

  it("explicit flush throws when transport fails", async () => {
    setupFetch(false);
    const monitor = new QaMonitor({
      ingestUrl: "http://localhost:3100",
      scenarioId: "test",
    });

    await expect(monitor.flush()).rejects.toThrow();
    await monitor.shutdown().catch(() => {});
  });
});
