import { describe, it, expect, vi } from 'vitest';
import { createVerifyStage } from '../../src/verify/verify-stage.js';
import type { DeployContext } from '../../src/core/types.js';
import type { GateAdapter } from '../../src/adapters/adapter.js';

vi.stubGlobal('fetch', vi.fn());
const mockFetch = vi.mocked(globalThis.fetch);

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
    provision: {
      stackName: 'test',
      outputs: { endpoint: 'http://localhost:3200' },
      provider: 'local',
      region: 'local',
      duration: 100,
    },
  };
}

describe('VerifyStage', () => {
  it('헬스체크 pass → healthy', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200 } as Response);
    const gate: GateAdapter = { evaluate: () => 'pass' };
    const stage = createVerifyStage(gate);
    const result = await stage.execute(makeCtx());
    expect(result.verification?.healthStatus).toBe('healthy');
  });

  it('헬스체크 fail → failed', async () => {
    mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));
    const gate: GateAdapter = { evaluate: () => 'fail' };
    const stage = createVerifyStage(gate, { maxRetries: 1, retryDelay: 0 });
    await expect(stage.execute(makeCtx())).rejects.toThrow();
  });
});
