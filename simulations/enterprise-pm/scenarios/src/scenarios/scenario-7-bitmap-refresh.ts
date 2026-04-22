// @def.boundary sim-scenarios
// @def.doc authorization-ontology-bitmap-pipeline

import { ok, equal, notEqual } from "node:assert/strict";
import type { Scenario } from "../runner/types.js";

interface S7Ctx {
  alice: { email: string; password: string; departmentId: string };
}

/**
 * 시나리오 7 — bitmap 만료 → refresh.
 *
 * §2 bitmap-pipeline §4 (Refresh):
 *   "expiresAt - now < refreshWindow 이면 백그라운드 재발급"
 *   "클라이언트는 expiresAt 임박 시 refresh 엔드포인트 호출"
 *
 * 검증:
 *   - 단계 2: 즉시 호출 → 200/201
 *   - 단계 4: 만료 후 동일 token → 401 + WWW-Authenticate: invalid_token reason="expired"
 *   - 단계 5: POST /auth/refresh → 200 + 새 token (이전 token 과 다름)
 *   - 단계 6: 새 token 으로 protected route 200
 *
 * 본 시나리오는 jwtTtlSeconds=2 로 부팅된 InProcessHandle 이 필요 — test beforeAll 에서 설정.
 */
export const scenario7BitmapRefresh: Scenario<S7Ctx> = {
  name: "scenario-7-bitmap-refresh",
  description: "JWT 만료 → POST /auth/refresh → 새 token 으로 protected route 접근",
  validates: [
    "VersionedBitmap refresh (§2 §4)",
    "JWT TTL 만료 처리",
    "WWW-Authenticate: invalid_token reason=expired",
  ],

  async setup() {
    const handle = (globalThis as unknown as {
      __simHandle?: {
        fixtures: {
          alice: { email: string; password: string; departmentId: string };
          departments: { eng: string };
        };
      };
    }).__simHandle;
    if (!handle) throw new Error("__simHandle not bound");
    return { alice: handle.fixtures.alice };
  },

  async act(ctx) {
    const gatewayFetch = (globalThis as unknown as {
      __simGatewayFetch?: (r: Request) => Promise<Response>;
    }).__simGatewayFetch!;
    const traceIds: string[] = [];

    // 1. login — short TTL bootstrap (jwtTtlSeconds=2)
    const loginRes = await gatewayFetch(
      new Request("http://sim/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: ctx.alice.email, password: ctx.alice.password }),
      }),
    );
    if (!loginRes.ok) throw new Error(`login: ${loginRes.status}`);
    const { token: token1, expiresIn } = (await loginRes.json()) as {
      token: string;
      expiresIn: number;
    };
    traceIds.push(loginRes.headers.get("x-trace-id") ?? "");

    // 2. 즉시 호출 — 200/201 (projects 생성 시도)
    const immediateRes = await gatewayFetch(
      new Request("http://sim/projects", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${token1}`,
        },
        body: JSON.stringify({
          name: "Scenario 7 probe",
          departmentId: ctx.alice.departmentId,
        }),
      }),
    );
    const immediateStatus = immediateRes.status;
    await immediateRes.text().catch(() => null); // drain body

    // 3. TTL + 1 초 대기 (만료)
    await new Promise((r) => setTimeout(r, (expiresIn + 1) * 1000));

    // 4. 만료된 token 으로 호출 → 401 + reason=expired
    const expiredRes = await gatewayFetch(
      new Request("http://sim/projects?departmentId=dept-eng", {
        headers: { Authorization: `Bearer ${token1}` },
      }),
    );
    const expiredStatus = expiredRes.status;
    const wwwAuth = expiredRes.headers.get("www-authenticate") ?? "";
    await expiredRes.text().catch(() => null);

    // 5. POST /auth/refresh
    const refreshRes = await gatewayFetch(
      new Request("http://sim/auth/refresh", {
        method: "POST",
        headers: { Authorization: `Bearer ${token1}` },
      }),
    );
    const refreshStatus = refreshRes.status;
    let token2 = "";
    if (refreshRes.ok) {
      const body = (await refreshRes.json()) as { token: string };
      token2 = body.token;
    } else {
      await refreshRes.text().catch(() => null);
    }

    // 6. 새 token 으로 protected route 재시도 → 200/201
    const reauthRes = token2
      ? await gatewayFetch(
          new Request("http://sim/projects", {
            method: "POST",
            headers: {
              "content-type": "application/json",
              Authorization: `Bearer ${token2}`,
            },
            body: JSON.stringify({
              name: "Scenario 7 reauth",
              departmentId: ctx.alice.departmentId,
            }),
          }),
        )
      : new Response("", { status: 0 });
    await reauthRes.text().catch(() => null);

    return {
      data: {
        ttlSeconds: expiresIn,
        immediateStatus,
        expiredStatus,
        expiredWwwAuth: wwwAuth,
        refreshStatus,
        token1,
        token2,
        reauthStatus: reauthRes.status,
      },
      traceIds: traceIds.filter(Boolean),
      stepCount: 6,
    };
  },

  async assert(_ctx, actResult) {
    const d = actResult.data as Record<string, unknown>;
    equal(d.ttlSeconds, 2, "TTL must be 2 seconds (in-process bootstrap option)");
    ok(
      d.immediateStatus === 200 || d.immediateStatus === 201,
      `immediate call must be 200/201, got ${d.immediateStatus}`,
    );
    equal(d.expiredStatus, 401, "expired token must yield 401");
    ok(
      (d.expiredWwwAuth as string).includes("expired"),
      `WWW-Authenticate must contain "expired", got: ${d.expiredWwwAuth}`,
    );
    equal(d.refreshStatus, 200, "refresh must yield 200");
    notEqual(d.token1, d.token2, "new token must differ from old");
    ok(
      d.reauthStatus === 200 || d.reauthStatus === 201,
      `reauth with new token must be 200/201, got ${d.reauthStatus}`,
    );
  },

  async teardown() {},
};
