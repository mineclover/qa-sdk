import { describe, it, expect, vi } from "vitest";
import { createDashboardData } from "../../src/monitor/dashboard.js";
import type { InfraProfileAdapter } from "../../src/adapters/adapter.js";
import type { DeployHistoryEntry, InfraDeploymentEntry, MonitorTarget } from "../../src/core/types.js";

function makeMockProfile(opts: {
  deployments?: Record<string, InfraDeploymentEntry>;
  monitors?: MonitorTarget[];
  history?: Record<string, DeployHistoryEntry[]>;
}): InfraProfileAdapter {
  const deployments = opts.deployments ?? {};
  const monitors = opts.monitors ?? [];
  const history = opts.history ?? {};

  return {
    setDeployment: vi.fn(),
    getDeployment: vi.fn().mockImplementation(async (id: string) => deployments[id] ?? null),
    getAllDeployments: vi.fn().mockResolvedValue(deployments),
    restore: vi.fn(),
    setMonitor: vi.fn(),
    removeMonitor: vi.fn(),
    getAllMonitors: vi.fn().mockResolvedValue(monitors),
    updateMonitorStatus: vi.fn(),
    addHistory: vi.fn(),
    getHistory: vi.fn().mockImplementation(async (id: string) => history[id] ?? []),
  };
}

describe("createDashboardData", () => {
  it("빈 프로필 → 0건 요약", async () => {
    const profile = makeMockProfile({});
    const dashboard = createDashboardData(profile);
    const summary = await dashboard.getSummary();

    expect(summary.totalServices).toBe(0);
    expect(summary.deployed).toBe(0);
    expect(summary.monitored).toBe(0);
    expect(summary.byStatus.Synced).toBe(0);
  });

  it("배포+모니터 있으면 카운트 반영", async () => {
    const deployments: Record<string, InfraDeploymentEntry> = {
      "svc-a": {
        serviceId: "svc-a",
        provider: "local",
        env: "dev",
        region: "local",
        endpoint: "http://localhost:3200",
        healthPath: "/health",
        stackName: "qa-dev-svc-a",
        deploymentVersion: "v1",
        deployedAt: "2026-04-01T00:00:00Z",
        triggeredBy: "manual",
        metadata: {},
      },
      "svc-b": {
        serviceId: "svc-b",
        provider: "cloudflare",
        env: "prod",
        region: "us-east",
        endpoint: "https://svc-b.example.com",
        healthPath: "/health",
        stackName: "qa-prod-svc-b",
        deploymentVersion: "v2",
        deployedAt: "2026-04-02T00:00:00Z",
        triggeredBy: "ci",
        metadata: {},
      },
    };

    const monitors: MonitorTarget[] = [
      {
        serviceId: "svc-a",
        endpoint: "http://localhost:3200",
        healthPath: "/health",
        provider: "local",
        env: "dev",
        region: "local",
        namespace: "qa-dev",
        interval: 60,
        lastStatus: "Synced",
        lastChecked: "2026-04-05T00:00:00Z",
      },
      {
        serviceId: "svc-b",
        endpoint: "https://svc-b.example.com",
        healthPath: "/health",
        provider: "cloudflare",
        env: "prod",
        region: "us-east",
        namespace: "default",
        interval: 30,
        lastStatus: "OutOfSync",
        lastChecked: "2026-04-05T00:00:00Z",
      },
    ];

    const profile = makeMockProfile({ deployments, monitors });
    const dashboard = createDashboardData(profile);
    const summary = await dashboard.getSummary();

    expect(summary.totalServices).toBe(2);
    expect(summary.deployed).toBe(2);
    expect(summary.monitored).toBe(2);
    expect(summary.byStatus.Synced).toBe(1);
    expect(summary.byStatus.OutOfSync).toBe(1);
    expect(summary.byProvider.local).toBe(1);
    expect(summary.byProvider.cloudflare).toBe(1);
    expect(summary.byEnv.dev).toBe(1);
    expect(summary.byEnv.prod).toBe(1);
  });

  it("getServiceDashboard — 배포 있는 서비스", async () => {
    const deployments: Record<string, InfraDeploymentEntry> = {
      "svc-a": {
        serviceId: "svc-a",
        provider: "local",
        env: "dev",
        region: "local",
        endpoint: "http://localhost:3200",
        healthPath: "/health",
        stackName: "qa-dev-svc-a",
        deploymentVersion: "v1",
        deployedAt: "2026-04-01T00:00:00Z",
        triggeredBy: "manual",
        metadata: {},
      },
    };
    const history: Record<string, DeployHistoryEntry[]> = {
      "svc-a": [
        {
          deployedAt: "2026-04-01T00:00:00Z",
          version: "v1",
          env: "dev",
          provider: "local",
          endpoint: "http://localhost:3200",
          duration: 5000,
          success: true,
          triggeredBy: "manual",
        },
      ],
    };

    const profile = makeMockProfile({ deployments, history });
    const dashboard = createDashboardData(profile);
    const svc = await dashboard.getServiceDashboard("svc-a");

    expect(svc.serviceId).toBe("svc-a");
    expect(svc.deployment).toBeDefined();
    expect(svc.deployment!.provider).toBe("local");
    expect(svc.history).toHaveLength(1);
    expect(svc.uptime).toBeDefined();
    expect(svc.uptime!.percentage).toBeGreaterThanOrEqual(0);
  });

  it("getServiceDashboard — 미배포 서비스", async () => {
    const profile = makeMockProfile({});
    const dashboard = createDashboardData(profile);
    const svc = await dashboard.getServiceDashboard("nonexistent");

    expect(svc.deployment).toBeUndefined();
    expect(svc.monitor).toBeUndefined();
    expect(svc.history).toHaveLength(0);
    expect(svc.uptime).toBeUndefined();
  });

  it("exportJson — JSON 문자열 반환", async () => {
    const profile = makeMockProfile({});
    const dashboard = createDashboardData(profile);
    const json = await dashboard.exportJson();
    const parsed = JSON.parse(json);
    expect(parsed.summary).toBeDefined();
    expect(parsed.services).toBeDefined();
  });
});
