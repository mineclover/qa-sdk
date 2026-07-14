// @def.boundary sim-gateway
// @def.doc authorization-ontology-bitmap-pipeline

import { describe, expect, it, vi, afterEach } from 'vitest';
import { Hono } from 'hono';
import { createLoginRoute } from './login.js';
import { verifyBitmapJwt } from '../lib/jwt.js';

const SECRET = 'x'.repeat(32);

afterEach(() => vi.restoreAllMocks());

describe('POST /auth/login', () => {
  it('정상 로그인 — auth-api에 자격 위임 → bitmap → JWT 발급', async () => {
    const fetchMock = vi.fn(async (url: string | URL, init?: RequestInit) => {
      const target = String(url);
      if (target.endsWith('/auth/authenticate')) {
        return Response.json({ userId: 'user-42', displayName: 'Alice' });
      }
      if (target.endsWith('/bitmap/issue')) {
        const body = JSON.parse(await new Response(init?.body as BodyInit).text());
        expect(body.userId).toBe('user-42');
        return Response.json({
          prefix: 'sim.bitmap',
          v: 'uv1',
          maskBase64: Buffer.from([0xab, 0xcd, 0xef]).toString('base64'),
          issuedAt: '2026-04-22T00:00:00.000Z',
          expiresAt: '2026-04-22T00:05:00.000Z',
          issuer: 'sim-auth-api',
          signature: 'auth-sig',
        });
      }
      throw new Error(`unexpected fetch: ${target}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const app = new Hono();
    app.route(
      '/',
      createLoginRoute({
        authApiUrl: 'http://sim-auth-api:4400',
        jwtSecret: SECRET,
        jwtTtlSeconds: 300,
      }),
    );

    const res = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'alice@example.com', password: 'x' }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { token: string };
    expect(body.token).toBeTruthy();
    const verified = await verifyBitmapJwt(body.token, SECRET);
    expect(verified.userId).toBe('user-42');
    expect(verified.bitmap.prefix).toBe('sim.bitmap');
    expect(verified.bitmap.v).toBe('uv1');
    expect(Array.from(verified.bitmap.mask)).toEqual([0xab, 0xcd, 0xef]);
  });

  it('auth-api 인증 실패 (401) → 401 반환', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('nope', { status: 401 })),
    );
    const app = new Hono();
    app.route(
      '/',
      createLoginRoute({ authApiUrl: 'http://x', jwtSecret: SECRET, jwtTtlSeconds: 300 }),
    );
    const res = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'bad@example.com', password: 'x' }),
    });
    expect(res.status).toBe(401);
  });

  it('body가 JSON이 아니면 400', async () => {
    const app = new Hono();
    app.route(
      '/',
      createLoginRoute({ authApiUrl: 'http://x', jwtSecret: SECRET, jwtTtlSeconds: 300 }),
    );
    const res = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'not-json',
    });
    expect(res.status).toBe(400);
  });

  it('email/password 누락 → 400', async () => {
    const app = new Hono();
    app.route(
      '/',
      createLoginRoute({ authApiUrl: 'http://x', jwtSecret: SECRET, jwtTtlSeconds: 300 }),
    );
    const res = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'x' }),
    });
    expect(res.status).toBe(400);
  });

  it('bitmap issue 실패 (5xx) → 502', async () => {
    const fetchMock = vi.fn(async (url: string | URL) => {
      if (String(url).endsWith('/auth/authenticate')) {
        return Response.json({ userId: 'u' });
      }
      return new Response('err', { status: 503 });
    });
    vi.stubGlobal('fetch', fetchMock);
    const app = new Hono();
    app.route(
      '/',
      createLoginRoute({ authApiUrl: 'http://x', jwtSecret: SECRET, jwtTtlSeconds: 300 }),
    );
    const res = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'alice@example.com', password: 'p' }),
    });
    expect(res.status).toBe(502);
  });
});
