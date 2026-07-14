// @def.boundary sim-scenarios

import { describe, expect, it } from 'vitest';
import { createSimHandle, createSimGatewayFetch, type FetchLike } from './sim-handle.js';

/** Fake fetch — request URL/options 캡처 + scripted response 반환. */
function fakeFetch(
  responses: Map<string, { status: number; body: unknown }>,
  capture: Array<{ url: string; init?: RequestInit }>,
): FetchLike {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : (input as URL).toString();
    capture.push({ url, init });
    const matched = [...responses.entries()].find(([key]) => url.startsWith(key));
    if (!matched) {
      return new Response('', { status: 404 });
    }
    const [, r] = matched;
    return new Response(JSON.stringify(r.body), {
      status: r.status,
      headers: { 'content-type': 'application/json' },
    });
  }) as unknown as FetchLike;
}

describe('createSimHandle', () => {
  it('fixtures — alice/bob/carol/david/eve/frank/admin 시드 노출', () => {
    const handle = createSimHandle({
      gatewayUrl: 'http://gateway',
      authApiUrl: 'http://auth-api:4001',
    });
    expect(handle.fixtures.alice.email).toBe('alice@example.com');
    expect(handle.fixtures.alice.password).toBe('alice-pass');
    expect(handle.fixtures.alice.id).toBe('usr_alice_example_com');
    expect(handle.fixtures.bob.email).toBe('bob@example.com');
    expect(handle.fixtures.carol.email).toBe('carol@example.com');
    expect(handle.fixtures.frank.email).toBe('frank@example.com');
    expect(handle.fixtures.admin.email).toBe('admin@example.com');
  });

  it('fixtures.departments — eng/marketing 결정론적 ID', () => {
    const handle = createSimHandle({
      gatewayUrl: 'http://gateway',
      authApiUrl: 'http://auth-api:4001',
    });
    expect(handle.fixtures.departments.eng).toBe('dept_Engineering');
    expect(handle.fixtures.departments.marketing).toBe('dept_Marketing');
  });

  it('fixtures.roles — manager/member/admin/approver_role', () => {
    const handle = createSimHandle({
      gatewayUrl: 'http://gateway',
      authApiUrl: 'http://auth-api:4001',
    });
    expect(handle.fixtures.roles.manager.id).toBe('role_manager');
    expect(handle.fixtures.roles.member.id).toBe('role_member');
    expect(handle.fixtures.roles.admin.id).toBe('role_admin');
    expect(handle.fixtures.roles.approver_role.id).toBe('role_approver');
  });

  it('authApp.getHttpServer().address() — authApiUrl host:port 추출', () => {
    const handle = createSimHandle({
      gatewayUrl: 'http://gateway',
      authApiUrl: 'http://auth-api:4400',
    });
    const addr = handle.authApp.getHttpServer().address();
    expect(addr).toEqual({ port: 4400 });
  });

  it('seedBudgetRequest — login → create → submit → start-review 호출 순서', async () => {
    const captured: Array<{ url: string; init?: RequestInit }> = [];
    const responses = new Map<string, { status: number; body: unknown }>([
      ['http://gateway/auth/login', { status: 200, body: { token: 'tk-alice' } }],
      [
        'http://gateway/approvals/requests/br_proj1_usr_alice_example_com_xyz/submit',
        { status: 200, body: { ok: true } },
      ],
      [
        'http://gateway/approvals/requests/br_proj1_usr_alice_example_com_xyz/start-review',
        { status: 200, body: { ok: true } },
      ],
      [
        'http://gateway/approvals/requests',
        { status: 201, body: { id: 'br_proj1_usr_alice_example_com_xyz' } },
      ],
    ]);
    const handle = createSimHandle({
      gatewayUrl: 'http://gateway',
      authApiUrl: 'http://auth-api:4001',
      fetchImpl: fakeFetch(responses, captured),
    });

    const result = await handle.fixtures.seedBudgetRequest({
      projectId: 'proj1',
      projectDepartmentId: 'dept_Engineering',
      amount: 500_000,
      requesterId: handle.fixtures.alice.id,
    });

    expect(result.id).toBe('br_proj1_usr_alice_example_com_xyz');
    // login → POST create → POST submit → POST start-review.
    const calls = captured.map((c) => `${c.init?.method ?? 'GET'} ${c.url}`);
    expect(calls[0]).toBe('POST http://gateway/auth/login');
    expect(calls[1]).toBe('POST http://gateway/approvals/requests');
    expect(calls[2]).toContain('/submit');
    expect(calls[3]).toContain('/start-review');
  });

  it('seedBudgetRequest — 미등록 requesterId 는 즉시 throw', async () => {
    const handle = createSimHandle({
      gatewayUrl: 'http://gateway',
      authApiUrl: 'http://auth-api:4001',
      fetchImpl: fakeFetch(new Map(), []),
    });
    await expect(
      handle.fixtures.seedBudgetRequest({
        projectId: 'p1',
        projectDepartmentId: 'dept_Engineering',
        amount: 100,
        requesterId: 'usr_unknown',
      }),
    ).rejects.toThrow(/unknown requesterId/);
  });

  it('delegateProject — alice 로그인 후 delegate POST', async () => {
    const captured: Array<{ url: string; init?: RequestInit }> = [];
    const responses = new Map<string, { status: number; body: unknown }>([
      ['http://gateway/auth/login', { status: 200, body: { token: 'tk-alice' } }],
      ['http://gateway/projects/proj1/delegate', { status: 200, body: { state: 'DELEGATED' } }],
    ]);
    const handle = createSimHandle({
      gatewayUrl: 'http://gateway',
      authApiUrl: 'http://auth-api:4001',
      fetchImpl: fakeFetch(responses, captured),
    });
    await handle.fixtures.delegateProject({
      projectId: 'proj1',
      graphRootId: 'g-1',
      delegateUserId: 'usr_frank_example_com',
    });
    const calls = captured.map((c) => `${c.init?.method ?? 'GET'} ${c.url}`);
    expect(calls[0]).toBe('POST http://gateway/auth/login');
    expect(calls[1]).toBe('POST http://gateway/projects/proj1/delegate');
  });

  it('createSimGatewayFetch — http://sim/path → ${gatewayUrl}/path 변환', async () => {
    const captured: Array<{ url: string; init?: RequestInit }> = [];
    const responses = new Map<string, { status: number; body: unknown }>([
      ['http://gateway/auth/login', { status: 200, body: { token: 'tk' } }],
    ]);
    const gatewayFetch = createSimGatewayFetch({
      gatewayUrl: 'http://gateway',
      fetchImpl: fakeFetch(responses, captured),
    });
    const res = await gatewayFetch(
      new Request('http://sim/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'alice@example.com' }),
      }),
    );
    expect(res.status).toBe(200);
    expect(captured[0]?.url).toBe('http://gateway/auth/login');
    expect(captured[0]?.init?.method).toBe('POST');
  });

  it('createSimGatewayFetch — query string 보존', async () => {
    const captured: Array<{ url: string; init?: RequestInit }> = [];
    const responses = new Map<string, { status: number; body: unknown }>([
      ['http://gateway/projects', { status: 200, body: [] }],
    ]);
    const gatewayFetch = createSimGatewayFetch({
      gatewayUrl: 'http://gateway',
      fetchImpl: fakeFetch(responses, captured),
    });
    await gatewayFetch(new Request('http://sim/projects?departmentId=dept_eng'));
    expect(captured[0]?.url).toBe('http://gateway/projects?departmentId=dept_eng');
  });

  it('createSimGatewayFetch — GET 은 body 미전송', async () => {
    const captured: Array<{ url: string; init?: RequestInit }> = [];
    const responses = new Map<string, { status: number; body: unknown }>([
      ['http://gateway/projects/p1', { status: 200, body: { id: 'p1' } }],
    ]);
    const gatewayFetch = createSimGatewayFetch({
      gatewayUrl: 'http://gateway',
      fetchImpl: fakeFetch(responses, captured),
    });
    await gatewayFetch(
      new Request('http://sim/projects/p1', {
        headers: { Authorization: 'Bearer tk' },
      }),
    );
    expect(captured[0]?.init?.method ?? 'GET').toBe('GET');
    expect(captured[0]?.init?.body).toBeUndefined();
  });

  it('createSimGatewayFetch — Authorization 헤더 전파', async () => {
    const captured: Array<{ url: string; init?: RequestInit }> = [];
    const responses = new Map<string, { status: number; body: unknown }>([
      ['http://gateway/secure', { status: 200, body: { ok: true } }],
    ]);
    const gatewayFetch = createSimGatewayFetch({
      gatewayUrl: 'http://gateway',
      fetchImpl: fakeFetch(responses, captured),
    });
    const headers = new Headers();
    headers.set('Authorization', 'Bearer secret-token');
    headers.set('X-Custom', 'value');

    await gatewayFetch(new Request('http://sim/secure', { headers }));

    const sentHeaders = captured[0]?.init?.headers as Headers;
    expect(sentHeaders.get('Authorization')).toBe('Bearer secret-token');
    expect(sentHeaders.get('X-Custom')).toBe('value');
  });

  it('createSimGatewayFetch — timeoutMs 및 AbortSignal 전파', async () => {
    let capturedSignal: AbortSignal | undefined;
    const fetchImpl = (async (_url: string, init?: RequestInit) => {
      capturedSignal = init?.signal;
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }) as unknown as FetchLike;

    const gatewayFetch = createSimGatewayFetch({
      gatewayUrl: 'http://gateway',
      timeoutMs: 1234,
      fetchImpl,
    });

    await gatewayFetch(new Request('http://sim/any'));
    expect(capturedSignal).toBeDefined();
    // signal 이 존재하고 AbortSignal.timeout(1234) 에서 생성되었는지 직접 검증은
    // 브라우저/Node 구현에 따라 어렵지만, signal 주입 여부는 확인됨.
  });

  it('seedBudgetRequest — 발급된 Bearer 토큰이 모든 후속 호출에 포함됨', async () => {
    const captured: Array<{ url: string; init?: RequestInit }> = [];
    const responses = new Map<string, { status: number; body: unknown }>([
      ['http://gateway/auth/login', { status: 200, body: { token: 'alice-jwt' } }],
      ['http://gateway/approvals/requests', { status: 201, body: { id: 'br-1' } }],
      ['http://gateway/approvals/requests/br-1/submit', { status: 200, body: { ok: true } }],
      ['http://gateway/approvals/requests/br-1/start-review', { status: 200, body: { ok: true } }],
    ]);
    const handle = createSimHandle({
      gatewayUrl: 'http://gateway',
      authApiUrl: 'http://auth-api:4001',
      fetchImpl: fakeFetch(responses, captured),
    });

    await handle.fixtures.seedBudgetRequest({
      projectId: 'p1',
      projectDepartmentId: 'd1',
      amount: 100,
      requesterId: handle.fixtures.alice.id,
    });

    // 1번은 login (no auth), 2~4번은 Bearer alice-jwt 확인
    const requests = captured.slice(1);
    for (const req of requests) {
      const h = req.init?.headers as Record<string, string>;
      expect(h['Authorization']).toBe('Bearer alice-jwt');
    }
  });
});
