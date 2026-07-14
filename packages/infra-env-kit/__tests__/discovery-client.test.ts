import { describe, expect, it, vi } from 'vitest';

import { createEnvRegistryDiscoveryClient } from '../src/discovery-client.js';

describe('infra-env-kit discovery client', () => {
  it('env별 URL을 해석한다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          serviceId: 'ingest-server',
          name: 'Ingest',
          url: 'http://default',
          tier: 'backend',
          ownedPrefixes: [],
          consumedPrefixes: [],
          urls: {
            dev: 'http://localhost:3200',
          },
        }),
      })),
    );

    const client = createEnvRegistryDiscoveryClient('http://localhost:3300');
    const service = await client.resolve('ingest-server', 'dev');

    expect(service?.url).toBe('http://localhost:3200');
  });
});
