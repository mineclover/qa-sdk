// @def.boundary sim-otel-utils
// @def.doc authorization-ontology-bitmap-pipeline

import { describe, expect, it, vi, afterEach } from 'vitest';
import { fetchWithTracePropagation } from './fetch-with-trace.js';

afterEach(() => vi.restoreAllMocks());

describe('fetchWithTracePropagation', () => {
  it('native fetch 호출 + propagation.inject 자동 호출', async () => {
    const fetchMock = vi.fn(async (url: string | URL, _init?: RequestInit) => {
      expect(String(url)).toBe('http://example.com/x');
      return new Response('ok', { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const res = await fetchWithTracePropagation('http://example.com/x', {
      method: 'GET',
      timeoutMs: 1000,
    });
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('기존 헤더 보존 + traceparent 추가 시도', async () => {
    const fetchMock = vi.fn(async (_url: string | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      expect(headers.get('x-custom')).toBe('v');
      return new Response('ok');
    });
    vi.stubGlobal('fetch', fetchMock);

    await fetchWithTracePropagation('http://x/', {
      method: 'POST',
      headers: { 'x-custom': 'v', 'content-type': 'application/json' },
      body: '{"a":1}',
      timeoutMs: 1000,
    });
    expect(fetchMock).toHaveBeenCalled();
  });

  it('timeout 초과 → AbortError throw', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url, init?: RequestInit) => {
        return new Promise<Response>((_, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError')),
          );
        });
      }),
    );
    await expect(fetchWithTracePropagation('http://x/', { timeoutMs: 50 })).rejects.toThrow(
      /abort/i,
    );
  });
});
