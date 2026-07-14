import { describe, it, expect, vi } from 'vitest';
import { createFleetManager } from '../../src/fleet/manager.js';
import type { InfraProfileAdapter } from '../../src/adapters/adapter.js';
import type { DiscoveryClient, ServiceInfo } from '../../src/discovery/client.js';
import type { InfraDeploymentEntry } from '../../src/core/types.js';

function makeDiscovery(services: ServiceInfo[], urls?: Record<string, string>): DiscoveryClient {
  return {
    resolve: vi.fn(),
    resolveAll: vi.fn(
      async () => urls ?? Object.fromEntries(services.map((svc) => [svc.serviceId, svc.url])),
    ),
    listServices: vi.fn(async () => services),
    generateConnectCode: vi.fn(),
    generateConnectCodeAll: vi.fn(),
  };
}

function makeInfraProfile(deployments?: Record<string, InfraDeploymentEntry>): InfraProfileAdapter {
  return {
    setDeployment: vi.fn(),
    getDeployment: vi.fn(),
    getAllDeployments: vi.fn(async () => deployments ?? {}),
    restore: vi.fn(),
    setMonitor: vi.fn(),
    removeMonitor: vi.fn(),
    getAllMonitors: vi.fn(async () => []),
    updateMonitorStatus: vi.fn(),
    addHistory: vi.fn(),
    getHistory: vi.fn(async () => []),
  };
}

describe('createFleetManager', () => {
  const services: ServiceInfo[] = [
    {
      serviceId: 'svc-a',
      name: 'Service A',
      url: 'http://localhost:3200',
      tier: 'backend',
      team: 'qa',
      ownedPrefixes: [],
      consumedPrefixes: [],
    },
    {
      serviceId: 'svc-b',
      name: 'Service B',
      url: 'http://localhost:3300',
      tier: 'backend',
      team: 'qa',
      ownedPrefixes: [],
      consumedPrefixes: [],
    },
    {
      serviceId: 'svc-child',
      name: 'Service Child',
      url: 'http://localhost:3400',
      tier: 'backend',
      team: 'qa',
      ownedPrefixes: [],
      consumedPrefixes: [],
      deployedWith: 'svc-a',
    },
  ];

  it('listDeployable은 deployedWith 서비스를 제외', async () => {
    const manager = createFleetManager(makeDiscovery(services), makeInfraProfile());

    const deployable = await manager.listDeployable('dev');
    expect(deployable.map((svc) => svc.serviceId)).toEqual(['svc-a', 'svc-b']);
  });

  it('deployAll은 기본적으로 dry-run 결과를 반환', async () => {
    const deployExecutor = vi.fn();
    const manager = createFleetManager(makeDiscovery(services), makeInfraProfile(), {
      deployExecutor,
    });

    const result = await manager.deployAll('dev');
    expect(result.summary.total).toBe(2);
    expect(result.summary.success).toBe(2);
    expect(deployExecutor).not.toHaveBeenCalled();
  });

  it('deployAll 실제 실행은 순차 호출하고 실패 시 중단', async () => {
    const deployExecutor = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('boom'));
    const manager = createFleetManager(makeDiscovery(services), makeInfraProfile(), {
      deployExecutor,
    });

    const result = await manager.deployAll('dev', { dryRun: false });
    expect(deployExecutor).toHaveBeenCalledTimes(2);
    expect(result.results).toHaveLength(2);
    expect(result.summary.success).toBe(1);
    expect(result.summary.failed).toBe(1);
    expect(result.results[1].error).toContain('boom');
  });

  it('deployAll continueOnError면 실패 후에도 계속 진행', async () => {
    const deployExecutor = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(undefined);
    const manager = createFleetManager(makeDiscovery(services), makeInfraProfile(), {
      deployExecutor,
    });

    const result = await manager.deployAll('dev', {
      dryRun: false,
      continueOnError: true,
    });
    expect(deployExecutor).toHaveBeenCalledTimes(2);
    expect(result.results).toHaveLength(2);
    expect(result.summary.success).toBe(1);
    expect(result.summary.failed).toBe(1);
  });

  it('deployByTier는 tier 필터 후 실제 실행', async () => {
    const deployExecutor = vi.fn().mockResolvedValue(undefined);
    const manager = createFleetManager(
      makeDiscovery([
        ...services,
        {
          serviceId: 'svc-ui',
          name: 'Service UI',
          url: 'http://localhost:3500',
          tier: 'frontend',
          team: 'qa',
          ownedPrefixes: [],
          consumedPrefixes: [],
        },
      ]),
      makeInfraProfile(),
      { deployExecutor },
    );

    const result = await manager.deployByTier('dev', 'frontend', { dryRun: false });
    expect(deployExecutor).toHaveBeenCalledTimes(1);
    expect(deployExecutor).toHaveBeenCalledWith('svc-ui', 'dev', { dryRun: false });
    expect(result.summary.success).toBe(1);
  });
});
