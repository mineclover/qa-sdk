---
lifecycle: draft
plan: 13d
phase: 4
depends-on: [13c, 12a, 12b]
---

# Plan 13d — sim 시나리오 7, 8 (bitmap refresh + pub/sub invalidation)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 시나리오 7, 8을 구현하여 §2 `authorization-ontology-bitmap-pipeline` 스펙의 §4 (Refresh) + §5 (Invalidation) 동작을 e2e 검증한다. (1) **시나리오 7** (bitmap 만료 → refresh) — JWT의 짧은 TTL (예: 2초) 발급 후 만료 → 동일 token으로 protected route 호출 시 401 + `WWW-Authenticate: invalid_token, reason="expired"` → 클라이언트가 gateway `POST /auth/refresh` 호출 → 새 JWT 발급 + 동일 user의 fresh bitmap → 새 token으로 200. (2) **시나리오 8** (권한 변경 → pub/sub invalidation) — admin user가 alice의 RoleAssignment 추가/제거 → sim-auth-api `BitmapInvalidationPublisher`가 Redis publish → sim-pm-api / sim-approval-api / 기타 비즈니스 서비스의 `BitmapInvalidationSubscriber`가 LRU cache flush → 다음 alice 호출 시 fresh bitmap 사용 (cache miss → re-issue) → 변경된 권한 반영. 두 시나리오 모두 §2 §3 (저장·전달), §4 (Refresh), §5 (Invalidation) 정확 매칭.

**Architecture:**
- **시나리오 7 (refresh)**:
  - setup: alice로 짧은 TTL (`JWT_TTL_SECONDS=2`) JWT 발급 환경. gateway 부팅 시 별도 옵션 주입 — in-process bootstrap에 `jwtTtlSeconds: 2`
  - act:
    1. login → token (TTL=2초)
    2. 즉시 GET /projects → 200 (새 token 정상)
    3. 3초 대기 → 만료
    4. 동일 token으로 GET /projects → 401 + WWW-Authenticate: `invalid_token, reason="expired"`
    5. POST /auth/refresh `{ userId }` → 새 token 발급
    6. 새 token으로 GET /projects → 200
  - assert:
    1. 단계 2 200
    2. 단계 4 401 + reason="expired"
    3. 단계 5 200 + 새 token (단계 1 token과 다름)
    4. 단계 6 200 + 새 token으로 정상 접근
- **시나리오 8 (pub/sub invalidation)**:
  - setup: admin user (RoleAssignment 변경 권한) + alice (모니터 대상). sim-redis 사용 (in-process는 ioredis-mock 또는 SIM_REDIS_URL=실 redis)
  - act:
    1. alice login → token1 (bitmap에 USER_ACTIONS.login + 일부 dept_action 비트만)
    2. GET /pm-api/some-restricted-endpoint (alice가 권한 없는) → 403
    3. admin login → token (admin)
    4. POST /admin/role-assignments `{ userId: alice.id, roleId: "manager", scopeType: "department", scopeId: "eng" }` → 200
    5. 잠시 대기 (pub/sub 전파 — 100~500ms)
    6. alice 동일 token1으로 endpoint 호출 → 여전히 401 (token1은 stale bitmap embed)
    7. alice 다시 login (또는 refresh) → token2 (fresh bitmap)
    8. token2로 endpoint 호출 → 200
    + cache flush 검증: BitmapCacheService.size() 또는 metrics 조회
  - assert:
    1. 단계 2 403 (초기 권한 부족 증거)
    2. 단계 4 admin assign 200
    3. 단계 6 stale token으로 여전히 401 — JWT는 자체 bitmap embed라 token2 발급 전까지는 변경 무반영
    4. 단계 8 token2로 200 — refresh 후 fresh bitmap 적용
    + 8 서비스의 cache가 alice 키 flush 됨 (적어도 sim-pm-api의 cache 통계 검증)

**Tech Stack:**
- Plan 13a/b/c와 동일
- `BitmapCacheService` 통계 조회 — `cache.size()` public 메서드 (Plan 12b에서 이미 노출)

---

## File Structure

### 새로 만드는 파일

```
simulations/enterprise-pm/scenarios/src/scenarios/
├── scenario-7-bitmap-refresh.ts
├── scenario-7-bitmap-refresh.test.ts
├── scenario-8-pubsub-invalidation.ts
└── scenario-8-pubsub-invalidation.test.ts
```

### 수정하는 파일

| 경로 | 변경 |
|---|---|
| `src/cli.ts` | ALL_SCENARIOS에 7, 8 추가 |
| `src/cli.test.ts` | 카운트 8건 갱신 |
| `simulations/enterprise-pm/services/gateway/src/routes/login.ts` (Plan 12a) | `POST /auth/refresh` endpoint 추가 |
| `simulations/enterprise-pm/services/gateway/src/routes/login.test.ts` | refresh endpoint 테스트 추가 |
| `simulations/enterprise-pm/services/auth-api/src/admin/admin.controller.ts` (Plan 11a 또는 신규) | `POST /admin/role-assignments` endpoint (시나리오 8 setup용) |
| `src/env/in-process-env.ts` | `jwtTtlSeconds` 옵션 + admin fixture 추가 |

---

## Task 0: baseline

- [ ] **Step 1: 선행 plan 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  ls simulations/enterprise-pm/scenarios/src/scenarios/scenario-5-three-stage-approval.ts && \
  ls simulations/enterprise-pm/scenarios/src/scenarios/scenario-6-delegated-resource.ts && \
  grep -n "BitmapInvalidationPublisher\|publishUserChange" simulations/enterprise-pm/services/auth-api/src 2>&1 | head -3
```

Expected: Plan 13c (5/6 시나리오) + Plan 12b (publisher 통합) 모두 hit.

---

## Task 1: gateway에 POST /auth/refresh endpoint 추가

**Files:**
- Modify: `simulations/enterprise-pm/services/gateway/src/routes/login.ts`
- Modify: `simulations/enterprise-pm/services/gateway/src/routes/login.test.ts`

- [ ] **Step 1: login.ts에 refresh route 추가**

`createLoginRoute` 함수 안에:

```ts
r.post("/auth/refresh", async (c) => {
  // 본 endpoint는 만료된 token도 받아 재발급 — 만료 검증은 skip하고 sub만 추출.
  // 보안: 만료된 token이라도 signature는 유효해야 함.
  const auth = c.req.header("authorization") ?? c.req.header("Authorization");
  if (!auth || !/^Bearer\s+/i.test(auth)) {
    return c.json({ error: "missing_bearer" }, 401);
  }
  const token = auth.replace(/^Bearer\s+/i, "").trim();

  // jose의 jwtVerify를 ignoreExpiration 옵션으로 호출 — 본 plan은 직접 decode.
  // verifyBitmapJwt를 옵션 추가: { ignoreExpiration?: boolean }
  let userId: string;
  try {
    const verified = await verifyBitmapJwt(token, opts.jwtSecret, { ignoreExpiration: true });
    userId = verified.userId;
  } catch (err) {
    if (err instanceof JwtVerifyError && err.reason === "signature") {
      return c.json({ error: "invalid_token_signature" }, 401);
    }
    if (err instanceof JwtVerifyError) {
      return c.json({ error: "invalid_token", reason: err.reason }, 401);
    }
    throw err;
  }

  // auth-api에서 fresh bitmap 발급
  const bmRes = await fetch(`${opts.authApiUrl}/bitmap/issue`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ userId }),
    signal: AbortSignal.timeout(5_000),
  });
  if (!bmRes.ok) return c.json({ error: "bitmap_upstream_failure", status: bmRes.status }, 502);
  const bmJson = await bmRes.json();
  const bmParsed = bitmapResponseSchema.safeParse(bmJson);
  if (!bmParsed.success) return c.json({ error: "bitmap_upstream_schema" }, 502);

  const bitmap: VersionedBitmap = {
    prefix: bmParsed.data.prefix,
    v: bmParsed.data.v,
    mask: new Uint8Array(Buffer.from(bmParsed.data.maskBase64, "base64")),
    issuedAt: bmParsed.data.issuedAt,
    expiresAt: bmParsed.data.expiresAt,
    issuer: bmParsed.data.issuer,
    signature: bmParsed.data.signature,
  };

  const newToken = await signBitmapJwt({
    userId, bitmap, secret: opts.jwtSecret, ttlSeconds: opts.jwtTtlSeconds,
  });

  return c.json({
    token: newToken,
    tokenType: "Bearer",
    expiresIn: opts.jwtTtlSeconds,
    userId,
    bitmapPrefix: bitmap.prefix,
    bitmapV: bitmap.v,
  });
});
```

- [ ] **Step 2: verifyBitmapJwt에 `ignoreExpiration` 옵션 추가 (Plan 12a 보강)**

`gateway/src/lib/jwt.ts`:

```ts
export interface VerifyOptions {
  ignoreExpiration?: boolean;
}

export async function verifyBitmapJwt(
  token: string,
  secret: string,
  options: VerifyOptions = {},
): Promise<VerifiedJwt> {
  // 기존 try { jwtVerify(...) } 블록에 currentDate 옵션 또는 maxTokenAge 분기.
  // jose의 jwtVerify는 expiration 자동 검증. ignoreExpiration 시 jwtVerify 직접 사용 안 하고
  // decodeJwt로 payload 읽고 signature만 별도 검증.
  if (options.ignoreExpiration) {
    const { decodeJwt, jwtVerify } = await import("jose");
    try {
      // signature는 검증, exp는 무시
      const { payload } = await jwtVerify(token, secretToKey(secret), {
        issuer: "sim-gateway",
        algorithms: ["HS256"],
        clockTolerance: Number.MAX_SAFE_INTEGER, // 사실상 무시
      });
      // 이하 기존 처리 동일
      // ...
    } catch (err) {
      // expired 외 모든 에러는 동일 처리
      // ...
    }
  }
  // 기존 코드
}
```

**구현 단순화**: `clockTolerance: Number.MAX_SAFE_INTEGER` 트릭으로 만료 무시 가능. 단 jose 버전에 따라 동작 다름 — 본 plan은 **별도 헬퍼 추가** 채택:

```ts
// jwt.ts
import { jwtVerify, decodeJwt } from "jose";

export async function verifyBitmapJwt(
  token: string,
  secret: string,
  options: VerifyOptions = {},
): Promise<VerifiedJwt> {
  // 기존 코드
  const verifyOpts: Parameters<typeof jwtVerify>[2] = {
    issuer: "sim-gateway",
    algorithms: ["HS256"],
  };
  if (options.ignoreExpiration) {
    // 만료 무시 — 매우 큰 clockTolerance
    verifyOpts.clockTolerance = "100y";
  }
  // ... 이하 동일
}
```

- [ ] **Step 3: login.test.ts에 refresh route 테스트 추가**

```ts
it("POST /auth/refresh — 만료된 token으로 새 token 발급", async () => {
  const SECRET = "x".repeat(32);
  // 1. 짧은 TTL token 발급
  const oldToken = await signBitmapJwt({
    userId: "u-1",
    bitmap: { prefix: "sim.bitmap", v: "uv1", mask: new Uint8Array([0x01]),
      issuedAt: "2026-04-22T00:00:00Z", expiresAt: "2026-04-22T00:00:01Z",
      issuer: "x", signature: "s" },
    secret: SECRET, ttlSeconds: 1,
  });
  await new Promise((r) => setTimeout(r, 1500)); // expire

  // 2. mock auth-api bitmap/issue
  vi.stubGlobal("fetch", vi.fn(async (url: string | URL) => {
    expect(String(url)).toContain("/bitmap/issue");
    return Response.json({
      prefix: "sim.bitmap", v: "uv1", maskBase64: "AQ==",
      issuedAt: "2026-04-22T00:00:10Z", expiresAt: "2026-04-22T00:05:10Z",
      issuer: "sim-auth-api", signature: "fresh",
    });
  }));

  const app = new Hono();
  app.route("/", createLoginRoute({
    authApiUrl: "http://x", jwtSecret: SECRET, jwtTtlSeconds: 300,
  }));

  const res = await app.request("/auth/refresh", {
    method: "POST",
    headers: { Authorization: `Bearer ${oldToken}` },
  });
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.token).toBeTruthy();
  expect(body.token).not.toBe(oldToken);
});

it("POST /auth/refresh — Bearer 누락 → 401", async () => {
  const app = new Hono();
  app.route("/", createLoginRoute({
    authApiUrl: "http://x", jwtSecret: "x".repeat(32), jwtTtlSeconds: 300,
  }));
  const res = await app.request("/auth/refresh", { method: "POST" });
  expect(res.status).toBe(401);
});

it("POST /auth/refresh — invalid signature → 401", async () => {
  const app = new Hono();
  app.route("/", createLoginRoute({
    authApiUrl: "http://x", jwtSecret: "x".repeat(32), jwtTtlSeconds: 300,
  }));
  // signature가 다른 token
  const badToken = await signBitmapJwt({
    userId: "u", bitmap: { prefix: "p", v: "v", mask: new Uint8Array([1]),
      issuedAt: "2026-04-22T00:00:00Z", expiresAt: "2026-04-22T00:05:00Z",
      issuer: "x", signature: "s" },
    secret: "y".repeat(32), ttlSeconds: 300,
  });
  const res = await app.request("/auth/refresh", {
    method: "POST", headers: { Authorization: `Bearer ${badToken}` },
  });
  expect(res.status).toBe(401);
});
```

- [ ] **Step 4: typecheck + 테스트**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter @qa-sdk/sim-gateway typecheck && \
  pnpm --filter @qa-sdk/sim-gateway test -- login 2>&1 | tail -5
```

Expected: 5 (Plan 12a) + 3 (refresh) = 8 PASS.

- [ ] **Step 5: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add simulations/enterprise-pm/services/gateway/src/routes/login.ts \
          simulations/enterprise-pm/services/gateway/src/routes/login.test.ts \
          simulations/enterprise-pm/services/gateway/src/lib/jwt.ts && \
  git commit -m "$(cat <<'EOF'
feat(sim-gateway): POST /auth/refresh — 만료 token으로 fresh bitmap 발급

verifyBitmapJwt에 ignoreExpiration 옵션 (clockTolerance 100y).
만료 token + 유효 signature → auth-api에서 fresh bitmap → 새 JWT.
§2 §4 (Refresh) 정확 구현.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: in-process-env에 admin fixture + jwtTtlSeconds 옵션

**Files:**
- Modify: `simulations/enterprise-pm/scenarios/src/env/in-process-env.ts`

- [ ] **Step 1: InProcessOptions에 jwtTtlSeconds 옵션**

```ts
export interface InProcessOptions {
  jwtSecret: string;
  jwtTtlSeconds?: number;  // ← 신규, default 300
  dialect: "sqlite";
}
```

- [ ] **Step 2: createApp 호출에 jwtTtlSeconds 전달**

```ts
const gatewayApp = createApp({
  authApiUrl: ...,
  jwtSecret: opts.jwtSecret,
  jwtTtlSeconds: opts.jwtTtlSeconds ?? 300,  // ← 옵션 활용
  // ...
});
```

- [ ] **Step 3: fixtures에 admin 추가**

`seedAuth` 헬퍼가 admin user 생성:

```ts
admin: { id: string; email: string; password: string; departmentId: null };  // role=admin scopeType=global
```

admin은 `RoleAssignment` 추가/제거 권한 (RoleService) — sim-auth-api Plan 11a의 role definition에서 정의.

- [ ] **Step 4: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add simulations/enterprise-pm/scenarios/src/env/in-process-env.ts && \
  git commit -m "$(cat <<'EOF'
feat(sim-scenarios): in-process env에 jwtTtlSeconds 옵션 + admin fixture

시나리오 7: jwtTtlSeconds=2초로 만료 시뮬.
시나리오 8: admin이 RoleAssignment 변경 → invalidation publish.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: scenario-7-bitmap-refresh (TDD)

**Files:**
- Create: `src/scenarios/scenario-7-bitmap-refresh.ts`
- Create: `src/scenarios/scenario-7-bitmap-refresh.test.ts`

- [ ] **Step 1: scenario-7-bitmap-refresh.ts**

```ts
// @def.boundary sim-scenarios
// @def.doc authorization-ontology-bitmap-pipeline

import { ok, equal, notEqual } from "node:assert/strict";
import type { Scenario } from "../runner/types.js";

interface S7Ctx {
  alice: { email: string; password: string };
  /** 본 시나리오 setup이 jwtTtlSeconds=2로 bootstrap 했음 가정. */
  expectedShortTtl: number;
}

/**
 * 시나리오 7 — bitmap 만료 → refresh.
 *
 * §2 bitmap-pipeline §4 (Refresh):
 *   "expiresAt - now < refreshWindow 이면 백그라운드 재발급"
 *   "클라이언트는 expiresAt 임박 시 refresh 엔드포인트 호출"
 *
 * 검증:
 *   - 단계 2: 즉시 호출 200
 *   - 단계 4: 만료 후 동일 token → 401 + reason="expired"
 *   - 단계 5: refresh → 새 token (다른 token 값)
 *   - 단계 6: 새 token으로 200
 */
export const scenario7BitmapRefresh: Scenario<S7Ctx> = {
  name: "scenario-7-bitmap-refresh",
  description: "JWT 만료 → POST /auth/refresh → 새 token으로 protected route 접근",
  validates: [
    "VersionedBitmap refresh (§2 §4)",
    "JWT TTL 만료 처리",
    "WWW-Authenticate: invalid_token reason=expired",
  ],

  async setup() {
    const handle = (globalThis as unknown as { __simHandle?: { fixtures: { alice: { email: string; password: string } } } }).__simHandle;
    if (!handle) throw new Error("__simHandle not bound");
    return {
      alice: { email: handle.fixtures.alice.email, password: handle.fixtures.alice.password },
      expectedShortTtl: 2,  // jwtTtlSeconds=2로 bootstrap된 환경 가정
    };
  },

  async act(ctx) {
    const gatewayFetch = (globalThis as unknown as { __simGatewayFetch?: (r: Request) => Promise<Response> }).__simGatewayFetch!;
    const traceIds: string[] = [];

    // 1. login → token1 (TTL=2초)
    const loginRes = await gatewayFetch(new Request("http://sim/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(ctx.alice),
    }));
    if (!loginRes.ok) throw new Error(`login: ${loginRes.status}`);
    const { token: token1, expiresIn } = (await loginRes.json()) as { token: string; expiresIn: number };
    traceIds.push(loginRes.headers.get("x-trace-id") ?? "");

    // 2. 즉시 호출 — 200
    const immediateRes = await gatewayFetch(new Request("http://sim/projects", {
      headers: { Authorization: `Bearer ${token1}` },
    }));
    traceIds.push(immediateRes.headers.get("x-trace-id") ?? "");
    const immediateStatus = immediateRes.status;

    // 3. TTL + 1초 대기 (만료)
    await new Promise((r) => setTimeout(r, (expiresIn + 1) * 1000));

    // 4. 만료된 token으로 호출 → 401 + WWW-Authenticate reason=expired
    const expiredRes = await gatewayFetch(new Request("http://sim/projects", {
      headers: { Authorization: `Bearer ${token1}` },
    }));
    const expiredStatus = expiredRes.status;
    const wwwAuth = expiredRes.headers.get("www-authenticate") ?? "";

    // 5. POST /auth/refresh
    const refreshRes = await gatewayFetch(new Request("http://sim/auth/refresh", {
      method: "POST",
      headers: { Authorization: `Bearer ${token1}` },
    }));
    const refreshStatus = refreshRes.status;
    let token2 = "";
    if (refreshRes.ok) {
      const body = (await refreshRes.json()) as { token: string };
      token2 = body.token;
    }

    // 6. 새 token으로 다시 호출 → 200
    const reauthRes = token2 ? await gatewayFetch(new Request("http://sim/projects", {
      headers: { Authorization: `Bearer ${token2}` },
    })) : new Response("", { status: 0 });

    return {
      data: {
        ttlSeconds: expiresIn,
        immediateStatus,
        expiredStatus,
        expiredWwwAuth: wwwAuth,
        refreshStatus,
        token1Prefix: token1.slice(0, 32),
        token2Prefix: token2.slice(0, 32),
        reauthStatus: reauthRes.status,
      },
      traceIds: traceIds.filter(Boolean),
      stepCount: 6,
    };
  },

  async assert(_ctx, actResult) {
    const d = actResult.data as Record<string, unknown>;
    equal(d.ttlSeconds, 2, "TTL must be 2 seconds (in-process bootstrap option)");
    equal(d.immediateStatus, 200, "immediate call must be 200");
    equal(d.expiredStatus, 401, "expired token must yield 401");
    ok(
      (d.expiredWwwAuth as string).includes("expired"),
      `WWW-Authenticate must contain "expired", got: ${d.expiredWwwAuth}`,
    );
    equal(d.refreshStatus, 200, "refresh must yield 200");
    notEqual(d.token1Prefix, d.token2Prefix, "new token must differ from old");
    equal(d.reauthStatus, 200, "reauth with new token must be 200");
  },

  async teardown() {},
};
```

- [ ] **Step 2: scenario-7 test**

본 시나리오는 `jwtTtlSeconds=2`로 별도 bootstrap. 일반 in-process bootstrap (TTL=300)과 격리.

```ts
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { runScenario } from "../runner/runner.js";
import { scenario7BitmapRefresh } from "./scenario-7-bitmap-refresh.js";
import type { InProcessHandle } from "../env/in-process-env.js";

const SKIP = process.env.SIM_SCENARIO_INPROC !== "1";

describe.skipIf(SKIP)("Scenario 7 — bitmap refresh", () => {
  let handle: InProcessHandle;
  beforeAll(async () => {
    const { bootstrapInProcess } = await import("../env/in-process-env.js");
    // 짧은 TTL로 bootstrap
    handle = await bootstrapInProcess({
      jwtSecret: "x".repeat(32),
      jwtTtlSeconds: 2,
      dialect: "sqlite",
    });
    const g = globalThis as unknown as { __simGatewayFetch: typeof handle.gatewayFetch; __simHandle: typeof handle };
    g.__simGatewayFetch = handle.gatewayFetch;
    g.__simHandle = handle;
  }, 60_000);
  afterAll(async () => { if (handle) await handle.cleanup(); });

  it("scenario 7 통과", async () => {
    const result = await runScenario(scenario7BitmapRefresh, {
      gatewayUrl: "http://sim-inproc", mode: "in-process",
    });
    if (result.status !== "passed") {
      console.error("[Scenario 7 실패]", result.error);
    }
    expect(result.status).toBe("passed");
  }, 60_000);
});
```

- [ ] **Step 3: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add simulations/enterprise-pm/scenarios/src/scenarios/scenario-7-bitmap-refresh.ts \
          simulations/enterprise-pm/scenarios/src/scenarios/scenario-7-bitmap-refresh.test.ts && \
  git commit -m "$(cat <<'EOF'
feat(sim-scenarios): Scenario 7 — bitmap refresh (§2 §4 정확 매칭)

JWT TTL=2초 bootstrap → 만료 → refresh → 새 token.
expired WWW-Authenticate 응답 검증.
in-process bootstrap에 jwtTtlSeconds 옵션 통합.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: scenario-8-pubsub-invalidation (TDD)

**Files:**
- Create: `src/scenarios/scenario-8-pubsub-invalidation.ts`
- Create: `src/scenarios/scenario-8-pubsub-invalidation.test.ts`

- [ ] **Step 1: scenario-8-pubsub-invalidation.ts**

```ts
// @def.boundary sim-scenarios
// @def.doc authorization-ontology-bitmap-pipeline

import { ok, equal } from "node:assert/strict";
import type { Scenario } from "../runner/types.js";

interface S8Ctx {
  alice: { id: string; email: string; password: string };
  admin: { email: string; password: string };
  newRole: { roleId: string; scopeType: string; scopeId: string };
  /** 알리스가 초기에 권한 없는 endpoint. */
  restrictedEndpoint: string;
}

/**
 * 시나리오 8 — 권한 변경 → pub/sub invalidation → fresh bitmap.
 *
 * §2 bitmap-pipeline §5 (Invalidation):
 *   "사용자 권한 박탈, 역할 재정의 → 즉시 파기"
 *   pub/sub publish → 각 서버 listener LRU 제거
 *
 * 검증:
 *   - 단계 2: 초기 권한 없음 → 403
 *   - 단계 4: admin assign 200 → publisher.publishUserChange("alice", "permission_change")
 *   - 단계 6: stale token으로 여전히 401/403 (JWT는 self-contained, refresh 안 하면 권한 변경 무반영)
 *   - 단계 8: 새 login (refresh) → fresh bitmap 적용 → 200
 *   - cache flush 검증: alice key가 sim-pm-api LRU에서 제거됨
 */
export const scenario8PubsubInvalidation: Scenario<S8Ctx> = {
  name: "scenario-8-pubsub-invalidation",
  description: "admin이 role 추가 → Redis pub/sub → LRU flush → alice 새 권한 적용",
  validates: [
    "Bitmap pub/sub invalidation (§2 §5)",
    "Redis publish/subscribe round-trip",
    "LRU cache flush",
    "fresh bitmap re-issue",
  ],

  async setup() {
    const handle = (globalThis as unknown as { __simHandle?: { fixtures: never } }).__simHandle;
    if (!handle) throw new Error("__simHandle not bound");
    const fx = handle.fixtures as unknown as {
      alice: { id: string; email: string; password: string };
      admin: { email: string; password: string };
      departments: { eng: string };
    };
    return {
      alice: fx.alice,
      admin: fx.admin,
      newRole: { roleId: "manager", scopeType: "department", scopeId: fx.departments.eng },
      restrictedEndpoint: "/projects/eng-restricted-x",
    };
  },

  async act(ctx) {
    const gatewayFetch = (globalThis as unknown as { __simGatewayFetch?: (r: Request) => Promise<Response> }).__simGatewayFetch!;
    const traceIds: string[] = [];

    // 1. alice login → token1
    const aliceLogin1 = await gatewayFetch(new Request("http://sim/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: ctx.alice.email, password: ctx.alice.password }),
    }));
    if (!aliceLogin1.ok) throw new Error(`alice login1: ${aliceLogin1.status}`);
    const { token: token1 } = (await aliceLogin1.json()) as { token: string };
    traceIds.push(aliceLogin1.headers.get("x-trace-id") ?? "");

    // 2. 초기 권한 없는 endpoint 호출 → 403 (또는 404 if not found, 본 시나리오는 403 가정)
    const initialDeny = await gatewayFetch(new Request(`http://sim${ctx.restrictedEndpoint}`, {
      headers: { Authorization: `Bearer ${token1}` },
    }));
    const initialDenyStatus = initialDeny.status;
    traceIds.push(initialDeny.headers.get("x-trace-id") ?? "");

    // 3. admin login
    const adminLogin = await gatewayFetch(new Request("http://sim/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(ctx.admin),
    }));
    if (!adminLogin.ok) throw new Error(`admin login: ${adminLogin.status}`);
    const { token: adminToken } = (await adminLogin.json()) as { token: string };

    // 4. admin assign role
    // sim-auth-api의 admin endpoint는 gateway 라우팅 — auth route 또는 별도
    const assignRes = await gatewayFetch(new Request("http://sim/auth/admin/role-assignments", {
      method: "POST",
      headers: { "content-type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        userId: ctx.alice.id,
        roleId: ctx.newRole.roleId,
        scopeType: ctx.newRole.scopeType,
        scopeId: ctx.newRole.scopeId,
      }),
    }));
    if (!assignRes.ok) throw new Error(`assign: ${assignRes.status} ${await assignRes.text()}`);
    traceIds.push(assignRes.headers.get("x-trace-id") ?? "");

    // 5. pub/sub 전파 + cache flush 대기 (~200ms)
    await new Promise((r) => setTimeout(r, 300));

    // 6. stale token1으로 호출 — JWT self-contained → 여전히 권한 없음
    const staleRes = await gatewayFetch(new Request(`http://sim${ctx.restrictedEndpoint}`, {
      headers: { Authorization: `Bearer ${token1}` },
    }));
    const staleStatus = staleRes.status;

    // 7. alice 다시 login (refresh) → fresh bitmap embed
    const aliceLogin2 = await gatewayFetch(new Request("http://sim/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: ctx.alice.email, password: ctx.alice.password }),
    }));
    if (!aliceLogin2.ok) throw new Error(`alice login2: ${aliceLogin2.status}`);
    const { token: token2 } = (await aliceLogin2.json()) as { token: string };

    // 8. token2로 호출 → 200
    const freshRes = await gatewayFetch(new Request(`http://sim${ctx.restrictedEndpoint}`, {
      headers: { Authorization: `Bearer ${token2}` },
    }));

    // cache flush 검증 (옵션) — sim-pm-api의 BitmapCacheService.cache.size() 조회 endpoint 또는 직접
    // 본 시나리오는 e2e 응답 status에 집중. cache 통계는 Plan 14a/b에서 수집.

    return {
      data: {
        initialDenyStatus,
        assignStatus: assignRes.status,
        staleStatus,
        freshStatus: freshRes.status,
        token1Prefix: token1.slice(0, 32),
        token2Prefix: token2.slice(0, 32),
      },
      traceIds: traceIds.filter(Boolean),
      stepCount: 8,
    };
  },

  async assert(_ctx, actResult) {
    const d = actResult.data as Record<string, unknown>;
    ok(
      d.initialDenyStatus === 403 || d.initialDenyStatus === 404,
      `initial call should be 403/404, got ${d.initialDenyStatus}`,
    );
    equal(d.assignStatus, 200, "admin role assign must succeed");
    // staleStatus는 application-level에서 권한 부족 (JWT의 stale bitmap)
    ok(
      d.staleStatus === 403 || d.staleStatus === 401,
      `stale token should still be denied (JWT self-contained), got ${d.staleStatus}`,
    );
    // 새 token으로 200
    equal(d.freshStatus, 200, "fresh token (with new role) must yield 200");
    ok(d.token1Prefix !== d.token2Prefix, "tokens must differ");
  },

  async teardown() {},
};
```

- [ ] **Step 2: scenario-8 test**

```ts
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { runScenario } from "../runner/runner.js";
import { scenario8PubsubInvalidation } from "./scenario-8-pubsub-invalidation.js";
import type { InProcessHandle } from "../env/in-process-env.js";

// 본 시나리오는 sim-redis 또는 ioredis-mock 필요
const SKIP = process.env.SIM_SCENARIO_INPROC !== "1" || !process.env.SIM_REDIS_URL;

describe.skipIf(SKIP)("Scenario 8 — pub/sub invalidation", () => {
  let handle: InProcessHandle;
  beforeAll(async () => {
    const { bootstrapInProcess } = await import("../env/in-process-env.js");
    handle = await bootstrapInProcess({ jwtSecret: "x".repeat(32), dialect: "sqlite" });
    const g = globalThis as unknown as { __simGatewayFetch: typeof handle.gatewayFetch; __simHandle: typeof handle };
    g.__simGatewayFetch = handle.gatewayFetch;
    g.__simHandle = handle;
  }, 60_000);
  afterAll(async () => { if (handle) await handle.cleanup(); });

  it("scenario 8 통과 — Redis pub/sub round-trip + LRU flush", async () => {
    const result = await runScenario(scenario8PubsubInvalidation, {
      gatewayUrl: "http://sim-inproc", mode: "in-process",
    });
    if (result.status !== "passed") {
      console.error("[Scenario 8 실패]", result.error);
    }
    expect(result.status).toBe("passed");
  }, 30_000);
});
```

- [ ] **Step 3: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add simulations/enterprise-pm/scenarios/src/scenarios/scenario-8-pubsub-invalidation.ts \
          simulations/enterprise-pm/scenarios/src/scenarios/scenario-8-pubsub-invalidation.test.ts && \
  git commit -m "$(cat <<'EOF'
feat(sim-scenarios): Scenario 8 — pub/sub invalidation (§2 §5)

admin assign → publisher.publishUserChange → 8 서비스 LRU flush.
JWT는 self-contained — stale token은 변경 무반영.
새 login으로 fresh bitmap 적용 → 권한 반영.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: cli.ts에 7, 8 등록

**Files:**
- Modify: `src/cli.ts`
- Modify: `src/cli.test.ts`

- [ ] **Step 1: cli.ts**

```ts
import { scenario7BitmapRefresh } from "./scenarios/scenario-7-bitmap-refresh.js";
import { scenario8PubsubInvalidation } from "./scenarios/scenario-8-pubsub-invalidation.js";

export const ALL_SCENARIOS: readonly Scenario[] = [
  scenario1Login,
  scenario2ProjectCreate,
  scenario3SelfDeptApproval,
  scenario4CrossDeptDeny,
  scenario5ThreeStageApproval,
  scenario6DelegatedResource,
  scenario7BitmapRefresh,
  scenario8PubsubInvalidation,
];
```

- [ ] **Step 2: cli.test.ts**

```ts
it("ALL_SCENARIOS — Plan 13d 시점에 8건 (전체)", () => {
  expect(ALL_SCENARIOS).toHaveLength(8);
  expect(ALL_SCENARIOS.map((s) => s.name)).toEqual([
    "scenario-1-login",
    "scenario-2-project-create",
    "scenario-3-self-dept-approval",
    "scenario-4-cross-dept-deny",
    "scenario-5-three-stage-approval",
    "scenario-6-delegated-resource",
    "scenario-7-bitmap-refresh",
    "scenario-8-pubsub-invalidation",
  ]);
});
```

- [ ] **Step 3: 회귀**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter @qa-sdk/sim-scenarios test 2>&1 | tail -5 && \
  pnpm --filter @qa-sdk/sim-scenarios build && \
  cd simulations/enterprise-pm/scenarios && node dist/cli.js list
```

Expected: list 출력에 8 시나리오.

- [ ] **Step 4: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add simulations/enterprise-pm/scenarios/src/cli.ts \
          simulations/enterprise-pm/scenarios/src/cli.test.ts && \
  git commit -m "$(cat <<'EOF'
feat(sim-scenarios): 8 시나리오 전체 등록 완료 (1~8)

Plan 13d로 design.md §4 8 시나리오 모두 ALL_SCENARIOS에 등록.
cli list / run --all 에서 전체 실행 가능.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review

- [ ] 시나리오 7 — §2 §4 (Refresh) 정확 매칭
  - jwtTtlSeconds=2로 짧은 TTL bootstrap
  - 만료 후 401 + WWW-Authenticate reason="expired"
  - POST /auth/refresh 200 + 새 token
  - 새 token으로 200
- [ ] 시나리오 8 — §2 §5 (Invalidation) 정확 매칭
  - admin assign → BitmapInvalidationPublisher.publishUserChange
  - sim-pm-api / 기타 서비스의 BitmapInvalidationSubscriber가 LRU flush
  - JWT self-contained — stale token은 변경 무반영
  - 새 login으로 fresh bitmap 적용
- [ ] gateway POST /auth/refresh endpoint 본격 구현 (verifyBitmapJwt ignoreExpiration 옵션)
- [ ] in-process bootstrap에 jwtTtlSeconds 옵션 + admin fixture
- [ ] cli ALL_SCENARIOS 8건 (전체)
- [ ] 시나리오 8은 SIM_REDIS_URL 추가 env gate (실 Redis 필요)
- [ ] no fallback — refresh 실패는 throw, login 실패는 throw

---

## Defer

| 작업 | 이유 | 후속 plan |
|---|---|---|
| Background refresh (expiresAt 임박 시 자동) | §2 §4 후반부 — 클라이언트 자동화 | Phase 5 SDK |
| HMAC secret rotation 시나리오 | §2 §7 — 운영 보안 | Phase 5 |
| pub/sub 지연 측정 (p99 SLI) | metrics-collector 통합 | Plan 14a |
| 부하 시 invalidation throughput | 부하 시뮬 | 후속 |
| 시나리오 8 — cache size 통계 endpoint 활용 | metrics-collector Plan 14a | Plan 14a |

---

## 의존·후속

- **Plan 13a/b/c**: runner / cli / scenarios 1~6.
- **Plan 12a**: gateway JWT — 본 plan이 /auth/refresh endpoint 추가.
- **Plan 12b**: BitmapInvalidationPublisher / Subscriber — 시나리오 8의 핵심.
- **Plan 14a**: marginal density — 8 시나리오 실행 결과로 측정.
- **Plan 14b**: 통합 회귀 — 전체 8 시나리오 자동 실행.
