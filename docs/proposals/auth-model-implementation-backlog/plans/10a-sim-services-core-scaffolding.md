---
lifecycle: draft
plan: 10a
phase: 4
depends-on: [09a, 09b, 09c, 09d]
---

# Plan 10a — 시뮬 코어 서비스 스캐폴딩 (auth-api / pm-api / approval-api)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `simulations/enterprise-pm/services/` 아래에 NestJS 기반 코어 비즈니스 서비스 3개 (`auth-api`, `pm-api`, `approval-api`)의 부팅 가능한 스켈레톤을 만든다. 각 서비스는 `/health` 엔드포인트만 우선 노출하고, `@qa-sdk/otel` `initTelemetry`로 트레이스를 활성화하고, `@qa-sdk/logger` `createLogger`로 IngestForwarder를 옵션 활성화한 상태에서 단일 포트 (`SERVICE_PORTS` SSOT 파생)로 listen 한다. 도메인 모델은 본 plan 영역 밖 — Plan 11a/11b가 모듈 단위로 부착한다.

**Architecture:**
- 3 서비스가 동일 패턴을 사용. 차이는 (1) 서비스명 / SERVICE_PORTS 키 (2) ownedPrefixes 메타 (3) Dockerfile build context.
- NestJS 11 + `@nestjs/platform-fastify` (definition-service / decision-service와 동일 스택).
- `src/main.ts`가 `initTelemetry` → `NestFactory.create<NestFastifyApplication>(AppModule, FastifyAdapter)` → `app.listen({ port, host: "0.0.0.0" })` 순서를 강제. OTEL은 NestFactory보다 먼저 초기화되어야 HttpInstrumentation이 모든 라우트를 포착한다.
- `AppModule`에는 `HealthController`만 우선 등록. 도메인 모듈은 Plan 11에서 추가.
- Dockerfile은 Plan 09c가 정의한 monorepo 공용 `Dockerfile.service` (multi-stage pnpm install + build + prune)를 그대로 활용. 본 plan은 `service` 빌드 인자만 다르게 호출하는 thin wrapper Dockerfile만 추가.
- 각 서비스의 `config/env.ts`는 zod 스키마 + `getRequiredServicePort("sim-<svc>-api")`로 기본 포트 파생. `process.env` 직접 접근 금지 (CLAUDE.md 환경변수 처리 규칙).
- `lib/logger.ts`는 `@qa-sdk/core` `createLogger` + `@qa-sdk/logger` `createIngestForwarder`로 conditional ingest forwarding. `QA_INGEST_URL`이 set되면 forwarder 활성화.
- 본 plan 종료 시점 전체 회귀: 3개 서비스 각각 `pnpm --filter @qa-sdk/sim-<svc>-api start` → `/health` 200 응답.

**Tech Stack:**
- @nestjs/{common,core,platform-fastify} ^11.0.0
- reflect-metadata ^0.2.2
- @qa-sdk/core, @qa-sdk/logger, @qa-sdk/otel (workspace)
- db-bootstrap (workspace, Plan 04c — 본 plan에서는 환경 변수 schema만 import, connection은 Plan 11에서)
- zod ^3.24.2
- TypeScript ES2023, NodeNext module resolution (NestJS 호환)
- vitest ^1.6.1

---

## File Structure

### 새로 만드는 파일 (3 서비스 동일 구조 × 3)

| 경로 | 책임 |
|---|---|
| `simulations/enterprise-pm/services/auth-api/package.json` | NestJS deps + workspace (@qa-sdk/*) + db-bootstrap dev |
| `simulations/enterprise-pm/services/auth-api/tsconfig.json` | ES2023 + decorators (definition-service tsconfig 그대로) |
| `simulations/enterprise-pm/services/auth-api/nest-cli.json` | NestCLI 메타 (build assets 처리) |
| `simulations/enterprise-pm/services/auth-api/src/main.ts` | initTelemetry → NestFactory → listen |
| `simulations/enterprise-pm/services/auth-api/src/app.module.ts` | HealthModule만 import |
| `simulations/enterprise-pm/services/auth-api/src/config/env.ts` | zod env schema + SERVICE_PORTS 파생 |
| `simulations/enterprise-pm/services/auth-api/src/config/env.test.ts` | env parse 단위 테스트 |
| `simulations/enterprise-pm/services/auth-api/src/lib/logger.ts` | createLogger + createIngestForwarder 옵션 |
| `simulations/enterprise-pm/services/auth-api/src/health/health.module.ts` | HealthController 등록 모듈 |
| `simulations/enterprise-pm/services/auth-api/src/health/health.controller.ts` | GET /health → `{ status, service, ownedPrefixes }` |
| `simulations/enterprise-pm/services/auth-api/src/health/health.controller.test.ts` | controller 단위 |
| `simulations/enterprise-pm/services/auth-api/Dockerfile` | Plan 09c `Dockerfile.service` 호출 wrapper |
| `simulations/enterprise-pm/services/auth-api/.dockerignore` | node_modules / dist / *.test.ts 제외 |

`pm-api`, `approval-api`도 동일 14 파일 구조. 차이는 서비스명 / 포트 / ownedPrefixes만.

### 변경하지 않는 파일 (Plan 11 영역)

| 경로 | 이유 |
|---|---|
| 도메인 schema/service/controller | Plan 11a (auth), 11b (pm + approval)에서 모듈 단위로 부착 |
| db-bootstrap connection 호출 | 본 plan은 부팅만, DB 연결은 Plan 11이 도메인 모듈과 함께 추가 |

---

## Task 0: baseline

- [ ] **Step 1: 선행 plan 완료 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  ls simulations/enterprise-pm/package.json && \
  grep -n "sim-auth-api\|sim-pm-api\|sim-approval-api" packages/core/src/lib/service-ports.ts && \
  ls packages/db-bootstrap/src/index.ts
```

Expected: 모두 hit. `simulations/enterprise-pm/package.json`은 09a, SERVICE_PORTS 9 entry는 09b, db-bootstrap은 04c. 미완료면 본 plan 시작 금지.

- [ ] **Step 2: pnpm workspace 인식 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm m ls --depth -1 2>&1 | grep "enterprise-pm" | head -3
```

Expected: `simulations/enterprise-pm` 또는 `simulations/*` glob이 workspace에 등록된 흔적. 미인식이면 09a 미완료.

- [ ] **Step 3: 포트 4400/4500/4600 free 확인**

```bash
for port in 4400 4500 4600; do
  echo "port $port:"
  lsof -nP -iTCP:$port 2>&1 | head -3
done
```

Expected: 모두 empty.

- [ ] **Step 4: 기존 NestJS 서비스 패턴 참조 (read-only)**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  ls packages/definition-service/src/main.ts packages/definition-service/src/app.module.ts packages/definition-service/src/health.controller.ts
```

Expected: 모두 존재. 본 plan은 동일 패턴을 시뮬 서비스에 복제.

---

## Task 1: auth-api — package.json + tsconfig + nest-cli

**Files:**
- Create: `simulations/enterprise-pm/services/auth-api/package.json`
- Create: `simulations/enterprise-pm/services/auth-api/tsconfig.json`
- Create: `simulations/enterprise-pm/services/auth-api/nest-cli.json`

- [ ] **Step 1: 디렉토리 생성**

```bash
mkdir -p /Users/junwoobang/workflow/qa-sdk/simulations/enterprise-pm/services/auth-api/src/{config,lib,health}
```

- [ ] **Step 2: package.json 작성**

`simulations/enterprise-pm/services/auth-api/package.json`:

```json
{
  "name": "@qa-sdk/sim-auth-api",
  "version": "0.1.0",
  "description": "시뮬 — 사용자/role/department + bitmap 발행 NestJS 서비스",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/main.ts",
    "build": "tsc",
    "start": "node dist/main.js",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "@nestjs/common": "^11.0.0",
    "@nestjs/core": "^11.0.0",
    "@nestjs/platform-fastify": "^11.0.0",
    "@qa-sdk/core": "workspace:*",
    "@qa-sdk/logger": "workspace:*",
    "@qa-sdk/otel": "workspace:*",
    "db-bootstrap": "workspace:*",
    "reflect-metadata": "^0.2.2",
    "rxjs": "^7.8.1",
    "zod": "^3.24.2"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "tsx": "^4.19.3",
    "typescript": "^5.8.2",
    "vitest": "^1.6.1"
  }
}
```

`db-bootstrap`은 본 plan에서는 env schema만 import하지만 Plan 11이 곧바로 connection을 추가하므로 dep으로 선언. `@qa-sdk/otel`은 본 plan에서 `initTelemetry` 호출에 필요 — runtime dep.

- [ ] **Step 3: tsconfig.json 작성 (definition-service 그대로 + outDir 차이 없음)**

`simulations/enterprise-pm/services/auth-api/tsconfig.json`:

```json
{
  "extends": "../../../../tsconfig.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "lib": ["ES2023"],
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "skipLibCheck": true,
    "module": "NodeNext",
    "moduleResolution": "NodeNext"
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

루트 tsconfig 상대 경로는 4단계 위 (`simulations/enterprise-pm/services/auth-api` → `qa-sdk/`). NestJS는 `experimentalDecorators` + `emitDecoratorMetadata` 필수.

- [ ] **Step 4: nest-cli.json 작성**

`simulations/enterprise-pm/services/auth-api/nest-cli.json`:

```json
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": {
    "deleteOutDir": true,
    "tsConfigPath": "tsconfig.json"
  }
}
```

`@nestjs/cli`로 generate 명령을 사용할 때 참조. 본 plan은 build에 `tsc`를 직접 사용하므로 nest CLI는 의존하지 않지만, IDE 인식 / 향후 확장 위해 표준 위치에 둔다.

- [ ] **Step 5: pnpm install**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm install
```

Expected: workspace 인식 + 의존성 설치 성공. `db-bootstrap`은 Plan 04c가 만들었어야 함 — 미완료면 install 실패 → 09 시리즈 회귀 점검.

- [ ] **Step 6: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add simulations/enterprise-pm/services/auth-api/package.json \
          simulations/enterprise-pm/services/auth-api/tsconfig.json \
          simulations/enterprise-pm/services/auth-api/nest-cli.json \
          pnpm-lock.yaml && \
  git commit -m "$(cat <<'EOF'
feat(sim-auth-api): NestJS 서비스 스캐폴딩 — package + tsconfig + nest-cli

ES2023 + decorators + NodeNext module resolution.
@qa-sdk/{core,logger,otel} + db-bootstrap workspace dep.
포트는 SERVICE_PORTS sim-auth-api 파생.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: auth-api — config/env + lib/logger

**Files:**
- Create: `simulations/enterprise-pm/services/auth-api/src/config/env.ts`
- Create: `simulations/enterprise-pm/services/auth-api/src/config/env.test.ts`
- Create: `simulations/enterprise-pm/services/auth-api/src/lib/logger.ts`

- [ ] **Step 1: env.ts 작성**

`simulations/enterprise-pm/services/auth-api/src/config/env.ts`:

```ts
// @def.boundary sim-auth-api
// @def.doc sim-erp-pm-design

import { z } from "zod";
import { getRequiredServicePort } from "@qa-sdk/core";
import { dbEnvSchema } from "db-bootstrap";

const DEFAULT_PORT = getRequiredServicePort("sim-auth-api");

export const envSchema = dbEnvSchema.extend({
  PORT: z.coerce.number().int().default(DEFAULT_PORT),
  CORS_ORIGIN: z.string().default("*"),
  /** OTel collector endpoint — undefined면 OTEL_ENABLED=false 효과 */
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().optional(),
  OTEL_ENABLED: z
    .preprocess((v) => v ?? "true", z.enum(["true", "false"]).transform((v) => v === "true")),
  /** ingest-server 엔드포인트 — set되면 IngestForwarder 활성화 */
  QA_INGEST_URL: z.string().optional(),
  /** Redis pub/sub — Plan 12b가 사용. 본 plan에서는 read-only 노출. */
  SIM_REDIS_URL: z.string().default("redis://localhost:6379"),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: NodeJS.ProcessEnv = process.env): Env {
  return envSchema.parse(source);
}

export const env = parseEnv();
```

**중요**: `dbEnvSchema`는 Plan 04c db-bootstrap에서 export. `QA_DB_DIALECT`, `QA_PG_*`, `QA_SQLITE_PATH` 필드를 가짐. 본 plan에서는 schema만 합성, 실제 connection은 Plan 11a가 호출.

- [ ] **Step 2: env.test.ts 작성**

`simulations/enterprise-pm/services/auth-api/src/config/env.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseEnv } from "./env.js";

describe("sim-auth-api env", () => {
  it("PORT는 SERVICE_PORTS sim-auth-api 기본값(4400)을 파생", () => {
    const env = parseEnv({});
    expect(env.PORT).toBe(4400);
  });

  it("PORT 환경변수가 우선", () => {
    const env = parseEnv({ PORT: "5000" });
    expect(env.PORT).toBe(5000);
  });

  it("OTEL_ENABLED 기본값은 true", () => {
    const env = parseEnv({});
    expect(env.OTEL_ENABLED).toBe(true);
  });

  it("OTEL_ENABLED=false도 허용", () => {
    const env = parseEnv({ OTEL_ENABLED: "false" });
    expect(env.OTEL_ENABLED).toBe(false);
  });

  it("QA_INGEST_URL은 optional", () => {
    const env = parseEnv({});
    expect(env.QA_INGEST_URL).toBeUndefined();
  });

  it("QA_DB_DIALECT 기본값은 sqlite (db-bootstrap)", () => {
    const env = parseEnv({});
    expect(env.QA_DB_DIALECT).toBe("sqlite");
  });
});
```

- [ ] **Step 3: lib/logger.ts 작성**

`simulations/enterprise-pm/services/auth-api/src/lib/logger.ts`:

```ts
// @def.boundary sim-auth-api
// @def.doc sim-erp-pm-design

import { createLogger as _createLogger, type Logger } from "@qa-sdk/core";
import { createIngestForwarder } from "@qa-sdk/logger";
import { env } from "../config/env.js";

/**
 * 시뮬 auth-api 전용 logger — IngestForwarder를 옵션 부착.
 *
 * - QA_INGEST_URL set → IngestForwarder 활성화 → ingest-server(3200)로 forward
 * - 미set → 표준 pino logger만
 *
 * 모든 도메인 모듈은 createLogger("sim-auth-api.<sub>")로 sub-namespace 사용.
 */
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

- [ ] **Step 4: typecheck + 단위 테스트**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter @qa-sdk/sim-auth-api typecheck && pnpm --filter @qa-sdk/sim-auth-api test
```

Expected: typecheck 0 error, env.test 6 PASS.

- [ ] **Step 5: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add simulations/enterprise-pm/services/auth-api/src/config simulations/enterprise-pm/services/auth-api/src/lib && \
  git commit -m "$(cat <<'EOF'
feat(sim-auth-api): env schema + logger 부착

dbEnvSchema(Plan 04c) extend로 QA_DB_DIALECT/PG/SQLITE 흡수.
PORT는 SERVICE_PORTS sim-auth-api 파생 (하드코딩 금지).
QA_INGEST_URL set 시 IngestForwarder 자동 활성화.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: auth-api — health 모듈

**Files:**
- Create: `simulations/enterprise-pm/services/auth-api/src/health/health.module.ts`
- Create: `simulations/enterprise-pm/services/auth-api/src/health/health.controller.ts`
- Create: `simulations/enterprise-pm/services/auth-api/src/health/health.controller.test.ts`

- [ ] **Step 1: health.controller.ts 작성**

`simulations/enterprise-pm/services/auth-api/src/health/health.controller.ts`:

```ts
// @def.boundary sim-auth-api
// @def.doc sim-erp-pm-design

import { Controller, Get } from "@nestjs/common";

const SERVICE_NAME = "sim-auth-api";
const OWNED_PREFIXES = ["sim.user", "sim.role", "sim.dept", "sim.bitmap"] as const;

@Controller()
export class HealthController {
  @Get("health")
  health() {
    return {
      status: "ok",
      service: SERVICE_NAME,
      ownedPrefixes: OWNED_PREFIXES,
      ts: new Date().toISOString(),
    };
  }
}
```

**ownedPrefixes**는 `sim-erp-pm-design.md` §2 그대로. 본 plan에서 string array로 우선 노출, Plan 11a가 prefix_ref 메타를 등록할 때 동일 목록을 사용해 SSOT 일관성 검증.

- [ ] **Step 2: health.module.ts 작성**

`simulations/enterprise-pm/services/auth-api/src/health/health.module.ts`:

```ts
// @def.boundary sim-auth-api
// @def.doc sim-erp-pm-design

import { Module } from "@nestjs/common";
import { HealthController } from "./health.controller.js";

@Module({
  controllers: [HealthController],
})
export class HealthModule {}
```

- [ ] **Step 3: health.controller.test.ts 작성**

`simulations/enterprise-pm/services/auth-api/src/health/health.controller.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { HealthController } from "./health.controller.js";

describe("sim-auth-api HealthController", () => {
  it("status=ok + service=sim-auth-api 반환", () => {
    const ctl = new HealthController();
    const res = ctl.health();
    expect(res.status).toBe("ok");
    expect(res.service).toBe("sim-auth-api");
  });

  it("ownedPrefixes는 design.md §2 (sim.user/role/dept/bitmap)", () => {
    const ctl = new HealthController();
    const res = ctl.health();
    expect(res.ownedPrefixes).toEqual(["sim.user", "sim.role", "sim.dept", "sim.bitmap"]);
  });

  it("ts는 ISO-8601 문자열", () => {
    const ctl = new HealthController();
    const res = ctl.health();
    expect(res.ts).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
```

- [ ] **Step 4: 테스트**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter @qa-sdk/sim-auth-api test
```

Expected: env (6) + health (3) = 9 PASS.

- [ ] **Step 5: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add simulations/enterprise-pm/services/auth-api/src/health && \
  git commit -m "$(cat <<'EOF'
feat(sim-auth-api): HealthModule + /health 엔드포인트

ownedPrefixes(sim.user/role/dept/bitmap) 노출.
Plan 11a가 prefix_ref 메타 등록 시 동일 목록을 SSOT로 활용.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: auth-api — app.module + main 부팅

**Files:**
- Create: `simulations/enterprise-pm/services/auth-api/src/app.module.ts`
- Create: `simulations/enterprise-pm/services/auth-api/src/main.ts`

- [ ] **Step 1: app.module.ts 작성**

`simulations/enterprise-pm/services/auth-api/src/app.module.ts`:

```ts
// @def.boundary sim-auth-api
// @def.doc sim-erp-pm-design

import { Module } from "@nestjs/common";
import { HealthModule } from "./health/health.module.js";

@Module({
  imports: [HealthModule],
})
export class AppModule {}
```

도메인 모듈(UserModule / RoleModule / DepartmentModule / BitmapIssuerModule)은 Plan 11a Task 5에서 imports 배열에 추가.

- [ ] **Step 2: main.ts 작성**

`simulations/enterprise-pm/services/auth-api/src/main.ts`:

```ts
// @def.boundary sim-auth-api
// @def.doc sim-erp-pm-design

import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { warnPortConflict } from "@qa-sdk/core";
import { initTelemetry, otelEnvSchema } from "@qa-sdk/otel";
import { createLogger } from "./lib/logger.js";
import { AppModule } from "./app.module.js";
import { env } from "./config/env.js";

const SERVICE_NAME = "sim-auth-api";
const logger = createLogger(SERVICE_NAME);

async function bootstrap() {
  // 1. OTel 부팅 (NestFactory 이전 — HttpInstrumentation이 모든 라우트 포착)
  const otelShutdown = initTelemetry({
    serviceName: SERVICE_NAME,
    env: otelEnvSchema.parse(process.env),
  });

  // 2. NestJS Fastify 부팅
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
    { logger: false }, // pino logger를 직접 사용, NestJS 기본 로거 비활성화
  );
  app.enableCors({ origin: env.CORS_ORIGIN });

  await app.listen({ port: env.PORT, host: "0.0.0.0" });
  logger.info(
    { port: env.PORT, dialect: env.QA_DB_DIALECT, ingestUrl: env.QA_INGEST_URL ?? null },
    `${SERVICE_NAME} listening`,
  );
  warnPortConflict(SERVICE_NAME, env.PORT, logger);

  // 3. graceful shutdown — OTel SDK도 함께 닫음
  const shutdown = async (signal: string) => {
    logger.info({ signal }, `${SERVICE_NAME} shutting down`);
    await app.close();
    await otelShutdown();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

bootstrap().catch((err) => {
  logger.error({ err }, `${SERVICE_NAME} 시작 실패`);
  process.exit(1);
});
```

**핵심 순서**: `initTelemetry`가 `NestFactory.create`보다 먼저. `@qa-sdk/otel`의 `HttpInstrumentation`이 NestJS의 Fastify HTTP 핸들러를 자동 패치하려면 모듈 import 시점 이전 부팅 필요.

- [ ] **Step 3: typecheck + build**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter @qa-sdk/sim-auth-api typecheck && pnpm --filter @qa-sdk/sim-auth-api build
```

Expected: 에러 없음, `dist/main.js` 생성.

- [ ] **Step 4: 부팅 smoke 테스트 (수동)**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter @qa-sdk/sim-auth-api start &
SERVER_PID=$!
sleep 3
curl -fsS http://localhost:4400/health
kill $SERVER_PID 2>/dev/null || true
```

Expected: JSON `{ "status": "ok", "service": "sim-auth-api", "ownedPrefixes": [...], "ts": "..." }`. 실패 시:
- 포트 점유: Task 0 Step 3 재확인
- module resolution 실패: tsconfig `module: NodeNext` 설정 점검
- OTel init 실패 (no endpoint): `OTEL_ENABLED=false`로 fallback. main.ts는 어차피 OTEL_ENABLED=false면 no-op 반환하므로 부팅은 성공해야 함.

- [ ] **Step 5: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add simulations/enterprise-pm/services/auth-api/src/app.module.ts \
          simulations/enterprise-pm/services/auth-api/src/main.ts && \
  git commit -m "$(cat <<'EOF'
feat(sim-auth-api): main 부팅 — initTelemetry → NestFactory → listen

OTel을 NestFactory 이전에 부팅 (HttpInstrumentation이 모든 라우트 포착).
SIGINT/SIGTERM 시 NestJS app.close + OTel shutdown.
SERVICE_PORTS 충돌 detect → warnPortConflict.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: auth-api — Dockerfile + .dockerignore

**Files:**
- Create: `simulations/enterprise-pm/services/auth-api/Dockerfile`
- Create: `simulations/enterprise-pm/services/auth-api/.dockerignore`

- [ ] **Step 1: Dockerfile 작성 (Plan 09c Dockerfile.service wrapper)**

`simulations/enterprise-pm/services/auth-api/Dockerfile`:

```dockerfile
# 시뮬 sim-auth-api — Plan 09c의 monorepo Dockerfile.service에 빌드 인자 전달
# 본 wrapper는 docker-compose.sim.yaml이 build context를 service-specific으로 지정할 때 사용한다.
ARG SERVICE_PATH=simulations/enterprise-pm/services/auth-api
ARG SERVICE_PACKAGE=@qa-sdk/sim-auth-api

FROM qa-sdk/sim-base:latest AS final
ARG SERVICE_PATH
ARG SERVICE_PACKAGE
ENV SIM_SERVICE_PATH=${SERVICE_PATH}
ENV SIM_SERVICE_PACKAGE=${SERVICE_PACKAGE}
WORKDIR /app/${SERVICE_PATH}
EXPOSE 4400
CMD ["node", "dist/main.js"]
```

**의존**: Plan 09c가 `qa-sdk/sim-base:latest` 이미지를 정의 (multi-stage pnpm install + 전체 monorepo build). 본 wrapper는 이미 빌드된 이미지에서 service-specific WORKDIR + CMD만 지정. 09c의 `Dockerfile.service`가 본 패턴을 docker-compose `build.target`로 지원하지 않을 경우 09c 갱신 필요 — defer 표 참조.

- [ ] **Step 2: .dockerignore 작성**

`simulations/enterprise-pm/services/auth-api/.dockerignore`:

```
node_modules
dist
.env*
*.test.ts
*.test.js
coverage
.vscode
.idea
```

- [ ] **Step 3: docker build smoke (선택 — Plan 09c 의존)**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  docker build -t qa-sdk/sim-auth-api:test \
    --build-arg SERVICE_PATH=simulations/enterprise-pm/services/auth-api \
    --build-arg SERVICE_PACKAGE=@qa-sdk/sim-auth-api \
    -f simulations/enterprise-pm/services/auth-api/Dockerfile . 2>&1 | tail -10
```

Expected: 성공. `qa-sdk/sim-base:latest` 미존재 시 Plan 09c 미완료 → 본 step skip + Defer 등록.

- [ ] **Step 4: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add simulations/enterprise-pm/services/auth-api/Dockerfile \
          simulations/enterprise-pm/services/auth-api/.dockerignore && \
  git commit -m "$(cat <<'EOF'
feat(sim-auth-api): Dockerfile wrapper + .dockerignore

Plan 09c sim-base 이미지에 SERVICE_PATH/PACKAGE 전달.
docker-compose.sim.yaml이 build target으로 본 wrapper 호출.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: pm-api — auth-api 패턴 복제

`auth-api`와 동일 14 파일을 `pm-api`로 생성. 차이만 명시.

- [ ] **Step 1: 디렉토리 + 파일 복제**

```bash
cp -r /Users/junwoobang/workflow/qa-sdk/simulations/enterprise-pm/services/auth-api \
      /Users/junwoobang/workflow/qa-sdk/simulations/enterprise-pm/services/pm-api
```

- [ ] **Step 2: package.json 차이 적용**

`simulations/enterprise-pm/services/pm-api/package.json`:
- `name`: `@qa-sdk/sim-pm-api`
- `description`: `시뮬 — Project/Task/ProjectMember NestJS 서비스`

- [ ] **Step 3: env.ts — 서비스 키 + 포트 차이**

```ts
const DEFAULT_PORT = getRequiredServicePort("sim-pm-api"); // 4500
```

- [ ] **Step 4: env.test.ts — 기본값 4500**

```ts
expect(env.PORT).toBe(4500);
```

- [ ] **Step 5: health.controller.ts — ownedPrefixes 차이**

```ts
const SERVICE_NAME = "sim-pm-api";
const OWNED_PREFIXES = ["sim.project", "sim.task", "sim.member"] as const;
```

- [ ] **Step 6: health.controller.test.ts — ownedPrefixes 검증 갱신**

```ts
expect(res.ownedPrefixes).toEqual(["sim.project", "sim.task", "sim.member"]);
```

- [ ] **Step 7: main.ts — SERVICE_NAME 차이**

```ts
const SERVICE_NAME = "sim-pm-api";
```

- [ ] **Step 8: Dockerfile — SERVICE_PATH/PACKAGE + EXPOSE 4500**

```dockerfile
ARG SERVICE_PATH=simulations/enterprise-pm/services/pm-api
ARG SERVICE_PACKAGE=@qa-sdk/sim-pm-api
EXPOSE 4500
```

- [ ] **Step 9: 모든 파일 내 `sim-auth-api` → `sim-pm-api` 일괄 치환 검증**

```bash
cd /Users/junwoobang/workflow/qa-sdk/simulations/enterprise-pm/services/pm-api && \
  grep -r "sim-auth-api\|auth-api" src/ --include="*.ts" 2>&1
```

Expected: empty. hit이 있으면 누락 — 위 step에서 변경 추가.

- [ ] **Step 10: typecheck + test + 부팅 smoke**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter @qa-sdk/sim-pm-api typecheck && \
  pnpm --filter @qa-sdk/sim-pm-api test && \
  pnpm --filter @qa-sdk/sim-pm-api build && \
  pnpm --filter @qa-sdk/sim-pm-api start &
SERVER_PID=$!
sleep 3
curl -fsS http://localhost:4500/health
kill $SERVER_PID 2>/dev/null || true
```

Expected: typecheck 0, test 9 PASS, /health JSON.

- [ ] **Step 11: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add simulations/enterprise-pm/services/pm-api && \
  git commit -m "$(cat <<'EOF'
feat(sim-pm-api): NestJS 서비스 스캐폴딩 (포트 4500)

auth-api 패턴 복제. ownedPrefixes=sim.project/task/member.
도메인 모듈은 Plan 11b에서 부착.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: approval-api — auth-api 패턴 복제

Task 6과 동일 절차, 차이만 명시.

- [ ] **Step 1: 디렉토리 복제**

```bash
cp -r /Users/junwoobang/workflow/qa-sdk/simulations/enterprise-pm/services/auth-api \
      /Users/junwoobang/workflow/qa-sdk/simulations/enterprise-pm/services/approval-api
```

- [ ] **Step 2: package.json**
- `name`: `@qa-sdk/sim-approval-api`
- `description`: `시뮬 — Budget/Resource/Time-off/Expense workflow NestJS 서비스`

- [ ] **Step 3: env.ts — `getRequiredServicePort("sim-approval-api")` (4600)**

- [ ] **Step 4: env.test.ts — `expect(env.PORT).toBe(4600)`**

- [ ] **Step 5: health.controller.ts**

```ts
const SERVICE_NAME = "sim-approval-api";
const OWNED_PREFIXES = ["sim.budget", "sim.resource", "sim.timeoff", "sim.expense"] as const;
```

- [ ] **Step 6: health.controller.test.ts — ownedPrefixes 검증 갱신**

- [ ] **Step 7: main.ts — `SERVICE_NAME = "sim-approval-api"`**

- [ ] **Step 8: Dockerfile — `SERVICE_PATH=simulations/enterprise-pm/services/approval-api`, `EXPOSE 4600`**

- [ ] **Step 9: `sim-auth-api`/`auth-api` 잔여 치환 검증**

```bash
cd /Users/junwoobang/workflow/qa-sdk/simulations/enterprise-pm/services/approval-api && \
  grep -r "sim-auth-api\|auth-api" src/ --include="*.ts" 2>&1
```

Expected: empty.

- [ ] **Step 10: typecheck + test + 부팅 smoke (포트 4600)**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter @qa-sdk/sim-approval-api typecheck && \
  pnpm --filter @qa-sdk/sim-approval-api test && \
  pnpm --filter @qa-sdk/sim-approval-api build && \
  pnpm --filter @qa-sdk/sim-approval-api start &
SERVER_PID=$!
sleep 3
curl -fsS http://localhost:4600/health
kill $SERVER_PID 2>/dev/null || true
```

Expected: typecheck 0, test 9 PASS, /health JSON.

- [ ] **Step 11: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add simulations/enterprise-pm/services/approval-api && \
  git commit -m "$(cat <<'EOF'
feat(sim-approval-api): NestJS 서비스 스캐폴딩 (포트 4600)

auth-api 패턴 복제. ownedPrefixes=sim.budget/resource/timeoff/expense.
state machine은 Plan 11b에서 부착.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: 통합 회귀 — 3 서비스 동시 부팅

- [ ] **Step 1: 3 서비스 동시 부팅 + /health probe**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter @qa-sdk/sim-auth-api start &
PID1=$!
pnpm --filter @qa-sdk/sim-pm-api start &
PID2=$!
pnpm --filter @qa-sdk/sim-approval-api start &
PID3=$!
sleep 5
echo "auth-api:"; curl -fsS http://localhost:4400/health; echo
echo "pm-api:";   curl -fsS http://localhost:4500/health; echo
echo "approval-api:"; curl -fsS http://localhost:4600/health; echo
kill $PID1 $PID2 $PID3 2>/dev/null || true
```

Expected: 3 JSON 응답, 각각의 ownedPrefixes가 design.md §2와 일치.

- [ ] **Step 2: workflow-smoke 회귀**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter @qa-sdk/cli test 2>&1 | tail -5
```

Expected: 12+ smoke PASS (본 plan은 CLI 영향 없음).

- [ ] **Step 3: def gate 회귀 (스펙 변경 없음)**

```bash
cd /Users/junwoobang/workflow/qa-sdk && node packages/cli/dist/index.js def validate 2>&1 | head -5
```

Expected: errors 0 유지.

---

## Self-Review

- [ ] 3 서비스 모두 NestJS 11 + @nestjs/platform-fastify 사용
- [ ] main.ts 부팅 순서: initTelemetry → NestFactory → listen → SIGINT/TERM 핸들러
- [ ] 각 서비스의 PORT는 SERVICE_PORTS SSOT 파생 (하드코딩 0)
- [ ] ownedPrefixes는 design.md §2와 1:1 매치
- [ ] createLogger가 QA_INGEST_URL set 시 IngestForwarder 활성화
- [ ] env.ts는 `dbEnvSchema.extend(...)`로 db-bootstrap 환경 변수 흡수
- [ ] 단위 테스트 9건 × 3 서비스 = 27 PASS
- [ ] 3 서비스 동시 부팅 → 3 /health 200
- [ ] Dockerfile은 Plan 09c sim-base 이미지에 인자 전달 (재사용)
- [ ] console.log 0건 (CLAUDE.md 로깅 컨벤션)

---

## Defer (본 plan 범위 외)

| 작업 | 이유 | 후속 plan |
|---|---|---|
| 도메인 모듈 (User/Project/Budget 등) 부착 | 본 plan은 부팅만 | Plan 11a / 11b |
| db-bootstrap connection 호출 + Drizzle DB 인스턴스 생성 | DB 의존은 도메인 모듈과 함께 | Plan 11a / 11b |
| Docker 이미지 빌드 + push to local registry | docker-compose.sim.yaml에서 build 수행 | Plan 09c (이미 정의) |
| JWT 검증 미들웨어 | gateway 흐름과 함께 | Plan 12a |
| Redis pub/sub bitmap invalidation | 별도 cross-service 통합 | Plan 12b |
| OTEL traceparent 전파 검증 | 다중 서비스 호출 사슬 필요 | Plan 12c |
| 09c sim-base Dockerfile에 본 wrapper 호환 인자 추가 | 09c가 SERVICE_PATH ARG 패턴을 채택하지 않으면 별도 PR | Plan 09c 갱신 |

---

## 의존·후속

- **Plan 09a/b/c/d** (인프라 부트스트랩): 본 plan의 전제. 미완료 시 시작 금지.
- **Plan 04c** (db-bootstrap): env schema import 의존. 미완료 시 typecheck 실패.
- **Plan 10b** (지원 서비스 스캐폴딩): 본 plan과 병렬. 동일 패턴 4 서비스 추가.
- **Plan 10c** (Edge 서비스): 본 plan과 병렬. Hono gateway + Prometheus exporter.
- **Plan 11a** (auth domain): 본 plan의 auth-api 위에 도메인 모듈 부착.
- **Plan 11b** (pm + approval domain): 본 plan의 pm-api / approval-api 위에 부착.
- **Plan 12a** (gateway 라우팅): 본 plan의 3 서비스로 라우트.
