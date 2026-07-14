// @def.boundary sim-scenarios

import { describe, expect, it } from 'vitest';
import { createBffRead, type FetchLike } from './bff-read.js';

function makeFetchWithHeader(
  ok: boolean,
  status: number,
  source: string | null,
  body = '',
): FetchLike {
  return async () => ({
    ok,
    status,
    async text() {
      return body;
    },
    headers: {
      get(name: string) {
        return name === 'x-data-source' ? source : null;
      },
    },
  });
}

describe('bff-read handle', () => {
  it('primary 헤더 응답을 그대로 반환', async () => {
    const f = createBffRead({
      bffReadUrl: 'http://bff/v1/read',
      fetchImpl: makeFetchWithHeader(true, 200, 'primary'),
    });
    expect(await f()).toEqual({ source: 'primary' });
  });

  it('replica 헤더 응답을 그대로 반환', async () => {
    const f = createBffRead({
      bffReadUrl: 'http://bff/v1/read',
      fetchImpl: makeFetchWithHeader(true, 200, 'replica'),
    });
    expect(await f()).toEqual({ source: 'replica' });
  });

  it('헤더 누락 시 throw — fallback 금지', async () => {
    const f = createBffRead({
      bffReadUrl: 'http://bff',
      fetchImpl: makeFetchWithHeader(true, 200, null),
    });
    await expect(f()).rejects.toThrow(/x-data-source/);
  });

  it('invalid 헤더 값 시 throw', async () => {
    const f = createBffRead({
      bffReadUrl: 'http://bff',
      fetchImpl: makeFetchWithHeader(true, 200, 'garbage'),
    });
    await expect(f()).rejects.toThrow(/x-data-source/);
  });

  it('non-2xx 응답에 throw', async () => {
    const f = createBffRead({
      bffReadUrl: 'http://bff',
      fetchImpl: makeFetchWithHeader(false, 503, 'primary', 'down'),
    });
    await expect(f()).rejects.toThrow(/status=503/);
  });
});
