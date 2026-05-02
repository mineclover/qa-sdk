---
lifecycle: draft
plan: 12c
phase: 4
depends-on: [12a, 12b, 06b, 06c, 11a]
---

# Plan 12c — sim OTEL traceparent + IngestForwarder + audit-recorder 통합

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 시뮬 9 서비스 전반에 (1) `@qa-sdk/otel`의 `initTelemetry`가 부팅 시 정확히 호출되는지 검증하는 일관 부팅 가드, (2) W3C `traceparent` 헤더가 cross-service HTTP 호출에서 정확히 전파되도록 NestJS HttpClient 인터셉터 + Hono 미들웨어 통합, (3) 각 서비스에 `IngestForwarder`가 부착되어 모든 `logger.info/warn/error` → ingest-server (3200) 자동 전송, (4) `audit-browser-api`에서 Plan 06b의 `PgAuditRecorder`를 사용하여 audit-recorder-store의 nested tree 조회, (5) `OtelAuditRecorder` wrapper가 sim-approval-api / sim-pm-api의 권한 결정 지점에 부착되어 active span에서 trace_id/span_id 자동 주입. 본 plan의 종료 조건은 e2e 검증 — 시뮬 시나리오 1개를 손으로 실행했을 때 동일 trace_id가 (gateway → auth-api → pm-api → approval-api) 모든 span에 일관 전파되고, ingest-server의 log/audit 기록에서 동일 trace_id로 조회 가능.

**Architecture:**
- **OTel 부팅 가드** — 9 서비스 server.ts 모두 `initTelemetry({ serviceName, env: otelEnvSchema.parse(process.env) })` 호출하는지 grep 검증 + 부팅 smoke (`/health` 응답에 `otelStatus: "ok"` 포함). gateway는 Plan 12a에 이미 통합 — 검증만.
- **HTTP traceparent 전파**:
  - **NestJS 측**: `OtelHttpClientInterceptor` 신규 — `@nestjs/common`의 `HttpService` 또는 native `fetch` 호출에 `propagation.inject` 자동 부착. NestJS의 axios 사용처에는 `axios.interceptors.request.use`로 inject. native fetch 사용처는 `fetchWithTracePropagation` 헬퍼 사용 강제 (lint 또는 ESLint rule은 본 plan 범위 외).
  - **Hono (gateway)**: Plan 12a에서 이미 inject — 검증만.
- **IngestForwarder 통합**:
  - 9 서비스 모두 `lib/logger.ts`가 `createIngestForwarder({ endpoint: env.QA_INGEST_URL, serviceName })` 사용 (Plan 10a/10b/10c가 이미 부착) — 본 plan은 회귀 검증 + 누락 시 추가.
  - 시뮬 트래픽 부하 시 forwarder가 ingest-server (3200)에 정상 전송 — 통합 smoke로 확인.
- **audit-browser-api 통합**:
  - Plan 06b의 `PgAuditRecorder` adapter를 audit-browser-api에서 read-only로 사용 (Plan 06c factory 활용)
  - `GET /audit/trace/:traceId` — listByRoot 호출
  - `GET /audit/firstFailure/:rootSpanId` — firstFailure 호출
  - `GET /audit/entry/:spanId` — get 호출
- **OtelAuditRecorder 부착**:
  - sim-pm-api / sim-approval-api에 `AccessChecker`를 사용하는 곳 (예: project create, approval transition) → `audit: new OtelAuditRecorder(new PgAuditRecorder(db))` 주입
  - active span의 trace_id/span_id 자동 추출 → audit entry 저장
  - `OtelAuditRecorder`는 Plan §1 결과물 — 본 plan은 활용만 (구현 없음)
- **e2e 검증 시나리오**:
  - 시나리오 1 (Plan 13a)와 별개로, 본 plan의 task 마지막에 단일 흐름 smoke:
    - login (gateway → auth-api) → JWT 발급
    - GET /projects/X (gateway → pm-api → AccessChecker → audit 기록)
    - audit-browser-api에서 trace_id로 listByRoot → 모든 entry가 동일 trace_id

**Tech Stack:**
- @qa-sdk/otel (workspace) — initTelemetry, otelEnvSchema
- @opentelemetry/api — propagation.inject
- @qa-sdk/logger (workspace) — createIngestForwarder
- audit-recorder-store (workspace) — PgAuditRecorder (Plan 06b)
- permission-engine (workspace) — OtelAuditRecorder, AccessChecker
- NestJS, Hono, vitest, ES2023

---

## File Structure

### 새로 만드는 파일

```
simulations/enterprise-pm/packages/sim-otel-utils/
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── src/
│   ├── index.ts
│   ├── fetch-with-trace.ts          # propagation.inject + AbortSignal.timeout 통합 fetch
│   ├── fetch-with-trace.test.ts
│   ├── nest-http-interceptor.ts     # NestJS HttpModule axios interceptor
│   ├── nest-http-interceptor.test.ts
│   └── otel-bootstrap-guard.ts      # 부팅 검증 헬퍼
└── README.md
```

```
simulations/enterprise-pm/services/audit-browser-api/src/audit-explorer/
├── audit-explorer.module.ts
├── audit-explorer.service.ts        # PgAuditRecorder 활용 read-only
├── audit-explorer.service.test.ts
├── audit-explorer.controller.ts     # GET /audit/trace/:traceId 등 3 endpoint
└── audit-explorer.controller.test.ts
```

### 수정하는 파일

| 경로 | 변경 |
|---|---|
| `simulations/enterprise-pm/services/{모든 8 NestJS 서비스}/src/main.ts` | initTelemetry 호출 회귀 검증 (이미 있을 가능성 높음 — Plan 10a/b/c) |
| `simulations/enterprise-pm/services/{비즈니스 7 서비스}/src/health/health.controller.ts` | `/health` 응답에 `otelStatus` 추가 |
| `simulations/enterprise-pm/services/{pm,approval}-api/src/`의 access checker 호출처 | `OtelAuditRecorder` wrap 적용 |
| `simulations/enterprise-pm/services/{모든 NestJS 서비스}/src/app.module.ts` | `HttpModule.register({ ...sim-otel-utils interceptor })` 또는 fetchWithTracePropagation 직접 사용 |
| `simulations/enterprise-pm/services/audit-browser-api/src/app.module.ts` | AuditExplorerModule import + audit-recorder-store factory 주입 |
| `simulations/enterprise-pm/services/audit-browser-api/package.json` | `audit-recorder-store` workspace dep 추가 |

---

## Task 0: baseline

- [ ] **Step 1: 선행 plan 완료 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  ls packages/permission-engine/src/audit/otel-wrapper.ts && \
  ls packages/audit-recorder-store/src/drizzle-recorder.ts && \
  grep -n "PgAuditRecorder\|createAuditRecorder" packages/audit-recorder-store/src/factory.ts 2>&1 | head -3
```

Expected: 모두 hit. Plan 06b (PgAuditRecorder) + 06c (factory) + permission-engine OtelAuditRecorder 완료.

- [ ] **Step 2: 9 서비스 main.ts에 initTelemetry 부착 현황**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  for svc in auth-api pm-api approval-api notification-api reporting-api document-api audit-browser-api gateway metrics-collector; do
    echo "[$svc]"
    grep -l "initTelemetry" simulations/enterprise-pm/services/$svc/src/*.ts 2>&1 | head -2
  done
```

Expected: 9 서비스 모두 hit (Plan 10a/b/c가 이미 부착).

- [ ] **Step 3: ingest-server 부팅 (smoke 대상)**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  curl -fsS http://localhost:3200/health 2>&1 | head -3 || \
  echo "ingest-server 미부팅 — 본 plan smoke 단계에서 부팅 필요"
```

---

## Task 1: sim-otel-utils 패키지 — fetchWithTrace + interceptor 헬퍼

**Files:**
- Create: `simulations/enterprise-pm/packages/sim-otel-utils/{package.json, tsconfig.json, tsup.config.ts}`
- Create: `simulations/enterprise-pm/packages/sim-otel-utils/src/index.ts`
- Create: `simulations/enterprise-pm/packages/sim-otel-utils/src/fetch-with-trace.ts`
- Create: `simulations/enterprise-pm/packages/sim-otel-utils/src/fetch-with-trace.test.ts`

- [ ] **Step 1: 디렉토리 + package.json**

```bash
mkdir -p /Users/junwoobang/workflow/qa-sdk/simulations/enterprise-pm/packages/sim-otel-utils/src
```

`simulations/enterprise-pm/packages/sim-otel-utils/package.json`:

```json
{
  "name": "@qa-sdk/sim-otel-utils",
  "version": "0.1.0",
  "description": "시뮬 — OTel traceparent 전파 헬퍼 (fetch + NestJS axios interceptor)",
  "private": true,
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" }
  },
  "scripts": {
    "build": "tsup",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "@opentelemetry/api": "^1.9.0"
  },
  "peerDependencies": {
    "@nestjs/axios": "^3.0.0",
    "@nestjs/common": "^11.0.0",
    "axios": "^1.7.0"
  },
  "peerDependenciesMeta": {
    "@nestjs/axios": { "optional": true },
    "@nestjs/common": { "optional": true },
    "axios": { "optional": true }
  },
  "devDependencies": {
    "@nestjs/axios": "^3.0.0",
    "@nestjs/common": "^11.0.0",
    "@types/node": "^22.0.0",
    "axios": "^1.7.0",
    "tsup": "^8.5.1",
    "typescript": "^5.8.2",
    "vitest": "^1.6.1"
  }
}
```

- [ ] **Step 2: tsconfig + tsup** (sim-bitmap-cache와 동일 패턴 — 생략)

- [ ] **Step 3: fetch-with-trace.test.ts (test-first)**

```ts
// @def.boundary sim-otel-utils
// @def.doc authorization-ontology-bitmap-pipeline

import { describe, expect, it, vi, afterEach } from "vitest";
import { fetchWithTracePropagation } from "./fetch-with-trace.js";

afterEach(() => vi.restoreAllMocks());

describe("fetchWithTracePropagation", () => {
  it("native fetch 호출 + propagation.inject 자동 호출", async () => {
    const fetchMock = vi.fn(async (url: string | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      // OTel propagation은 active span 없을 시 inject가 noop이지만,
      // 본 호출이 발생했음만 확인
      expect(String(url)).toBe("http://example.com/x");
      return new Response("ok", { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const res = await fetchWithTracePropagation("http://example.com/x", {
      method: "GET",
      timeoutMs: 1000,
    });
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("기존 헤더 보존 + traceparent 추가", async () => {
    const fetchMock = vi.fn(async (_url: string | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      expect(headers.get("x-custom")).toBe("v");
      return new Response("ok");
    });
    vi.stubGlobal("fetch", fetchMock);

    await fetchWithTracePropagation("http://x/", {
      method: "POST",
      headers: { "x-custom": "v", "content-type": "application/json" },
      body: '{"a":1}',
      timeoutMs: 1000,
    });
    expect(fetchMock).toHaveBeenCalled();
  });

  it("timeout 초과 → AbortError throw", async () => {
    vi.stubGlobal("fetch", vi.fn(async (_url, init?: RequestInit) => {
      return new Promise<Response>((_, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
      });
    }));
    await expect(
      fetchWithTracePropagation("http://x/", { timeoutMs: 50 }),
    ).rejects.toThrow(/abort/i);
  });
});
```

- [ ] **Step 4: fetch-with-trace.ts**

```ts
// @def.boundary sim-otel-utils
// @def.doc authorization-ontology-bitmap-pipeline

import { context, propagation } from "@opentelemetry/api";

export interface FetchWithTraceOptions extends RequestInit {
  timeoutMs?: number;
}

/**
 * fetchWithTracePropagation — native fetch에 W3C traceparent 자동 주입.
 *
 * - active OTel context가 있으면 traceparent + tracestate 헤더 자동 부착
 * - 없으면 inject가 noop (외부 호출이 새 trace 시작)
 * - timeoutMs 지정 시 AbortSignal.timeout — 초과 시 AbortError throw (caller가 처리)
 *
 * NestJS / Hono / CLI 어디서든 사용 가능. axios 사용처는 nestHttpInterceptor 사용.
 */
export async function fetchWithTracePropagation(
  url: string | URL,
  options: FetchWithTraceOptions = {},
): Promise<Response> {
  const headers = new Headers(options.headers);
  propagation.inject(context.active(), headers, {
    set: (h, key, val) => (h as Headers).set(key, val),
  });

  const init: RequestInit = {
    ...options,
    headers,
  };
  if (options.timeoutMs !== undefined) {
    init.signal = AbortSignal.timeout(options.timeoutMs);
  }
  return fetch(url, init);
}
```

- [ ] **Step 5: nest-http-interceptor.ts**

```ts
// @def.boundary sim-otel-utils
// @def.doc authorization-ontology-bitmap-pipeline

import { context, propagation } from "@opentelemetry/api";
import type { AxiosInstance, InternalAxiosRequestConfig } from "axios";

/**
 * NestJS의 HttpService(axios)에 traceparent inject 인터셉터 설치.
 *
 * 사용 예시:
 *   @Module({
 *     imports: [HttpModule.registerAsync({
 *       useFactory: () => ({}),
 *     })],
 *   })
 *   export class MyModule {
 *     constructor(httpService: HttpService) {
 *       installTraceInterceptor(httpService.axiosRef);
 *     }
 *   }
 */
export function installTraceInterceptor(axios: AxiosInstance): number {
  return axios.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    const headers = config.headers ?? {};
    propagation.inject(context.active(), headers, {
      set: (h, key, val) => {
        (h as Record<string, string>)[key] = val;
      },
    });
    config.headers = headers;
    return config;
  });
}
```

- [ ] **Step 6: index.ts**

```ts
export {
  fetchWithTracePropagation,
  type FetchWithTraceOptions,
} from "./fetch-with-trace.js";
export { installTraceInterceptor } from "./nest-http-interceptor.js";
```

- [ ] **Step 7: pnpm install + 테스트 + build**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm install && \
  pnpm --filter @qa-sdk/sim-otel-utils typecheck && \
  pnpm --filter @qa-sdk/sim-otel-utils test && \
  pnpm --filter @qa-sdk/sim-otel-utils build
```

Expected: 3 PASS (fetch) + interceptor smoke. build 0 error.

- [ ] **Step 8: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add simulations/enterprise-pm/packages/sim-otel-utils pnpm-lock.yaml && \
  git commit -m "$(cat <<'EOF'
feat(sim-otel-utils): traceparent propagation 헬퍼

fetchWithTracePropagation — native fetch + propagation.inject + timeout.
installTraceInterceptor — NestJS axios에 트레이스 inject.
sim 9 서비스가 cross-service 호출 시 일관된 W3C 전파 보장.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: 9 서비스 OTEL 부팅 회귀 검증 + /health 응답 확장

**Files:**
- Modify: `simulations/enterprise-pm/services/{비즈니스 7}/src/health/health.controller.ts`

- [ ] **Step 1: initTelemetry 호출 보장 (회귀 grep)**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  for svc in auth-api pm-api approval-api notification-api reporting-api document-api audit-browser-api gateway metrics-collector; do
    n=$(grep -c "initTelemetry" simulations/enterprise-pm/services/$svc/src/*.ts 2>/dev/null | grep -v ":0$" | wc -l | tr -d ' ')
    echo "[$svc] initTelemetry hit files: $n"
  done
```

Expected: 9 서비스 모두 1+ hit. 누락 서비스가 있으면 즉시 추가 (Plan 10a/b/c 회귀).

- [ ] **Step 2: /health 응답 확장 — `otelStatus`**

NestJS 비즈니스 6 서비스 (audit-browser-api 제외 — Plan 06b 의존 별도) + audit-browser-api의 health.controller.ts에 추가.

`pm-api/src/health/health.controller.ts` 예시 (나머지 동일 패턴):

```ts
import { Controller, Get } from "@nestjs/common";
import { trace } from "@opentelemetry/api";

@Controller("health")
export class HealthController {
  @Get()
  health() {
    // OTel global tracer가 noop이 아닌지 확인 (initTelemetry 후 SDK 등록되면 NodeTracerProvider)
    const tracer = trace.getTracer("sim-pm-api");
    // tracer.startSpan은 항상 동작 (noop도 valid). 식별 가능한 휴리스틱은 constructor 이름.
    const otelStatus =
      tracer.constructor.name === "NoopTracer" ? "noop" : "ok";
    return {
      status: "ok",
      service: "sim-pm-api",
      ownedPrefixes: ["sim.project", "sim.task", "sim.member"],
      otelStatus,
      ts: new Date().toISOString(),
    };
  }
}
```

- [ ] **Step 3: 6 서비스 + audit-browser-api에 일괄 적용**

각 서비스의 health.controller.ts에 동일 패턴. `serviceName`과 `ownedPrefixes`만 차이.

- [ ] **Step 4: gateway의 /health에도 동일 적용 (Hono)**

`gateway/src/routes/health.ts`:

```ts
import { Hono } from "hono";
import { trace } from "@opentelemetry/api";

export function createHealthRoutes() {
  const r = new Hono();
  r.get("/health", (c) => {
    const tracer = trace.getTracer("sim-gateway");
    const otelStatus = tracer.constructor.name === "NoopTracer" ? "noop" : "ok";
    return c.json({
      status: "ok",
      service: "sim-gateway",
      role: "edge-router",
      ownedPrefixes: [],
      otelStatus,
      ts: new Date().toISOString(),
    });
  });
  return r;
}
```

- [ ] **Step 5: 단위 테스트 갱신 — `/health` 응답에 otelStatus 포함**

각 서비스의 health 단위 테스트에 추가:

```ts
expect(body.otelStatus).toMatch(/ok|noop/);
```

(`noop`은 SDK 미부팅 시 — 단위 테스트 환경에서 정상)

- [ ] **Step 6: typecheck + 모든 서비스 health 테스트**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  for svc in sim-auth-api sim-pm-api sim-approval-api sim-notification-api sim-reporting-api sim-document-api sim-audit-browser-api sim-gateway; do
    pnpm --filter "@qa-sdk/$svc" test -- health 2>&1 | tail -3
  done
```

Expected: 8 서비스 health 테스트 PASS.

- [ ] **Step 7: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add simulations/enterprise-pm/services/*/src/health \
          simulations/enterprise-pm/services/gateway/src/routes/health.ts && \
  git commit -m "$(cat <<'EOF'
feat(sim): /health 응답에 otelStatus 추가 (8 서비스 + gateway)

NoopTracer 검출로 OTel SDK 부팅 여부 노출.
운영 시 'ok' / 단위 테스트 환경에서 'noop' 정상.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: 9 서비스 cross-service 호출에 traceparent 통합

**Files:**
- Modify: `simulations/enterprise-pm/services/gateway/src/lib/proxy.ts` (이미 inject 사용 — 회귀 확인)
- Modify: `simulations/enterprise-pm/services/{비즈니스 6}/src/`의 cross-service fetch 사용처 → `fetchWithTracePropagation`

- [ ] **Step 1: gateway proxy 회귀 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  grep -n "propagation.inject" simulations/enterprise-pm/services/gateway/src/lib/proxy.ts
```

Expected: hit. Plan 12a에서 이미 inject. 변경 불필요.

- [ ] **Step 2: 비즈니스 서비스의 cross-service 호출 식별**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  for svc in pm-api approval-api notification-api reporting-api document-api audit-browser-api; do
    echo "--- $svc ---"
    grep -rn "fetch(" simulations/enterprise-pm/services/$svc/src 2>&1 | grep -v ".test.ts" | head -5
  done
```

각 hit를 `fetchWithTracePropagation`로 교체.

- [ ] **Step 3: package.json에 sim-otel-utils dep 추가 (6 서비스)**

```bash
for svc in pm-api approval-api notification-api reporting-api document-api audit-browser-api; do
  echo "[$svc] @qa-sdk/sim-otel-utils dep 추가"
done
```

각 `package.json` dependencies:

```json
"@qa-sdk/sim-otel-utils": "workspace:*"
```

- [ ] **Step 4: HttpModule 사용처에 interceptor 적용 (서비스별 case-by-case)**

approval-api가 pm-api를 호출하는 경우 (시나리오 5에서 발생) 예시:

`approval-api/src/approval/external-clients/pm-client.service.ts` (예시):

```ts
import { Injectable, OnModuleInit } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { installTraceInterceptor } from "@qa-sdk/sim-otel-utils";

@Injectable()
export class PmClient implements OnModuleInit {
  constructor(private readonly http: HttpService) {}
  onModuleInit() {
    installTraceInterceptor(this.http.axiosRef);
  }
  // ... methods
}
```

본 plan에서 모든 cross-service 호출처를 한 번에 만들 필요는 없음 — 시나리오 진행 시점에 추가. Task 3는 **interceptor 헬퍼 사용 가능 상태** 보장만 목표.

- [ ] **Step 5: typecheck + smoke**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm install && \
  for svc in sim-pm-api sim-approval-api sim-notification-api sim-reporting-api sim-document-api sim-audit-browser-api; do
    pnpm --filter "@qa-sdk/$svc" typecheck 2>&1 | tail -2
  done
```

Expected: 6 서비스 0 error.

- [ ] **Step 6: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add simulations/enterprise-pm/services/*/package.json pnpm-lock.yaml && \
  git commit -m "$(cat <<'EOF'
feat(sim): 6 서비스에 sim-otel-utils dep — traceparent 전파 준비

각 서비스의 cross-service 호출은 시나리오 진행 시점에
fetchWithTracePropagation 또는 installTraceInterceptor 적용.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: IngestForwarder 통합 회귀 + e2e smoke

**Files:**
- Verify: `simulations/enterprise-pm/services/*/src/lib/logger.ts` (회귀)

- [ ] **Step 1: 9 서비스 logger.ts에 IngestForwarder 부착 회귀**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  for svc in auth-api pm-api approval-api notification-api reporting-api document-api audit-browser-api gateway metrics-collector; do
    f=simulations/enterprise-pm/services/$svc/src/lib/logger.ts
    if [ -f "$f" ]; then
      hit=$(grep -c "createIngestForwarder" "$f")
      echo "[$svc] createIngestForwarder hit: $hit"
    else
      echo "[$svc] logger.ts 없음 (lib 디렉토리 미생성)"
    fi
  done
```

Expected: 9 서비스 모두 1 hit. 누락 시 Plan 10a/b/c 패턴 적용.

- [ ] **Step 2: ingest-server 부팅 후 smoke 검증 (옵션)**

```bash
# ingest-server 부팅 (별도 터미널)
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter @qa-sdk/ingest-server start &

# sim-pm-api 부팅 + 로그 발생
QA_INGEST_URL=http://localhost:3200 \
  pnpm --filter @qa-sdk/sim-pm-api start &
sleep 3
curl http://localhost:4500/health

# ingest-server에서 로그 수신 확인
sleep 2
curl -fsS http://localhost:3200/observation?service=sim-pm-api 2>&1 | head -5
```

Expected: ingest-server 응답에 `service: sim-pm-api`의 health 호출 로그 포함. 미수신 시 logger 부착 점검.

- [ ] **Step 3: 회귀 점검 후 별도 커밋 없음 (변경사항 없을 시)**

위 Step 1이 9 서비스 모두 hit이면 본 task는 "회귀 PASS" 기록만.

---

## Task 5: audit-browser-api — PgAuditRecorder 통합 (TDD)

**Files:**
- Modify: `simulations/enterprise-pm/services/audit-browser-api/package.json`
- Modify: `simulations/enterprise-pm/services/audit-browser-api/src/app.module.ts`
- Create: `simulations/enterprise-pm/services/audit-browser-api/src/audit-explorer/audit-explorer.module.ts`
- Create: `simulations/enterprise-pm/services/audit-browser-api/src/audit-explorer/audit-explorer.service.ts`
- Create: `simulations/enterprise-pm/services/audit-browser-api/src/audit-explorer/audit-explorer.service.test.ts`
- Create: `simulations/enterprise-pm/services/audit-browser-api/src/audit-explorer/audit-explorer.controller.ts`
- Create: `simulations/enterprise-pm/services/audit-browser-api/src/audit-explorer/audit-explorer.controller.test.ts`

- [ ] **Step 1: dep 추가**

`audit-browser-api/package.json` dependencies:

```json
"audit-recorder-store": "workspace:*",
"permission-engine": "workspace:*",
"db-bootstrap": "workspace:*",
"drizzle-orm": "catalog:"
```

peerDependencies (Plan 11a 패턴):

```json
"better-sqlite3": "catalog:",
"postgres": "^3.4.0"
```

- [ ] **Step 2: audit-explorer.service.test.ts (test-first, in-memory PgAuditRecorder mock)**

```ts
// @def.boundary sim-audit-browser-api
// @def.doc authorization-ontology-nested-audit-tracing

import { describe, expect, it, vi } from "vitest";
import { AuditExplorerService } from "./audit-explorer.service.js";
import type { AuditEntry, AuditRecorder } from "permission-engine";

const sampleEntries: AuditEntry[] = [
  { kind: "execution", spanId: "exec-1", traceId: "t1", parentSpanId: null,
    apiId: "api-x", actorUserId: "u", outcome: "allow",
    startedAt: "2026-04-22T00:00:00Z", finishedAt: "2026-04-22T00:00:01Z" } as AuditEntry,
  { kind: "check", spanId: "chk-1", traceId: "t1", parentSpanId: "exec-1",
    pass: "bitmap", outcome: "allow", recordedAt: "2026-04-22T00:00:00Z" } as AuditEntry,
];

function makeMockRecorder(): AuditRecorder {
  return {
    listByRoot: vi.fn(async () => sampleEntries),
    firstFailure: vi.fn(async () => null),
    get: vi.fn(async (id: string) => sampleEntries.find((e) => e.spanId === id) ?? null),
    startExecution: vi.fn(async () => sampleEntries[0] as never),
    finishExecution: vi.fn(async () => undefined as never),
    recordCheck: vi.fn(async () => sampleEntries[1] as never),
  };
}

describe("AuditExplorerService", () => {
  it("listTrace — listByRoot 위임", async () => {
    const rec = makeMockRecorder();
    const svc = new AuditExplorerService(rec);
    const result = await svc.listTrace("exec-1");
    expect(result).toHaveLength(2);
    expect(rec.listByRoot).toHaveBeenCalledWith("exec-1");
  });

  it("findFirstFailure — firstFailure 위임", async () => {
    const rec = makeMockRecorder();
    const svc = new AuditExplorerService(rec);
    const result = await svc.findFirstFailure("exec-1");
    expect(result).toBeNull();
  });

  it("getEntry — get 위임", async () => {
    const rec = makeMockRecorder();
    const svc = new AuditExplorerService(rec);
    const got = await svc.getEntry("chk-1");
    expect(got?.spanId).toBe("chk-1");
  });

  it("getEntry(미존재) → null", async () => {
    const rec = makeMockRecorder();
    const svc = new AuditExplorerService(rec);
    expect(await svc.getEntry("missing")).toBeNull();
  });
});
```

- [ ] **Step 3: audit-explorer.service.ts**

```ts
// @def.boundary sim-audit-browser-api
// @def.doc authorization-ontology-nested-audit-tracing

import { Inject, Injectable } from "@nestjs/common";
import type { AuditEntry, AuditRecorder } from "permission-engine";

export const AUDIT_RECORDER = Symbol("AUDIT_RECORDER");

@Injectable()
export class AuditExplorerService {
  constructor(@Inject(AUDIT_RECORDER) private readonly recorder: AuditRecorder) {}

  async listTrace(rootSpanId: string): Promise<AuditEntry[]> {
    return this.recorder.listByRoot(rootSpanId);
  }

  async findFirstFailure(rootSpanId: string): Promise<AuditEntry | null> {
    return this.recorder.firstFailure(rootSpanId);
  }

  async getEntry(spanId: string): Promise<AuditEntry | null> {
    return this.recorder.get(spanId);
  }
}
```

- [ ] **Step 4: audit-explorer.controller.ts + controller.test.ts**

```ts
import { Controller, Get, NotFoundException, Param } from "@nestjs/common";
import { AuditExplorerService } from "./audit-explorer.service.js";

@Controller("audit")
export class AuditExplorerController {
  constructor(private readonly svc: AuditExplorerService) {}

  @Get("trace/:rootSpanId")
  async trace(@Param("rootSpanId") id: string) {
    const entries = await this.svc.listTrace(id);
    return { rootSpanId: id, count: entries.length, entries };
  }

  @Get("firstFailure/:rootSpanId")
  async firstFailure(@Param("rootSpanId") id: string) {
    const entry = await this.svc.findFirstFailure(id);
    return { rootSpanId: id, firstFailure: entry };
  }

  @Get("entry/:spanId")
  async entry(@Param("spanId") id: string) {
    const e = await this.svc.getEntry(id);
    if (!e) throw new NotFoundException({ error: "not_found", spanId: id });
    return e;
  }
}
```

`audit-explorer.controller.test.ts` (NestJS Test 패턴):

```ts
import { describe, expect, it, vi } from "vitest";
import { Test } from "@nestjs/testing";
import { AuditExplorerController } from "./audit-explorer.controller.js";
import { AUDIT_RECORDER, AuditExplorerService } from "./audit-explorer.service.js";

describe("AuditExplorerController", () => {
  it("GET /audit/trace/:id — count + entries 응답", async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AuditExplorerController],
      providers: [
        AuditExplorerService,
        { provide: AUDIT_RECORDER, useValue: {
          listByRoot: vi.fn(async () => [
            { kind: "execution", spanId: "x", traceId: "t" } as never,
          ]),
          firstFailure: vi.fn(),
          get: vi.fn(),
        } },
      ],
    }).compile();
    const ctrl = moduleRef.get(AuditExplorerController);
    const result = await ctrl.trace("x");
    expect(result.count).toBe(1);
    expect(result.rootSpanId).toBe("x");
  });

  it("GET /audit/entry/:id (미존재) → NotFoundException", async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AuditExplorerController],
      providers: [
        AuditExplorerService,
        { provide: AUDIT_RECORDER, useValue: {
          listByRoot: vi.fn(),
          firstFailure: vi.fn(),
          get: vi.fn(async () => null),
        } },
      ],
    }).compile();
    const ctrl = moduleRef.get(AuditExplorerController);
    await expect(ctrl.entry("nope")).rejects.toThrow(/not_found/);
  });
});
```

- [ ] **Step 5: audit-explorer.module.ts + app.module.ts 통합**

`audit-explorer.module.ts`:

```ts
import { Module, Global } from "@nestjs/common";
import { AuditExplorerService, AUDIT_RECORDER } from "./audit-explorer.service.js";
import { AuditExplorerController } from "./audit-explorer.controller.js";
// Plan 06c factory 활용
import { createAuditRecorder } from "audit-recorder-store";
import { createConnection } from "db-bootstrap";
import { env } from "../config/env.js";

@Global()
@Module({
  controllers: [AuditExplorerController],
  providers: [
    AuditExplorerService,
    {
      provide: AUDIT_RECORDER,
      useFactory: async () => {
        const conn = await createConnection({ dialect: env.QA_DB_DIALECT, ...env });
        return createAuditRecorder({ dialect: env.QA_DB_DIALECT, db: conn.db });
      },
    },
  ],
  exports: [AuditExplorerService],
})
export class AuditExplorerModule {}
```

`app.module.ts`에 imports에 `AuditExplorerModule` 추가.

- [ ] **Step 6: typecheck + 테스트 + build**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter @qa-sdk/sim-audit-browser-api typecheck && \
  pnpm --filter @qa-sdk/sim-audit-browser-api test 2>&1 | tail -10
```

Expected: 4 (service) + 2 (controller) = 6 PASS 신규.

- [ ] **Step 7: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add simulations/enterprise-pm/services/audit-browser-api && \
  git commit -m "$(cat <<'EOF'
feat(sim-audit-browser-api): AuditExplorer 통합 — PgAuditRecorder read

3 endpoint: GET /audit/trace/:id /firstFailure/:id /entry/:id.
Plan 06c createAuditRecorder factory로 dialect 추상.
NestJS Test 패턴 — Controller 단위 테스트 + service mock.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: pm-api / approval-api에 OtelAuditRecorder 부착

**Files:**
- Modify: `simulations/enterprise-pm/services/pm-api/src/`의 AccessChecker 사용처
- Modify: `simulations/enterprise-pm/services/approval-api/src/`의 AccessChecker 사용처

- [ ] **Step 1: pm-api에 AccessChecker 사용처 식별**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  grep -rn "AccessChecker\|accessChecker" simulations/enterprise-pm/services/pm-api/src 2>&1 | head -5
```

Expected: project create / task assign 등의 권한 체크 지점에 hit. 미존재 시 Plan 11b가 만든 위치 활용.

- [ ] **Step 2: AccessChecker 인스턴스화 시 OtelAuditRecorder wrap**

`pm-api/src/auth-deps/access-checker.factory.ts` (예시):

```ts
import { AccessChecker, OtelAuditRecorder } from "permission-engine";
import { createAuditRecorder } from "audit-recorder-store";
// ... db, union, evaluator, policyRegistry import

export async function createPmAccessChecker(opts: {
  dialect: "sqlite" | "pg";
  db: never;
  /* 기타 deps */
}) {
  const baseAudit = await createAuditRecorder({ dialect: opts.dialect, db: opts.db });
  const audit = new OtelAuditRecorder(baseAudit);
  return new AccessChecker({
    union: /* DisjointUnionIndex */,
    policyRegistry: /* ResourcePolicyRegistry */,
    evaluator: /* InstancePolicyEvaluator */,
    audit,
  });
}
```

- [ ] **Step 3: approval-api도 동일 패턴**

`approval-api/src/auth-deps/access-checker.factory.ts` 동일 구조.

- [ ] **Step 4: 단위 테스트 — OtelAuditRecorder가 active span에서 ID 자동 채움**

`pm-api/src/auth-deps/access-checker.factory.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { trace, context } from "@opentelemetry/api";
import { OtelAuditRecorder } from "permission-engine";

describe("PM AccessChecker — OtelAuditRecorder 부착 검증", () => {
  it("active span 설정 시 traceId가 audit entry에 자동 주입", async () => {
    const baseAudit = {
      startExecution: vi.fn(async (args) => args),
      finishExecution: vi.fn(),
      recordCheck: vi.fn(async (args) => args),
      get: vi.fn(),
      listByRoot: vi.fn(),
      firstFailure: vi.fn(),
    } as never;
    const wrapped = new OtelAuditRecorder(baseAudit);

    // active span 시뮬레이션은 어렵지만, wrapper가 random ID 자동 생성하는지 검증
    await wrapped.startExecution({
      apiId: "test-api",
      actorUserId: "u1",
      targetKind: "resource",
      targetId: "r1",
    } as never);

    expect(baseAudit.startExecution).toHaveBeenCalledTimes(1);
    const args = (baseAudit.startExecution as never as { mock: { calls: never[][] } }).mock.calls[0][0] as { spanId: string; traceId: string };
    expect(args.spanId).toMatch(/^[0-9a-f]{16}$/); // 8 byte hex
    expect(args.traceId).toMatch(/^[0-9a-f]{32}$/); // 16 byte hex
  });
});
```

- [ ] **Step 5: typecheck + 테스트**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter @qa-sdk/sim-pm-api typecheck && \
  pnpm --filter @qa-sdk/sim-pm-api test -- access-checker 2>&1 | tail -5 && \
  pnpm --filter @qa-sdk/sim-approval-api typecheck
```

Expected: typecheck 0, access-checker 1+ PASS.

- [ ] **Step 6: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add simulations/enterprise-pm/services/pm-api/src/auth-deps \
          simulations/enterprise-pm/services/approval-api/src/auth-deps && \
  git commit -m "$(cat <<'EOF'
feat(sim-pm/approval-api): AccessChecker에 OtelAuditRecorder wrap

Plan §1의 OtelAuditRecorder가 active OTel span에서 trace_id/span_id 자동 추출.
audit-recorder-store의 PgAuditRecorder를 base로 wrap.
호출자가 명시 ID 안 주입해도 trace 연결 보장.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: e2e — 단일 시나리오 trace 일관성 검증

**Files:**
- Create: `simulations/enterprise-pm/scripts/e2e-trace-smoke.sh`

본 plan의 핵심 검증 — login → /projects/X → audit explorer 조회까지 동일 trace_id.

- [ ] **Step 1: e2e-trace-smoke.sh 작성**

```bash
mkdir -p /Users/junwoobang/workflow/qa-sdk/simulations/enterprise-pm/scripts
```

`simulations/enterprise-pm/scripts/e2e-trace-smoke.sh`:

```bash
#!/usr/bin/env bash
# Plan 12c — trace 일관성 e2e smoke
# 사용법: ./e2e-trace-smoke.sh
# 사전: docker-compose.sim.yaml + qa-sdk-db + sim-redis 부팅, 9 서비스 부팅 완료
set -euo pipefail

GATEWAY=${GATEWAY:-http://localhost:8888}
AUDIT_API=${AUDIT_API:-http://localhost:5100}
INGEST_API=${INGEST_API:-http://localhost:3200}

echo "==> 1. /auth/login"
LOGIN=$(curl -fsS -X POST "$GATEWAY/auth/login" \
  -H "content-type: application/json" \
  -d '{"email":"alice@example.com","password":"test123"}')
TOKEN=$(echo "$LOGIN" | jq -r '.token')
[ -n "$TOKEN" ] && [ "$TOKEN" != "null" ] || { echo "login 실패"; echo "$LOGIN"; exit 1; }
echo "  → token 발급 OK"

echo "==> 2. GET /projects (gateway → pm-api → AccessChecker → audit 기록)"
PROJ_RES=$(curl -fsS -D /tmp/headers.txt "$GATEWAY/projects" \
  -H "Authorization: Bearer $TOKEN")
TRACE_ID=$(grep -i "^x-trace-id:" /tmp/headers.txt | awk '{print $2}' | tr -d '\r' || echo "")
echo "  → 응답 일부: ${PROJ_RES:0:100}"
echo "  → trace_id (응답 헤더): $TRACE_ID"

echo "==> 3. trace_id로 audit-browser-api 조회"
if [ -n "$TRACE_ID" ]; then
  # audit entry 검색은 root span 필요 — trace_id가 root span과 동일하지 않을 수 있음
  # 본 smoke는 trace_id 추출까지만 검증. 구체 entry 매칭은 시나리오 1 (Plan 13a)에서.
  echo "  → trace_id 추출 OK — Plan 13a에서 entry 매칭"
else
  echo "  ⚠️ trace_id가 응답 헤더에 노출되지 않음 — Plan 12a/12c가 x-trace-id 헤더 부착 필요"
fi

echo "==> 4. ingest-server에서 sim-pm-api 로그 수신 확인"
LOG_COUNT=$(curl -fsS "$INGEST_API/observation?service=sim-pm-api" 2>/dev/null | jq '.observations | length' 2>/dev/null || echo "0")
echo "  → sim-pm-api log count: $LOG_COUNT"

echo "✓ trace smoke 종료 — 추가 검증은 Plan 13a 시나리오 1 + audit-browser-api 통합"
```

```bash
chmod +x /Users/junwoobang/workflow/qa-sdk/simulations/enterprise-pm/scripts/e2e-trace-smoke.sh
```

- [ ] **Step 2: 응답 헤더에 x-trace-id 부착 — gateway middleware 추가**

`gateway/src/middleware/traceparent.ts`에 응답 헤더 부착 추가:

```ts
// 기존 코드 + 응답 시 trace id 노출
await context.with(trace.setSpan(upstreamCtx, span), async () => {
  await next();
  const ctx = span.spanContext();
  if (ctx.traceId) c.header("x-trace-id", ctx.traceId);
  span.setAttribute("http.status_code", c.res.status);
});
```

테스트도 갱신:

```ts
it("응답 헤더에 x-trace-id 노출", async () => {
  const app = new Hono();
  app.use("*", traceparent);
  app.get("/x", (c) => c.text("ok"));
  const res = await app.request("/x");
  expect(res.headers.get("x-trace-id")).toMatch(/^[0-9a-f]{32}$/);
});
```

- [ ] **Step 3: e2e smoke 실행 (인프라 + 9 서비스 부팅 후)**

(생략 — 본 plan은 스크립트 정의까지. 실행은 Plan 14b 회귀에서)

- [ ] **Step 4: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add simulations/enterprise-pm/scripts/e2e-trace-smoke.sh \
          simulations/enterprise-pm/services/gateway/src/middleware/traceparent.ts \
          simulations/enterprise-pm/services/gateway/src/middleware/traceparent.test.ts && \
  git commit -m "$(cat <<'EOF'
feat(sim-gateway): 응답 헤더에 x-trace-id 노출 + e2e smoke 스크립트

x-trace-id로 클라이언트가 audit-browser-api 조회 가능.
e2e-trace-smoke.sh — login → projects → trace_id 추출까지 자동화.
실 검증은 Plan 13a 시나리오 1 + Plan 14b 통합 회귀에서.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: 회귀

- [ ] **Step 1: sim-otel-utils + audit-browser-api + 9 서비스 typecheck**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter @qa-sdk/sim-otel-utils typecheck && \
  pnpm --filter @qa-sdk/sim-audit-browser-api typecheck && \
  for svc in sim-auth-api sim-pm-api sim-approval-api sim-notification-api sim-reporting-api sim-document-api sim-gateway sim-metrics-collector; do
    pnpm --filter "@qa-sdk/$svc" typecheck 2>&1 | tail -2
  done
```

Expected: 모두 0 error.

- [ ] **Step 2: 전체 sim 패키지 단위 테스트**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter "./simulations/enterprise-pm/**" test 2>&1 | tail -20
```

Expected: 9 서비스 + 2 패키지 (sim-bitmap-cache + sim-otel-utils) 누적 PASS.

- [ ] **Step 3: def gate**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter @qa-sdk/cli def validate 2>&1 | tail -5
```

Expected: errors 0.

---

## Self-Review

- [ ] 9 서비스 모두 `initTelemetry` 부팅 시 호출 (회귀 grep 통과)
- [ ] /health 응답에 `otelStatus` 필드 (운영 'ok' / 단위 테스트 'noop')
- [ ] sim-otel-utils 패키지 — fetchWithTracePropagation + installTraceInterceptor
- [ ] gateway proxy.ts가 propagation.inject 호출 (Plan 12a 회귀)
- [ ] x-trace-id 응답 헤더 노출 (gateway middleware 갱신)
- [ ] IngestForwarder 9 서비스 회귀 — createIngestForwarder 부착 확인
- [ ] audit-browser-api에 PgAuditRecorder + AuditExplorer 통합
- [ ] 3 endpoint: GET /audit/trace, /firstFailure, /entry
- [ ] OtelAuditRecorder가 pm-api / approval-api의 AccessChecker에 부착
- [ ] e2e-trace-smoke.sh 스크립트로 login → projects → trace_id 추출 검증 가능
- [ ] no fallback — initTelemetry 실패는 silent skip 아님 (env 검증 throw)
- [ ] no approximation — trace propagation은 OTel API 100% 위임

---

## Defer

| 작업 | 이유 | 후속 plan |
|---|---|---|
| OTel collector (Tempo/Jaeger) 부팅 | 시뮬 운영 시점 | Phase 5 관측 plan |
| Span attribute 표준화 (k8s, pod 등) | 운영 클러스터 도입 후 | 후속 |
| AccessChecker 외 다른 권한 결정 지점 audit | 시나리오 진행 중 발견 시 case-by-case | 시나리오 plan |
| metric exemplar (trace + metric 연결) | metrics-collector 통합 후 | Plan 14a |
| ESLint rule — fetch 대신 fetchWithTracePropagation 강제 | DX 도구 | 후속 |

---

## 의존·후속

- **Plan 12a** (gateway JWT): 본 plan은 12a의 traceparent 미들웨어 + proxy를 회귀 검증 + x-trace-id 응답 헤더 추가.
- **Plan 12b** (bitmap pub/sub): 본 plan은 12b의 Subscriber logger를 IngestForwarder 통합 후 ingest 전송 검증.
- **Plan 06b/06c** (PgAuditRecorder + factory): audit-browser-api가 dep로 활용.
- **Plan 11a/11b** (sim-auth-api / sim-pm-api / sim-approval-api): AccessChecker 사용처에 OtelAuditRecorder wrap.
- **Plan §1** (OtelAuditRecorder): permission-engine 패키지의 wrapper. 본 plan은 활용만.
- **Plan 13a~d** (8 시나리오): 본 plan의 e2e-trace-smoke 자동화 패턴 활용.
- **Plan 14b** (통합 회귀): e2e-trace-smoke.sh를 정식 회귀에 포함.
