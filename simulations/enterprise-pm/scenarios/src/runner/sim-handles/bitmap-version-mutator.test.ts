// @def.boundary sim-scenarios

import { describe, expect, it } from 'vitest';
import { createBitmapVersionMutator, type FetchLike } from './bitmap-version-mutator.js';

describe('bitmap-version-mutator handle', () => {
  it('POST /admin/bitmap/bump-version 후 newVersion 반환', async () => {
    const calls: string[] = [];
    const fetchImpl: FetchLike = async (url, init) => {
      calls.push(url);
      expect(init?.method).toBe('POST');
      return {
        ok: true,
        status: 200,
        async text() {
          return '';
        },
        async json() {
          return { newVersion: 'v2' };
        },
      };
    };
    const f = createBitmapVersionMutator({
      authApiUrl: 'http://auth/',
      fetchImpl,
    });
    expect(await f()).toEqual({ newVersion: 'v2' });
    expect(calls[0]).toBe('http://auth/admin/bitmap/bump-version');
  });

  it('non-2xx에 throw', async () => {
    const fetchImpl: FetchLike = async () => ({
      ok: false,
      status: 500,
      async text() {
        return 'boom';
      },
      async json() {
        return {};
      },
    });
    const f = createBitmapVersionMutator({
      authApiUrl: 'http://auth',
      fetchImpl,
    });
    await expect(f()).rejects.toThrow(/status=500/);
  });

  it('newVersion missing/invalid → throw', async () => {
    const fetchImpl: FetchLike = async () => ({
      ok: true,
      status: 200,
      async text() {
        return '';
      },
      async json() {
        return { newVersion: '' };
      },
    });
    const f = createBitmapVersionMutator({
      authApiUrl: 'http://auth',
      fetchImpl,
    });
    await expect(f()).rejects.toThrow(/invalid newVersion/);
  });
});
