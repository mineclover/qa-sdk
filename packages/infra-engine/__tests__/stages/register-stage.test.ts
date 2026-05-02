import { describe, it, expect, vi } from "vitest";
import { createRegisterStage } from "../../src/stages/register-stage.js";
import type { DeployContext } from "../../src/core/types.js";
import type { RegistryAdapter, ServiceProfileAdapter, InfraProfileAdapter } from "../../src/adapters/adapter.js";

function makeCtx(): DeployContext {
  return {
    service: "test-svc",
    provider: "local",
    env: "dev",
    region: "local",
    configPath: "config/dev.yaml",
    triggeredBy: "manual",
    config: {
      global: { region: "local" },
      services: { "test-svc": { port: 3200 } },
      connections: {},
    },
    provision: {
      stackName: "test-svc-dev-local-local",
      outputs: { endpoint: "http://localhost:3200" },
      provider: "local",
      region: "local",
      duration: 100,
    },
  };
}

describe("RegisterStage", () => {
  it("등록 + 프로필 갱신 성공", async () => {
    const registry: RegistryAdapter = {
      syncDeployment: vi.fn(async () => ({ synced: true })),
    };
    const profile: ServiceProfileAdapter = {
      get: vi.fn(async () => null),
      set: vi.fn(async () => {}),
      restore: vi.fn(async () => {}),
    };
    const infraProfile: InfraProfileAdapter = {
      setDeployment: vi.fn(async () => {}),
      getDeployment: vi.fn(async () => null),
      getAllDeployments: vi.fn(async () => ({})),
      restore: vi.fn(async () => {}),
      setMonitor: vi.fn(async () => {}),
      removeMonitor: vi.fn(async () => {}),
      getAllMonitors: vi.fn(async () => []),
      updateMonitorStatus: vi.fn(async () => {}),
      addHistory: vi.fn(async () => {}),
      getHistory: vi.fn(async () => []),
    };

    const stage = createRegisterStage(registry, profile, infraProfile);
    const result = await stage.execute(makeCtx());

    expect(result.registration?.synced).toBe(true);
    expect(result.registration?.profileUpdated).toBe(true);
    expect(registry.syncDeployment).toHaveBeenCalledOnce();
    expect(profile.set).toHaveBeenCalledWith("test-svc", "http://localhost:3200");
  });
});
