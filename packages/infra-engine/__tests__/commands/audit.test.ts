import { describe, it, expect } from 'vitest';
import { auditRegistry } from '../../src/commands/audit.js';
import type { DiscoveryClient, ServiceInfo } from '../../src/discovery/client.js';

function makeDiscovery(services: ServiceInfo[]): DiscoveryClient {
  return {
    resolve: async () => null,
    resolveAll: async () => ({}),
    listServices: async () => services,
    generateConnectCode: async () => '',
    generateConnectCodeAll: async () => '',
  };
}

describe('auditRegistry', () => {
  it('이상 없는 서비스 → 경고/에러 없음', async () => {
    const services: ServiceInfo[] = [
      {
        serviceId: 'svc-a',
        name: 'Service A',
        url: 'http://localhost:3200',
        tier: 'backend',
        team: 'core',
        ownedPrefixes: ['page_view'],
        consumedPrefixes: [],
        urls: { dev: 'http://dev:3200', staging: 'http://stage:3200', prod: 'http://prod:3200' },
      },
    ];
    const result = await auditRegistry(makeDiscovery(services));
    expect(result.errors).toHaveLength(0);
    // env URL이 있고 ownedPrefixes가 있으므로 경고 없음
    expect(result.warnings).toHaveLength(0);
  });

  it('URL 미등록 → no-url 경고', async () => {
    const services: ServiceInfo[] = [
      {
        serviceId: 'svc-a',
        name: 'Service A',
        url: '',
        tier: 'frontend',
        team: 'ui',
        ownedPrefixes: [],
        consumedPrefixes: [],
        urls: { dev: 'http://dev:3200', staging: 'http://stage:3200', prod: 'http://prod:3200' },
      },
    ];
    const result = await auditRegistry(makeDiscovery(services));
    expect(result.warnings.some((w) => w.type === 'no-url')).toBe(true);
  });

  it('env URL 누락 → no-env-url 경고', async () => {
    const services: ServiceInfo[] = [
      {
        serviceId: 'svc-a',
        name: 'Service A',
        url: 'http://localhost:3200',
        tier: 'frontend',
        team: 'ui',
        ownedPrefixes: [],
        consumedPrefixes: [],
        urls: { dev: 'http://dev:3200' }, // staging, prod 누락
      },
    ];
    const result = await auditRegistry(makeDiscovery(services));
    const noEnvUrl = result.warnings.filter((w) => w.type === 'no-env-url');
    expect(noEnvUrl).toHaveLength(2); // staging, prod
  });

  it('backend tier에 ownedPrefixes 없음 → 경고', async () => {
    const services: ServiceInfo[] = [
      {
        serviceId: 'svc-a',
        name: 'Service A',
        url: 'http://localhost:3200',
        tier: 'backend',
        team: 'core',
        ownedPrefixes: [],
        consumedPrefixes: [],
        urls: { dev: 'http://dev:3200', staging: 'http://stage:3200', prod: 'http://prod:3200' },
      },
    ];
    const result = await auditRegistry(makeDiscovery(services));
    expect(result.warnings.some((w) => w.type === 'no-owned-prefixes')).toBe(true);
  });

  it('consumed prefix 소유자 없음 → orphan-consumed 경고', async () => {
    const services: ServiceInfo[] = [
      {
        serviceId: 'svc-a',
        name: 'Service A',
        url: 'http://localhost:3200',
        tier: 'frontend',
        team: 'ui',
        ownedPrefixes: [],
        consumedPrefixes: ['orphan_prefix'],
        urls: { dev: 'http://dev:3200', staging: 'http://stage:3200', prod: 'http://prod:3200' },
      },
    ];
    const result = await auditRegistry(makeDiscovery(services));
    expect(result.warnings.some((w) => w.type === 'orphan-consumed')).toBe(true);
  });

  it('URL 중복 → duplicate-url 경고', async () => {
    const services: ServiceInfo[] = [
      {
        serviceId: 'svc-a',
        name: 'Service A',
        url: 'http://localhost:3200',
        tier: 'frontend',
        team: 'ui',
        ownedPrefixes: [],
        consumedPrefixes: [],
        urls: { dev: 'http://dev:3200', staging: 'http://stage:3200', prod: 'http://prod:3200' },
      },
      {
        serviceId: 'svc-b',
        name: 'Service B',
        url: 'http://localhost:3200', // 동일 URL
        tier: 'frontend',
        team: 'ui',
        ownedPrefixes: [],
        consumedPrefixes: [],
        urls: { dev: 'http://dev:3200', staging: 'http://stage:3200', prod: 'http://prod:3200' },
      },
    ];
    const result = await auditRegistry(makeDiscovery(services));
    expect(result.warnings.some((w) => w.type === 'duplicate-url')).toBe(true);
  });
});
