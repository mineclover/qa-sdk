import { describe, expect, it, vi } from 'vitest';
import type { DocRecord } from '../../core/types.js';
import { SyncService } from './sync.service.js';

function doc(index: number): DocRecord {
  const id = `doc-${String(index).padStart(5, '0')}`;
  return {
    docId: id,
    title: id,
    scope: 'data',
    aspect: 'domain_data',
    depth: 'overview',
    lifecycle: 'approved',
    tags: [],
    links: [],
    version: 1,
    bodyHash: `${id}-hash`,
    syncedAt: '2026-06-30T00:00:00.000Z',
  };
}

describe('SyncService semantic materialization source', () => {
  it('rebuilds search over every document instead of the first 10000 docs only', () => {
    const docs = Array.from({ length: 10005 }, (_, index) => doc(index));
    const docsService = {
      list({ limit = 500, offset = 0 }: { limit?: number; offset?: number } = {}) {
        return docs.slice(offset, offset + limit);
      },
    };
    const search = { index: vi.fn() };
    const service = new SyncService(docsService as any, search as any, {} as any, {} as any);

    const indexedDocs = (service as any).rebuildSearchIndex() as DocRecord[];

    expect(indexedDocs).toHaveLength(10005);
    expect(search.index).toHaveBeenCalledTimes(10005);
    expect(indexedDocs.at(-1)?.docId).toBe('doc-10004');
  });
});
