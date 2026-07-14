import { describe, it, expect, vi } from 'vitest';
import { createProvisionStage } from '../../src/stages/provision-stage.js';
import type { DeployContext } from '../../src/core/types.js';
import type { DeployProvider, ValidationResult } from '../../src/adapters/adapter.js';

function makeCtx(): DeployContext {
  return {
    service: 'test-svc',
    provider: 'local',
    env: 'dev',
    region: 'local',
    configPath: 'config/dev.yaml',
    triggeredBy: 'manual',
    config: {
      global: { region: 'local' },
      services: { 'test-svc': { port: 3200 } },
      connections: {},
    },
  };
}

function mockProvider(): DeployProvider {
  return {
    name: 'local',
    getProgram: vi.fn(() => ({})),
    destroy: vi.fn(async () => {}),
    validate: vi.fn(async (): Promise<ValidationResult> => ({ valid: true, errors: [] })),
  };
}

describe('ProvisionStage', () => {
  it('프로바이더 검증 + 배포 → ProvisionResult', async () => {
    const provider = mockProvider();
    const deploy = vi.fn(async () => ({
      stackName: 'test-svc-dev-local-local',
      outputs: { endpoint: 'http://localhost:3200' },
    }));

    const stage = createProvisionStage(() => provider, deploy);
    const result = await stage.execute(makeCtx());

    expect(result.provision).toBeDefined();
    expect(result.provision!.outputs.endpoint).toBe('http://localhost:3200');
    expect(provider.validate).toHaveBeenCalledOnce();
  });

  it('검증 실패 → throw', async () => {
    const provider = mockProvider();
    vi.mocked(provider.validate).mockResolvedValueOnce({
      valid: false,
      errors: ['API key missing'],
    });

    const stage = createProvisionStage(() => provider, vi.fn());
    await expect(stage.execute(makeCtx())).rejects.toThrow('API key missing');
  });

  it('rollback → provider.destroy 호출', async () => {
    const provider = mockProvider();
    const deploy = vi.fn(async () => ({
      stackName: 'test-svc-dev-local-local',
      outputs: { endpoint: 'http://localhost:3200' },
    }));

    const stage = createProvisionStage(() => provider, deploy);
    await stage.execute(makeCtx());

    // rollback 실행
    await stage.rollback!(makeCtx());
    expect(provider.destroy).toHaveBeenCalledWith('test-svc-dev-local-local');
  });
});
