---
lifecycle: draft
plan: 12a-1
phase: 4
depends-on: [12a, 11a]
sources:
  - simulations/enterprise-pm/services/gateway/package.json
  - simulations/enterprise-pm/services/gateway/tsup.config.ts
  - simulations/enterprise-pm/services/gateway/src/app.ts
  - simulations/enterprise-pm/services/gateway/src/lib/jwt.ts
  - simulations/enterprise-pm/services/gateway/src/lib/bitmap-claim.ts
  - simulations/enterprise-pm/services/gateway/src/test-bootstrap.ts
  - simulations/enterprise-pm/services/gateway/src/test-bootstrap.test.ts
  - simulations/enterprise-pm/services/gateway/src/routes/proxy-routes.ts
---

# Plan 12a-1 — sim-gateway package exports + `/approvals/requests/*` 라우팅 정합 + test-bootstrap

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Plan 12a가 완성한 `sim-gateway` (Hono JWT + traceparent + reverse proxy)를 Plan 13a/b/c/d의 in-process 시나리오 runner가 소비할 수 있도록 **package-level entry point**를 정렬한다. (1) `package.json`의 `exports` 필드를 추가 — `./app` (createApp), `./jwt` (verifyBitmapJwt), `./bitmap-claim` (BitmapClaim 타입/헬퍼) 세 서브경로. (2) `/approvals/requests/*` 경로 라우팅 검증 — `PROXY_TARGETS`의 `/approvals` prefix가 approval-api로 정확히 proxy되며 downstream path는 원본 그대로 보존됨을 확인하고, `BudgetController`(`/budgets`)와의 경로 불일치를 `ApprovalRequestsController` 신규로 해소. (3) `test-bootstrap.ts` — 시나리오 runner가 gateway를 in-process Hono app으로 부팅할 때 공통으로 사용할 helper (secret 자동 생성, default proxy targets fixture, bob/alice JWT issue 헬퍼). (4) Plan 11a의 실 `/auth/authenticate` endpoint와 Plan 12a의 login route 흐름이 프로토콜 정합 (`userId`, `displayName`, `departmentId`) — 호환성 회귀 테스트 추가. 본 plan은 fallback/placeholder 없이 Plan 12a가 가정한 `@qa-sdk/sim-gateway/app` import 경로를 실체화한다.

**Architecture:**
- **Package exports 3개 서브경로**:
  - `"."` — CLI/server entry (기존 유지). tsup 번들 `dist/server.js`가 bin.
  - `"./app"` — `dist/app.js` + `dist/app.d.ts` (createApp, AppOptions). Plan 13a `in-process-env.ts`의 dynamic import 대상.
  - `"./jwt"` — `dist/lib/jwt.js` + d.ts (signBitmapJwt, verifyBitmapJwt, JwtVerifyError, VerifiedJwt). Plan 13a scenario-1/2/7의 토큰 검증에 사용.
  - `"./bitmap-claim"` — `dist/lib/bitmap-claim.js` + d.ts (BitmapClaim 타입, bitmapToClaim, claimToBitmap). 상호 variant 검증에 사용.
  - `"./test-bootstrap"` — `dist/test-bootstrap.js` + d.ts (신규 — 시나리오 runner 공통 헬퍼).
- **빌드 변경 (tsup dual entry)**: 기존 `entry: ["src/server.ts"]` → `["src/server.ts", "src/app.ts", "src/lib/jwt.ts", "src/lib/bitmap-claim.ts", "src/test-bootstrap.ts"]`. dts 활성화 (`dts: true`). 서브경로마다 단일 파일 산출.
- **`/approvals/requests/*` 라우팅 갭 해소**:
  - Plan 12a의 `PROXY_TARGETS`에는 `/approvals` prefix가 `sim-approval-api`로 매핑되어 있고, `proxyRequest`는 `c.req.url`의 `pathname + search`를 그대로 downstream에 전달 — 따라서 `/approvals/requests/:id/decisions` 호출은 approval-api의 `/approvals/requests/:id/decisions`로 도달한다.
  - 그러나 Plan 11b가 구현한 approval-api의 실제 controller는 `/budgets`·`/expense-reports`·`/time-off-requests`·`/resource-requests` 4종. Plan 13b/c의 시나리오는 공통 `/approvals/requests/:id` 표면을 사용 — **본 plan에서 approval-api에 `ApprovalRequestsController` (neutral facade) 를 추가**하여 downstream 경로와 시나리오 표면을 정합한다.
  - `ApprovalRequestsController`는 state/lookup을 전담: `GET /approvals/requests/:id` / `POST /approvals/requests/:id/decisions` — 내부적으로 kind를 분기 (`budget`/`expense-report`/`time-off`/`resource`)하여 해당 service에 위임.
  - 본 plan에서는 `ApprovalRequestsController`와 `ApprovalLookupService` (kind 결정 + id 조회 + decision 위임) 를 신규 구현.
- **test-bootstrap.ts의 역할**:
  - `createGatewayTestApp(opts)` — env 기본값 (32바이트 랜덤 secret, 5s timeout, uv1) + proxy targets placeholder 127.0.0.1:1 (시나리오가 override)로 `createApp()`을 호출하는 factory
  - `issueTestToken(args)` — test fixture에서 곧바로 `signBitmapJwt` 호출해 bearer 토큰 발급 (bob / alice fixture에서 활용)
  - in-memory SQLite 어댑터는 audit-browser-api가 관할 (본 plan 대상 아님).
- **`/auth/authenticate` 호환성 회귀**:
  - Plan 11a가 이미 구현한 `POST /auth/authenticate`의 응답 schema는 `{ userId, displayName, departmentId }`.
  - Plan 12a의 `createLoginRoute`의 `authResponseSchema`도 동일 — 본 plan은 회귀 테스트(gateway → authenticate → bitmap/issue → JWT) 1건으로 스키마 일치를 고정.

**Tech Stack:**
- `jose` ^5.9.0 (Plan 12a 기존 dep)
- hono ^4.7.5, tsup ^8.5.1 — dual entry + dts 빌드
- @nestjs/common (ApprovalRequestsController용)
- vitest, ES2023

## 현재 증거 표면 ^evidence

- Gateway package exports는 `simulations/enterprise-pm/services/gateway/package.json`의 `./app`, `./jwt`, `./bitmap-claim`, `./test-bootstrap`, `./routing` 서브경로로 구현되어 있다.
- `test-bootstrap.ts`와 `test-bootstrap.test.ts`가 in-process scenario runner 소비 표면을 고정한다.
- 현재 repo에는 본 plan 초안이 언급한 `approval/requests/ApprovalRequestsController` 파일군은 없다. 이후 시나리오 구현은 현재 approval-api/gateway 표면과 scenario fixtures를 기준으로 유지된다.

---

## File Structure

### 새로 만드는 파일

| 경로 | 책임 |
|---|---|
| `simulations/enterprise-pm/services/gateway/src/test-bootstrap.ts` | `createGatewayTestApp()` + `issueTestToken()` — 시나리오 runner 공통 헬퍼 |
| `simulations/enterprise-pm/services/gateway/src/test-bootstrap.test.ts` | 헬퍼 단위 테스트 (app 생성, token issue/verify round-trip) |
| `simulations/enterprise-pm/services/approval-api/src/approval/requests/approval-requests.controller.ts` | `GET/POST /approvals/requests/:id[/decisions]` facade |
| `simulations/enterprise-pm/services/approval-api/src/approval/requests/approval-requests.controller.test.ts` | NestJS Test — kind 분기 + decision 위임 |
| `simulations/enterprise-pm/services/approval-api/src/approval/requests/approval-lookup.service.ts` | kind 분기 + BudgetService/ResourceService/TimeOffService/ExpenseService 위임 |
| `simulations/enterprise-pm/services/approval-api/src/approval/requests/approval-lookup.service.test.ts` | service 단위 — 각 kind 위임 검증 |
| `simulations/enterprise-pm/services/approval-api/src/approval/requests/approval-requests.module.ts` | Module — controller + lookup service + 4 sub-service 주입 |

### 수정하는 파일

| 경로 | 변경 |
|---|---|
| `simulations/enterprise-pm/services/gateway/package.json` | `exports` 필드 추가 (3 서브경로 + test-bootstrap + root) |
| `simulations/enterprise-pm/services/gateway/tsup.config.ts` (신규 또는 기존) | entry 5개 + `dts: true` + tsup `splitting: false` 보장 |
| `simulations/enterprise-pm/services/gateway/tsconfig.json` | include에 `src/test-bootstrap.ts` 포함 (기존 src 전체면 변경 없음) |
| `simulations/enterprise-pm/services/gateway/src/routes/proxy-routes.ts` | `PROXY_TARGETS`의 `/approvals` 엔트리 주석 정합 (`ApprovalRequestsController` 진입점 명시) |
| `simulations/enterprise-pm/services/gateway/src/integration.test.ts` | `/auth/authenticate` 실제 응답 스키마 호환성 1건 추가 |
| `simulations/enterprise-pm/services/approval-api/src/app.module.ts` | `ApprovalRequestsModule` imports 추가 |

---

## Task 0: baseline

- [ ] **Step 1: Plan 12a + Plan 11a/b 완료 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  ls simulations/enterprise-pm/services/gateway/src/app.ts && \
  ls simulations/enterprise-pm/services/gateway/src/lib/jwt.ts && \
  ls simulations/enterprise-pm/services/auth-api/src/auth/authenticate/authenticate.controller.ts && \
  ls simulations/enterprise-pm/services/approval-api/src/approval/budget/budget.controller.ts
```

Expected: 4 파일 모두 hit.

- [ ] **Step 2: 현재 gateway `exports` 필드 확인 (없음 예상)**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  node -e 'console.log(JSON.stringify(require("./simulations/enterprise-pm/services/gateway/package.json").exports ?? null))'
```

Expected: `null` — Plan 12a는 `main` + `type: module`만 사용.

- [ ] **Step 3: gateway tsup 엔트리 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  cat simulations/enterprise-pm/services/gateway/tsup.config.ts 2>/dev/null || \
  ls simulations/enterprise-pm/services/gateway/tsup.config.* 2>/dev/null
```

Expected: 존재 시 `entry: ["src/server.ts"]` 단일, dts 미활성화. 미존재 시 본 plan에서 신규 생성.

- [ ] **Step 4: 현재 gateway 테스트 baseline**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter @qa-sdk/sim-gateway test 2>&1 | tail -5
```

Expected: Plan 12a 기준 47 PASS (integration env gate skip).

- [ ] **Step 5: approval-api baseline**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter @qa-sdk/sim-approval-api test 2>&1 | tail -5
```

Expected: Plan 11b 기준 통과.

---

## Task 1: gateway `package.json` — `exports` 필드 추가

**Files:**
- Modify: `simulations/enterprise-pm/services/gateway/package.json`

- [ ] **Step 1: `exports` 필드 신규 추가**

`simulations/enterprise-pm/services/gateway/package.json`에 `"type": "module"` 다음 위치에 삽입:

```json
{
  "name": "@qa-sdk/sim-gateway",
  "version": "0.1.0",
  "description": "시뮬 — Hono 기반 gateway (JWT bitmap embed + traceparent + 라우팅)",
  "private": true,
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/server.d.ts",
      "import": "./dist/server.js"
    },
    "./app": {
      "types": "./dist/app.d.ts",
      "import": "./dist/app.js"
    },
    "./jwt": {
      "types": "./dist/lib/jwt.d.ts",
      "import": "./dist/lib/jwt.js"
    },
    "./bitmap-claim": {
      "types": "./dist/lib/bitmap-claim.d.ts",
      "import": "./dist/lib/bitmap-claim.js"
    },
    "./test-bootstrap": {
      "types": "./dist/test-bootstrap.d.ts",
      "import": "./dist/test-bootstrap.js"
    }
  }
}
```

**근거 — `main` 제거**: `exports` 필드가 존재하면 `main`은 legacy fallback이라 TypeScript/Node는 `exports`를 우선. 혼란 방지 위해 `main` 필드 제거 (기존 유지해도 무방하지만 일관성 위해 삭제). bin은 유지.

- [ ] **Step 2: tsup.config.ts 갱신 (entry 5개 + dts)**

`simulations/enterprise-pm/services/gateway/tsup.config.ts`:

```ts
// @def.boundary sim-gateway
// @def.doc authorization-ontology-bitmap-pipeline

import { defineConfig } from "tsup";

/**
 * sim-gateway — 5 entry 산출:
 *   - src/server.ts        → dist/server.{js,d.ts}  (bin entry, 기본 export ".")
 *   - src/app.ts           → dist/app.{js,d.ts}      ("./app" — createApp)
 *   - src/lib/jwt.ts       → dist/lib/jwt.{js,d.ts}  ("./jwt")
 *   - src/lib/bitmap-claim.ts → dist/lib/bitmap-claim.{js,d.ts} ("./bitmap-claim")
 *   - src/test-bootstrap.ts → dist/test-bootstrap.{js,d.ts} ("./test-bootstrap")
 *
 * CLAUDE.md §"CLI tsup 번들 제약"은 CLI 패키지(단일 bin) 적용 — 본 gateway는
 * 5 entry 라이브러리 스타일이므로 splitting=false + 정적 import만 사용.
 */
export default defineConfig({
  entry: [
    "src/server.ts",
    "src/app.ts",
    "src/lib/jwt.ts",
    "src/lib/bitmap-claim.ts",
    "src/test-bootstrap.ts",
  ],
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: "es2023",
  platform: "node",
  splitting: false,
  shims: true,
  banner: (ctx) => ({
    // server.ts만 shebang (bin). 다른 entry는 일반 module.
    js: ctx.format === "esm" && ctx.options.entry && String(ctx.options.entry).includes("server")
      ? "#!/usr/bin/env node"
      : "",
  }),
});
```

**주의 — banner는 entry마다 분기**: tsup은 entry 단위로 banner를 평가하지 않으므로 `"#!/usr/bin/env node"`가 모든 산출물에 삽입되면 import 시 문법 에러. 단순 해결: banner 제거 + `server.ts` 최상단에 `#!/usr/bin/env node` 직접 삽입 (또는 `bin` 진입점에만 별도 shebang 처리 스크립트). 본 plan은 banner 제거를 선택:

```ts
// banner 블록 제거. server.ts 파일 최상단에 다음 한 줄 추가:
#!/usr/bin/env node
```

`src/server.ts` 최상단 변경:

```ts
#!/usr/bin/env node
// @def.boundary sim-gateway
// @def.doc authorization-ontology-bitmap-pipeline
// ...기존 import
```

tsup는 shebang 라인을 자동으로 보존 (entry 1번째 줄이 `#!` 시작이면 preserve).

- [ ] **Step 3: `main` 필드 제거 + bin 유지**

`package.json`에서 `main`·`types` 제거 (exports가 대체). `bin`은 유지:

```json
{
  "bin": {
    "sim-gateway": "dist/server.js"
  }
}
```

- [ ] **Step 4: 빌드 후 exports 정합성 검증**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter @qa-sdk/sim-gateway build && \
  ls simulations/enterprise-pm/services/gateway/dist/app.js \
     simulations/enterprise-pm/services/gateway/dist/app.d.ts \
     simulations/enterprise-pm/services/gateway/dist/lib/jwt.js \
     simulations/enterprise-pm/services/gateway/dist/lib/jwt.d.ts \
     simulations/enterprise-pm/services/gateway/dist/lib/bitmap-claim.js \
     simulations/enterprise-pm/services/gateway/dist/server.js
```

Expected: 5 entry 각각 `.js` + `.d.ts`. 빌드 에러 0.

- [ ] **Step 5: import smoke (node 직접 호출)**

```bash
cd /Users/junwoobang/workflow/qa-sdk/simulations/enterprise-pm/services/gateway && \
  node --input-type=module -e "import { createApp } from './dist/app.js'; console.log(typeof createApp);" && \
  node --input-type=module -e "import { verifyBitmapJwt } from './dist/lib/jwt.js'; console.log(typeof verifyBitmapJwt);"
```

Expected: `function` 각 1회 출력.

- [ ] **Step 6: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add simulations/enterprise-pm/services/gateway/package.json \
          simulations/enterprise-pm/services/gateway/tsup.config.ts \
          simulations/enterprise-pm/services/gateway/src/server.ts && \
  git commit -m "$(cat <<'EOF'
feat(sim-gateway): package.json exports + tsup dual entry 빌드

"./app", "./jwt", "./bitmap-claim" 3 서브경로 노출 — Plan 13 시나리오
runner가 dynamic import로 소비.
main 제거 + exports가 단일 진입점. server.ts에 shebang 직접 삽입.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: gateway `test-bootstrap.ts` — 시나리오 공통 헬퍼 (TDD)

**Files:**
- Create: `simulations/enterprise-pm/services/gateway/src/test-bootstrap.ts`
- Create: `simulations/enterprise-pm/services/gateway/src/test-bootstrap.test.ts`

- [ ] **Step 1: test-bootstrap.test.ts (test-first)**

```ts
// @def.boundary sim-gateway
// @def.doc authorization-ontology-bitmap-pipeline

import { describe, expect, it } from "vitest";
import {
  createGatewayTestApp,
  issueTestToken,
  DEFAULT_TEST_PROXY_TARGETS,
} from "./test-bootstrap.js";
import { verifyBitmapJwt } from "./lib/jwt.js";

describe("gateway test-bootstrap", () => {
  it("createGatewayTestApp — 기본 옵션만으로 Hono app 생성 + /health 200", async () => {
    const handle = createGatewayTestApp({});
    const res = await handle.app.request("/health");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.service).toBe("sim-gateway");
    expect(handle.secret.length).toBeGreaterThanOrEqual(32);
  });

  it("createGatewayTestApp — proxy targets override", async () => {
    const handle = createGatewayTestApp({
      proxyTargets: {
        ...DEFAULT_TEST_PROXY_TARGETS,
        "sim-pm-api": "http://custom-host:9999",
      },
    });
    // PROXY_TARGETS에 /projects가 sim-pm-api로 매핑 — handle은 내부 options 노출
    expect(handle.proxyTargets["sim-pm-api"]).toBe("http://custom-host:9999");
  });

  it("issueTestToken — 유효 JWT 발급 + verify 라운드트립", async () => {
    const handle = createGatewayTestApp({});
    const token = await issueTestToken({
      userId: "alice-1",
      departmentId: "dept-eng",
      secret: handle.secret,
      bitmapV: "uv1",
      ttlSeconds: 300,
    });
    expect(token.split(".")).toHaveLength(3);
    const verified = await verifyBitmapJwt(token, handle.secret);
    expect(verified.userId).toBe("alice-1");
    expect(verified.bitmap.prefix).toBe("sim.bitmap");
    expect(verified.bitmap.v).toBe("uv1");
  });

  it("DEFAULT_TEST_PROXY_TARGETS — PROXY_TARGETS 6 서비스 모두 포함", () => {
    expect(Object.keys(DEFAULT_TEST_PROXY_TARGETS)).toEqual(
      expect.arrayContaining([
        "sim-pm-api",
        "sim-approval-api",
        "sim-notification-api",
        "sim-reporting-api",
        "sim-document-api",
        "sim-audit-browser-api",
      ]),
    );
  });

  it("createGatewayTestApp — /projects/x JWT 없이 401 (protected 동작 회귀)", async () => {
    const handle = createGatewayTestApp({});
    const res = await handle.app.request("/projects/x");
    expect(res.status).toBe(401);
  });

  it("createGatewayTestApp — 유효 JWT → /projects/x proxy 호출 (downstream 미정 시 502/504)", async () => {
    const handle = createGatewayTestApp({});
    const token = await issueTestToken({
      userId: "u1",
      departmentId: null,
      secret: handle.secret,
      bitmapV: "uv1",
      ttlSeconds: 300,
    });
    const res = await handle.app.request("/projects/x", {
      headers: { Authorization: `Bearer ${token}` },
    });
    // downstream이 127.0.0.1:1 이므로 fetch는 ECONNREFUSED → 502 또는 timeout → 504
    expect([502, 504]).toContain(res.status);
  });
});
```

- [ ] **Step 2: test-bootstrap.ts**

```ts
// @def.boundary sim-gateway
// @def.doc authorization-ontology-bitmap-pipeline

import { randomBytes } from "node:crypto";
import type { Hono } from "hono";
import { createApp, type AppOptions } from "./app.js";
import { signBitmapJwt } from "./lib/jwt.js";
import type { VersionedBitmap } from "permission-engine";

/**
 * 시나리오 runner 공통 fixture — 6 PROXY_TARGETS의 기본 placeholder URL.
 *
 * 시나리오가 실제 downstream을 주입해야 할 경우 override 대상. 본 default는
 * 127.0.0.1:1 (unreachable) — unexpected 호출을 빠르게 502/504로 실패시켜
 * 테스트 의도(의존 주입 누락)를 명확히 드러낸다.
 */
export const DEFAULT_TEST_PROXY_TARGETS: Readonly<Record<string, string>> = {
  "sim-pm-api": "http://127.0.0.1:1",
  "sim-approval-api": "http://127.0.0.1:1",
  "sim-notification-api": "http://127.0.0.1:1",
  "sim-reporting-api": "http://127.0.0.1:1",
  "sim-document-api": "http://127.0.0.1:1",
  "sim-audit-browser-api": "http://127.0.0.1:1",
};

export interface GatewayTestAppOptions {
  /** 주입 시 사용, 미주입 시 32 byte 랜덤 hex (64자 문자열). */
  jwtSecret?: string;
  /** 주입 시 해당 값, 미주입 시 "uv1" (§2 §6 unified). */
  currentBitmapV?: string;
  /** 주입 시 해당 값, 미주입 시 300. */
  jwtTtlSeconds?: number;
  /** override 대상 — 일부 key만 주면 나머지는 DEFAULT 유지. */
  proxyTargets?: Record<string, string>;
  /** authApiUrl 주입. 미주입 시 "http://127.0.0.1:1" (시나리오가 NestJS app 부팅 후 override). */
  authApiUrl?: string;
  /** 주입 시 ms, 미주입 시 500 (단위 테스트 빠른 실패용). */
  proxyTimeoutMs?: number;
}

export interface GatewayTestAppHandle {
  app: Hono;
  secret: string;
  currentBitmapV: string;
  jwtTtlSeconds: number;
  proxyTargets: Record<string, string>;
  authApiUrl: string;
  proxyTimeoutMs: number;
}

/**
 * createGatewayTestApp — 시나리오 runner / 단위 테스트용 Hono app factory.
 *
 * 본 함수는 Plan 12a의 `createApp()`을 얇게 wrapping — in-memory secret 생성 +
 * default proxy targets을 주입. 실 downstream을 연결하려는 시나리오는 proxyTargets
 * 필드로 override (부분 override도 허용).
 */
export function createGatewayTestApp(
  opts: GatewayTestAppOptions,
): GatewayTestAppHandle {
  const secret =
    opts.jwtSecret ??
    randomBytes(32).toString("hex"); // 64 char hex = 32 byte 이상 → env 제약 충족
  const currentBitmapV = opts.currentBitmapV ?? "uv1";
  const jwtTtlSeconds = opts.jwtTtlSeconds ?? 300;
  const proxyTargets: Record<string, string> = {
    ...DEFAULT_TEST_PROXY_TARGETS,
    ...(opts.proxyTargets ?? {}),
  };
  const authApiUrl = opts.authApiUrl ?? "http://127.0.0.1:1";
  const proxyTimeoutMs = opts.proxyTimeoutMs ?? 500;

  const appOptions: AppOptions = {
    authApiUrl,
    jwtSecret: secret,
    jwtTtlSeconds,
    currentBitmapV,
    proxyTimeoutMs,
    proxyTargets,
  };
  const app = createApp(appOptions);
  return {
    app,
    secret,
    currentBitmapV,
    jwtTtlSeconds,
    proxyTargets,
    authApiUrl,
    proxyTimeoutMs,
  };
}

export interface IssueTestTokenArgs {
  userId: string;
  /** fixture 사용자의 departmentId. null 허용 (global scope user). */
  departmentId: string | null;
  secret: string;
  bitmapV: string;
  ttlSeconds: number;
  /** 주입 시 그대로 사용, 미주입 시 3바이트 zero mask (scenario-1이 bit-set 검증 시 override 필요). */
  mask?: Uint8Array;
  issuer?: string;
  signature?: string;
}

/**
 * issueTestToken — 시나리오 runner의 fixture 설정 단계에서 즉시 bearer 토큰을 발급.
 *
 * 실 사용자 로그인 흐름(gateway /auth/login → auth-api /auth/authenticate
 * → auth-api /bitmap/issue)을 거치지 않고 테스트 fixture 레벨에서 직접 JWT를 발급한다.
 * 본 helper는 시나리오의 setup phase 단축용 — act phase에서는 실 `/auth/login`을 통과해야 한다.
 */
export async function issueTestToken(args: IssueTestTokenArgs): Promise<string> {
  const now = new Date();
  const bitmap: VersionedBitmap = {
    prefix: "sim.bitmap",
    v: args.bitmapV,
    mask: args.mask ?? new Uint8Array(3),
    issuedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + args.ttlSeconds * 1000).toISOString(),
    issuer: args.issuer ?? "test-bootstrap",
    signature: args.signature ?? "test-signature",
  };
  return signBitmapJwt({
    userId: args.userId,
    bitmap,
    secret: args.secret,
    ttlSeconds: args.ttlSeconds,
  });
}
```

- [ ] **Step 3: 테스트 통과**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter @qa-sdk/sim-gateway test -- test-bootstrap
```

Expected: 6 PASS.

- [ ] **Step 4: 빌드 (test-bootstrap entry가 dist 산출 확인)**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter @qa-sdk/sim-gateway build && \
  ls simulations/enterprise-pm/services/gateway/dist/test-bootstrap.js \
     simulations/enterprise-pm/services/gateway/dist/test-bootstrap.d.ts
```

Expected: 2 파일 모두 hit.

- [ ] **Step 5: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add simulations/enterprise-pm/services/gateway/src/test-bootstrap.ts \
          simulations/enterprise-pm/services/gateway/src/test-bootstrap.test.ts && \
  git commit -m "$(cat <<'EOF'
feat(sim-gateway): test-bootstrap — 시나리오 공통 헬퍼

createGatewayTestApp: 32바이트 랜덤 secret + DEFAULT_TEST_PROXY_TARGETS +
createApp wrapping.
issueTestToken: fixture 단계에서 직접 JWT 발급.
downstream 미주입 시 127.0.0.1:1 → 502/504 빠른 실패 (no silent fallback).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: approval-api — `ApprovalRequestsController` facade (TDD)

**Files:**
- Create: `simulations/enterprise-pm/services/approval-api/src/approval/requests/approval-lookup.service.ts`
- Create: `simulations/enterprise-pm/services/approval-api/src/approval/requests/approval-lookup.service.test.ts`
- Create: `simulations/enterprise-pm/services/approval-api/src/approval/requests/approval-requests.controller.ts`
- Create: `simulations/enterprise-pm/services/approval-api/src/approval/requests/approval-requests.controller.test.ts`
- Create: `simulations/enterprise-pm/services/approval-api/src/approval/requests/approval-requests.module.ts`

- [ ] **Step 1: approval-lookup.service.test.ts (test-first)**

```ts
// @def.boundary sim-approval-api
// @def.doc authorization-ontology-application-enforcement

import { describe, expect, it, vi } from "vitest";
import { ApprovalLookupService } from "./approval-lookup.service.js";

describe("ApprovalLookupService", () => {
  function makeServices() {
    return {
      budget: {
        find: vi.fn(),
        decide: vi.fn(),
      },
      resource: {
        find: vi.fn(),
        decide: vi.fn(),
      },
      timeoff: {
        find: vi.fn(),
        decide: vi.fn(),
      },
      expense: {
        find: vi.fn(),
        decide: vi.fn(),
      },
    } as const;
  }

  it("find(kind=budget) — BudgetService.find 위임", async () => {
    const svcs = makeServices();
    svcs.budget.find.mockResolvedValueOnce({ id: "br-1", status: "submitted", kind: "budget" });
    const svc = new ApprovalLookupService(svcs.budget as never, svcs.resource as never, svcs.timeoff as never, svcs.expense as never);
    const found = await svc.find({ kind: "budget", id: "br-1" });
    expect(found?.id).toBe("br-1");
    expect(svcs.budget.find).toHaveBeenCalledWith("br-1");
    expect(svcs.resource.find).not.toHaveBeenCalled();
  });

  it("find(kind=resource) — ResourceService.find 위임", async () => {
    const svcs = makeServices();
    svcs.resource.find.mockResolvedValueOnce({ id: "rr-1", status: "submitted" });
    const svc = new ApprovalLookupService(svcs.budget as never, svcs.resource as never, svcs.timeoff as never, svcs.expense as never);
    const found = await svc.find({ kind: "resource", id: "rr-1" });
    expect(found?.id).toBe("rr-1");
    expect(svcs.resource.find).toHaveBeenCalledWith("rr-1");
  });

  it("find(kind=time-off) — TimeOffService.find 위임", async () => {
    const svcs = makeServices();
    svcs.timeoff.find.mockResolvedValueOnce({ id: "to-1" });
    const svc = new ApprovalLookupService(svcs.budget as never, svcs.resource as never, svcs.timeoff as never, svcs.expense as never);
    expect((await svc.find({ kind: "time-off", id: "to-1" }))?.id).toBe("to-1");
  });

  it("find(kind=expense-report) — ExpenseService.find 위임", async () => {
    const svcs = makeServices();
    svcs.expense.find.mockResolvedValueOnce({ id: "er-1" });
    const svc = new ApprovalLookupService(svcs.budget as never, svcs.resource as never, svcs.timeoff as never, svcs.expense as never);
    expect((await svc.find({ kind: "expense-report", id: "er-1" }))?.id).toBe("er-1");
  });

  it("decide(kind=budget) — BudgetService.decide 위임", async () => {
    const svcs = makeServices();
    svcs.budget.decide.mockResolvedValueOnce({ id: "br-1", status: "approved" });
    const svc = new ApprovalLookupService(svcs.budget as never, svcs.resource as never, svcs.timeoff as never, svcs.expense as never);
    const res = await svc.decide({
      kind: "budget",
      id: "br-1",
      approverId: "mgr-1",
      decision: "approved",
      comment: "ok",
    });
    expect(res.status).toBe("approved");
    expect(svcs.budget.decide).toHaveBeenCalledWith("br-1", {
      approverId: "mgr-1",
      decision: "approved",
      comment: "ok",
    });
  });

  it("decide(kind 미지원) → throw (no silent fallback)", async () => {
    const svcs = makeServices();
    const svc = new ApprovalLookupService(svcs.budget as never, svcs.resource as never, svcs.timeoff as never, svcs.expense as never);
    await expect(svc.decide({
      kind: "invalid" as never,
      id: "x", approverId: "u", decision: "approved",
    })).rejects.toThrow(/kind/i);
  });
});
```

- [ ] **Step 2: approval-lookup.service.ts**

```ts
// @def.boundary sim-approval-api
// @def.doc authorization-ontology-application-enforcement

import { Inject, Injectable } from "@nestjs/common";
import { BudgetService } from "../budget/budget.service.js";
import { ResourceService } from "../resource/resource.service.js";
import { TimeOffService } from "../timeoff/timeoff.service.js";
import { ExpenseService } from "../expense/expense.service.js";

/**
 * ApprovalRequestKind — 4 sub-entity 중 하나. gateway의 `/approvals/requests/:id`
 * facade가 본 kind를 body 또는 query로 받아 분기 (본 서비스는 kind 고정 입력 전제).
 */
export type ApprovalRequestKind =
  | "budget"
  | "resource"
  | "time-off"
  | "expense-report";

export interface FindArgs {
  kind: ApprovalRequestKind;
  id: string;
}

export interface DecideArgs {
  kind: ApprovalRequestKind;
  id: string;
  approverId: string;
  decision: "approved" | "rejected";
  comment?: string;
}

/**
 * ApprovalLookupService — 4 sub-service facade.
 *
 * Plan 11b는 `BudgetController`(`/budgets`) 등 4 별도 controller를 만들었으나,
 * gateway의 `/approvals/requests/:id` 표면과 정합하려면 단일 진입점이 필요.
 * 본 service는 kind를 받아 해당 sub-service에 위임만 한다 (no business logic).
 *
 * kind 미지원 값은 no-fallback 원칙에 따라 throw — caller가 kind를 명시 주입해야 함.
 */
@Injectable()
export class ApprovalLookupService {
  constructor(
    @Inject(BudgetService) private readonly budget: BudgetService,
    @Inject(ResourceService) private readonly resource: ResourceService,
    @Inject(TimeOffService) private readonly timeoff: TimeOffService,
    @Inject(ExpenseService) private readonly expense: ExpenseService,
  ) {}

  async find(args: FindArgs): Promise<unknown> {
    switch (args.kind) {
      case "budget":
        return this.budget.find(args.id);
      case "resource":
        return this.resource.find(args.id);
      case "time-off":
        return this.timeoff.find(args.id);
      case "expense-report":
        return this.expense.find(args.id);
      default: {
        const k: never = args.kind;
        throw new Error(`ApprovalLookupService.find: unsupported kind=${String(k)}`);
      }
    }
  }

  async decide(args: DecideArgs): Promise<unknown> {
    const payload = {
      approverId: args.approverId,
      decision: args.decision,
      comment: args.comment,
    };
    switch (args.kind) {
      case "budget":
        return this.budget.decide(args.id, payload);
      case "resource":
        return this.resource.decide(args.id, payload);
      case "time-off":
        return this.timeoff.decide(args.id, payload);
      case "expense-report":
        return this.expense.decide(args.id, payload);
      default: {
        const k: never = args.kind;
        throw new Error(`ApprovalLookupService.decide: unsupported kind=${String(k)}`);
      }
    }
  }
}
```

**주의 — sub-service 시그니처**: Plan 11b의 `BudgetService.decide(id, { approverId, decision, comment })`가 본 service의 호출 규약. 만약 실 시그니처가 다르면 adapter layer (예: ResourceService는 `decide` 대신 `approve`/`reject`만 있을 수 있음)가 본 service에서 추가 필요. Plan 11b의 실제 method 명은 `decide` 통일(Plan 11b §approval-api Task 8 budget service method)이므로 위 구현 유효. 만약 상이하면 `ApprovalLookupService.decide` 내부 분기에서 각 service별로 실 method를 호출하도록 명시적으로 매핑 (no silent fallback).

- [ ] **Step 3: approval-requests.controller.test.ts (test-first)**

```ts
// @def.boundary sim-approval-api
// @def.doc authorization-ontology-application-enforcement

import { describe, expect, it, vi } from "vitest";
import { Test } from "@nestjs/testing";
import { ApprovalRequestsController } from "./approval-requests.controller.js";
import { ApprovalLookupService } from "./approval-lookup.service.js";

describe("ApprovalRequestsController", () => {
  async function makeCtx(lookup: Partial<ApprovalLookupService>) {
    const moduleRef = await Test.createTestingModule({
      controllers: [ApprovalRequestsController],
      providers: [{ provide: ApprovalLookupService, useValue: lookup }],
    }).compile();
    return moduleRef.get(ApprovalRequestsController);
  }

  it("GET /approvals/requests/:id?kind=budget — find 위임", async () => {
    const find = vi.fn().mockResolvedValue({ id: "br-1", status: "approved" });
    const ctrl = await makeCtx({ find: find as never });
    const result = await ctrl.find("br-1", "budget");
    expect(result).toEqual({ id: "br-1", status: "approved" });
    expect(find).toHaveBeenCalledWith({ kind: "budget", id: "br-1" });
  });

  it("GET /approvals/requests/:id (kind 누락) → 400", async () => {
    const ctrl = await makeCtx({ find: vi.fn() as never });
    await expect(ctrl.find("x", undefined as never)).rejects.toMatchObject({
      status: 400,
    });
  });

  it("GET /approvals/requests/:id — find 결과 null → 404", async () => {
    const find = vi.fn().mockResolvedValue(null);
    const ctrl = await makeCtx({ find: find as never });
    await expect(ctrl.find("missing", "budget")).rejects.toMatchObject({
      status: 404,
    });
  });

  it("POST /approvals/requests/:id/decisions — decide 위임", async () => {
    const decide = vi.fn().mockResolvedValue({ id: "br-1", status: "approved" });
    const ctrl = await makeCtx({ decide: decide as never });
    const result = await ctrl.decide("br-1", {
      kind: "budget",
      approverId: "mgr-1",
      decision: "approved",
      comment: "ok",
    });
    expect(result).toEqual({ id: "br-1", status: "approved" });
    expect(decide).toHaveBeenCalledWith({
      kind: "budget",
      id: "br-1",
      approverId: "mgr-1",
      decision: "approved",
      comment: "ok",
    });
  });

  it("POST /approvals/requests/:id/decisions (body invalid) → 400", async () => {
    const ctrl = await makeCtx({ decide: vi.fn() as never });
    await expect(
      ctrl.decide("br-1", { kind: "budget", approverId: "", decision: "approved" } as never),
    ).rejects.toMatchObject({ status: 400 });
  });
});
```

- [ ] **Step 4: approval-requests.controller.ts**

```ts
// @def.boundary sim-approval-api
// @def.doc authorization-ontology-application-enforcement

import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
} from "@nestjs/common";
import { z } from "zod";
import { ApprovalLookupService, type ApprovalRequestKind } from "./approval-lookup.service.js";

const kindSchema = z.enum(["budget", "resource", "time-off", "expense-report"]);

const decisionBodySchema = z.object({
  kind: kindSchema,
  approverId: z.string().min(1),
  decision: z.enum(["approved", "rejected"]),
  comment: z.string().optional(),
});

/**
 * POST /approvals/requests/:id/decisions + GET /approvals/requests/:id
 *
 * 본 controller는 Plan 12a의 gateway `/approvals/*` proxy + Plan 13b/c의
 * 시나리오 표면을 정합하기 위한 facade. 실 비즈니스 로직은 `ApprovalLookupService`
 * 가 kind-별 sub-service에 위임한다.
 *
 * kind는 body 또는 query로 명시 — no silent default. Plan 13의 시나리오가 각
 * fixture에 kind를 주입한다 (scenario 3/4는 budget, scenario 5는 budget,
 * scenario 6은 expense-report 등).
 */
@Controller("approvals/requests")
export class ApprovalRequestsController {
  constructor(private readonly lookup: ApprovalLookupService) {}

  @Get(":id")
  async find(@Param("id") id: string, @Query("kind") kindRaw: string) {
    const parsed = kindSchema.safeParse(kindRaw);
    if (!parsed.success) {
      throw new BadRequestException({
        error: "invalid_kind",
        issues: parsed.error.issues,
      });
    }
    const result = await this.lookup.find({
      kind: parsed.data as ApprovalRequestKind,
      id,
    });
    if (!result) {
      throw new NotFoundException({ error: "not_found", kind: parsed.data, id });
    }
    return result;
  }

  @Post(":id/decisions")
  async decide(@Param("id") id: string, @Body() body: unknown) {
    const parsed = decisionBodySchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        error: "invalid_decision_body",
        issues: parsed.error.issues,
      });
    }
    return this.lookup.decide({
      kind: parsed.data.kind as ApprovalRequestKind,
      id,
      approverId: parsed.data.approverId,
      decision: parsed.data.decision,
      comment: parsed.data.comment,
    });
  }
}
```

- [ ] **Step 5: approval-requests.module.ts**

```ts
// @def.boundary sim-approval-api
// @def.doc authorization-ontology-application-enforcement

import { Module } from "@nestjs/common";
import { BudgetModule } from "../budget/budget.module.js";
import { ResourceModule } from "../resource/resource.module.js";
import { TimeOffModule } from "../timeoff/timeoff.module.js";
import { ExpenseModule } from "../expense/expense.module.js";
import { ApprovalRequestsController } from "./approval-requests.controller.js";
import { ApprovalLookupService } from "./approval-lookup.service.js";

/**
 * ApprovalRequestsModule — 4 sub-domain module import + lookup service provider.
 *
 * sub-module이 이미 BudgetService / ResourceService / TimeOffService /
 * ExpenseService를 export하고 있어야 함 (Plan 11b가 그렇게 했다고 가정).
 * 미 export 시 본 module 컴파일 시 provider 누락 에러 발생 → Plan 11b에
 * exports 보강 (no silent default).
 */
@Module({
  imports: [BudgetModule, ResourceModule, TimeOffModule, ExpenseModule],
  controllers: [ApprovalRequestsController],
  providers: [ApprovalLookupService],
})
export class ApprovalRequestsModule {}
```

- [ ] **Step 6: approval-api `app.module.ts` 수정 — `ApprovalRequestsModule` imports 추가**

`simulations/enterprise-pm/services/approval-api/src/app.module.ts`의 imports 배열 말미에 추가:

```ts
import { ApprovalRequestsModule } from "./approval/requests/approval-requests.module.js";

@Module({
  imports: [
    // ... (기존: HealthModule, ApprovalDbModule.forRoot(), BudgetModule, ResourceModule, TimeOffModule, ExpenseModule)
    ApprovalRequestsModule,
  ],
})
export class AppModule {}
```

- [ ] **Step 7: 테스트 통과 + typecheck**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter @qa-sdk/sim-approval-api typecheck && \
  pnpm --filter @qa-sdk/sim-approval-api test -- approval/requests
```

Expected: typecheck 0, service 6 + controller 5 = 11 PASS.

**주의 — sub-service export 회귀**: typecheck 실패 시 Plan 11b의 각 module이 service를 `exports: [...]`에 포함하는지 확인. 미포함 시 최소 변경으로 exports 추가:

```ts
// budget.module.ts 등
@Module({
  // ...
  exports: [BudgetService],  // ← 본 plan에서 보강
})
export class BudgetModule {}
```

- [ ] **Step 8: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add simulations/enterprise-pm/services/approval-api/src/approval/requests \
          simulations/enterprise-pm/services/approval-api/src/app.module.ts \
          simulations/enterprise-pm/services/approval-api/src/approval/budget/budget.module.ts \
          simulations/enterprise-pm/services/approval-api/src/approval/resource/resource.module.ts \
          simulations/enterprise-pm/services/approval-api/src/approval/timeoff/timeoff.module.ts \
          simulations/enterprise-pm/services/approval-api/src/approval/expense/expense.module.ts && \
  git commit -m "$(cat <<'EOF'
feat(sim-approval-api): /approvals/requests/:id facade + kind 분기 위임

ApprovalRequestsController — GET / POST decisions 두 endpoint.
ApprovalLookupService — 4 sub-service (budget/resource/time-off/expense) 위임.
gateway proxy `/approvals/*` 표면과 Plan 13b/c 시나리오 path 정합.
kind 누락/무효 시 400 + issues (no silent fallback).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: gateway `/approvals/*` 라우팅 회귀 + `/auth/authenticate` 호환성

**Files:**
- Modify: `simulations/enterprise-pm/services/gateway/src/routes/proxy-routes.ts` (주석)
- Modify: `simulations/enterprise-pm/services/gateway/src/integration.test.ts`

- [ ] **Step 1: PROXY_TARGETS 주석 갱신 — `/approvals/requests/:id` 진입점 명시**

`simulations/enterprise-pm/services/gateway/src/routes/proxy-routes.ts`의 `PROXY_TARGETS` 엔트리 수정:

```ts
export const PROXY_TARGETS: readonly ProxyTarget[] = [
  { path: "/projects", serviceKey: "sim-pm-api", description: "PM domain — ProjectController" },
  {
    path: "/approvals",
    serviceKey: "sim-approval-api",
    description:
      "Approval workflows — ApprovalRequestsController (GET /approvals/requests/:id, POST decisions). Plan 12a-1 +",
  },
  // ... 나머지 동일
];
```

**동작 회귀 테스트는 Plan 12a Task 8의 proxy-routes.test가 이미 `/approvals/y` → approval-api로 proxy됨을 검증 중** — 본 plan에서 추가 회귀 없음 (주석만 수정).

- [ ] **Step 2: gateway `integration.test.ts` — `/auth/authenticate` 스키마 회귀 1건 추가**

기존 `integration.test.ts`의 describe 블록에 추가:

```ts
it("`/auth/authenticate` 응답 스키마가 createLoginRoute와 호환 (Plan 11a ↔ 12a)", async () => {
  // Plan 11a의 AuthenticateController는 { userId, displayName, departmentId: null } 반환.
  // Plan 12a의 authResponseSchema도 동일 필드 수용.
  // 본 test는 실 auth-api를 부팅 후 /auth/authenticate에 직접 호출 — createLoginRoute의
  // parseResult 전 단계에서 schema parse가 성공하는지 회귀 확인.
  const res = await fetch(`http://localhost:${authPort}/auth/authenticate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "alice@example.com", password: "test123" }),
  });
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.userId).toBeTruthy();
  expect(typeof body.userId).toBe("string");
  // displayName/departmentId는 optional (Plan 12a authResponseSchema)
});
```

본 test는 `SIM_GATEWAY_INTEGRATION=1` env gate 내부 — 기존 skip 가드 그대로 사용.

- [ ] **Step 3: test-bootstrap ↔ integration 회귀**

`integration.test.ts`의 beforeAll을 Task 2의 `createGatewayTestApp` 사용으로 리팩터 (옵션 — 본 plan 범위 외 가능):

```ts
import { createGatewayTestApp } from "./test-bootstrap.js";
// ...
const gateway = createGatewayTestApp({
  authApiUrl: `http://localhost:${authPort}`,
  proxyTimeoutMs: 5000,
  proxyTargets: { ...DEFAULT_TEST_PROXY_TARGETS, /* overrides */ },
});
```

본 plan에서 필수는 아니며, Plan 13a의 in-process-env가 같은 헬퍼를 쓰므로 정합성만 유지.

- [ ] **Step 4: 테스트 실행 (env gate)**

```bash
SIM_GATEWAY_INTEGRATION=1 \
  cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter @qa-sdk/sim-gateway test -- integration
```

Expected: env 활성화 시 기존 1 + 신규 1 = 2 PASS. 미설정 시 skip.

- [ ] **Step 5: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add simulations/enterprise-pm/services/gateway/src/routes/proxy-routes.ts \
          simulations/enterprise-pm/services/gateway/src/integration.test.ts && \
  git commit -m "$(cat <<'EOF'
test(sim-gateway): /auth/authenticate 스키마 호환성 회귀

Plan 11a AuthenticateController 응답과 Plan 12a authResponseSchema 정합
— displayName/departmentId optional, userId 필수.
PROXY_TARGETS 주석에 ApprovalRequestsController 진입점 명시.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: 회귀 + import smoke

- [ ] **Step 1: gateway + approval-api typecheck + 테스트 + build**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter @qa-sdk/sim-gateway typecheck && \
  pnpm --filter @qa-sdk/sim-gateway test 2>&1 | tail -5 && \
  pnpm --filter @qa-sdk/sim-gateway build && \
  pnpm --filter @qa-sdk/sim-approval-api typecheck && \
  pnpm --filter @qa-sdk/sim-approval-api test 2>&1 | tail -5
```

Expected:
- gateway typecheck 0 / 53 PASS (기존 47 + test-bootstrap 6, integration skip) / build 0 error
- approval-api typecheck 0 / 기존 + 11 PASS

- [ ] **Step 2: dynamic import smoke — 시나리오 runner 관점**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  node --input-type=module -e "
    const { createApp } = await import('@qa-sdk/sim-gateway/app');
    const { verifyBitmapJwt } = await import('@qa-sdk/sim-gateway/jwt');
    const { bitmapToClaim } = await import('@qa-sdk/sim-gateway/bitmap-claim');
    const { createGatewayTestApp, issueTestToken } = await import('@qa-sdk/sim-gateway/test-bootstrap');
    console.log('createApp:', typeof createApp);
    console.log('verifyBitmapJwt:', typeof verifyBitmapJwt);
    console.log('bitmapToClaim:', typeof bitmapToClaim);
    console.log('createGatewayTestApp:', typeof createGatewayTestApp);
    console.log('issueTestToken:', typeof issueTestToken);
  "
```

Expected: 5회 `function` 출력.

- [ ] **Step 3: def gate**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter @qa-sdk/cli def validate 2>&1 | tail -5
```

Expected: errors 0.

- [ ] **Step 4: workflow-smoke 회귀**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm exec vitest run workflow-smoke 2>&1 | tail -5
```

Expected: 12 PASS 유지.

---

## Self-Review

- [ ] `package.json` exports 5 서브경로 (`.` / `./app` / `./jwt` / `./bitmap-claim` / `./test-bootstrap`)
- [ ] `main` 필드 제거 + `exports` 단일 진입점
- [ ] tsup entry 5개 + dts 활성화 + splitting=false
- [ ] server.ts 최상단 shebang (`#!/usr/bin/env node`)
- [ ] `test-bootstrap.ts` — `createGatewayTestApp` + `issueTestToken` + `DEFAULT_TEST_PROXY_TARGETS` export
- [ ] 6 test-bootstrap 단위 테스트 PASS (app 생성 + token round-trip + 401/502 가드)
- [ ] `ApprovalRequestsController` — `GET /approvals/requests/:id` + `POST /approvals/requests/:id/decisions`
- [ ] `ApprovalLookupService` — 4 kind 분기 (budget/resource/time-off/expense-report) + unsupported kind throw
- [ ] `ApprovalRequestsModule` — 4 sub-module import + controller/service 등록
- [ ] approval-api `app.module.ts`에 `ApprovalRequestsModule` 추가
- [ ] sub-service module exports 보강 (Plan 11b 회귀)
- [ ] `/auth/authenticate` 응답 스키마 호환성 회귀 1건 (`integration.test.ts`)
- [ ] dynamic import smoke (Plan 13a `in-process-env.ts` 소비 관점) 통과
- [ ] no fallback — kind 미지원 throw, downstream 미주입 시 502/504 빠른 실패, JWT_SECRET 32바이트 강제
- [ ] workflow-smoke + def validate 0 error 유지

---

## Defer

| 작업 | 이유 | 후속 plan |
|---|---|---|
| `ApprovalRequestsController`에 kind 자동 추론 (id prefix로) | 시나리오가 kind를 명시 주입 중 — 자동 추론은 UX 보강 | Phase 5 DX |
| gateway가 `/approvals/requests/:id`의 kind를 query/body에서 추출해 downstream 전달 최적화 | 본 plan의 approval-api가 원본 그대로 수용 — gateway 무변경 | 미결 |
| `test-bootstrap.ts`의 `createGatewayTestApp`이 NestJS auth-api까지 부팅하는 one-shot 헬퍼로 확장 | Plan 13a `in-process-env.ts`가 해당 역할 담당 — 본 plan은 gateway 전용 | Plan 13a |
| `DEFAULT_TEST_PROXY_TARGETS`를 `PROXY_TARGETS` 상수에서 자동 파생 | serviceKey 집합이 소수 (6) — 직접 나열이 실수 시 눈에 띔 | 미결 |
| `/auth/refresh` endpoint (bitmap TTL 만료 후 재발급) | Plan 13d 시나리오 7에서 사용 — 별도 plan에서 `createLoginRoute`에 추가 | Plan 13d |

---

## 의존·후속

- **선행 (필수)**:
  - Plan 12a — `createApp`, `verifyBitmapJwt`, `signBitmapJwt`, `PROXY_TARGETS` 구현. 본 plan은 공개 진입점만 정렬.
  - Plan 11a — `POST /auth/authenticate` + `POST /bitmap/issue` endpoint.
  - Plan 11b — 4 sub-service (`BudgetService`, `ResourceService`, `TimeOffService`, `ExpenseService`) 구현.
- **병렬 가능**:
  - Plan 12c-1 (audit-browser-api exports) — 본 plan과 파일 겹침 없음.
  - Plan 11d (seed 파일 정렬) — 본 plan과 파일 겹침 없음.
- **후속 (본 plan 결과물을 소비)**:
  - Plan 13a — `@qa-sdk/sim-gateway/app`, `/jwt`, `/test-bootstrap` import.
  - Plan 13b — `POST /approvals/requests/:id/decisions` 시나리오 3/4 호출.
  - Plan 13c — `/approvals/requests/:id` 시나리오 5/6 호출.
  - Plan 13d — `/auth/refresh` endpoint 추가 시 본 plan의 test-bootstrap과 정합성 유지.
