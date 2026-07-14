// @def.boundary registry-system
// @def.doc registry-system

import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DefinitionClient } from '@qa-sdk/definition-client';
import { InMemoryConfigStore } from '../../stores/in-memory-config-store.js';
import { InMemoryServiceEndpointStore } from '../../stores/in-memory-service-endpoint-store.js';
import { ServiceTopologyService } from './service-topology.service.js';

function createService(definitionClient?: Partial<DefinitionClient>) {
  return ServiceTopologyService.fromStores({
    configStore: new InMemoryConfigStore(),
    endpointStore: new InMemoryServiceEndpointStore(),
    definitionClient: definitionClient as DefinitionClient | undefined,
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ServiceTopologyService definition-client integration', () => {
  it('topology 변경 후 affected tests를 조회한다', async () => {
    const getAffectedTests = vi.fn<DefinitionClient['getAffectedTests']>().mockResolvedValue({
      changedDoc: 'registry-services-api-spec',
      affectedTests: [],
      totalTests: 3,
    });
    const service = createService({ getAffectedTests });

    const result = await service.upsert('demo', {
      serviceId: 'api',
      name: 'API',
      ownedPrefixes: ['endpoint'],
    });

    expect(result).toEqual({
      ok: true,
      serviceId: 'api',
      action: 'created',
    });
    expect(getAffectedTests).toHaveBeenCalledWith('registry-services-api-spec');
  });

  it('definition-service가 실패해도 topology 변경은 fail-open으로 유지된다', async () => {
    const getAffectedTests = vi
      .fn<DefinitionClient['getAffectedTests']>()
      .mockRejectedValue(new Error('offline'));
    const service = createService({ getAffectedTests });

    await expect(
      service.replaceAll('demo', {
        services: [
          {
            serviceId: 'web',
            name: 'Web',
            ownedPrefixes: ['page_view'],
          },
        ],
      }),
    ).resolves.toEqual({
      ok: true,
      count: 1,
    });
    expect(getAffectedTests).toHaveBeenCalledTimes(1);
  });
});
