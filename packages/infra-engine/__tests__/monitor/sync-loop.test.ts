import { describe, it, expect, vi, beforeEach } from "vitest";
import { createSyncLoop, type SyncCheckResult } from "../../src/monitor/sync-loop.js";
import type { InfraProfileAdapter } from "../../src/adapters/adapter.js";
import type { MonitorTarget, SyncStatus } from "../../src/core/types.js";

function makeMonitor(overrides?: Partial<MonitorTarget>): MonitorTarget {
  return {
    serviceId: "test-svc",
    endpoint: "http://localhost:3200",
    healthPath: "/health",
    provider: "local",
    env: "dev",
    region: "local",
    namespace: "qa-dev",
    interval: 60,
    lastStatus: undefined,
    lastChecked: undefined,
    ...overrides,
  };
}

function makeMockProfile(monitors: MonitorTarget[]): InfraProfileAdapter {
  return {
    setDeployment: vi.fn(),
    getDeployment: vi.fn(),
    getAllDeployments: vi.fn().mockResolvedValue({}),
    restore: vi.fn(),
    setMonitor: vi.fn(),
    removeMonitor: vi.fn(),
    getAllMonitors: vi.fn().mockResolvedValue(monitors),
    updateMonitorStatus: vi.fn(),
    addHistory: vi.fn(),
    getHistory: vi.fn().mockResolvedValue([]),
  };
}

describe("createSyncLoop", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("모니터 대상 없으면 빈 배열 반환", async () => {
    const profile = makeMockProfile([]);
    const loop = createSyncLoop({ infraProfile: profile });
    const results = await loop.syncAll();
    expect(results).toHaveLength(0);
  });

  it("정상 응답 → Synced", async () => {
    const monitors = [makeMonitor()];
    const profile = makeMockProfile(monitors);

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, status: 200 }),
    );

    const loop = createSyncLoop({ infraProfile: profile });
    const results = await loop.syncAll();

    expect(results).toHaveLength(1);
    expect(results[0].currentStatus).toBe("Synced");
    expect(results[0].latency).toBeTypeOf("number");
    expect(profile.updateMonitorStatus).toHaveBeenCalledWith(
      "test-svc",
      "Synced",
      expect.any(String),
    );
  });

  it("500 응답 → OutOfSync", async () => {
    const monitors = [makeMonitor({ lastStatus: "Synced" })];
    const profile = makeMockProfile(monitors);

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500 }),
    );

    const loop = createSyncLoop({ infraProfile: profile });
    const results = await loop.syncAll();

    expect(results[0].currentStatus).toBe("OutOfSync");
    expect(results[0].changed).toBe(true);
  });

  it("4xx 응답 → Degraded", async () => {
    const monitors = [makeMonitor()];
    const profile = makeMockProfile(monitors);

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 404 }),
    );

    const loop = createSyncLoop({ infraProfile: profile });
    const results = await loop.syncAll();

    expect(results[0].currentStatus).toBe("Degraded");
  });

  it("네트워크 에러 → Unknown", async () => {
    const monitors = [makeMonitor()];
    const profile = makeMockProfile(monitors);

    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("ECONNREFUSED")),
    );

    const loop = createSyncLoop({ infraProfile: profile });
    const results = await loop.syncAll();

    expect(results[0].currentStatus).toBe("Unknown");
    expect(results[0].detail).toContain("ECONNREFUSED");
  });

  it("상태 변경 시 onStatusChange 콜백 호출", async () => {
    const monitors = [makeMonitor({ lastStatus: "Synced" })];
    const profile = makeMockProfile(monitors);
    const onStatusChange = vi.fn();

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500 }),
    );

    const loop = createSyncLoop({ infraProfile: profile, onStatusChange });
    await loop.syncAll();

    expect(onStatusChange).toHaveBeenCalledWith("test-svc", "Synced", "OutOfSync");
  });

  it("상태 미변경 시 콜백 미호출", async () => {
    const monitors = [makeMonitor({ lastStatus: "Synced" })];
    const profile = makeMockProfile(monitors);
    const onStatusChange = vi.fn();

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, status: 200 }),
    );

    const loop = createSyncLoop({ infraProfile: profile, onStatusChange });
    await loop.syncAll();

    expect(onStatusChange).not.toHaveBeenCalled();
  });

  it("start/stop/isRunning", () => {
    const profile = makeMockProfile([]);
    const loop = createSyncLoop({ infraProfile: profile, interval: 1 });

    expect(loop.isRunning()).toBe(false);
    loop.start();
    expect(loop.isRunning()).toBe(true);
    loop.stop();
    expect(loop.isRunning()).toBe(false);
  });

  it("여러 모니터 동시 체크", async () => {
    const monitors = [
      makeMonitor({ serviceId: "svc-a" }),
      makeMonitor({ serviceId: "svc-b" }),
      makeMonitor({ serviceId: "svc-c" }),
    ];
    const profile = makeMockProfile(monitors);

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, status: 200 }),
    );

    const loop = createSyncLoop({ infraProfile: profile });
    const results = await loop.syncAll();

    expect(results).toHaveLength(3);
    expect(results.map((r) => r.serviceId)).toEqual(["svc-a", "svc-b", "svc-c"]);
  });
});
