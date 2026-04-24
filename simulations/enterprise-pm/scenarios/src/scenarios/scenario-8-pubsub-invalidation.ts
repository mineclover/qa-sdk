// @def.boundary sim-scenarios
// @def.doc authorization-ontology-bitmap-pipeline

import { ok, equal, notEqual } from "node:assert/strict";
import type { Scenario } from "../runner/types.js";
import {
  auditEntryHint,
  auditFirstFailureHint,
  auditTraceHint,
} from "../post-run/operator-handoff.js";

interface S8Ctx {
  bob: { id: string; email: string; password: string };
  admin: { email: string; password: string };
  newRole: { roleId: string; scopeType: string; scopeId: string };
  /** bob 이 초기에 권한 없는 endpoint (budget.approve — member mask 미포함). */
  restrictedEndpoint: string;
  /** admin → auth-api 직접 호출 base URL (gateway proxy 우회). */
  authApiBaseUrl: string;
  engRequestId: string;
}

/**
 * 시나리오 8 — 권한 변경 → invalidation → fresh bitmap 적용.
 *
 * §2 bitmap-pipeline §5 (Invalidation):
 *   admin 이 bob 의 role 을 추가 → BitmapInvalidationPublisher 가 Redis publish
 *   (in-process bootstrap 은 BitmapCacheModule 미활성화 — publish 는 no-op)
 *
 *   핵심 검증:
 *   - JWT self-contained: stale token 은 role 변경 무반영 (여전히 deny)
 *   - 새 login 시 BitmapIssuer 가 최신 role_assignments 조회 → fresh bitmap
 *   - 새 token 으로 protected route 200
 *
 * 본 시나리오는 bob (member, 0x0f00 mask) 로 시작 → admin 이 manager role 추가 →
 * bob 새 login 시 bitmap 은 두 role 의 union (ffff).
 */
export const scenario8PubsubInvalidation: Scenario<S8Ctx> = {
  name: "scenario-8-pubsub-invalidation",
  description:
    "admin 이 role 추가 → Redis pub/sub (옵션) → 새 login 시 fresh bitmap 적용",
  validates: [
    "Bitmap invalidation (§2 §5)",
    "fresh bitmap re-issue on login",
    "JWT self-contained semantics",
  ],

  async setup() {
    const handle = (globalThis as unknown as { __simHandle?: unknown })
      .__simHandle as
      | {
          fixtures: {
            bob: { id: string; email: string; password: string };
            admin: { email: string; password: string };
            alice: { id: string };
            departments: { eng: string };
            roles: { manager: { id: string } };
            seedBudgetRequest: (args: {
              projectId: string;
              projectDepartmentId: string;
              amount: number;
              requesterId: string;
            }) => Promise<{ id: string }>;
          };
          authApp: {
            getHttpServer: () => { address: () => { port: number } | null };
          };
        }
      | undefined;
    if (!handle) throw new Error("__simHandle not bound");
    const fx = handle.fixtures;
    const addr = handle.authApp.getHttpServer().address();
    if (!addr) throw new Error("authApp address not available");
    const authApiBaseUrl = `http://127.0.0.1:${addr.port}`;

    // engineering budget request 를 하나 시드 — bob 이 approve 시도할 대상.
    // requesterId=alice, bob 은 member 로 initial bitmap mask 가 budget.approve (addr 10) 미포함.
    const engReq = await fx.seedBudgetRequest({
      projectId: "proj-scenario-8",
      projectDepartmentId: fx.departments.eng,
      amount: 500_000,
      requesterId: fx.alice.id,
    });

    return {
      bob: fx.bob,
      admin: fx.admin,
      newRole: {
        roleId: fx.roles.manager.id,
        scopeType: "department",
        scopeId: fx.departments.eng,
      },
      // bob 의 재시도 endpoint — 생성된 eng budget request 의 approve 경로.
      restrictedEndpoint: `/approvals/requests/${engReq.id}/decisions`,
      authApiBaseUrl,
      engRequestId: engReq.id,
    };
  },

  async act(ctx) {
    const gatewayFetch = (globalThis as unknown as {
      __simGatewayFetch?: (r: Request) => Promise<Response>;
    }).__simGatewayFetch!;
    const traceIds: string[] = [];

    // 1. bob login → token1 (초기 mask 0x0f00)
    const bobLogin1 = await gatewayFetch(
      new Request("http://sim/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: ctx.bob.email,
          password: ctx.bob.password,
        }),
      }),
    );
    if (!bobLogin1.ok) throw new Error(`bob login1: ${bobLogin1.status}`);
    const { token: token1 } = (await bobLogin1.json()) as { token: string };
    traceIds.push(bobLogin1.headers.get("x-trace-id") ?? "");

    // 2. 초기 approve 시도 (member mask 미포함) → 403
    const initialDeny = await gatewayFetch(
      new Request(`http://sim${ctx.restrictedEndpoint}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${token1}`,
        },
        body: JSON.stringify({ decision: "approve", comment: "initial try" }),
      }),
    );
    const initialDenyStatus = initialDeny.status;
    let initialDenyBody: Record<string, unknown> | null = null;
    try {
      initialDenyBody = (await initialDeny.json()) as Record<string, unknown>;
    } catch {
      initialDenyBody = null;
    }
    traceIds.push(initialDeny.headers.get("x-trace-id") ?? "");
    const initialDenyMeta = ((initialDenyBody?.message as Record<string, unknown>) ??
      initialDenyBody ??
      {}) as {
      rootSpanId?: string;
      firstFailureSpanId?: string;
    };

    // 3. admin → auth-api 직접 role assign (gateway proxy 우회)
    const assignRes = await fetch(`${ctx.authApiBaseUrl}/assignments`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        userId: ctx.bob.id,
        roleId: ctx.newRole.roleId,
        scopeType: ctx.newRole.scopeType,
        scopeId: ctx.newRole.scopeId,
      }),
    });
    if (!assignRes.ok) {
      throw new Error(
        `assign: ${assignRes.status} ${await assignRes.text()}`,
      );
    }

    // 4. invalidation publish 전파 대기 (in-process 는 no-op but test 안정)
    await new Promise((r) => setTimeout(r, 100));

    // 5. stale token1 로 재시도 — JWT self-contained → 여전히 403
    const staleRes = await gatewayFetch(
      new Request(`http://sim${ctx.restrictedEndpoint}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${token1}`,
        },
        body: JSON.stringify({ decision: "approve", comment: "stale retry" }),
      }),
    );
    const staleStatus = staleRes.status;
    let staleBody: Record<string, unknown> | null = null;
    try {
      staleBody = (await staleRes.json()) as Record<string, unknown>;
    } catch {
      staleBody = null;
    }
    const staleMeta = ((staleBody?.message as Record<string, unknown>) ??
      staleBody ??
      {}) as {
      rootSpanId?: string;
      firstFailureSpanId?: string;
    };

    // 6. bob 다시 login → token2 (fresh bitmap with new manager role)
    const bobLogin2 = await gatewayFetch(
      new Request("http://sim/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: ctx.bob.email,
          password: ctx.bob.password,
        }),
      }),
    );
    if (!bobLogin2.ok) throw new Error(`bob login2: ${bobLogin2.status}`);
    const { token: token2 } = (await bobLogin2.json()) as { token: string };

    // 7. token2 로 재시도 — manager role bits 포함 → 200/201
    const freshRes = await gatewayFetch(
      new Request(`http://sim${ctx.restrictedEndpoint}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${token2}`,
        },
        body: JSON.stringify({ decision: "approve", comment: "fresh retry" }),
      }),
    );
    const freshStatus = freshRes.status;
    let freshBody: Record<string, unknown> | null = null;
    try {
      freshBody = (await freshRes.json()) as Record<string, unknown>;
    } catch {
      freshBody = null;
    }

    return {
      data: {
        initialDenyStatus,
        initialDenyMeta,
        assignStatus: assignRes.status,
        staleStatus,
        staleMeta,
        freshStatus,
        freshRootSpanId:
          typeof freshBody?.rootSpanId === "string"
            ? freshBody.rootSpanId
            : null,
        token1,
        token2,
      },
      traceIds: traceIds.filter(Boolean),
      stepCount: 7,
      operatorHints: [
        ...(initialDenyMeta.rootSpanId
          ? [
              auditTraceHint(initialDenyMeta.rootSpanId, "initial-deny-trace"),
              auditFirstFailureHint(
                initialDenyMeta.rootSpanId,
                "initial-deny-first-failure",
              ),
            ]
          : []),
        ...(initialDenyMeta.firstFailureSpanId
          ? [
              auditEntryHint(
                initialDenyMeta.firstFailureSpanId,
                "initial-deny-entry",
              ),
            ]
          : []),
        ...(staleMeta.rootSpanId
          ? [
              auditTraceHint(staleMeta.rootSpanId, "stale-deny-trace"),
              auditFirstFailureHint(
                staleMeta.rootSpanId,
                "stale-deny-first-failure",
              ),
            ]
          : []),
        ...(staleMeta.firstFailureSpanId
          ? [
              auditEntryHint(
                staleMeta.firstFailureSpanId,
                "stale-deny-entry",
              ),
            ]
          : []),
        ...(typeof freshBody?.rootSpanId === "string"
          ? [
              auditTraceHint(freshBody.rootSpanId, "fresh-approve-trace"),
            ]
          : []),
      ],
    };
  },

  async assert(_ctx, actResult) {
    const d = actResult.data as Record<string, unknown>;
    ok(
      d.initialDenyStatus === 403 || d.initialDenyStatus === 404,
      `initial call should be 403/404 (member mask 미포함), got ${d.initialDenyStatus}`,
    );
    ok(
      d.assignStatus === 200 || d.assignStatus === 201,
      `admin role assign must succeed, got ${d.assignStatus}`,
    );
    // stale token 은 JWT embed → role 변경 무반영, 여전히 deny.
    ok(
      d.staleStatus === 403 || d.staleStatus === 401,
      `stale token should still be denied (JWT self-contained), got ${d.staleStatus}`,
    );
    // 새 token 으로 승인 성공 — fresh bitmap 에는 manager mask (ffff) 포함.
    ok(
      d.freshStatus === 200 || d.freshStatus === 201,
      `fresh token (with new role) must yield 200/201, got ${d.freshStatus}`,
    );
    notEqual(d.token1, d.token2, "tokens must differ after role change");
  },

  async teardown() {},
};
