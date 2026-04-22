---
lifecycle: draft
plan: 10c
phase: 4
depends-on: [09a, 09b, 09c, 09d]
---

# Plan 10c — 시뮬 Edge 서비스 스캐폴딩 (gateway / metrics-collector)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `simulations/enterprise-pm/services/` 아래에 Edge 서비스 2개를 만든다 — (1) `gateway` (Hono 기반 — JWT bitmap embed + traceparent 주입 + 7개 비즈니스 API로 라우팅, 본 plan은 placeholder 라우트만 / 실제 라우팅은 Plan 12a) (2) `metrics-collector` (prom-client 기반 — Prometheus exporter, 본 plan은 `/metrics` endpoint placeholder + process gauge만 / 실제 cross-service scrape은 Plan 14a). 두 서비스 모두 `qa-sdk/decode-service` 패턴(Hono + `@hono/node-server`)을 따라 NestJS와 다른 lightweight 부팅을 사용한다.

**Architecture:**
- **gateway (포트 8888)**: Hono + `@hono/node-server`. `qa-sdk/decode-service/src/server.ts` 패턴 그대로 — `serve({ fetch: app.fetch, port })`. middleware로 request-id + 향후 JWT 검증 + traceparent 주입. 본 plan은 `/health` + 7 placeholder 라우트(`/auth`, `/projects`, `/approvals`, `/notifications`, `/reports`, `/documents`, `/audit`)만 — 각 라우트는 503 + `Plan 12a will implement` 응답.
- **metrics-collector (포트 5200)**: prom-client + Hono. `/metrics` endpoint가 (1) process_uptime / heap / rss gauge (2) 향후 7 비즈니스 서비스의 scrape 결과 노출. 본 plan은 process gauge만 — Plan 14a가 cross-service scrape registry 부착.
- 두 서비스는 NestJS가 아니므로 nest-cli.json·platform-fastify 의존 없음. tsup 단일 번들 가능 (decode-service와 동일).
- OTel 부팅은 NestJS 서비스와 동일 — `initTelemetry`가 server 시작 전.
- ownedPrefixes 없음 (gateway는 라우터 / metrics-collector는 exporter).

**Tech Stack:**
- gateway: hono ^4.7.5, `@hono/node-server` ^1.14.1, jose ^5.9.0 (Plan 12a JWT 검증 dep — 본 plan에서는 미사용 dep 등록만)
- metrics-collector: hono ^4.7.5, `@hono/node-server`, `prom-client` ^15.1.3
- 공통: @qa-sdk/{core,logger,otel}, zod, vitest, tsup, ES2023

---

## File Structure

### 새로 만드는 파일 (gateway 13 + metrics-collector 13 = 26)

```
simulations/enterprise-pm/services/gateway/
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── src/
│   ├── server.ts               # serve + initTelemetry + 라우트 마운트
│   ├── app.ts                  # createApp(deps) — Hono 인스턴스 + 미들웨어 + 라우트
│   ├── app.test.ts             # health + 7 placeholder 라우트 응답 검증
│   ├── config/env.ts           # SERVICE_PORTS sim-gateway 파생
│   ├── config/env.test.ts
│   ├── lib/logger.ts           # createLogger + IngestForwarder
│   ├── middleware/request-id.ts
│   ├── middleware/traceparent.ts  # 본 plan은 placeholder (next-only) — Plan 12a가 실제 주입
│   ├── routes/health.ts
│   └── routes/placeholder.ts   # 7 비즈니스 라우트 placeholder (503 + 메시지)
├── Dockerfile
└── .dockerignore
```

```
simulations/enterprise-pm/services/metrics-collector/
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── src/
│   ├── server.ts               # serve + initTelemetry + Hono 마운트
│   ├── app.ts                  # createApp(deps)
│   ├── app.test.ts
│   ├── config/env.ts
│   ├── config/env.test.ts
│   ├── lib/logger.ts
│   ├── lib/registry.ts         # prom-client Registry + process gauge 등록
│   ├── lib/registry.test.ts
│   ├── routes/health.ts
│   └── routes/metrics.ts       # /metrics → registry.metrics()
├── Dockerfile
└── .dockerignore
```

---

## Task 0: baseline

- [ ] **Step 1: Plan 09 + SERVICE_PORTS 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  ls simulations/enterprise-pm/package.json && \
  grep -n "sim-gateway\|sim-metrics-collector" packages/core/src/lib/service-ports.ts
```

Expected: 2 entry hit. 미충족 시 Plan 09b 미완료 → 시작 금지.

- [ ] **Step 2: 포트 8888/5200 free 확인**

```bash
for port in 8888 5200; do echo "port $port:"; lsof -nP -iTCP:$port 2>&1 | head -2; done
```

Expected: empty.

- [ ] **Step 3: decode-service Hono 패턴 참조 (read-only)**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  ls packages/decode-service/src/server.ts packages/decode-service/src/app.ts \
     packages/decode-service/src/middleware/request-id.ts \
     packages/decode-service/src/routes/health.ts packages/decode-service/src/routes/metrics.ts
```

Expected: 모두 존재. 본 plan은 동일 패턴을 시뮬 edge 서비스에 복제.

---

## Task 1: gateway — 디렉토리 + package + tsconfig + tsup

**Files:**
- Create: `simulations/enterprise-pm/services/gateway/package.json`
- Create: `simulations/enterprise-pm/services/gateway/tsconfig.json`
- Create: `simulations/enterprise-pm/services/gateway/tsup.config.ts`

- [ ] **Step 1: 디렉토리 생성**

```bash
mkdir -p /Users/junwoobang/workflow/qa-sdk/simulations/enterprise-pm/services/gateway/src/{config,lib,middleware,routes}
```

- [ ] **Step 2: package.json**

```json
{
  "name": "@qa-sdk/sim-gateway",
  "version": "0.1.0",
  "description": "시뮬 — Hono 기반 gateway (JWT bitmap embed + traceparent + 라우팅)",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsup",
    "start": "node dist/server.js",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "@hono/node-server": "^1.14.1",
    "@qa-sdk/core": "workspace:*",
    "@qa-sdk/logger": "workspace:*",
    "@qa-sdk/otel": "workspace:*",
    "hono": "^4.7.5",
    "jose": "^5.9.0",
    "zod": "^3.24.2"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "tsup": "^8.5.1",
    "tsx": "^4.19.3",
    "typescript": "^5.8.2",
    "vitest": "^1.6.1"
  }
}
```

`jose`는 Plan 12a JWT 검증 시 사용. 본 plan에서는 dep만 등록 (server.ts에서 import 안 함).

- [ ] **Step 3: tsconfig.json**

```json
{
  "extends": "../../../../tsconfig.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "lib": ["ES2023"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "skipLibCheck": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

`Bundler` resolution — tsup 사용에 적합. NestJS 서비스(`NodeNext`)와 다름.

- [ ] **Step 4: tsup.config.ts**

```ts
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/server.ts"],
  format: ["esm"],
  dts: false,
  sourcemap: true,
  clean: true,
  target: "es2023",
  platform: "node",
});
```

- [ ] **Step 5: pnpm install**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm install
```

Expected: workspace 인식 + hono / jose / @hono/node-server 설치.

- [ ] **Step 6: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add simulations/enterprise-pm/services/gateway/package.json \
          simulations/enterprise-pm/services/gateway/tsconfig.json \
          simulations/enterprise-pm/services/gateway/tsup.config.ts \
          pnpm-lock.yaml && \
  git commit -m "$(cat <<'EOF'
feat(sim-gateway): Hono 패키지 스캐폴딩 (포트 8888)

@hono/node-server + hono + jose dep.
tsup ESM 단일 번들. Bundler resolution.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: gateway — config/env + lib/logger + middleware

**Files:**
- Create: `simulations/enterprise-pm/services/gateway/src/config/env.ts`
- Create: `simulations/enterprise-pm/services/gateway/src/config/env.test.ts`
- Create: `simulations/enterprise-pm/services/gateway/src/lib/logger.ts`
- Create: `simulations/enterprise-pm/services/gateway/src/middleware/request-id.ts`
- Create: `simulations/enterprise-pm/services/gateway/src/middleware/traceparent.ts`

- [ ] **Step 1: env.ts**

`simulations/enterprise-pm/services/gateway/src/config/env.ts`:

```ts
// @def.boundary sim-gateway
// @def.doc sim-erp-pm-design

import { z } from "zod";
import { getRequiredServicePort, getServiceDevUrl } from "@qa-sdk/core";

const DEFAULT_PORT = getRequiredServicePort("sim-gateway");

export const envSchema = z.object({
  PORT: z.coerce.number().int().default(DEFAULT_PORT),
  CORS_ORIGIN: z.string().default("*"),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().optional(),
  OTEL_ENABLED: z
    .preprocess((v) => v ?? "true", z.enum(["true", "false"]).transform((v) => v === "true")),
  QA_INGEST_URL: z.string().optional(),
  /** 비즈니스 서비스 base URL — Plan 12a가 실제 라우팅에 사용. 본 plan은 미사용. */
  AUTH_API_URL: z.string().default(getServiceDevUrl("sim-auth-api") ?? "http://localhost:4400"),
  PM_API_URL: z.string().default(getServiceDevUrl("sim-pm-api") ?? "http://localhost:4500"),
  APPROVAL_API_URL: z.string().default(getServiceDevUrl("sim-approval-api") ?? "http://localhost:4600"),
  NOTIFICATION_API_URL: z.string().default(getServiceDevUrl("sim-notification-api") ?? "http://localhost:4700"),
  REPORTING_API_URL: z.string().default(getServiceDevUrl("sim-reporting-api") ?? "http://localhost:4800"),
  DOCUMENT_API_URL: z.string().default(getServiceDevUrl("sim-document-api") ?? "http://localhost:4900"),
  AUDIT_BROWSER_API_URL: z.string().default(getServiceDevUrl("sim-audit-browser-api") ?? "http://localhost:5100"),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: NodeJS.ProcessEnv = process.env): Env {
  return envSchema.parse(source);
}

export const env = parseEnv();
```

**중요**: 7 비즈니스 서비스 URL은 SERVICE_PORTS SSOT에서 파생 (`getServiceDevUrl`). fallback `http://localhost:4xxx`는 SSOT가 dev URL을 제공하지 않을 때만 — design.md §2의 포트와 일치.

- [ ] **Step 2: env.test.ts**

```ts
import { describe, expect, it } from "vitest";
import { parseEnv } from "./env.js";

describe("sim-gateway env", () => {
  it("PORT 기본값 8888 (SERVICE_PORTS sim-gateway)", () => {
    expect(parseEnv({}).PORT).toBe(8888);
  });
  it("AUTH_API_URL 기본값은 sim-auth-api (4400) 파생", () => {
    expect(parseEnv({}).AUTH_API_URL).toContain("4400");
  });
  it("PM_API_URL 기본값은 sim-pm-api (4500) 파생", () => {
    expect(parseEnv({}).PM_API_URL).toContain("4500");
  });
  it("환경변수 override 동작", () => {
    expect(parseEnv({ AUTH_API_URL: "http://custom:9999" }).AUTH_API_URL).toBe("http://custom:9999");
  });
  it("OTEL_ENABLED 기본 true", () => {
    expect(parseEnv({}).OTEL_ENABLED).toBe(true);
  });
});
```

- [ ] **Step 3: lib/logger.ts** (Plan 10a 패턴 그대로)

```ts
// @def.boundary sim-gateway
// @def.doc sim-erp-pm-design

import { createLogger as _createLogger, type Logger } from "@qa-sdk/core";
import { createIngestForwarder } from "@qa-sdk/logger";
import { env } from "../config/env.js";

export function createLogger(name: string): Logger {
  if (!env.QA_INGEST_URL) return _createLogger(name);
  return _createLogger(name, {
    destinations: [
      {
        stream: createIngestForwarder({ endpoint: env.QA_INGEST_URL, serviceName: name }),
        level: "info",
      },
    ],
  });
}

export type { Logger } from "@qa-sdk/core";
```

- [ ] **Step 4: middleware/request-id.ts** (decode-service 패턴 그대로)

```ts
// @def.boundary sim-gateway
// @def.doc sim-erp-pm-design

import type { MiddlewareHandler } from "hono";
import { randomUUID } from "node:crypto";

export const requestId: MiddlewareHandler = async (c, next) => {
  const incoming = c.req.header("x-request-id");
  const id = incoming && /^[a-zA-Z0-9-_]{8,}$/.test(incoming) ? incoming : randomUUID();
  c.set("requestId", id);
  c.header("x-request-id", id);
  await next();
};
```

- [ ] **Step 5: middleware/traceparent.ts** (placeholder — Plan 12a가 실제 주입 로직 추가)

```ts
// @def.boundary sim-gateway
// @def.doc sim-erp-pm-design

import type { MiddlewareHandler } from "hono";

/**
 * traceparent 주입 미들웨어.
 *
 * Plan 10c: pass-through. 클라이언트의 traceparent를 그대로 전달.
 * Plan 12a: OTel context에서 active span을 read하여 downstream에 주입,
 *           없으면 신규 W3C trace 생성.
 */
export const traceparent: MiddlewareHandler = async (c, next) => {
  // 본 plan은 통과만 — Plan 12a에서 OTel context 통합
  await next();
};
```

- [ ] **Step 6: typecheck + 단위 테스트**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter @qa-sdk/sim-gateway typecheck && \
  pnpm --filter @qa-sdk/sim-gateway test 2>&1 | tail -10
```

Expected: typecheck 0, env test 5 PASS.

- [ ] **Step 7: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add simulations/enterprise-pm/services/gateway/src && \
  git commit -m "$(cat <<'EOF'
feat(sim-gateway): env + logger + 미들웨어 (request-id + traceparent placeholder)

7 비즈니스 서비스 URL을 SERVICE_PORTS SSOT에서 파생.
traceparent 주입 로직은 Plan 12a (OTel context 통합).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: gateway — routes (health + 7 placeholder)

**Files:**
- Create: `simulations/enterprise-pm/services/gateway/src/routes/health.ts`
- Create: `simulations/enterprise-pm/services/gateway/src/routes/placeholder.ts`

- [ ] **Step 1: routes/health.ts**

```ts
// @def.boundary sim-gateway
// @def.doc sim-erp-pm-design

import { Hono } from "hono";

export function createHealthRoutes() {
  const r = new Hono();
  r.get("/health", (c) =>
    c.json({
      status: "ok",
      service: "sim-gateway",
      role: "edge-router",
      ownedPrefixes: [],
      ts: new Date().toISOString(),
    }),
  );
  return r;
}
```

- [ ] **Step 2: routes/placeholder.ts** (7 비즈니스 라우트 placeholder — 503 응답)

```ts
// @def.boundary sim-gateway
// @def.doc sim-erp-pm-design

import { Hono } from "hono";

const ROUTES: Array<{ path: string; targetService: string }> = [
  { path: "/auth", targetService: "sim-auth-api" },
  { path: "/projects", targetService: "sim-pm-api" },
  { path: "/approvals", targetService: "sim-approval-api" },
  { path: "/notifications", targetService: "sim-notification-api" },
  { path: "/reports", targetService: "sim-reporting-api" },
  { path: "/documents", targetService: "sim-document-api" },
  { path: "/audit", targetService: "sim-audit-browser-api" },
];

export function createPlaceholderRoutes() {
  const r = new Hono();
  for (const { path, targetService } of ROUTES) {
    r.all(`${path}/*`, (c) =>
      c.json(
        {
          error: "not-implemented",
          message: `Plan 12a will implement routing to ${targetService}`,
          targetService,
          path: c.req.path,
        },
        503,
      ),
    );
  }
  return r;
}

export const PLACEHOLDER_ROUTES = ROUTES;
```

- [ ] **Step 3: 커밋 (테스트는 Task 4에서 server 부팅 후 통합 검증)**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add simulations/enterprise-pm/services/gateway/src/routes && \
  git commit -m "$(cat <<'EOF'
feat(sim-gateway): routes — health + 7 placeholder (503)

각 placeholder는 targetService 메타와 함께 'Plan 12a will implement' 응답.
실제 라우팅은 Plan 12a (JWT 검증 + reverse proxy).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: gateway — app + server + 통합 테스트

**Files:**
- Create: `simulations/enterprise-pm/services/gateway/src/app.ts`
- Create: `simulations/enterprise-pm/services/gateway/src/app.test.ts`
- Create: `simulations/enterprise-pm/services/gateway/src/server.ts`

- [ ] **Step 1: app.ts**

```ts
// @def.boundary sim-gateway
// @def.doc sim-erp-pm-design

import { Hono } from "hono";
import { requestId } from "./middleware/request-id.js";
import { traceparent } from "./middleware/traceparent.js";
import { createHealthRoutes } from "./routes/health.js";
import { createPlaceholderRoutes } from "./routes/placeholder.js";

export function createApp() {
  const app = new Hono();
  app.use("*", requestId);
  app.use("*", traceparent);
  app.route("/", createHealthRoutes());
  app.route("/", createPlaceholderRoutes());
  return app;
}
```

- [ ] **Step 2: app.test.ts** (Hono의 `app.fetch`로 in-process 테스트)

```ts
import { describe, expect, it } from "vitest";
import { createApp } from "./app.js";

describe("sim-gateway app", () => {
  const app = createApp();

  it("GET /health → 200 + service=sim-gateway", async () => {
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.service).toBe("sim-gateway");
    expect(body.role).toBe("edge-router");
  });

  it("x-request-id 응답 헤더 부착", async () => {
    const res = await app.request("/health");
    expect(res.headers.get("x-request-id")).toBeTruthy();
  });

  it("GET /auth/login → 503 + targetService=sim-auth-api", async () => {
    const res = await app.request("/auth/login");
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.targetService).toBe("sim-auth-api");
    expect(body.error).toBe("not-implemented");
  });

  it("GET /projects/123 → 503 + targetService=sim-pm-api", async () => {
    const res = await app.request("/projects/123");
    expect(res.status).toBe(503);
    expect((await res.json()).targetService).toBe("sim-pm-api");
  });

  it("7 placeholder 라우트 모두 503", async () => {
    const paths = ["/auth/x", "/projects/x", "/approvals/x", "/notifications/x", "/reports/x", "/documents/x", "/audit/x"];
    for (const p of paths) {
      const res = await app.request(p);
      expect(res.status, p).toBe(503);
    }
  });
});
```

- [ ] **Step 3: server.ts** (decode-service 패턴 + initTelemetry)

```ts
// @def.boundary sim-gateway
// @def.doc sim-erp-pm-design

import "reflect-metadata";
import { serve } from "@hono/node-server";
import { warnPortConflict, installSimpleShutdown } from "@qa-sdk/core";
import { initTelemetry, otelEnvSchema } from "@qa-sdk/otel";
import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { createLogger } from "./lib/logger.js";

const SERVICE_NAME = "sim-gateway";
const logger = createLogger(SERVICE_NAME);

const otelShutdown = initTelemetry({
  serviceName: SERVICE_NAME,
  env: otelEnvSchema.parse(process.env),
});

const app = createApp();

const server = serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  logger.info(
    {
      port: info.port,
      authApi: env.AUTH_API_URL,
      pmApi: env.PM_API_URL,
      approvalApi: env.APPROVAL_API_URL,
      notificationApi: env.NOTIFICATION_API_URL,
      reportingApi: env.REPORTING_API_URL,
      documentApi: env.DOCUMENT_API_URL,
      auditBrowserApi: env.AUDIT_BROWSER_API_URL,
    },
    `${SERVICE_NAME} listening`,
  );
  warnPortConflict(SERVICE_NAME, env.PORT, logger);
});

installSimpleShutdown({ server, logger });

process.on("SIGTERM", () => void otelShutdown());
process.on("SIGINT", () => void otelShutdown());
```

- [ ] **Step 4: typecheck + test + build + 부팅 smoke**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter @qa-sdk/sim-gateway typecheck && \
  pnpm --filter @qa-sdk/sim-gateway test && \
  pnpm --filter @qa-sdk/sim-gateway build && \
  pnpm --filter @qa-sdk/sim-gateway start &
PID=$!
sleep 3
echo "/health:"; curl -fsS http://localhost:8888/health; echo
echo "/auth/login:"; curl -sS -o /dev/null -w "%{http_code}\n" http://localhost:8888/auth/login
echo "/projects/abc:"; curl -sS -o /dev/null -w "%{http_code}\n" http://localhost:8888/projects/abc
kill $PID 2>/dev/null || true
```

Expected: typecheck 0, test 5 (env) + 5 (app) = 10 PASS, /health 200, placeholder 503.

- [ ] **Step 5: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add simulations/enterprise-pm/services/gateway/src/app.ts \
          simulations/enterprise-pm/services/gateway/src/app.test.ts \
          simulations/enterprise-pm/services/gateway/src/server.ts && \
  git commit -m "$(cat <<'EOF'
feat(sim-gateway): app + server 부팅 (포트 8888)

initTelemetry → serve → installSimpleShutdown.
in-process app.fetch 테스트로 health + 7 placeholder 검증.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: gateway — Dockerfile + .dockerignore

- [ ] **Step 1: Dockerfile**

```dockerfile
# 시뮬 sim-gateway — Hono 기반 edge router
ARG SERVICE_PATH=simulations/enterprise-pm/services/gateway
ARG SERVICE_PACKAGE=@qa-sdk/sim-gateway

FROM qa-sdk/sim-base:latest AS final
ARG SERVICE_PATH
ARG SERVICE_PACKAGE
ENV SIM_SERVICE_PATH=${SERVICE_PATH}
ENV SIM_SERVICE_PACKAGE=${SERVICE_PACKAGE}
WORKDIR /app/${SERVICE_PATH}
EXPOSE 8888
CMD ["node", "dist/server.js"]
```

- [ ] **Step 2: .dockerignore**

```
node_modules
dist
.env*
*.test.ts
*.test.js
coverage
```

- [ ] **Step 3: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add simulations/enterprise-pm/services/gateway/Dockerfile \
          simulations/enterprise-pm/services/gateway/.dockerignore && \
  git commit -m "$(cat <<'EOF'
feat(sim-gateway): Dockerfile wrapper + .dockerignore

Plan 09c sim-base 이미지 위에 SERVICE_PATH 인자 전달.
EXPOSE 8888.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: metrics-collector — 디렉토리 + package + tsconfig + tsup

- [ ] **Step 1: 디렉토리 생성**

```bash
mkdir -p /Users/junwoobang/workflow/qa-sdk/simulations/enterprise-pm/services/metrics-collector/src/{config,lib,routes}
```

- [ ] **Step 2: package.json**

```json
{
  "name": "@qa-sdk/sim-metrics-collector",
  "version": "0.1.0",
  "description": "시뮬 — Prometheus exporter (prom-client 기반)",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsup",
    "start": "node dist/server.js",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "@hono/node-server": "^1.14.1",
    "@qa-sdk/core": "workspace:*",
    "@qa-sdk/logger": "workspace:*",
    "@qa-sdk/otel": "workspace:*",
    "hono": "^4.7.5",
    "prom-client": "^15.1.3",
    "zod": "^3.24.2"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "tsup": "^8.5.1",
    "tsx": "^4.19.3",
    "typescript": "^5.8.2",
    "vitest": "^1.6.1"
  }
}
```

- [ ] **Step 3: tsconfig.json + tsup.config.ts** (gateway와 동일 패턴, entry는 `src/server.ts`)

`simulations/enterprise-pm/services/metrics-collector/tsconfig.json`:

```json
{
  "extends": "../../../../tsconfig.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "lib": ["ES2023"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "skipLibCheck": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

`simulations/enterprise-pm/services/metrics-collector/tsup.config.ts`:

```ts
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/server.ts"],
  format: ["esm"],
  dts: false,
  sourcemap: true,
  clean: true,
  target: "es2023",
  platform: "node",
});
```

- [ ] **Step 4: pnpm install + 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm install
```

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add simulations/enterprise-pm/services/metrics-collector/package.json \
          simulations/enterprise-pm/services/metrics-collector/tsconfig.json \
          simulations/enterprise-pm/services/metrics-collector/tsup.config.ts \
          pnpm-lock.yaml && \
  git commit -m "$(cat <<'EOF'
feat(sim-metrics-collector): Hono + prom-client 패키지 스캐폴딩 (포트 5200)

tsup ESM. Plan 14a가 cross-service scrape registry 부착.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: metrics-collector — config + logger + registry + routes

**Files:**
- Create: `simulations/enterprise-pm/services/metrics-collector/src/config/env.ts`
- Create: `simulations/enterprise-pm/services/metrics-collector/src/config/env.test.ts`
- Create: `simulations/enterprise-pm/services/metrics-collector/src/lib/logger.ts`
- Create: `simulations/enterprise-pm/services/metrics-collector/src/lib/registry.ts`
- Create: `simulations/enterprise-pm/services/metrics-collector/src/lib/registry.test.ts`
- Create: `simulations/enterprise-pm/services/metrics-collector/src/routes/health.ts`
- Create: `simulations/enterprise-pm/services/metrics-collector/src/routes/metrics.ts`

- [ ] **Step 1: config/env.ts**

```ts
// @def.boundary sim-metrics-collector
// @def.doc sim-erp-pm-design

import { z } from "zod";
import { getRequiredServicePort } from "@qa-sdk/core";

const DEFAULT_PORT = getRequiredServicePort("sim-metrics-collector");

export const envSchema = z.object({
  PORT: z.coerce.number().int().default(DEFAULT_PORT),
  CORS_ORIGIN: z.string().default("*"),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().optional(),
  OTEL_ENABLED: z
    .preprocess((v) => v ?? "true", z.enum(["true", "false"]).transform((v) => v === "true")),
  QA_INGEST_URL: z.string().optional(),
  /** Plan 14a가 사용 — 스크레이프 대상 base URL 콤마 구분 */
  SCRAPE_TARGETS: z.string().default(""),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: NodeJS.ProcessEnv = process.env): Env {
  return envSchema.parse(source);
}

export const env = parseEnv();
```

- [ ] **Step 2: config/env.test.ts**

```ts
import { describe, expect, it } from "vitest";
import { parseEnv } from "./env.js";

describe("sim-metrics-collector env", () => {
  it("PORT 기본값 5200", () => {
    expect(parseEnv({}).PORT).toBe(5200);
  });
  it("SCRAPE_TARGETS 기본 빈 문자열", () => {
    expect(parseEnv({}).SCRAPE_TARGETS).toBe("");
  });
});
```

- [ ] **Step 3: lib/logger.ts** (Plan 10a 패턴)

```ts
// @def.boundary sim-metrics-collector
// @def.doc sim-erp-pm-design

import { createLogger as _createLogger, type Logger } from "@qa-sdk/core";
import { createIngestForwarder } from "@qa-sdk/logger";
import { env } from "../config/env.js";

export function createLogger(name: string): Logger {
  if (!env.QA_INGEST_URL) return _createLogger(name);
  return _createLogger(name, {
    destinations: [
      {
        stream: createIngestForwarder({ endpoint: env.QA_INGEST_URL, serviceName: name }),
        level: "info",
      },
    ],
  });
}
```

- [ ] **Step 4: lib/registry.ts** (prom-client Registry + process gauge 등록)

```ts
// @def.boundary sim-metrics-collector
// @def.doc sim-erp-pm-design

import { Registry, collectDefaultMetrics, Gauge } from "prom-client";

/**
 * Prometheus Registry 생성.
 *
 * 본 plan: process default metrics + sim_collector_uptime_seconds gauge.
 * Plan 14a: cross-service scrape registry 부착 (7 비즈니스 서비스의 /metrics 합산).
 */
export function createMetricsRegistry(opts: { serviceName: string } = { serviceName: "sim-metrics-collector" }) {
  const registry = new Registry();
  registry.setDefaultLabels({ service: opts.serviceName });

  collectDefaultMetrics({ register: registry });

  const startedAt = Date.now();
  const uptimeGauge = new Gauge({
    name: "sim_collector_uptime_seconds",
    help: "Seconds since sim-metrics-collector started",
    registers: [registry],
    collect() {
      this.set((Date.now() - startedAt) / 1000);
    },
  });

  return { registry, uptimeGauge };
}
```

- [ ] **Step 5: lib/registry.test.ts**

```ts
import { describe, expect, it } from "vitest";
import { createMetricsRegistry } from "./registry.js";

describe("sim-metrics-collector registry", () => {
  it("default metrics + uptime gauge 등록", async () => {
    const { registry } = createMetricsRegistry();
    const text = await registry.metrics();
    expect(text).toContain("sim_collector_uptime_seconds");
    expect(text).toContain("process_cpu_user_seconds_total"); // collectDefaultMetrics
  });

  it("default label service=sim-metrics-collector 부착", async () => {
    const { registry } = createMetricsRegistry();
    const text = await registry.metrics();
    expect(text).toContain('service="sim-metrics-collector"');
  });
});
```

- [ ] **Step 6: routes/health.ts**

```ts
// @def.boundary sim-metrics-collector
// @def.doc sim-erp-pm-design

import { Hono } from "hono";

export function createHealthRoutes() {
  const r = new Hono();
  r.get("/health", (c) =>
    c.json({
      status: "ok",
      service: "sim-metrics-collector",
      role: "exporter",
      ownedPrefixes: [],
      ts: new Date().toISOString(),
    }),
  );
  return r;
}
```

- [ ] **Step 7: routes/metrics.ts**

```ts
// @def.boundary sim-metrics-collector
// @def.doc sim-erp-pm-design

import { Hono } from "hono";
import type { Registry } from "prom-client";

export interface MetricsRouteDeps {
  registry: Registry;
}

export function createMetricsRoutes(deps: MetricsRouteDeps) {
  const r = new Hono();
  r.get("/metrics", async (c) => {
    const text = await deps.registry.metrics();
    return c.text(text, 200, {
      "Content-Type": deps.registry.contentType,
    });
  });
  return r;
}
```

- [ ] **Step 8: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add simulations/enterprise-pm/services/metrics-collector/src && \
  git commit -m "$(cat <<'EOF'
feat(sim-metrics-collector): config + logger + registry + routes

prom-client Registry + collectDefaultMetrics + uptime gauge.
/metrics endpoint는 registry.metrics() text 반환.
cross-service scrape는 Plan 14a.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: metrics-collector — app + server + 통합 테스트

**Files:**
- Create: `simulations/enterprise-pm/services/metrics-collector/src/app.ts`
- Create: `simulations/enterprise-pm/services/metrics-collector/src/app.test.ts`
- Create: `simulations/enterprise-pm/services/metrics-collector/src/server.ts`

- [ ] **Step 1: app.ts**

```ts
// @def.boundary sim-metrics-collector
// @def.doc sim-erp-pm-design

import { Hono } from "hono";
import type { Registry } from "prom-client";
import { createHealthRoutes } from "./routes/health.js";
import { createMetricsRoutes } from "./routes/metrics.js";

export interface AppDeps {
  registry: Registry;
}

export function createApp(deps: AppDeps) {
  const app = new Hono();
  app.route("/", createHealthRoutes());
  app.route("/", createMetricsRoutes({ registry: deps.registry }));
  return app;
}
```

- [ ] **Step 2: app.test.ts**

```ts
import { describe, expect, it } from "vitest";
import { createApp } from "./app.js";
import { createMetricsRegistry } from "./lib/registry.js";

describe("sim-metrics-collector app", () => {
  const { registry } = createMetricsRegistry();
  const app = createApp({ registry });

  it("GET /health → 200", async () => {
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    expect((await res.json()).service).toBe("sim-metrics-collector");
  });

  it("GET /metrics → 200 + Prometheus text format", async () => {
    const res = await app.request("/metrics");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/plain");
    const body = await res.text();
    expect(body).toContain("sim_collector_uptime_seconds");
  });
});
```

- [ ] **Step 3: server.ts**

```ts
// @def.boundary sim-metrics-collector
// @def.doc sim-erp-pm-design

import { serve } from "@hono/node-server";
import { warnPortConflict, installSimpleShutdown } from "@qa-sdk/core";
import { initTelemetry, otelEnvSchema } from "@qa-sdk/otel";
import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { createLogger } from "./lib/logger.js";
import { createMetricsRegistry } from "./lib/registry.js";

const SERVICE_NAME = "sim-metrics-collector";
const logger = createLogger(SERVICE_NAME);

const otelShutdown = initTelemetry({
  serviceName: SERVICE_NAME,
  env: otelEnvSchema.parse(process.env),
});

const { registry } = createMetricsRegistry({ serviceName: SERVICE_NAME });
const app = createApp({ registry });

const server = serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  logger.info({ port: info.port }, `${SERVICE_NAME} listening`);
  warnPortConflict(SERVICE_NAME, env.PORT, logger);
});

installSimpleShutdown({ server, logger });

process.on("SIGTERM", () => void otelShutdown());
process.on("SIGINT", () => void otelShutdown());
```

- [ ] **Step 4: typecheck + test + build + 부팅 smoke**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter @qa-sdk/sim-metrics-collector typecheck && \
  pnpm --filter @qa-sdk/sim-metrics-collector test && \
  pnpm --filter @qa-sdk/sim-metrics-collector build && \
  pnpm --filter @qa-sdk/sim-metrics-collector start &
PID=$!
sleep 3
echo "/health:"; curl -fsS http://localhost:5200/health; echo
echo "/metrics 일부:"; curl -fsS http://localhost:5200/metrics | grep -E "sim_collector_uptime|process_cpu" | head -5
kill $PID 2>/dev/null || true
```

Expected: typecheck 0, test 2 (env) + 2 (registry) + 2 (app) = 6 PASS, /health 200, /metrics에 uptime gauge.

- [ ] **Step 5: Dockerfile + .dockerignore + 커밋**

`simulations/enterprise-pm/services/metrics-collector/Dockerfile`:

```dockerfile
ARG SERVICE_PATH=simulations/enterprise-pm/services/metrics-collector
ARG SERVICE_PACKAGE=@qa-sdk/sim-metrics-collector

FROM qa-sdk/sim-base:latest AS final
ARG SERVICE_PATH
ARG SERVICE_PACKAGE
ENV SIM_SERVICE_PATH=${SERVICE_PATH}
ENV SIM_SERVICE_PACKAGE=${SERVICE_PACKAGE}
WORKDIR /app/${SERVICE_PATH}
EXPOSE 5200
CMD ["node", "dist/server.js"]
```

`.dockerignore`은 gateway와 동일.

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add simulations/enterprise-pm/services/metrics-collector/src/app.ts \
          simulations/enterprise-pm/services/metrics-collector/src/app.test.ts \
          simulations/enterprise-pm/services/metrics-collector/src/server.ts \
          simulations/enterprise-pm/services/metrics-collector/Dockerfile \
          simulations/enterprise-pm/services/metrics-collector/.dockerignore && \
  git commit -m "$(cat <<'EOF'
feat(sim-metrics-collector): app + server + Dockerfile

initTelemetry → serve. /metrics → prom-client text format.
Plan 14a가 cross-service scrape 부착 시 confgi의 SCRAPE_TARGETS 활용.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: 통합 회귀 — gateway + metrics-collector 동시 부팅

- [ ] **Step 1: 2 서비스 동시 부팅**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter @qa-sdk/sim-gateway start & PID1=$!
  pnpm --filter @qa-sdk/sim-metrics-collector start & PID2=$!
sleep 4
echo "gateway/health:"; curl -fsS http://localhost:8888/health; echo
echo "gateway/auth/x:"; curl -sS -o /dev/null -w "%{http_code}\n" http://localhost:8888/auth/x
echo "metrics/health:"; curl -fsS http://localhost:5200/health; echo
echo "metrics/metrics 첫 5줄:"; curl -fsS http://localhost:5200/metrics | head -5
kill $PID1 $PID2 2>/dev/null || true
```

Expected: 2 /health 200, gateway placeholder 503, metrics text/plain.

- [ ] **Step 2: workflow-smoke + def gate 회귀**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter @qa-sdk/cli test 2>&1 | tail -3 && \
  node packages/cli/dist/index.js def validate 2>&1 | head -3
```

Expected: smoke PASS, def errors 0.

---

## Self-Review

- [ ] gateway는 Hono + jose dep, 7 placeholder 라우트 503 반환
- [ ] metrics-collector는 prom-client Registry + collectDefaultMetrics
- [ ] 두 서비스 모두 initTelemetry → serve 패턴 (decode-service 참조)
- [ ] PORT는 SERVICE_PORTS SSOT 파생
- [ ] gateway env가 7 비즈니스 서비스 URL을 SERVICE_PORTS에서 파생 (`getServiceDevUrl`)
- [ ] traceparent middleware는 placeholder (Plan 12a가 OTel context 통합)
- [ ] gateway in-process 테스트 5 PASS, metrics-collector in-process 테스트 2 PASS
- [ ] 2 서비스 동시 부팅 → 모두 정상

---

## Defer (본 plan 범위 외)

| 작업 | 이유 | 후속 plan |
|---|---|---|
| JWT 검증 미들웨어 (jose) | bitmap 페이로드 정의 + auth-api 발행 endpoint 필요 | Plan 12a |
| 7 비즈니스 라우트 reverse proxy | URL 라우팅 + 헤더 forward 구현 | Plan 12a |
| traceparent OTel context 주입 | OTel Trace API + propagation 통합 | Plan 12a / 12c |
| metrics-collector cross-service scrape | 7 서비스의 /metrics 폴링 + 합산 | Plan 14a |
| metrics-collector marginal density 측정 | reporting-api 협조 + 시뮬 트래픽 후 | Plan 14a |
| docker-compose에 두 서비스 포함 | 09c 후속 또는 본 plan defer | Plan 09c 갱신 |

---

## 의존·후속

- **Plan 09a/b/c/d** (인프라 부트스트랩): 본 plan의 전제.
- **Plan 10a / 10b** (NestJS 서비스 7개): 본 plan과 병렬. gateway env가 7 서비스 URL 참조하지만 본 plan은 부팅만 — 통합 검증은 Plan 12a.
- **Plan 12a** (gateway 라우팅): 본 plan의 placeholder를 reverse proxy로 교체.
- **Plan 12c** (OTEL 전파): 본 plan의 traceparent middleware에 실제 주입 로직 추가.
- **Plan 14a** (marginal density): 본 plan의 metrics-collector에 scrape registry 부착.
