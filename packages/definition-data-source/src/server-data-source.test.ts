// @def.doc definition-data-source

import { afterEach, describe, expect, it, vi } from 'vitest';
import { ServerDataSource } from './server-data-source.js';

const document = {
  docId: 'definition-addressing',
  title: 'Definition Addressing',
  scope: 'system',
  aspect: 'architecture',
  depth: 'overview',
  lifecycle: 'approved',
  tags: ['context'],
  links: [],
  version: 1,
  revision: 42,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ServerDataSource', () => {
  it('[contract:docs-control-plane.definition-context.source-transport.v1] projects HTTP responses through the DefDataSource contract', async () => {
    const fetchMock = vi.fn(async (input: string | URL) => {
      const path = new URL(String(input)).pathname;
      const response = responseForPath(path);
      return new Response(JSON.stringify(response.body), {
        status: response.status,
        headers: { 'content-type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const source = new ServerDataSource('http://definition.test');

    await expect(source.ping()).resolves.toBe(true);
    await expect(source.get(document.docId)).resolves.toMatchObject({
      docId: document.docId,
    });
    await expect(source.getChildren(document.docId)).resolves.toEqual([]);
    await expect(source.getIncomingLinks(document.docId)).resolves.toEqual([]);
    await expect(source.getOutgoingLinks(document.docId)).resolves.toEqual([]);
    await expect(source.getBody(document.docId)).resolves.toMatchObject({
      docId: document.docId,
      body: '# Definition Addressing',
    });
    await expect(source.getBoundaryContext(document.docId)).resolves.toMatchObject({
      boundary: { boundary: { docId: document.docId } },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://definition.test/docs/definition-addressing',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('[contract:docs-control-plane.definition-context.source-transport.v1] returns null for an HTTP 404 document', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ message: 'not found' }), { status: 404 })),
    );

    await expect(new ServerDataSource('http://definition.test').get('missing')).resolves.toBeNull();
  });
});

function responseForPath(path: string): { status: number; body: unknown } {
  if (path === '/health') return { status: 200, body: { status: 'ok' } };
  if (path === '/docs/definition-addressing') return { status: 200, body: document };
  if (path === '/docs/definition-addressing/children') {
    return { status: 200, body: { docId: document.docId, children: [] } };
  }
  if (path === '/docs/definition-addressing/incoming-links') {
    return { status: 200, body: { docId: document.docId, links: [] } };
  }
  if (path === '/docs/definition-addressing/outgoing-links') {
    return { status: 200, body: { docId: document.docId, links: [] } };
  }
  if (path === '/docs/definition-addressing/body') {
    return {
      status: 200,
      body: { docId: document.docId, body: '# Definition Addressing', revision: document.revision },
    };
  }
  if (path === '/graph/definition-addressing/boundary-context') {
    return {
      status: 200,
      body: {
        mode: 'transitive',
        level: 'overview',
        boundary: { boundary: { docId: document.docId }, members: [], couplings: {} },
        concerns: { docId: document.docId, direct: [], inherited: [], all: [] },
        impact: { sourceId: document.docId, impacted: [], affectedGroups: [], blastRadius: 0 },
        feedbackTrace: [],
      },
    };
  }
  return { status: 404, body: { message: 'not found' } };
}
