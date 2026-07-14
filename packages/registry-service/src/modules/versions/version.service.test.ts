// @def.boundary registry-system
// @def.doc registry-system

import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DefinitionClient } from '@qa-sdk/definition-client';
import { InMemoryPrefixRegistry, InMemoryVersionLifecycleStore } from 'index-meta';
import { InMemoryDraftLockStore } from '../../stores/in-memory-draft-lock-store.js';
import { InMemoryPrefixOwnerStore } from '../../stores/in-memory-prefix-owner-store.js';
import { VersionService } from './version.service.js';

function createService(definitionClient?: Partial<DefinitionClient>) {
  const prefixRegistry = new InMemoryPrefixRegistry();
  const versionStore = new InMemoryVersionLifecycleStore();
  const ownerStore = new InMemoryPrefixOwnerStore();
  const lockStore = new InMemoryDraftLockStore();
  const service = new VersionService(
    prefixRegistry,
    versionStore,
    ownerStore,
    lockStore,
    undefined,
    undefined,
    definitionClient as DefinitionClient | undefined,
  );

  return { service, ownerStore };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('VersionService definition-client integration', () => {
  it('activate 성공 후 definition-service consumption snapshot을 기록한다', async () => {
    const recordConsumption = vi.fn<DefinitionClient['recordConsumption']>().mockResolvedValue({
      id: 1,
      consumptionRate: 0,
    });
    const { service, ownerStore } = createService({ recordConsumption });

    await ownerStore.register({
      prefix: 'role',
      owner: 'registry-service',
      kind: 'leaf',
      numberType: 'number',
      createdAt: '2026-03-27T00:00:00.000Z',
    });
    await service.createDraft('role', {
      versionId: 'v1',
      baseVersionId: null,
      capacity: 16,
    });
    await service.release('role', 'v1');

    const result = await service.activate('role', 'v1');

    expect(result).toEqual({ ok: true, diagnostics: [] });
    expect(recordConsumption).toHaveBeenCalledWith('role', {
      prefixVersion: 'v1',
      totalSpace: 16,
      observedAddresses: 0,
      dimStats: {},
    });
  });

  it('definition-service가 실패해도 activate는 fail-open으로 완료된다', async () => {
    const recordConsumption = vi
      .fn<DefinitionClient['recordConsumption']>()
      .mockRejectedValue(new Error('offline'));
    const { service, ownerStore } = createService({ recordConsumption });

    await ownerStore.register({
      prefix: 'role',
      owner: 'registry-service',
      kind: 'leaf',
      numberType: 'number',
      createdAt: '2026-03-27T00:00:00.000Z',
    });
    await service.createDraft('role', {
      versionId: 'v1',
      baseVersionId: null,
      capacity: 8,
    });
    await service.release('role', 'v1');

    await expect(service.activate('role', 'v1')).resolves.toEqual({
      ok: true,
      diagnostics: [],
    });
    expect(recordConsumption).toHaveBeenCalledTimes(1);
  });
});
