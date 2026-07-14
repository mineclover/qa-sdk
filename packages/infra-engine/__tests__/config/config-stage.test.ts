import { describe, it, expect, vi } from 'vitest';
import { createConfigStage } from '../../src/config/config-stage.js';
import type { DeployContext } from '../../src/core/types.js';
import type { SopsLoader } from '../../src/config/sops-loader.js';

function makeCtx(): DeployContext {
  return {
    service: 'test-svc',
    provider: 'local',
    env: 'dev',
    region: 'local',
    configPath: 'config/dev.yaml',
    triggeredBy: 'manual',
  };
}

describe('ConfigStage', () => {
  it('복호화 + 검증 → ctx.config 채움', async () => {
    const mockLoader: SopsLoader = {
      decrypt: vi.fn(async () => ({
        global: { region: 'local' },
        services: { 'test-svc': { port: 3200 } },
        connections: { 'test-svc': { endpoint: 'http://localhost:3200' } },
      })),
    };

    const stage = createConfigStage(mockLoader);
    const result = await stage.execute(makeCtx());

    expect(result.config).toBeDefined();
    expect(result.config!.global.region).toBe('local');
    expect(result.config!.services['test-svc'].port).toBe(3200);
  });

  it('검증 실패 → throw', async () => {
    const mockLoader: SopsLoader = {
      decrypt: vi.fn(async () => ({
        global: {}, // region 누락
        services: {},
        connections: {},
      })),
    };

    const stage = createConfigStage(mockLoader);
    await expect(stage.execute(makeCtx())).rejects.toThrow();
  });
});
