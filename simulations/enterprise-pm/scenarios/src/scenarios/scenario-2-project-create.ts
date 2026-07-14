// @def.boundary sim-scenarios
// @def.doc authorization-ontology-resource-lifecycle

import { ok, equal } from 'node:assert/strict';
import type { Scenario } from '../runner/types.js';
import { auditTraceHint } from '../post-run/operator-handoff.js';

interface S2Ctx {
  email: string;
  password: string;
  departmentId: string;
}

/**
 * 시나리오 2 — 프로젝트 생성 + owner 자동 권한.
 *
 * authorization-ontology-resource-lifecycle §3 + lifecycle:
 *   1. POST /projects → 201 + project.id (transaction kind, Pass 1 bitmap allow)
 *   2. resource-policy-store 에 UNREGISTERED entry 자동 생성 (ownerId=alice)
 *   3. GET /projects/:id → 200 — Pass 1 bitmap allow + Pass 2 UNREGISTERED → ownerId 매칭
 */
export const scenario2ProjectCreate: Scenario<S2Ctx> = {
  name: 'scenario-2-project-create',
  description: '프로젝트 생성 + UNREGISTERED 정책 + owner 자동 접근',
  validates: [
    'resource-policy-store state machine',
    'AccessChecker 2-pass',
    'UNREGISTERED → ownerId match',
  ],

  async setup() {
    const handle = (globalThis as any).__simHandle;
    if (!handle) throw new Error('__simHandle not bound');
    return {
      email: handle.fixtures.alice.email,
      password: handle.fixtures.alice.password,
      departmentId: handle.fixtures.departments.eng,
    };
  },

  async act(ctx) {
    const gatewayFetch = (globalThis as any).__simGatewayFetch;
    if (!gatewayFetch) throw new Error('__simGatewayFetch not bound');

    const traceIds: string[] = [];

    // 1. login
    const loginRes = await gatewayFetch(
      new Request('http://sim/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: ctx.email, password: ctx.password }),
      }),
    );
    if (!loginRes.ok) throw new Error(`login: ${loginRes.status} ${await loginRes.text()}`);
    traceIds.push(loginRes.headers.get('x-trace-id') ?? '');
    const { token, userId } = (await loginRes.json()) as {
      token: string;
      userId: string;
    };

    // 2. POST /projects
    const createRes = await gatewayFetch(
      new Request('http://sim/projects', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: 'Demo Project (scenario 2)',
          departmentId: ctx.departmentId,
        }),
      }),
    );
    if (createRes.status !== 201) {
      throw new Error(`POST /projects: status=${createRes.status} body=${await createRes.text()}`);
    }
    traceIds.push(createRes.headers.get('x-trace-id') ?? '');
    const created = (await createRes.json()) as {
      id: string;
      name: string;
      ownerId: string;
      rootSpanId: string;
    };

    // 3. GET /projects/:id
    const getRes = await gatewayFetch(
      new Request(`http://sim/projects/${created.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    );
    if (!getRes.ok) {
      throw new Error(
        `GET /projects/${created.id}: status=${getRes.status} body=${await getRes.text()}`,
      );
    }
    traceIds.push(getRes.headers.get('x-trace-id') ?? '');
    const fetched = (await getRes.json()) as {
      id: string;
      ownerId: string;
      rootSpanId: string;
    };

    return {
      data: {
        userId,
        createdId: created.id,
        createdOwnerId: created.ownerId,
        createdRootSpanId: created.rootSpanId,
        fetchedId: fetched.id,
        fetchedOwnerId: fetched.ownerId,
        fetchedRootSpanId: fetched.rootSpanId,
      },
      traceIds: traceIds.filter(Boolean),
      stepCount: 3,
      operatorHints: [
        auditTraceHint(created.rootSpanId, 'create'),
        auditTraceHint(fetched.rootSpanId, 'fetch'),
      ],
    };
  },

  async assert(_ctx, actResult) {
    const d = actResult.data as Record<string, string>;
    ok(d.createdId, 'created project id missing');
    equal(d.createdOwnerId, d.userId, 'owner must be the user that created (alice)');
    equal(d.fetchedId, d.createdId, 'fetched id must match created id');
    equal(d.fetchedOwnerId, d.userId, 'fetched ownerId must remain alice');
    ok(d.createdRootSpanId && d.createdRootSpanId.length > 0, 'createRootSpanId must exist');
    ok(d.fetchedRootSpanId && d.fetchedRootSpanId.length > 0, 'fetchedRootSpanId must exist');
    ok(actResult.traceIds.length >= 1, `expected >= 1 trace ids, got ${actResult.traceIds.length}`);
    // GET 200 자체가 Pass 2 UNREGISTERED → owner 매칭 통과의 증거.
  },

  async teardown() {
    // handles — 별도 cleanup 없음
  },
};
