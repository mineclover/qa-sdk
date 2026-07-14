import { describe, expect, it, vi, afterEach } from 'vitest';
import { authHeaders, extractTraceId, loginViaGateway } from './http-helpers.js';

afterEach(() => vi.restoreAllMocks());

describe('http-helpers', () => {
  it('loginViaGateway — 200 → token 응답', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({
          token: 'abc.def.ghi',
          tokenType: 'Bearer',
          expiresIn: 300,
          userId: 'u1',
        }),
      ),
    );
    const res = await loginViaGateway('http://x', {
      email: 'a@b.c',
      password: 'p',
    });
    expect(res.token).toBe('abc.def.ghi');
    expect(res.userId).toBe('u1');
  });

  it('loginViaGateway — 401 → throw', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('nope', { status: 401 })),
    );
    await expect(
      loginViaGateway('http://x', { email: 'a@b.c', password: 'wrong' }),
    ).rejects.toThrow(/login failed/);
  });

  it('authHeaders — Bearer 형식', () => {
    expect(authHeaders('xyz')).toEqual({ Authorization: 'Bearer xyz' });
    expect(authHeaders('xyz', { 'x-extra': '1' })).toEqual({
      Authorization: 'Bearer xyz',
      'x-extra': '1',
    });
  });

  it('extractTraceId — x-trace-id 헤더 추출', () => {
    const res = new Response('', { headers: { 'x-trace-id': 'abc123' } });
    expect(extractTraceId(res)).toBe('abc123');
  });
});
