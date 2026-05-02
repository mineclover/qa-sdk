import { describe, it, expect, vi } from "vitest";
import { createPipeline } from "../src/core/pipeline.js";
import { createConfigStage } from "../src/config/config-stage.js";
import { createProvisionStage } from "../src/stages/provision-stage.js";
import { createRegisterStage } from "../src/stages/register-stage.js";
import { createVerifyStage } from "../src/verify/verify-stage.js";
import { createObserveStage } from "../src/stages/observe-stage.js";
import { createGateAdapter } from "../src/adapters/gate.js";
import type { SopsLoader } from "../src/config/sops-loader.js";
import type {
  RegistryAdapter,
  ServiceProfileAdapter,
  InfraProfileAdapter,
  IngestAdapter,
  CoordinateAdapter,
  DeployProvider,
  ValidationResult,
} from "../src/adapters/adapter.js";

// fetch 모킹 (헬스체크용)
vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200 })));

describe("5단계 파이프라인 통합 테스트", () => {
  it("성공 경로: Config → Provision → Register → Verify → Observe", async () => {
    // 모킹
    const sopsLoader: SopsLoader = {
      decrypt: vi.fn(async () => ({
        global: { region: "local" },
        services: { "test-svc": { port: 3200 } },
        connections: { "test-svc": { endpoint: "http://localhost:3200" } },
      })),
    };

    const provider: DeployProvider = {
      name: "local",
      getProgram: vi.fn(() => ({})),
      destroy: vi.fn(async () => {}),
      validate: vi.fn(async (): Promise<ValidationResult> => ({ valid: true, errors: [] })),
    };

    const deployFn = vi.fn(async () => ({
      stackName: "test-svc-dev-local-local",
      outputs: { endpoint: "http://localhost:3200" },
    }));

    const registry: RegistryAdapter = { syncDeployment: vi.fn(async () => ({ synced: true })) };
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
    const ingest: IngestAdapter = { emit: vi.fn(async () => ({ ok: true })) };
    const coord: CoordinateAdapter = {
      resolveSvcRef: () => "service:v1:42",
      encodeDeployEvent: () => ({ deploy_event: "deploy_event:v1:100" }),
      encodeHealthEvent: () => ({}),
    };

    const gate = createGateAdapter();

    // 파이프라인 구성
    const pipeline = createPipeline([
      createConfigStage(sopsLoader),
      createProvisionStage(() => provider, deployFn),
      createRegisterStage(registry, profile, infraProfile),
      createVerifyStage(gate),
      createObserveStage(ingest, coord, infraProfile),
    ]);

    // 실행
    const result = await pipeline.run({
      service: "test-svc",
      provider: "local",
      env: "dev",
      region: "local",
      configPath: "config/dev.yaml",
      triggeredBy: "manual",
    });

    // 검증
    expect(result.success).toBe(true);
    expect(result.healthStatus).toBe("healthy");
    expect(result.gateVerdict).toBe("pass");
    expect(result.stageResults).toHaveLength(5);
    expect(result.stageResults.map((s) => s.stage)).toEqual([
      "config", "provision", "register", "verify", "observe",
    ]);
    expect(result.stageResults.every((s) => s.status === "success")).toBe(true);

    // 어댑터 호출 검증
    expect(sopsLoader.decrypt).toHaveBeenCalledOnce();
    expect(deployFn).toHaveBeenCalledOnce();
    expect(registry.syncDeployment).toHaveBeenCalledOnce();
    expect(profile.set).toHaveBeenCalledWith("test-svc", "http://localhost:3200");
    expect(ingest.emit).toHaveBeenCalledOnce();
    expect(infraProfile.setMonitor).toHaveBeenCalledOnce();
  });
});
