import { describe, it, expect, vi } from 'vitest';
import { createObserveStage } from '../../src/stages/observe-stage.js';
import type { DeployContext } from '../../src/core/types.js';
import type {
  IngestAdapter,
  CoordinateAdapter,
  InfraProfileAdapter,
} from '../../src/adapters/adapter.js';

function makeCtx(): DeployContext {
  return {
    service: 'test-svc',
    provider: 'local',
    env: 'dev',
    region: 'local',
    configPath: 'config/dev.yaml',
    triggeredBy: 'manual',
    config: { global: { region: 'local' }, services: {}, connections: {} },
    provision: {
      stackName: 'test',
      outputs: { endpoint: 'http://localhost:3200' },
      provider: 'local',
      region: 'local',
      duration: 100,
    },
    verification: {
      healthStatus: 'healthy',
      gateVerdict: 'pass',
      checks: [],
      retryCount: 0,
      totalDuration: 50,
    },
  };
}

describe('ObserveStage', () => {
  it('emit 성공 + 모니터 등록', async () => {
    const ingest: IngestAdapter = { emit: vi.fn(async () => ({ ok: true })) };
    const coord: CoordinateAdapter = {
      resolveSvcRef: vi.fn(() => 'service:v1:42'),
      encodeDeployEvent: vi.fn(() => ({ deploy_event: 'deploy_event:v1:100' })),
      encodeHealthEvent: vi.fn(() => ({})),
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

    const stage = createObserveStage(ingest, coord, infraProfile);
    const result = await stage.execute(makeCtx());

    expect(result.observation?.eventEmitted).toBe(true);
    expect(result.observation?.monitorRegistered).toBe(true);
    expect(ingest.emit).toHaveBeenCalledOnce();
    expect(infraProfile.setMonitor).toHaveBeenCalledOnce();
  });

  it('ingest 실패 → fail-open (warnings)', async () => {
    const ingest: IngestAdapter = { emit: vi.fn(async () => ({ ok: false, error: 'timeout' })) };
    const coord: CoordinateAdapter = {
      resolveSvcRef: () => null,
      encodeDeployEvent: () => ({}),
      encodeHealthEvent: () => ({}),
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

    const stage = createObserveStage(ingest, coord, infraProfile);
    const result = await stage.execute(makeCtx());

    expect(result.observation?.eventEmitted).toBe(false);
    expect(result.observation?.warnings).toContain('timeout');
  });
});
