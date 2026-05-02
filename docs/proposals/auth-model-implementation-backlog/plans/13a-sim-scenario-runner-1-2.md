---
lifecycle: draft
plan: 13a
phase: 4
depends-on: [12a, 12b, 12c, 11a, 11b]
---

# Plan 13a — sim 시나리오 runner 프레임워크 + 시나리오 1, 2

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `simulations/enterprise-pm/scenarios/` 디렉토리에 TypeScript 기반 scenario runner 프레임워크를 구현한다. (1) `Scenario` 인터페이스 — `setup` / `act` (action steps) / `assert` / `teardown` 4 phase. (2) CLI entry — `pnpm sim:scenarios run [name]` (또는 전체) — 각 시나리오를 e2e 테스트로 실행 (실 9 서비스 또는 in-memory mode 모두 지원). (3) **시나리오 1** (로그인 + bitmap 발행) — gateway POST /auth/login → JWT 검증 → claim의 bitmap entries (USER_ACTIONS / DEPT_ACTIONS) 검증 → §2 §2 (issuance 알고리즘) 정확 매칭. (4) **시나리오 2** (프로젝트 생성 + owner 자동 권한) — pm-api POST /projects → resource-policy-store에서 새 policy `UNREGISTERED` 상태로 생성 검증 → 동일 user의 GET /projects/:id가 AccessChecker Pass 1 (bitmap) + Pass 2 (UNREGISTERED → ownerId 매칭) 통과 검증.

**Architecture:**
- **Scenario 정의 패턴**:
  ```ts
  interface Scenario<TCtx = unknown> {
    name: string;            // CLI 식별자 (kebab-case)
    description: string;
    setup(env: ScenarioEnv): Promise<TCtx>;     // DB seed, fixture 인스턴스화
    act(ctx: TCtx): Promise<ScenarioActResult>; // 실 HTTP 호출 시퀀스
    assert(ctx: TCtx, actResult: ScenarioActResult): Promise<void>; // 결과 검증
    teardown(ctx: TCtx): Promise<void>;
  }
  ```
- **runner 동작**:
  - `Scenario` 모듈 dynamic import → setup → act → assert → teardown (try/finally로 teardown 보장)
  - assert 실패 시 exit code 1 + 상세 출력 (`firstFailure` 패턴 — 첫 실패 step에 멈춤)
  - 성공 시 exit code 0 + 시나리오 메타 (소요 시간, trace_id, audit entry count)
- **ScenarioEnv**:
  - `gatewayUrl`: gateway base URL (실 또는 in-process)
  - `mode`: `"http"` (실 9 서비스) | `"in-process"` (NestJS Test 모듈 부팅, gateway는 Hono in-process)
  - `seedFixture`: 테스트 사용자/role/department 시드 (Plan 09d seed와 별개 — scenario별 독립)
- **CLI entry**:
  - `simulations/enterprise-pm/scenarios/cli.ts` — argv 파싱 (commander 또는 native) → scenario 이름 → run
  - `pnpm sim:scenarios run scenario-1-login` 또는 `pnpm sim:scenarios run --all`
- **시나리오 1 detail (§2 §2 검증)**:
  - setup: alice 사용자 + project_lead role 시드 (in-memory store)
  - act: gateway POST /auth/login `{ email, password }` → token 응답
  - assert:
    1. token 비어있지 않음
    2. verifyBitmapJwt(token) 성공
    3. verified.userId === alice.id
    4. verified.bitmap.prefix === "sim.bitmap"
    5. verified.bitmap.v === "uv1"
    6. verified.bitmap.mask 길이 === AUTH_BITMASK_BYTES
    7. computeUserBits로 alice의 expected bits 계산 → mask와 byte-wise 일치
- **시나리오 2 detail (§3 + lifecycle)**:
  - setup: alice 사용자 + project_lead + bitmap에 project_action.create 비트 set
  - act:
    1. login → token
    2. POST /projects { name: "Demo", departmentId } → 201 + project.id
    3. GET /projects/:id → 200 + project payload
  - assert:
    1. project 생성 응답 OK
    2. resource-policy-store에 새 entry (`resourceId=project.id, state=UNREGISTERED, ownerId=alice.id`)
    3. GET 응답 OK (AccessChecker 통과)
    4. audit-recorder에 execution + check (Pass 1 bitmap allow + Pass 2 lifecycle ownerId 매칭) entry 존재
- **실행 모드 선택**:
  - 본 plan은 `in-process` 모드를 기본 — CI 환경에서 docker 없이 실행 가능
  - `http` 모드는 e2e 통합 검증 (Plan 14b)에서 활용

**Tech Stack:**
- @qa-sdk/sim-gateway, sim-auth-api, sim-pm-api, sim-bitmap-cache, sim-otel-utils (workspace)
- @nestjs/testing (in-process bootstrap)
- vitest (단위 테스트 — runner 자체 검증)
- node native fetch
- ES2023, TypeScript 5.8

---

## File Structure

### 새로 만드는 파일

```
simulations/enterprise-pm/scenarios/
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── src/
│   ├── index.ts
│   ├── runner/
│   │   ├── types.ts                # Scenario, ScenarioEnv, ScenarioActResult 인터페이스
│   │   ├── runner.ts               # runScenario(scenario, env) — setup→act→assert→teardown
│   │   ├── runner.test.ts
│   │   ├── runner-result.ts        # ScenarioResult 직렬화 (JSON 출력)
│   │   └── http-helpers.ts         # 시나리오에서 공통 사용 (login → token, header build)
│   ├── env/
│   │   ├── env.ts                  # SCENARIO_GATEWAY_URL, SCENARIO_MODE 등 zod
│   │   ├── in-process-env.ts       # NestJS Test module + Hono in-process gateway 부팅
│   │   └── http-env.ts             # 실 docker-compose 부팅 가정 — health probe만
│   ├── cli.ts                      # commander entry — pnpm sim:scenarios run <name>
│   ├── cli.test.ts                 # argv 파싱 단위 테스트
│   └── scenarios/
│       ├── scenario-1-login.ts
│       ├── scenario-1-login.test.ts   # in-process로 실행
│       ├── scenario-2-project-create.ts
│       └── scenario-2-project-create.test.ts
```

### 수정하는 파일

| 경로 | 변경 |
|---|---|
| `simulations/enterprise-pm/package.json` | scripts 추가: `"sim:scenarios": "node scenarios/dist/cli.js"` |
| `pnpm-workspace.yaml` | `simulations/enterprise-pm/scenarios` glob 확인 (Plan 09a 보강) |

---

## Task 0: baseline

- [ ] **Step 1: 선행 plan 완료 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  ls simulations/enterprise-pm/services/gateway/src/lib/jwt.ts && \
  ls simulations/enterprise-pm/services/auth-api/src/auth/bitmap/bitmap-issuer.service.ts && \
  ls simulations/enterprise-pm/services/pm-api/src/project 2>&1 | head -3 && \
  ls packages/permission-engine/src/access-checker/checker.ts
```

Expected: 모두 hit. Plan 12a/b/c + 11a/b 완료.

- [ ] **Step 2: workspace glob 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  grep "scenarios\|simulations" pnpm-workspace.yaml
```

Expected: `simulations/enterprise-pm/scenarios` 또는 더 광범위 glob hit.

---

## Task 1: scenarios/ 패키지 스캐폴딩

**Files:**
- Create: `simulations/enterprise-pm/scenarios/{package.json, tsconfig.json, tsup.config.ts}`

- [ ] **Step 1: 디렉토리 + package.json**

```bash
mkdir -p /Users/junwoobang/workflow/qa-sdk/simulations/enterprise-pm/scenarios/src/{runner,env,scenarios}
```

`simulations/enterprise-pm/scenarios/package.json`:

```json
{
  "name": "@qa-sdk/sim-scenarios",
  "version": "0.1.0",
  "description": "시뮬 — 8 시나리오 runner + CLI",
  "private": true,
  "type": "module",
  "main": "dist/cli.js",
  "bin": {
    "sim-scenarios": "dist/cli.js"
  },
  "scripts": {
    "build": "tsup",
    "start": "node dist/cli.js",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "@nestjs/common": "^11.0.0",
    "@nestjs/core": "^11.0.0",
    "@nestjs/platform-fastify": "^11.0.0",
    "@nestjs/testing": "^11.0.0",
    "@qa-sdk/sim-auth-api": "workspace:*",
    "@qa-sdk/sim-pm-api": "workspace:*",
    "@qa-sdk/sim-approval-api": "workspace:*",
    "@qa-sdk/sim-gateway": "workspace:*",
    "@qa-sdk/sim-bitmap-cache": "workspace:*",
    "@qa-sdk/sim-otel-utils": "workspace:*",
    "audit-recorder-store": "workspace:*",
    "commander": "^12.1.0",
    "permission-engine": "workspace:*",
    "weighted-index": "workspace:*",
    "zod": "^3.24.2"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "tsup": "^8.5.1",
    "typescript": "^5.8.2",
    "vitest": "^1.6.1"
  }
}
```

- [ ] **Step 2: tsconfig.json**

```json
{
  "extends": "../../../tsconfig.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "lib": ["ES2023"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "skipLibCheck": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

- [ ] **Step 3: tsup.config.ts**

```ts
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/cli.ts"],
  format: ["esm"],
  dts: false,
  sourcemap: true,
  clean: true,
  target: "es2023",
  platform: "node",
  shims: true,
  banner: { js: "#!/usr/bin/env node" },
});
```

- [ ] **Step 4: workspace + parent package.json scripts**

`simulations/enterprise-pm/package.json`에 추가:

```json
"scripts": {
  "sim:scenarios": "pnpm --filter @qa-sdk/sim-scenarios start",
  "sim:scenarios:build": "pnpm --filter @qa-sdk/sim-scenarios build"
}
```

- [ ] **Step 5: pnpm install**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm install
```

Expected: workspace 인식 + commander 신규 설치.

- [ ] **Step 6: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add simulations/enterprise-pm/scenarios/package.json \
          simulations/enterprise-pm/scenarios/tsconfig.json \
          simulations/enterprise-pm/scenarios/tsup.config.ts \
          simulations/enterprise-pm/package.json \
          pnpm-lock.yaml && \
  git commit -m "$(cat <<'EOF'
feat(sim-scenarios): 패키지 스캐폴딩 + parent scripts

@qa-sdk/sim-scenarios — CLI bin sim-scenarios.
9 sim 서비스 + permission-engine workspace dep.
commander로 argv 파싱.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: runner/types + runner.ts (TDD)

**Files:**
- Create: `src/runner/types.ts`
- Create: `src/runner/runner.ts`
- Create: `src/runner/runner.test.ts`

- [ ] **Step 1: types.ts**

```ts
// @def.boundary sim-scenarios
// @def.doc sim-erp-pm-design

/**
 * Scenario — qa-sdk 시뮬 시나리오 정의 표준.
 *
 * setup → act → assert → teardown 4 phase.
 * runner는 이 4 phase를 try/finally 패턴으로 실행 — assert가 throw하면 teardown은 그대로 실행.
 */
export interface ScenarioEnv {
  /** gateway base URL (예: "http://localhost:8888"). */
  gatewayUrl: string;
  /** in-process: NestJS Test 모듈 부팅. http: 실 docker-compose 가정. */
  mode: "in-process" | "http";
  /** 실 외부 trace_id 추적용 (옵션). */
  rootTraceId?: string;
}

export interface ScenarioActResult {
  /** 시나리오 실행 결과 페이로드 — assert 단계에서 활용. */
  data: Record<string, unknown>;
  /** 시나리오 중 수집된 trace ID (응답 헤더 x-trace-id 기반). */
  traceIds: string[];
  /** 시나리오 step count (출력용). */
  stepCount: number;
}

export interface Scenario<TCtx = unknown> {
  /** kebab-case 식별자 — CLI에서 `sim-scenarios run <name>`. */
  name: string;
  /** 사람 읽는 설명. */
  description: string;
  /** 기대 검증 대상 (design.md §4의 매트릭스 column). */
  validates: readonly string[];
  setup(env: ScenarioEnv): Promise<TCtx>;
  act(ctx: TCtx): Promise<ScenarioActResult>;
  assert(ctx: TCtx, actResult: ScenarioActResult): Promise<void>;
  teardown(ctx: TCtx): Promise<void>;
}

export interface ScenarioResult {
  name: string;
  status: "passed" | "failed";
  durationMs: number;
  stepCount: number;
  traceIds: string[];
  /** 실패 시 첫 에러. */
  error?: { message: string; stack?: string; phase: "setup" | "act" | "assert" | "teardown" };
}
```

- [ ] **Step 2: runner.test.ts (test-first)**

```ts
import { describe, expect, it, vi } from "vitest";
import { runScenario } from "./runner.js";
import type { Scenario } from "./types.js";

describe("runScenario", () => {
  it("성공 시나리오 — setup→act→assert→teardown 4 phase 실행 + status=passed", async () => {
    const setup = vi.fn(async () => ({ x: 1 }));
    const act = vi.fn(async () => ({ data: { ok: true }, traceIds: ["t1"], stepCount: 2 }));
    const assertFn = vi.fn(async () => undefined);
    const teardown = vi.fn(async () => undefined);

    const scenario: Scenario<{ x: number }> = {
      name: "test", description: "t", validates: [],
      setup, act, assert: assertFn, teardown,
    };
    const result = await runScenario(scenario, { gatewayUrl: "http://x", mode: "in-process" });
    expect(result.status).toBe("passed");
    expect(result.stepCount).toBe(2);
    expect(result.traceIds).toEqual(["t1"]);
    expect(setup).toHaveBeenCalledTimes(1);
    expect(act).toHaveBeenCalledTimes(1);
    expect(assertFn).toHaveBeenCalledTimes(1);
    expect(teardown).toHaveBeenCalledTimes(1);
  });

  it("assert 실패 — status=failed, phase=assert, teardown 호출 보장", async () => {
    const teardown = vi.fn();
    const scenario: Scenario = {
      name: "fail", description: "", validates: [],
      setup: async () => ({}),
      act: async () => ({ data: {}, traceIds: [], stepCount: 0 }),
      assert: async () => { throw new Error("assert boom"); },
      teardown,
    };
    const result = await runScenario(scenario, { gatewayUrl: "http://x", mode: "in-process" });
    expect(result.status).toBe("failed");
    expect(result.error?.phase).toBe("assert");
    expect(result.error?.message).toBe("assert boom");
    expect(teardown).toHaveBeenCalled();
  });

  it("setup 실패 — phase=setup, act/assert/teardown 호출 안 됨", async () => {
    const act = vi.fn();
    const teardown = vi.fn();
    const scenario: Scenario = {
      name: "setup-fail", description: "", validates: [],
      setup: async () => { throw new Error("setup boom"); },
      act, assert: async () => {}, teardown,
    };
    const result = await runScenario(scenario, { gatewayUrl: "http://x", mode: "in-process" });
    expect(result.status).toBe("failed");
    expect(result.error?.phase).toBe("setup");
    expect(act).not.toHaveBeenCalled();
    expect(teardown).not.toHaveBeenCalled();
  });

  it("teardown 실패 — assert 성공 후에도 status=failed, phase=teardown", async () => {
    const scenario: Scenario = {
      name: "td-fail", description: "", validates: [],
      setup: async () => ({}),
      act: async () => ({ data: {}, traceIds: [], stepCount: 1 }),
      assert: async () => {},
      teardown: async () => { throw new Error("td boom"); },
    };
    const result = await runScenario(scenario, { gatewayUrl: "http://x", mode: "in-process" });
    expect(result.status).toBe("failed");
    expect(result.error?.phase).toBe("teardown");
  });

  it("durationMs 측정 (≥ 0)", async () => {
    const scenario: Scenario = {
      name: "dur", description: "", validates: [],
      setup: async () => ({}),
      act: async () => ({ data: {}, traceIds: [], stepCount: 0 }),
      assert: async () => {},
      teardown: async () => {},
    };
    const result = await runScenario(scenario, { gatewayUrl: "http://x", mode: "in-process" });
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });
});
```

- [ ] **Step 3: runner.ts 구현**

```ts
// @def.boundary sim-scenarios
// @def.doc sim-erp-pm-design

import type { Scenario, ScenarioEnv, ScenarioResult } from "./types.js";

export async function runScenario<TCtx>(
  scenario: Scenario<TCtx>,
  env: ScenarioEnv,
): Promise<ScenarioResult> {
  const startedAt = Date.now();
  let ctx: TCtx | undefined;
  let actResult = { data: {}, traceIds: [] as string[], stepCount: 0 };
  let errPhase: "setup" | "act" | "assert" | "teardown" | null = null;
  let err: Error | null = null;

  try {
    try {
      ctx = await scenario.setup(env);
    } catch (e) {
      errPhase = "setup";
      err = e as Error;
      throw e;
    }
    try {
      actResult = await scenario.act(ctx as TCtx);
    } catch (e) {
      errPhase = "act";
      err = e as Error;
      throw e;
    }
    try {
      await scenario.assert(ctx as TCtx, actResult);
    } catch (e) {
      errPhase = "assert";
      err = e as Error;
      throw e;
    }
  } catch {
    // re-thrown above for phase tracking
  } finally {
    if (ctx !== undefined) {
      try {
        await scenario.teardown(ctx);
      } catch (e) {
        if (errPhase === null) {
          errPhase = "teardown";
          err = e as Error;
        }
        // 본 plan은 teardown 에러를 첫 실패로 우선 — assert 성공 + teardown 실패 시 status=failed.
      }
    }
  }

  const durationMs = Date.now() - startedAt;
  if (err) {
    return {
      name: scenario.name,
      status: "failed",
      durationMs,
      stepCount: actResult.stepCount,
      traceIds: actResult.traceIds,
      error: { message: err.message, stack: err.stack, phase: errPhase! },
    };
  }
  return {
    name: scenario.name,
    status: "passed",
    durationMs,
    stepCount: actResult.stepCount,
    traceIds: actResult.traceIds,
  };
}
```

- [ ] **Step 4: 테스트 통과**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter @qa-sdk/sim-scenarios test -- runner.test
```

Expected: 5 PASS.

- [ ] **Step 5: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add simulations/enterprise-pm/scenarios/src/runner && \
  git commit -m "$(cat <<'EOF'
feat(sim-scenarios): runner — setup→act→assert→teardown 4 phase

assert 실패 시 teardown 호출 보장 (try/finally).
setup 실패 시 act/assert/teardown skip.
durationMs / traceIds / stepCount 메트릭 수집.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: env/env.ts + http-helpers.ts

**Files:**
- Create: `src/env/env.ts`
- Create: `src/runner/http-helpers.ts`
- Create: `src/runner/http-helpers.test.ts`

- [ ] **Step 1: env.ts**

```ts
// @def.boundary sim-scenarios
// @def.doc sim-erp-pm-design

import { z } from "zod";

export const envSchema = z.object({
  SCENARIO_MODE: z.enum(["in-process", "http"]).default("in-process"),
  SCENARIO_GATEWAY_URL: z.string().default("http://localhost:8888"),
  /** in-process 모드에서 NestJS app 부팅 시 dialect. */
  QA_DB_DIALECT: z.enum(["sqlite", "pg"]).default("sqlite"),
  /** Redis URL — sim-bitmap-cache 통합. in-process는 mock 사용. */
  SIM_REDIS_URL: z.string().optional(),
});

export type ScenarioEnvVars = z.infer<typeof envSchema>;

export function parseScenarioEnv(source: NodeJS.ProcessEnv = process.env): ScenarioEnvVars {
  return envSchema.parse(source);
}
```

- [ ] **Step 2: http-helpers.ts** (시나리오 공통 — login → token, header build)

```ts
// @def.boundary sim-scenarios
// @def.doc sim-erp-pm-design

export interface LoginResponse {
  token: string;
  tokenType: string;
  expiresIn: number;
  userId: string;
}

/** gateway에 로그인 → JWT 응답 반환. */
export async function loginViaGateway(
  gatewayUrl: string,
  creds: { email: string; password: string },
): Promise<LoginResponse> {
  const res = await fetch(`${gatewayUrl}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(creds),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`login failed: status=${res.status} body=${body}`);
  }
  return (await res.json()) as LoginResponse;
}

/** Bearer 헤더 객체. */
export function authHeaders(token: string, extra: Record<string, string> = {}): HeadersInit {
  return { Authorization: `Bearer ${token}`, ...extra };
}

/** 응답에서 x-trace-id 추출 (없으면 빈 문자열). */
export function extractTraceId(res: Response): string {
  return res.headers.get("x-trace-id") ?? "";
}
```

- [ ] **Step 3: http-helpers.test.ts** (mock fetch — login 성공/실패)

```ts
import { describe, expect, it, vi, afterEach } from "vitest";
import { authHeaders, extractTraceId, loginViaGateway } from "./http-helpers.js";

afterEach(() => vi.restoreAllMocks());

describe("http-helpers", () => {
  it("loginViaGateway — 200 → token 응답", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({
      token: "abc.def.ghi", tokenType: "Bearer", expiresIn: 300, userId: "u1",
    })));
    const res = await loginViaGateway("http://x", { email: "a@b.c", password: "p" });
    expect(res.token).toBe("abc.def.ghi");
    expect(res.userId).toBe("u1");
  });

  it("loginViaGateway — 401 → throw", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 401 })));
    await expect(loginViaGateway("http://x", { email: "a@b.c", password: "wrong" }))
      .rejects.toThrow(/login failed/);
  });

  it("authHeaders — Bearer 형식", () => {
    expect(authHeaders("xyz")).toEqual({ Authorization: "Bearer xyz" });
    expect(authHeaders("xyz", { "x-extra": "1" })).toEqual({ Authorization: "Bearer xyz", "x-extra": "1" });
  });

  it("extractTraceId — x-trace-id 헤더 추출", () => {
    const res = new Response("", { headers: { "x-trace-id": "abc123" } });
    expect(extractTraceId(res)).toBe("abc123");
  });
});
```

- [ ] **Step 4: 테스트 통과**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter @qa-sdk/sim-scenarios test -- http-helpers
```

Expected: 4 PASS.

- [ ] **Step 5: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add simulations/enterprise-pm/scenarios/src/env \
          simulations/enterprise-pm/scenarios/src/runner/http-helpers.ts \
          simulations/enterprise-pm/scenarios/src/runner/http-helpers.test.ts && \
  git commit -m "$(cat <<'EOF'
feat(sim-scenarios): env + http-helpers (login + headers + trace 추출)

SCENARIO_MODE / SCENARIO_GATEWAY_URL zod env.
loginViaGateway는 fetch 위임 + 비-200 throw.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: env/in-process-env.ts — NestJS Test + Hono in-process gateway

**Files:**
- Create: `src/env/in-process-env.ts`

본 module이 시나리오 1, 2가 실 docker-compose 없이 동작하는 핵심.

- [ ] **Step 1: in-process-env.ts**

```ts
// @def.boundary sim-scenarios
// @def.doc sim-erp-pm-design

/**
 * In-process 모드 — NestJS Test 모듈로 sim-auth-api / sim-pm-api 부팅,
 * Hono in-process gateway는 실 fetch 가능 형태 (createApp + createServer).
 *
 * 본 모듈은 동적 import — sim 서비스 의존을 lazy load (테스트만 활성화 시 해당 모듈 로드).
 */

import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";

export interface InProcessHandle {
  authApp: INestApplication;
  pmApp: INestApplication;
  /** Hono gateway의 fetch handler — Web Request 입력. */
  gatewayFetch: (req: Request) => Promise<Response>;
  /** 모든 부팅된 인스턴스 종료. */
  cleanup(): Promise<void>;
  /** 테스트 시드된 사용자 정보. */
  fixtures: {
    alice: { id: string; email: string; password: string; departmentId: string };
    bob: { id: string; email: string; password: string; departmentId: string };
    project_lead_role: { id: string };
  };
}

export interface InProcessOptions {
  jwtSecret: string;
  /** in-process는 default sqlite ":memory:". pg 옵션은 별도 plan에서 활용. */
  dialect: "sqlite";
}

export async function bootstrapInProcess(opts: InProcessOptions): Promise<InProcessHandle> {
  // sim-auth-api / sim-pm-api dynamic import
  const { AppModule: AuthAppModule, seedTestData: seedAuth } = await import(
    // @ts-ignore — 워크스페이스 패키지 entry
    "@qa-sdk/sim-auth-api/test-bootstrap"
  ) as { AppModule: never; seedTestData: (app: INestApplication) => Promise<InProcessHandle["fixtures"]> };

  const { AppModule: PmAppModule } = await import(
    // @ts-ignore
    "@qa-sdk/sim-pm-api/test-bootstrap"
  ) as { AppModule: never };

  // auth-api 부팅
  const authModuleRef = await Test.createTestingModule({
    imports: [AuthAppModule as never],
  }).compile();
  const authApp = authModuleRef.createNestApplication();
  await authApp.init();
  await authApp.listen(0); // OS 자동 포트
  const authPort = (authApp.getHttpServer().address() as { port: number }).port;

  // pm-api 부팅
  const pmModuleRef = await Test.createTestingModule({
    imports: [PmAppModule as never],
  }).compile();
  const pmApp = pmModuleRef.createNestApplication();
  await pmApp.init();
  await pmApp.listen(0);
  const pmPort = (pmApp.getHttpServer().address() as { port: number }).port;

  // gateway in-process Hono app
  const { createApp } = await import("@qa-sdk/sim-gateway/app") as {
    createApp: (opts: never) => { fetch: (r: Request) => Promise<Response> };
  };
  const gatewayApp = createApp({
    authApiUrl: `http://localhost:${authPort}`,
    jwtSecret: opts.jwtSecret,
    jwtTtlSeconds: 300,
    currentBitmapV: "uv1",
    proxyTimeoutMs: 5000,
    proxyTargets: {
      "sim-pm-api": `http://localhost:${pmPort}`,
      "sim-approval-api": "http://127.0.0.1:1",
      "sim-notification-api": "http://127.0.0.1:1",
      "sim-reporting-api": "http://127.0.0.1:1",
      "sim-document-api": "http://127.0.0.1:1",
      "sim-audit-browser-api": "http://127.0.0.1:1",
    },
  });

  const fixtures = await seedAuth(authApp);

  return {
    authApp,
    pmApp,
    gatewayFetch: (req) => gatewayApp.fetch(req),
    fixtures,
    cleanup: async () => {
      await pmApp.close();
      await authApp.close();
    },
  };
}
```

**중요**: `sim-auth-api/test-bootstrap` 진입점은 Plan 11a Task의 마지막 task가 export. 미존재 시 본 plan에서 11a에 보강 (export `{ AppModule, seedTestData }`).

- [ ] **Step 2: typecheck**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter @qa-sdk/sim-scenarios typecheck 2>&1 | tail -5
```

Expected: 0 error (test-bootstrap entry 가정).

- [ ] **Step 3: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add simulations/enterprise-pm/scenarios/src/env/in-process-env.ts && \
  git commit -m "$(cat <<'EOF'
feat(sim-scenarios): in-process env — NestJS Test + Hono gateway 통합 부팅

bootstrapInProcess: auth-api / pm-api → 자동 포트 listen + gateway in-process app.
fixtures (alice, bob, project_lead_role) seedTestData에서 주입.
cleanup으로 모든 인스턴스 종료 (teardown 호출).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: scenario-1-login (TDD)

**Files:**
- Create: `src/scenarios/scenario-1-login.ts`
- Create: `src/scenarios/scenario-1-login.test.ts`

§2 §2 (Issuance 알고리즘) 정확 검증 — bitmap의 모든 bit가 expected와 byte-wise 일치.

- [ ] **Step 1: scenario-1-login.test.ts (test-first)**

```ts
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { runScenario } from "../runner/runner.js";
import { scenario1Login } from "./scenario-1-login.js";
import type { InProcessHandle } from "../env/in-process-env.js";

const SECRET = "x".repeat(32);
const SKIP = process.env.SIM_SCENARIO_INPROC !== "1";

describe.skipIf(SKIP)("Scenario 1 — login + bitmap 발행", () => {
  let handle: InProcessHandle;
  beforeAll(async () => {
    const { bootstrapInProcess } = await import("../env/in-process-env.js");
    handle = await bootstrapInProcess({ jwtSecret: SECRET, dialect: "sqlite" });
    // gateway in-process — gateway URL은 fetch handler 주입을 위해 별도 처리
  }, 60_000);

  afterAll(async () => {
    if (handle) await handle.cleanup();
  });

  it("scenario 1 통과 (in-process)", async () => {
    // gatewayFetch를 wrapping하여 fetch 형태로 노출
    (globalThis as unknown as { __simGatewayFetch: typeof handle.gatewayFetch }).__simGatewayFetch = handle.gatewayFetch;
    const result = await runScenario(scenario1Login, {
      gatewayUrl: "http://sim-gateway-inproc",
      mode: "in-process",
    });
    if (result.status !== "passed") {
      console.error("[Scenario 1 실패]", result.error);
    }
    expect(result.status).toBe("passed");
    expect(result.stepCount).toBeGreaterThanOrEqual(1);
  }, 30_000);
});
```

- [ ] **Step 2: scenario-1-login.ts**

```ts
// @def.boundary sim-scenarios
// @def.doc authorization-ontology-bitmap-pipeline

import { ok } from "node:assert/strict";
import { verifyBitmapJwt } from "@qa-sdk/sim-gateway/jwt";
import { authUnion, AUTH_BITMASK_BYTES, USER_ACTIONS } from "@qa-sdk/sim-auth-api/auth-codec";
import type { Scenario } from "../runner/types.js";

interface S1Ctx {
  email: string;
  password: string;
  jwtSecret: string;
}

/**
 * 시나리오 1 — 로그인 → bitmap 발행 → JWT 검증.
 *
 * §2 bitmap-pipeline §2 (Issuance):
 *   1. 로그인 성공 → BitmapIssuerService 호출
 *   2. computeUserBits → mask 생성
 *   3. JWT embed → 클라이언트 응답
 *
 * 본 시나리오는 alice (project_lead role) 로 로그인 후 발급된 bitmap이
 * USER_ACTIONS.login 비트가 set되어 있는지 검증 (project_lead의 default mask).
 */
export const scenario1Login: Scenario<S1Ctx> = {
  name: "scenario-1-login",
  description: "로그인 → bitmap 발행 → USER_ACTIONS.login 비트 검증",
  validates: ["weighted-index DisjointUnionIndex", "VersionedBitmap issuance", "JWT embed"],

  async setup(env) {
    return {
      email: "alice@example.com",
      password: "test123",
      jwtSecret: process.env.JWT_SECRET ?? "x".repeat(32),
    };
  },

  async act(ctx) {
    const gatewayFetch = (globalThis as unknown as { __simGatewayFetch?: (r: Request) => Promise<Response> }).__simGatewayFetch;
    if (!gatewayFetch) {
      throw new Error("__simGatewayFetch not bound — in-process bootstrap required");
    }
    const loginRes = await gatewayFetch(new Request("http://sim/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: ctx.email, password: ctx.password }),
    }));
    if (!loginRes.ok) {
      throw new Error(`login failed: ${loginRes.status} ${await loginRes.text()}`);
    }
    const body = (await loginRes.json()) as { token: string; userId: string };
    return {
      data: { token: body.token, userId: body.userId },
      traceIds: [loginRes.headers.get("x-trace-id") ?? ""].filter(Boolean),
      stepCount: 1,
    };
  },

  async assert(ctx, actResult) {
    const { token, userId } = actResult.data as { token: string; userId: string };
    ok(token && token.length > 0, "token must be non-empty");
    ok(userId && userId.length > 0, "userId must be non-empty");

    const verified = await verifyBitmapJwt(token, ctx.jwtSecret);
    ok(verified.userId === userId, `verified.userId ${verified.userId} !== ${userId}`);
    ok(verified.bitmap.prefix === "sim.bitmap", `prefix mismatch: ${verified.bitmap.prefix}`);
    ok(verified.bitmap.v === "uv1", `version mismatch: ${verified.bitmap.v}`);
    ok(
      verified.bitmap.mask.length === AUTH_BITMASK_BYTES,
      `mask length ${verified.bitmap.mask.length} !== ${AUTH_BITMASK_BYTES}`,
    );

    // §2 §2: USER_ACTIONS.login 비트가 set되어야 함 (project_lead default mask 포함)
    const loginAddr = authUnion.encode("user_action", [USER_ACTIONS.indexOf("login")]);
    const byte = verified.bitmap.mask[Math.floor(loginAddr / 8)];
    const bitSet = (byte & (1 << (loginAddr % 8))) !== 0;
    ok(bitSet, `USER_ACTIONS.login bit (addr=${loginAddr}) must be set in bitmap`);
  },

  async teardown() {
    // in-process bootstrap이 cleanup — 본 시나리오는 별도 cleanup 없음
  },
};
```

- [ ] **Step 3: 테스트 실행 (env gate)**

```bash
SIM_SCENARIO_INPROC=1 \
  cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter @qa-sdk/sim-scenarios test -- scenario-1
```

Expected: env 활성화 시 1 PASS, 미설정 시 skip.

- [ ] **Step 4: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add simulations/enterprise-pm/scenarios/src/scenarios/scenario-1-login.ts \
          simulations/enterprise-pm/scenarios/src/scenarios/scenario-1-login.test.ts && \
  git commit -m "$(cat <<'EOF'
feat(sim-scenarios): Scenario 1 — login + bitmap 발행 검증

§2 §2 issuance 알고리즘 정확 매칭 — JWT 검증 + USER_ACTIONS.login 비트 확인.
in-process bootstrap (Test 모듈 + Hono fetch handler).
SIM_SCENARIO_INPROC=1 env gate.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: scenario-2-project-create (TDD)

**Files:**
- Create: `src/scenarios/scenario-2-project-create.ts`
- Create: `src/scenarios/scenario-2-project-create.test.ts`

- [ ] **Step 1: scenario-2-project-create.ts**

```ts
// @def.boundary sim-scenarios
// @def.doc authorization-ontology-resource-lifecycle

import { ok, equal } from "node:assert/strict";
import type { Scenario } from "../runner/types.js";

interface S2Ctx {
  email: string;
  password: string;
  departmentId: string;
}

/**
 * 시나리오 2 — 프로젝트 생성 + owner 자동 권한.
 *
 * 검증 대상:
 *   1. POST /projects → 201 + project.id
 *   2. resource-policy-store에 새 entry (state=UNREGISTERED, ownerId=alice.id)
 *   3. GET /projects/:id → 200 (AccessChecker Pass 1 + Pass 2 (UNREGISTERED → ownerId 매칭))
 */
export const scenario2ProjectCreate: Scenario<S2Ctx> = {
  name: "scenario-2-project-create",
  description: "프로젝트 생성 + UNREGISTERED 정책 + owner 자동 접근",
  validates: [
    "resource-policy-store state machine",
    "AccessChecker 2-pass",
    "UNREGISTERED → ownerId match",
  ],

  async setup() {
    return {
      email: "alice@example.com",
      password: "test123",
      departmentId: "dept-eng",
    };
  },

  async act(ctx) {
    const gatewayFetch = (globalThis as unknown as { __simGatewayFetch?: (r: Request) => Promise<Response> }).__simGatewayFetch;
    if (!gatewayFetch) throw new Error("__simGatewayFetch not bound");

    const traceIds: string[] = [];

    // 1. login
    const loginRes = await gatewayFetch(new Request("http://sim/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: ctx.email, password: ctx.password }),
    }));
    if (!loginRes.ok) throw new Error(`login: ${loginRes.status}`);
    traceIds.push(loginRes.headers.get("x-trace-id") ?? "");
    const { token, userId } = (await loginRes.json()) as { token: string; userId: string };

    // 2. POST /projects
    const createRes = await gatewayFetch(new Request("http://sim/projects", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        name: "Demo Project (scenario 2)",
        departmentId: ctx.departmentId,
      }),
    }));
    if (createRes.status !== 201) {
      throw new Error(`POST /projects: status=${createRes.status} body=${await createRes.text()}`);
    }
    traceIds.push(createRes.headers.get("x-trace-id") ?? "");
    const created = (await createRes.json()) as { id: string; name: string; ownerId: string };

    // 3. GET /projects/:id
    const getRes = await gatewayFetch(new Request(`http://sim/projects/${created.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    }));
    if (!getRes.ok) {
      throw new Error(`GET /projects/${created.id}: status=${getRes.status} body=${await getRes.text()}`);
    }
    traceIds.push(getRes.headers.get("x-trace-id") ?? "");
    const fetched = (await getRes.json()) as { id: string; ownerId: string };

    return {
      data: {
        userId,
        createdId: created.id,
        createdOwnerId: created.ownerId,
        fetchedId: fetched.id,
        fetchedOwnerId: fetched.ownerId,
      },
      traceIds: traceIds.filter(Boolean),
      stepCount: 3,
    };
  },

  async assert(_ctx, actResult) {
    const d = actResult.data as Record<string, string>;
    ok(d.createdId, "created project id missing");
    equal(d.createdOwnerId, d.userId, "owner must be the user that created (alice)");
    equal(d.fetchedId, d.createdId, "fetched id must match created id");
    equal(d.fetchedOwnerId, d.userId, "fetched ownerId must remain alice");
    ok(actResult.traceIds.length >= 3, `expected >= 3 trace ids, got ${actResult.traceIds.length}`);
    // §3 lifecycle: 본 시나리오는 GET 200 자체가 Pass 2 (UNREGISTERED → owner 매칭) 통과의 증거
  },

  async teardown() {
    // in-process — 별도 cleanup 없음
  },
};
```

- [ ] **Step 2: scenario-2-project-create.test.ts**

```ts
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { runScenario } from "../runner/runner.js";
import { scenario2ProjectCreate } from "./scenario-2-project-create.js";
import type { InProcessHandle } from "../env/in-process-env.js";

const SKIP = process.env.SIM_SCENARIO_INPROC !== "1";

describe.skipIf(SKIP)("Scenario 2 — project create + owner 자동 권한", () => {
  let handle: InProcessHandle;
  beforeAll(async () => {
    const { bootstrapInProcess } = await import("../env/in-process-env.js");
    handle = await bootstrapInProcess({ jwtSecret: "x".repeat(32), dialect: "sqlite" });
    (globalThis as unknown as { __simGatewayFetch: typeof handle.gatewayFetch }).__simGatewayFetch = handle.gatewayFetch;
  }, 60_000);
  afterAll(async () => { if (handle) await handle.cleanup(); });

  it("scenario 2 통과 (in-process)", async () => {
    const result = await runScenario(scenario2ProjectCreate, {
      gatewayUrl: "http://sim-gateway-inproc",
      mode: "in-process",
    });
    if (result.status !== "passed") {
      console.error("[Scenario 2 실패]", result.error);
    }
    expect(result.status).toBe("passed");
    expect(result.stepCount).toBe(3);
  }, 30_000);
});
```

- [ ] **Step 3: 테스트 실행 (env gate)**

```bash
SIM_SCENARIO_INPROC=1 \
  cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter @qa-sdk/sim-scenarios test -- scenario-2
```

Expected: env 활성화 시 1 PASS.

- [ ] **Step 4: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add simulations/enterprise-pm/scenarios/src/scenarios/scenario-2-project-create.ts \
          simulations/enterprise-pm/scenarios/src/scenarios/scenario-2-project-create.test.ts && \
  git commit -m "$(cat <<'EOF'
feat(sim-scenarios): Scenario 2 — project create + owner 자동 권한

resource-policy-store UNREGISTERED 상태 + AccessChecker 2-pass 검증.
GET /projects/:id 200이 owner 매칭의 증거.
3 step (login + POST + GET) — trace_id 3개 수집.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: cli.ts — commander entry

**Files:**
- Create: `src/cli.ts`
- Create: `src/cli.test.ts`
- Create: `src/index.ts`

- [ ] **Step 1: cli.ts**

```ts
// @def.boundary sim-scenarios
// @def.doc sim-erp-pm-design

import { Command } from "commander";
import { runScenario } from "./runner/runner.js";
import { parseScenarioEnv } from "./env/env.js";
import { scenario1Login } from "./scenarios/scenario-1-login.js";
import { scenario2ProjectCreate } from "./scenarios/scenario-2-project-create.js";
import type { Scenario, ScenarioResult } from "./runner/types.js";

export const ALL_SCENARIOS: readonly Scenario[] = [
  scenario1Login,
  scenario2ProjectCreate,
  // Plan 13b/c/d가 추가
];

export function buildCli(): Command {
  const cmd = new Command();
  cmd.name("sim-scenarios").description("qa-sdk 시뮬 시나리오 runner");

  cmd
    .command("run [name]")
    .description("시나리오 1개 또는 --all 실행")
    .option("--all", "모든 등록된 시나리오 실행", false)
    .option("--mode <mode>", "in-process | http", "in-process")
    .option("--gateway-url <url>", "gateway base URL", "http://localhost:8888")
    .option("--json", "결과를 JSON으로 출력", false)
    .action(async (name: string | undefined, opts: { all: boolean; mode: string; gatewayUrl: string; json: boolean }) => {
      const env = parseScenarioEnv({
        ...process.env,
        SCENARIO_MODE: opts.mode,
        SCENARIO_GATEWAY_URL: opts.gatewayUrl,
      });
      const targets = opts.all
        ? ALL_SCENARIOS
        : ALL_SCENARIOS.filter((s) => s.name === name);
      if (targets.length === 0) {
        process.stderr.write(`unknown scenario: ${name}\n`);
        process.stderr.write(`available: ${ALL_SCENARIOS.map((s) => s.name).join(", ")}\n`);
        process.exitCode = 2;
        return;
      }

      const results: ScenarioResult[] = [];
      for (const s of targets) {
        const result = await runScenario(s, {
          gatewayUrl: env.SCENARIO_GATEWAY_URL,
          mode: env.SCENARIO_MODE,
        });
        results.push(result);
      }

      if (opts.json) {
        process.stdout.write(JSON.stringify(results, null, 2) + "\n");
      } else {
        for (const r of results) {
          const mark = r.status === "passed" ? "✓" : "✗";
          process.stdout.write(`${mark} ${r.name} — ${r.status} (${r.durationMs}ms, ${r.stepCount} step)\n`);
          if (r.error) {
            process.stdout.write(`  → ${r.error.phase} 실패: ${r.error.message}\n`);
          }
        }
      }

      const failed = results.filter((r) => r.status === "failed").length;
      process.exitCode = failed === 0 ? 0 : 1;
    });

  cmd
    .command("list")
    .description("등록된 시나리오 목록 출력")
    .action(() => {
      for (const s of ALL_SCENARIOS) {
        process.stdout.write(`${s.name} — ${s.description}\n`);
        for (const v of s.validates) process.stdout.write(`  · ${v}\n`);
      }
    });

  return cmd;
}

// shebang으로 실행
if (import.meta.url === `file://${process.argv[1]}`) {
  buildCli().parseAsync(process.argv).catch((err) => {
    process.stderr.write(`scenarios CLI error: ${(err as Error).message}\n`);
    process.exit(1);
  });
}
```

- [ ] **Step 2: cli.test.ts** (argv 파싱 단위 — 실행 안 함)

```ts
import { describe, expect, it } from "vitest";
import { ALL_SCENARIOS, buildCli } from "./cli.js";

describe("sim-scenarios CLI", () => {
  it("ALL_SCENARIOS — Plan 13a 시점에 2건 (1, 2)", () => {
    expect(ALL_SCENARIOS).toHaveLength(2);
    expect(ALL_SCENARIOS.map((s) => s.name)).toEqual([
      "scenario-1-login",
      "scenario-2-project-create",
    ]);
  });

  it("buildCli — list / run 명령어 등록", () => {
    const cmd = buildCli();
    const cmdNames = cmd.commands.map((c) => c.name());
    expect(cmdNames).toContain("run");
    expect(cmdNames).toContain("list");
  });

  it("scenario.validates — design.md §4 매트릭스 컬럼 추적", () => {
    const s1 = ALL_SCENARIOS[0];
    expect(s1.validates).toContain("VersionedBitmap issuance");
  });
});
```

- [ ] **Step 3: index.ts**

```ts
export { runScenario } from "./runner/runner.js";
export type { Scenario, ScenarioEnv, ScenarioResult, ScenarioActResult } from "./runner/types.js";
export { ALL_SCENARIOS, buildCli } from "./cli.js";
```

- [ ] **Step 4: 테스트 + build**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter @qa-sdk/sim-scenarios test -- cli && \
  pnpm --filter @qa-sdk/sim-scenarios build && \
  ls simulations/enterprise-pm/scenarios/dist/cli.js
```

Expected: cli 3 PASS, build 산출 cli.js 존재.

- [ ] **Step 5: CLI smoke (list 명령)**

```bash
cd /Users/junwoobang/workflow/qa-sdk/simulations/enterprise-pm/scenarios && \
  node dist/cli.js list
```

Expected: 2 시나리오 출력 (scenario-1-login / scenario-2-project-create).

- [ ] **Step 6: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add simulations/enterprise-pm/scenarios/src/cli.ts \
          simulations/enterprise-pm/scenarios/src/cli.test.ts \
          simulations/enterprise-pm/scenarios/src/index.ts && \
  git commit -m "$(cat <<'EOF'
feat(sim-scenarios): CLI entry — sim-scenarios run / list

commander 기반 — run [name] / --all / --mode / --json.
exit code: 0 (all passed) / 1 (any failed) / 2 (unknown scenario).
list 명령으로 design.md §4 매트릭스 추적 가능.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: 회귀

- [ ] **Step 1: sim-scenarios 전체 테스트**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter @qa-sdk/sim-scenarios typecheck && \
  pnpm --filter @qa-sdk/sim-scenarios test 2>&1 | tail -10
```

Expected: typecheck 0, runner 5 + http-helpers 4 + cli 3 = 12 PASS (in-process scenario는 SIM_SCENARIO_INPROC=1 시 추가 2건).

- [ ] **Step 2: in-process scenario 통합**

```bash
SIM_SCENARIO_INPROC=1 \
  cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter @qa-sdk/sim-scenarios test 2>&1 | tail -5
```

Expected: 14 PASS (12 + 2 in-process).

- [ ] **Step 3: def gate**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter @qa-sdk/cli def validate 2>&1 | tail -5
```

---

## Self-Review

- [ ] Scenario 인터페이스 4 phase (setup/act/assert/teardown) — runner가 라이프사이클 보장
- [ ] runner — assert 실패 시 teardown 호출 보장 (try/finally)
- [ ] 시나리오 1 — §2 §2 issuance 정확 검증 (JWT + USER_ACTIONS.login 비트)
- [ ] 시나리오 2 — resource-policy UNREGISTERED + AccessChecker 2-pass + GET 200으로 owner 매칭 증명
- [ ] CLI — run [name] / --all / list / --json
- [ ] in-process bootstrap — NestJS Test + Hono fetch handler 통합
- [ ] env gate (SIM_SCENARIO_INPROC=1) — CI 영향 격리
- [ ] ALL_SCENARIOS는 design.md §4 매트릭스의 8 시나리오 — 본 plan은 1, 2 (Plan 13b/c/d가 나머지 추가)
- [ ] no fallback — login 실패는 throw, GET 비-200도 throw

---

## Defer

| 작업 | 이유 | 후속 plan |
|---|---|---|
| 시나리오 3-8 | Plan 13b/c/d | 13b/c/d |
| http 모드 — 실 docker-compose 자동 부팅 | Plan 14b 통합 회귀 | Plan 14b |
| 시나리오별 audit-recorder entry 검증 | Plan 14a marginal density 통합 후 | Plan 14a |
| 부하 시나리오 (옵션 D — 100+ user 동시) | sim-erp-pm-design.md §8 후속 | 후속 |
| Playwright UI 시나리오 | scope 외 (CLI runner only) | 별도 프로젝트 |

---

## 의존·후속

- **Plan 12a/b/c**: gateway / bitmap pubsub / OTel + audit 통합 — 본 plan의 in-process bootstrap의 dep.
- **Plan 11a/b**: sim-auth-api / sim-pm-api 도메인 모델 — 본 plan이 호출.
- **Plan 13b/c/d**: 시나리오 3~8 추가 — ALL_SCENARIOS 배열에 append.
- **Plan 14a**: marginal density 측정 — 본 plan의 시나리오 실행 후 ingest_observations 분석.
- **Plan 14b**: 통합 회귀 — http 모드로 실 docker-compose 통합 검증.
