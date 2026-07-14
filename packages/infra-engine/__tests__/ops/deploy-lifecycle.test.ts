import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { createPipeline } from '../../src/core/pipeline.js';
import { createConfigStage } from '../../src/config/config-stage.js';
import { createPlainLoader } from '../../src/config/sops-loader.js';
import { createProvisionStage } from '../../src/stages/provision-stage.js';
import { createRegisterStage } from '../../src/stages/register-stage.js';
import { createVerifyStage } from '../../src/verify/verify-stage.js';
import { createObserveStage } from '../../src/stages/observe-stage.js';
import { createGateAdapter } from '../../src/adapters/gate.js';
import { createInfraProfileAdapter } from '../../src/adapters/infra-profile.js';
import { createServiceProfileAdapter } from '../../src/adapters/service-profile.js';
import type { DeployContext } from '../../src/core/types.js';

// fetch 모킹 — 헬스체크 pass
vi.stubGlobal(
  'fetch',
  vi.fn(async () => ({ ok: true, status: 200 })),
);

const CONFIG_DIR = resolve(__dirname, '../../config');

// Mock adapters that need external services
const mockRegistry = { syncDeployment: vi.fn(async () => ({ synced: true })) };
const mockIngest = { emit: vi.fn(async () => ({ ok: true })) };
const mockCoordinate = {
  resolveSvcRef: () => 'service:v1:1',
  encodeDeployEvent: () => ({ deploy_event: 'deploy_event:v1:1' }),
  encodeHealthEvent: () => ({}),
};

// Mock provider
const mockProvider = {
  name: 'local',
  getProgram: () => ({}),
  destroy: vi.fn(async () => {}),
  validate: vi.fn(async () => ({ valid: true, errors: [] as string[] })),
};

const mockDeployFn = vi.fn(async (_p: any, _c: any, serviceId: string, stackName: string) => ({
  stackName,
  outputs: {
    endpoint: `http://localhost:${3200 + Math.floor(Math.random() * 100)}`,
    version: 'abc123',
  },
}));

describe('운영 테스트: 환경별 배포 라이프사이클', () => {
  let profileDir: string;

  beforeEach(async () => {
    profileDir = await mkdtemp(`${tmpdir()}/infra-ops-`);
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await rm(profileDir, { recursive: true, force: true });
  });

  const envs = ['test', 'dev', 'stage', 'prod'] as const;

  for (const env of envs) {
    it(`${env} 환경: 설정 로딩 → 배포 → 등록 → 검증 → 관측`, async () => {
      const loader = createPlainLoader();
      const infraProfile = createInfraProfileAdapter(profileDir);
      const serviceProfile = createServiceProfileAdapter(profileDir);
      const gate = createGateAdapter();

      const pipeline = createPipeline([
        createConfigStage(loader),
        createProvisionStage(() => mockProvider, mockDeployFn),
        createRegisterStage(mockRegistry, serviceProfile, infraProfile),
        createVerifyStage(gate),
        createObserveStage(mockIngest, mockCoordinate, infraProfile),
      ]);

      // 각 환경의 첫 번째 서비스로 배포 테스트
      const configPath = `${CONFIG_DIR}/${env}.json`;
      const config = JSON.parse(await readFile(configPath, 'utf-8'));
      const firstService = Object.keys(config.services)[0];

      const result = await pipeline.run({
        service: firstService,
        provider: 'local',
        env,
        region: config.global.region,
        configPath,
        triggeredBy: 'manual',
      } as DeployContext);

      // 검증
      expect(result.success).toBe(true);
      expect(result.stageResults).toHaveLength(5);
      expect(result.stageResults.map((s) => s.stage)).toEqual([
        'config',
        'provision',
        'register',
        'verify',
        'observe',
      ]);
      expect(result.stageResults.every((s) => s.status === 'success')).toBe(true);

      // 설정이 올바르게 로딩되었는지
      expect(mockDeployFn).toHaveBeenCalledOnce();

      // 프로필이 업데이트되었는지
      const savedUrl = await serviceProfile.get(firstService);
      expect(savedUrl).toBeTruthy();

      // 인프라 프로필이 기록되었는지
      const deployment = await infraProfile.getDeployment(firstService);
      expect(deployment).not.toBeNull();
      expect(deployment!.env).toBe(env);
      expect(deployment!.provider).toBe('local');

      // 모니터가 등록되었는지
      const monitors = await infraProfile.getAllMonitors();
      expect(monitors).toHaveLength(1);
      expect(monitors[0].serviceId).toBe(firstService);

      // registry sync 호출되었는지
      expect(mockRegistry.syncDeployment).toHaveBeenCalledOnce();
      // ingest emit 호출되었는지
      expect(mockIngest.emit).toHaveBeenCalledOnce();
    });
  }

  it('전체 환경 서비스 수 확인', async () => {
    const loader = createPlainLoader();
    for (const env of envs) {
      const raw = await loader.decrypt(`${CONFIG_DIR}/${env}.json`);
      const svcCount = Object.keys((raw as any).services).length;
      console.log(`  ${env}: ${svcCount}개 서비스`);
      expect(svcCount).toBeGreaterThan(0);
    }
  });

  it('prod 환경: 전체 서비스 순차 배포', async () => {
    const loader = createPlainLoader();
    const infraProfile = createInfraProfileAdapter(profileDir);
    const serviceProfile = createServiceProfileAdapter(profileDir);
    const gate = createGateAdapter();

    const raw = await loader.decrypt(`${CONFIG_DIR}/prod.json`);
    const services = Object.keys((raw as any).services);

    for (const svc of services) {
      vi.clearAllMocks();

      const pipeline = createPipeline([
        createConfigStage(loader),
        createProvisionStage(() => mockProvider, mockDeployFn),
        createRegisterStage(mockRegistry, serviceProfile, infraProfile),
        createVerifyStage(gate),
        createObserveStage(mockIngest, mockCoordinate, infraProfile),
      ]);

      const result = await pipeline.run({
        service: svc,
        provider: 'local',
        env: 'prod',
        region: 'ap-northeast-2',
        configPath: `${CONFIG_DIR}/prod.json`,
        triggeredBy: 'ci',
      } as DeployContext);

      expect(result.success).toBe(true);
    }

    // 모든 서비스가 프로필에 등록되었는지
    const allDeployments = await infraProfile.getAllDeployments();
    expect(Object.keys(allDeployments)).toHaveLength(services.length);

    // 모든 서비스에 모니터가 등록되었는지
    const monitors = await infraProfile.getAllMonitors();
    expect(monitors).toHaveLength(services.length);

    console.log(`  prod 환경 ${services.length}개 서비스 전체 배포 완료`);
    console.log(`  등록된 배포: ${Object.keys(allDeployments).join(', ')}`);
    console.log(`  등록된 모니터: ${monitors.map((m) => m.serviceId).join(', ')}`);
  });
});
