## 단계 9: sim-canary-controller 신규 NestJS 서비스 (Pass 1 + Pass 2 + 30s 사이클)

**Spec 참조:** `01-decision-model.md` 전체

본 단계는 enterprise-pm 시뮬에 카나리/스케일링 control-plane을 단일 NestJS 서비스로 도입한다. 30초 주기로 metrics scrape → 카테고리 verdict 산출 → Pass 1 (Safety) 결정 → 조건부 Pass 2 (Resource) 결정 → action 실행(gateway routing push, docker compose --scale) 흐름을 구현한다. 결정 객체는 Plan A grammar #7/#8/#14/#15(`decision-id`, `cycle-id`, `decision-category`, `decision-signal`)로 합성되어 audit-recorder에 멱등 적재되며, controller는 PG advisory lock으로 active/standby 단일성을 보장한다. spec 01 §3/§4 의사 코드를 그대로 코드화하고 §2 임계 표를 yaml로 외화한다.

### File Structure (단계 9)

| 종류 | 경로 |
|---|---|
| Create | `simulations/enterprise-pm/services/canary-controller/package.json` |
| Create | `simulations/enterprise-pm/services/canary-controller/tsconfig.json` |
| Create | `simulations/enterprise-pm/services/canary-controller/nest-cli.json` |
| Create | `simulations/enterprise-pm/services/canary-controller/vitest.config.ts` |
| Create | `simulations/enterprise-pm/services/canary-controller/Dockerfile` |
| Create | `simulations/enterprise-pm/services/canary-controller/controller-config.yaml` |
| Create | `simulations/enterprise-pm/services/canary-controller/src/main.ts` |
| Create | `simulations/enterprise-pm/services/canary-controller/src/app.module.ts` |
| Create | `simulations/enterprise-pm/services/canary-controller/src/config/env.ts` |
| Create | `simulations/enterprise-pm/services/canary-controller/src/lib/logger.ts` |
| Create | `simulations/enterprise-pm/services/canary-controller/src/health/{health.module.ts,health.controller.ts}` |
| Create | `simulations/enterprise-pm/services/canary-controller/src/lock/{advisory-lock.service.ts,advisory-lock.module.ts,advisory-lock.test.ts}` |
| Create | `simulations/enterprise-pm/services/canary-controller/src/metrics/{metrics-scrape.service.ts,metrics-scrape.module.ts,metrics-scrape.test.ts}` |
| Create | `simulations/enterprise-pm/services/canary-controller/src/verdict/{category-verdict.service.ts,category-verdict.test.ts}` |
| Create | `simulations/enterprise-pm/services/canary-controller/src/decision/{safety-decision.service.ts,safety-decision.test.ts,resource-decision.service.ts,resource-decision.test.ts,decision-builder.service.ts,decision-builder.test.ts,decision.module.ts}` |
| Create | `simulations/enterprise-pm/services/canary-controller/src/action/{action-executor.service.ts,action-executor.test.ts,action.module.ts}` |
| Create | `simulations/enterprise-pm/services/canary-controller/src/cycle/{cycle-scheduler.service.ts,cycle.module.ts}` |
| Create | `simulations/enterprise-pm/services/canary-controller/src/integration/cycle-flow.test.ts` |
| Modify | `simulations/enterprise-pm/docker-compose.sim.yaml` (sim-canary-controller service entry, port 5300) |
| Modify | `simulations/enterprise-pm/scripts/sim-up.sh` (sim-canary-controller healthcheck wait) |
| Modify | `simulations/enterprise-pm/.env.sim.example` (SIM_CONTROLLER_* keys) |

### Task 9.1: 서비스 패키지 골격 (auth-api 패턴 모범)

**Files:**
- Create: `simulations/enterprise-pm/services/canary-controller/{package.json,tsconfig.json,nest-cli.json,vitest.config.ts}`
- Create: `simulations/enterprise-pm/services/canary-controller/src/{main.ts,app.module.ts,config/env.ts,lib/logger.ts,health/health.module.ts,health/health.controller.ts}`

sim-auth-api 구조 그대로(NestJS 11 + Fastify, pino, OTel bootstrap, graceful shutdown).

- [ ] **Step 9.1.1: package.json (auth-api `package.json` 의존 매트릭스 + 본 service 추가분 — `@nestjs/schedule`, `sim-identifier-grammar`, `ulid`, `yaml`)**

```json
{
  "name": "@qa-sdk/sim-canary-controller",
  "version": "0.1.0", "private": true, "type": "module", "main": "dist/main.js",
  "scripts": { "dev": "tsx watch src/main.ts", "build": "tsc", "start": "node dist/main.js",
    "typecheck": "tsc --noEmit", "test": "vitest run", "clean": "rm -rf dist" },
  "dependencies": {
    "@nestjs/common": "^11.0.0", "@nestjs/core": "^11.0.0", "@nestjs/platform-fastify": "^11.0.0",
    "@nestjs/schedule": "^4.1.0", "@qa-sdk/core": "workspace:*", "@qa-sdk/logger": "workspace:*",
    "@qa-sdk/otel": "workspace:*", "db-bootstrap": "workspace:*", "drizzle-orm": "catalog:",
    "reflect-metadata": "^0.2.2", "rxjs": "^7.8.1", "sim-identifier-grammar": "workspace:*",
    "ulid": "^2.3.0", "yaml": "^2.5.0", "zod": "^3.24.2"
  },
  "peerDependencies": { "postgres": "^3.4.0" },
  "devDependencies": { "@nestjs/testing": "^11.0.0", "@types/node": "^22.0.0",
    "postgres": "^3.4.0", "tsx": "^4.19.3", "typescript": "^5.8.2", "vitest": "^1.6.1" }
}
```

- [ ] **Step 9.1.2: tsconfig.json / nest-cli.json / vitest.config.ts** — auth-api와 동형 (tsconfig는 ES2023 target, NodeNext, `experimentalDecorators`/`emitDecoratorMetadata`; nest-cli는 `{ "collection": "@nestjs/schematics", "sourceRoot": "src" }`; vitest는 Node env + `src/**/*.test.ts`).

- [ ] **Step 9.1.3: config/env.ts — Zod 스키마 (process.env 직접 접근 금지)**

```typescript
import { z } from "zod";
const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(5300),
  CORS_ORIGIN: z.string().default("*"),
  SIM_LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  SIM_CONTROLLER_CYCLE_MS: z.coerce.number().int().positive().default(30_000),
  SIM_CONTROLLER_ID: z.string().regex(/^[0-9A-Z]{8}$/).default("CTRL0001"),
  SIM_CONTROLLER_CONFIG_PATH: z.string().default("./controller-config.yaml"),
  SIM_DB_WRITE_URL: z.string().url(),
  SIM_METRICS_COLLECTOR_URL: z.string().url(), QA_INGEST_URL: z.string().url(),
  SIM_AUDIT_RECORDER_URL: z.string().url(), SIM_GATEWAY_ADMIN_URL: z.string().url(),
  SIM_COMPOSE_PROJECT: z.string().default("enterprise-pm"),
  SIM_LOAD_RPS_THRESHOLD: z.coerce.number().positive().default(100),
  SIM_CPU_HIGH_PCT: z.coerce.number().min(0).max(100).default(80),
  SIM_DB_POOL_HIGH_PCT: z.coerce.number().min(0).max(100).default(80),
  SIM_SCALE_COOLDOWN_UP_MS: z.coerce.number().int().positive().default(60_000),
  SIM_SCALE_COOLDOWN_DOWN_MS: z.coerce.number().int().positive().default(180_000),
});
export const env = envSchema.parse(process.env);
export type ControllerEnv = z.infer<typeof envSchema>;
```

- [ ] **Step 9.1.4: lib/logger.ts**: `import { createLogger as base } from "@qa-sdk/logger"; export const createLogger = (n: string) => base(n, { level: env.SIM_LOG_LEVEL });`

- [ ] **Step 9.1.5: health module + controller** — auth-api와 동일 구조 (`@Get("/health")` → `{ status: "ok", service: "sim-canary-controller" }`).

- [ ] **Step 9.1.6: app.module.ts (이후 Task 9.5+에서 채워질 모듈 import)**

```typescript
import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { HealthModule } from "./health/health.module.js";
import { AdvisoryLockModule } from "./lock/advisory-lock.module.js";
import { MetricsScrapeModule } from "./metrics/metrics-scrape.module.js";
import { DecisionModule } from "./decision/decision.module.js";
import { ActionModule } from "./action/action.module.js";
import { CycleModule } from "./cycle/cycle.module.js";

@Module({
  imports: [ScheduleModule.forRoot(), HealthModule, AdvisoryLockModule,
    MetricsScrapeModule, DecisionModule, ActionModule, CycleModule],
})
export class AppModule {}
```

- [ ] **Step 9.1.7: main.ts (sim-auth-api와 1:1 동형)**

```typescript
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { warnPortConflict } from "@qa-sdk/core";
import { initTelemetry, otelEnvSchema } from "@qa-sdk/otel";
import { createLogger } from "./lib/logger.js";
import { AppModule } from "./app.module.js";
import { env } from "./config/env.js";

const SERVICE_NAME = "sim-canary-controller";
const logger = createLogger(SERVICE_NAME);

async function bootstrap() {
  const otelShutdown = initTelemetry({ serviceName: SERVICE_NAME, env: otelEnvSchema.parse(process.env) });
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), { logger: false });
  app.enableCors({ origin: env.CORS_ORIGIN });
  await app.listen({ port: env.PORT, host: "0.0.0.0" });
  logger.info({ port: env.PORT, controllerId: env.SIM_CONTROLLER_ID, cycleMs: env.SIM_CONTROLLER_CYCLE_MS }, `${SERVICE_NAME} listening`);
  warnPortConflict(SERVICE_NAME, env.PORT, logger);

  const shutdown = async (signal: string) => {
    logger.info({ signal }, `${SERVICE_NAME} shutting down`);
    await app.close(); await otelShutdown(); process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}
bootstrap().catch((err) => { logger.error({ err }, `${SERVICE_NAME} 시작 실패`); process.exit(1); });
```

- [ ] **Step 9.1.8: Commit**

```bash
git add simulations/enterprise-pm/services/canary-controller/
pnpm install && pnpm --filter @qa-sdk/sim-canary-controller build
git commit -m "feat(sim-canary-controller): NestJS service skeleton (Fastify + OTel + health)"
```

### Task 9.2: Dockerfile (Plan A Task 1.1 패턴)

**Files:**
- Create: `simulations/enterprise-pm/services/canary-controller/Dockerfile`

sim-base 멀티스테이지 wrapper 패턴(auth-api와 동일). 빌드는 monorepo root context.

```dockerfile
ARG SERVICE_PATH=simulations/enterprise-pm/services/canary-controller
ARG SERVICE_PACKAGE=@qa-sdk/sim-canary-controller
FROM qa-sdk/sim-base:latest AS final
ARG SERVICE_PATH
ARG SERVICE_PACKAGE
ENV SIM_SERVICE_PATH=${SERVICE_PATH}
ENV SIM_SERVICE_PACKAGE=${SERVICE_PACKAGE}
WORKDIR /app/${SERVICE_PATH}
EXPOSE 5300
CMD ["node", "dist/main.js"]
```

Commit: `feat(sim-canary-controller): Dockerfile (sim-base wrapper, port 5300)`

### Task 9.3: docker-compose service entry (port 5300)

**Files:**
- Modify: `simulations/enterprise-pm/docker-compose.sim.yaml`
- Modify: `simulations/enterprise-pm/.env.sim.example`

`docker-compose.sim.yaml` services 블록 끝에 추가:

```yaml
  sim-canary-controller:
    image: qa-sdk/sim-canary-controller:latest
    build: { context: ../.., dockerfile: simulations/enterprise-pm/services/canary-controller/Dockerfile }
    environment:
      PORT: 5300
      SIM_LOG_LEVEL: info
      SIM_CONTROLLER_ID: ${SIM_CONTROLLER_ID:-CTRL0001}
      SIM_CONTROLLER_CYCLE_MS: ${SIM_CONTROLLER_CYCLE_MS:-30000}
      SIM_CONTROLLER_CONFIG_PATH: /app/simulations/enterprise-pm/services/canary-controller/controller-config.yaml
      SIM_DB_WRITE_URL: ${SIM_DB_WRITE_URL}
      SIM_METRICS_COLLECTOR_URL: http://sim-metrics-collector:9000
      QA_INGEST_URL: http://qa-sdk-ingest:3200
      SIM_AUDIT_RECORDER_URL: http://sim-audit-browser-api:4700
      SIM_GATEWAY_ADMIN_URL: http://sim-gateway:4100
    ports: ["5300:5300"]
    depends_on:
      qa-sdk-db: { condition: service_healthy }
      qa-sdk-ingest: { condition: service_healthy }
      sim-gateway: { condition: service_healthy }
    healthcheck:
      test: ["CMD", "wget", "-q", "-O-", "http://localhost:5300/health"]
      interval: 10s
      timeout: 3s
      retries: 5
      start_period: 20s
    restart: unless-stopped
```

`.env.sim.example`에 `SIM_CONTROLLER_ID=CTRL0001` / `SIM_CONTROLLER_CYCLE_MS=30000` 추가.

Commit: `feat(sim): add sim-canary-controller compose entry (port 5300)`

### Task 9.4: controller-config.yaml (spec 01 §2 임계 표 yaml로)

**Files:**
- Create: `simulations/enterprise-pm/services/canary-controller/controller-config.yaml`

spec 01 §2 카테고리×신호×PASS/WARN/FAIL 임계를 yaml로 직렬화. hard rule(compatibility, auditSafety)은 override 불가 — yaml 미수록(코드 const). dwellTime/window 등 정책 상수도 포함.

```yaml
# spec 01 §2 임계 매트릭스 (hard rule 제외)
perf:
  errorRate: { warn: 1.5, fail: 1.5, baselineMultiplier: true }
  p95LatencyDelta: { warn: 0.20, fail: 0.50 }
decisionQuality:
  denyRateDelta: { warn: 0.05, fail: 0.15 }
  avgConfidenceDelta: { warn: -0.05, fail: -0.15 }
replicationHealth:
  replicationLagMs: { warn: 500, fail: 2000 }
window:
  rollingCycles: 10
  failQuorum: 3
dwell:
  promotionMs: 120000
confidence:
  holdThreshold: 0.6
weightSequence: [5, 25, 50, 100]
```

Commit: `feat(sim-canary-controller): controller-config.yaml (spec 01 §2 thresholds)`

### Task 9.5: PG advisory lock 모듈 (spec 01 §6)

**Files:**
- Create: `src/lock/advisory-lock.{service,module,test}.ts`

spec 01 §6: controller 싱글톤 — `pg_try_advisory_lock(hashtextextended('sim-canary-controller', 0))`. 미획득 standby는 metrics scrape는 하되 audit write/action 실행 SKIP(read-only). `db-bootstrap` 사용하지 않고 `postgres`를 직접 가는 이유: advisory lock은 **세션 스코프**라 connection lifetime을 service가 직접 소유해야 하기 때문. NestJS lifecycle hook(`OnModuleInit`/`OnModuleDestroy`)으로 connection을 단일 보유.

- [ ] **Step 9.5.1: 실패 테스트** — 두 service 인스턴스가 같은 PG에 동시 접속 시 한쪽만 `tryAcquire()` 성공, release 후 다른 쪽 성공.

```typescript
describe("AdvisoryLockService (spec 01 §6)", () => {
  const PG = process.env.SIM_DB_WRITE_URL;
  const itPg = PG ? it : it.skip;
  itPg("only one instance acquires; release lets the other succeed", async () => {
    const a = new AdvisoryLockService({ pgUrl: PG!, lockKey: "sim-canary-controller" });
    const b = new AdvisoryLockService({ pgUrl: PG!, lockKey: "sim-canary-controller" });
    await a.onModuleInit(); await b.onModuleInit();
    const ok = await a.tryAcquire();
    expect(ok && (await b.tryAcquire())).toBe(false);
    await a.release();
    expect(await b.tryAcquire()).toBe(true);
    await b.release(); await a.onModuleDestroy(); await b.onModuleDestroy();
  });
});
```

- [ ] **Step 9.5.2: 최소 구현**

```typescript
// src/lock/advisory-lock.service.ts
import { Injectable, type OnModuleInit, type OnModuleDestroy } from "@nestjs/common";
import postgres, { type Sql } from "postgres";
import { createLogger } from "../lib/logger.js";

export interface AdvisoryLockConfig { pgUrl: string; lockKey: string }

@Injectable()
export class AdvisoryLockService implements OnModuleInit, OnModuleDestroy {
  private sql!: Sql;
  private holding = false;
  private readonly logger = createLogger("sim-canary-controller:lock");
  constructor(private readonly cfg: AdvisoryLockConfig) {}

  async onModuleInit() { this.sql = postgres(this.cfg.pgUrl, { max: 1, onnotice: () => {} }); }
  async onModuleDestroy() {
    try { if (this.holding) await this.release(); } finally { await this.sql?.end(); }
  }

  async tryAcquire(): Promise<boolean> {
    if (this.holding) return true;
    const rows = await this.sql`SELECT pg_try_advisory_lock(hashtextextended(${this.cfg.lockKey}, 0)) AS ok`;
    const ok = Boolean(rows[0]?.ok);
    if (ok) { this.holding = true; this.logger.info({ lockKey: this.cfg.lockKey }, "advisory lock acquired"); }
    return ok;
  }

  async release(): Promise<void> {
    if (!this.holding) return;
    await this.sql`SELECT pg_advisory_unlock(hashtextextended(${this.cfg.lockKey}, 0))`;
    this.holding = false;
  }

  isHolding(): boolean { return this.holding; }
}
```

`src/lock/advisory-lock.module.ts`: `useFactory: () => new AdvisoryLockService({ pgUrl: env.SIM_DB_WRITE_URL, lockKey: "sim-canary-controller" })`, exports.

Commit: `feat(sim-canary-controller): PG advisory lock for active/standby singleton (spec 01 §6)`

### Task 9.6: metrics scrape 모듈 (spec 01 §5 t=0s)

**Files:**
- Create: `src/metrics/metrics-scrape.{service,module,test}.ts`

spec 01 §5 t=0s: metrics-collector(Prometheus) / ingest insights(`/v1/insights/schema-compat`) / audit-recorder anomaly 세 source 병렬 fetch. `AbortSignal.timeout(5_000)`. fail-open — source 실패 시 weight 0.3로 낮춰 `confidence`에 반영. signal 식별자는 Plan A grammar #15 `buildDecisionSignal`로 합성하여 매트릭스 위반(예: `perf.RPS`)을 build 시점 차단.

- [ ] **Step 9.6.1: 실패 테스트** — 3 케이스: (a) 3 source 정상 → 12개 signal 모두 수집(매트릭스 전수), (b) ingest down → `sources.find(s=>s.name==="ingest").ok=false, weight=0.3`, schema-compat signal 누락이지만 다른 source signal은 정상, (c) `fetch` 호출이 모두 `signal: AbortSignal.timeout(5_000)`을 가진다.

```typescript
it("aggregates 3 sources; fails open when ingest down", async () => {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (url.includes("/metrics")) return new Response(JSON.stringify({ errorRate: 0.01, p95LatencyDelta: 0.1, RPS: 50, CPU: 30, dbPoolUtilization: 0.4 }));
    if (url.includes("schema-compat")) throw new Error("ECONNREFUSED");
    return new Response(JSON.stringify({ criticalAnomalyRate: 0, denyRateDelta: 0, avgConfidenceDelta: 0, replicationLagMs: 100, timeSinceLastReplicaChange: 999_999 }));
  }));
  const out = await new MetricsScrapeService({ metricsUrl: "http://m", ingestUrl: "http://i", auditUrl: "http://a" }).scrape();
  expect(out.sources.find((s) => s.name === "ingest")!.weight).toBe(0.3);
});
```

- [ ] **Step 9.6.2: 최소 구현**

```typescript
// src/metrics/metrics-scrape.service.ts
import { Injectable } from "@nestjs/common";
import { buildDecisionSignal, ALL_SIGNAL_PAIRS } from "sim-identifier-grammar";
import { createLogger } from "../lib/logger.js";

export interface ScrapeConfig { metricsUrl: string; ingestUrl: string; auditUrl: string }
export interface SignalSample { value: number; sourceName: string }
export interface SourceStatus { name: "metrics" | "ingest" | "audit"; ok: boolean; weight: number }
export interface ScrapeResult { scrapedAt: string; signals: Record<string, SignalSample>; sources: SourceStatus[] }

// 카테고리×signal → source name. spec 01 §7 측정원 표 그대로.
const SIGNAL_SOURCE: ReadonlyArray<readonly [string, string, "metrics" | "ingest" | "audit"]> = [
  ["perf", "errorRate", "metrics"], ["perf", "p95LatencyDelta", "metrics"],
  ["compatibility", "schemaCompatRate", "ingest"],
  ["decisionQuality", "denyRateDelta", "audit"], ["decisionQuality", "avgConfidenceDelta", "audit"],
  ["auditSafety", "criticalAnomalyRate", "audit"],
  ["replicationHealth", "replicationLagMs", "audit"],
  ["loadPressure", "RPS", "metrics"], ["loadPressure", "p95LatencyDelta", "metrics"],
  ["resourceHeadroom", "CPU", "metrics"], ["resourceHeadroom", "dbPoolUtilization", "metrics"],
  ["stability", "timeSinceLastReplicaChange", "audit"],
];

@Injectable()
export class MetricsScrapeService {
  private readonly logger = createLogger("sim-canary-controller:scrape");
  constructor(private readonly cfg: ScrapeConfig) {}

  async scrape(): Promise<ScrapeResult> {
    const sig = AbortSignal.timeout(5_000);
    const [m, i, a] = await Promise.allSettled([
      this.fetchJson(`${this.cfg.metricsUrl}/metrics`, sig),
      this.fetchJson(`${this.cfg.ingestUrl}/v1/insights/schema-compat`, sig),
      this.fetchJson(`${this.cfg.auditUrl}/v1/insights/anomaly`, sig),
    ]);
    const w = (s: PromiseSettledResult<unknown>) => s.status === "fulfilled" ? 1 : 0.3;
    const sources: SourceStatus[] = [
      { name: "metrics", ok: m.status === "fulfilled", weight: w(m) },
      { name: "ingest", ok: i.status === "fulfilled", weight: w(i) },
      { name: "audit", ok: a.status === "fulfilled", weight: w(a) },
    ];
    const payloads = {
      metrics: m.status === "fulfilled" ? m.value : {},
      ingest: i.status === "fulfilled" ? i.value : {},
      audit: a.status === "fulfilled" ? a.value : {},
    } as const;
    const signals: Record<string, SignalSample> = {};
    for (const [c, s, src] of SIGNAL_SOURCE) {
      try {
        const id = buildDecisionSignal({ category: c as never, signal: s as never });
        const v = (payloads[src] as Record<string, unknown>)[s];
        if (typeof v === "number") signals[id] = { value: v, sourceName: src };
      } catch (err) { this.logger.warn({ err, c, s }, "decision signal grammar reject"); }
    }
    for (const [c, s] of ALL_SIGNAL_PAIRS) if (!SIGNAL_SOURCE.some(([cc, ss]) => cc === c && ss === s))
      this.logger.warn({ c, s }, "signal missing in scrape map (spec drift)");
    return { scrapedAt: new Date().toISOString(), signals, sources };
  }

  private async fetchJson(url: string, signal: AbortSignal): Promise<Record<string, unknown>> {
    const res = await fetch(url, { signal });
    if (!res.ok) throw new Error(`scrape ${url} → HTTP ${res.status}`);
    try { return (await res.json()) as Record<string, unknown>; }
    catch (err) { throw new Error(`scrape ${url} → invalid JSON: ${(err as Error).message}`); }
  }
}
```

`src/metrics/metrics-scrape.module.ts`: `useFactory: () => new MetricsScrapeService({ metricsUrl: env.SIM_METRICS_COLLECTOR_URL, ingestUrl: env.QA_INGEST_URL, auditUrl: env.SIM_AUDIT_RECORDER_URL })`.

Commit: `feat(sim-canary-controller): metrics scrape (3 sources, fail-open, 5s timeout — spec 01 §5)`

### Task 9.7: 카테고리별 verdict 산출 (spec 01 §2 표) — 8 카테고리 PASS/WARN/FAIL

**Files:**
- Create: `src/verdict/category-verdict.{service,test}.ts`

spec 01 §2 매트릭스 1:1. 카테고리 verdict = 신호 verdict 최악값. hard rule (`compatibility.schemaCompatRate < 1.0`, `auditSafety.criticalAnomalyRate > 0`) 단일 사이클 즉시 FAIL — controller-config.yaml override 무시. perf의 errorRate는 baseline 곱 임계.

- [ ] **Step 9.7.1: 실패 테스트** — 케이스: (a) compatibility < 1.0 → FAIL hard + `hardFail` 포함, (b) auditSafety > 0 → FAIL hard, (c) perf.errorRate 3 구간(baseline×1.2 / 1.5 / >1.5 → PASS/WARN/FAIL), (d) perf.p95LatencyDelta 3 구간, (e) replicationLag 3 구간(500 / 2000), (f) 카테고리 = worst signal (perf.p95 FAIL → category FAIL), (g) loadPressure RPS 임계, (h) resourceHeadroom CPU 임계.

```typescript
it("compatibility < 1.0 → FAIL hard; auditSafety > 0 → FAIL hard", () => {
  const r1 = svc.evaluate(sample({ "compatibility.schemaCompatRate": 0.9 }));
  expect(r1.compatibility).toBe("FAIL"); expect(r1.hardFail).toContain("compatibility");
});
```

- [ ] **Step 9.7.2: 최소 구현** — band 평가는 동일 패턴 (`val > fail ? "FAIL" : val > warn ? "WARN" : "PASS"`) 헬퍼로 압축. hard rule 두 신호는 별도 분기.

```typescript
// src/verdict/category-verdict.service.ts
import { Injectable } from "@nestjs/common";
import type { ScrapeResult } from "../metrics/metrics-scrape.service.js";

export type Verdict = "PASS" | "WARN" | "FAIL";

export interface VerdictConfig {
  perf: { errorRate: { warn: number; fail: number; baselineMultiplier: boolean }; p95LatencyDelta: { warn: number; fail: number } };
  decisionQuality: { denyRateDelta: { warn: number; fail: number }; avgConfidenceDelta: { warn: number; fail: number } };
  replicationHealth: { replicationLagMs: { warn: number; fail: number } };
  baselines: { errorRate: number; RPS: number; CPU: number; dbPoolUtilization: number; cooldownUpMs: number };
}

export interface CategoryVerdicts {
  perf: Verdict; compatibility: Verdict; decisionQuality: Verdict; auditSafety: Verdict;
  replicationHealth: Verdict; loadPressure: Verdict; resourceHeadroom: Verdict; stability: Verdict;
  hardFail: string[]; triggerSignals: string[];
}

const worse = (a: Verdict, b: Verdict): Verdict =>
  a === "FAIL" || b === "FAIL" ? "FAIL" : a === "WARN" || b === "WARN" ? "WARN" : "PASS";

const band = (v: number | null, warn: number, fail: number): Verdict =>
  v === null ? "PASS" : v > fail ? "FAIL" : v > warn ? "WARN" : "PASS";
const bandAbs = (v: number | null, warn: number, fail: number): Verdict =>
  v === null ? "PASS" : Math.abs(v) > fail ? "FAIL" : Math.abs(v) > warn ? "WARN" : "PASS";

@Injectable()
export class CategoryVerdictService {
  constructor(private readonly cfg: VerdictConfig) {}

  evaluate(scrape: ScrapeResult): CategoryVerdicts {
    const sig = (id: string): number | null => scrape.signals[id]?.value ?? null;
    const triggers: string[] = []; const hardFail: string[] = [];
    const push = (id: string, v: Verdict) => { if (v !== "PASS") triggers.push(id); };

    const baseErr = this.cfg.baselines.errorRate;
    const perfErr = band(sig("perf.errorRate"), baseErr * 1.2, baseErr * 1.5);
    const perfLat = band(sig("perf.p95LatencyDelta"), 0.2, 0.5);
    push("perf.errorRate", perfErr); push("perf.p95LatencyDelta", perfLat);
    const perf = worse(perfErr, perfLat);

    const sc = sig("compatibility.schemaCompatRate");
    let compatibility: Verdict = "PASS";
    if (sc !== null && sc < 1.0) {
      compatibility = "FAIL"; hardFail.push("compatibility"); triggers.push("compatibility.schemaCompatRate");
    }

    const drV = bandAbs(sig("decisionQuality.denyRateDelta"), 0.05, 0.15);
    const acRaw = sig("decisionQuality.avgConfidenceDelta");
    const acV: Verdict = acRaw === null ? "PASS" : acRaw < -0.15 ? "FAIL" : acRaw < -0.05 ? "WARN" : "PASS";
    push("decisionQuality.denyRateDelta", drV); push("decisionQuality.avgConfidenceDelta", acV);
    const decisionQuality = worse(drV, acV);

    const ca = sig("auditSafety.criticalAnomalyRate");
    let auditSafety: Verdict = "PASS";
    if (ca !== null && ca > 0) {
      auditSafety = "FAIL"; hardFail.push("auditSafety"); triggers.push("auditSafety.criticalAnomalyRate");
    }

    const replicationHealth = band(sig("replicationHealth.replicationLagMs"), 500, 2000);
    push("replicationHealth.replicationLagMs", replicationHealth);

    const rpsT = this.cfg.baselines.RPS, rps = sig("loadPressure.RPS");
    const rpsV: Verdict = rps === null ? "PASS" : rps >= rpsT ? "FAIL" : rps >= rpsT * 0.8 ? "WARN" : "PASS";
    const lat2V = band(sig("loadPressure.p95LatencyDelta"), 0.3, 0.5);
    push("loadPressure.RPS", rpsV); push("loadPressure.p95LatencyDelta", lat2V);
    const loadPressure = worse(rpsV, lat2V);

    const cpuT = this.cfg.baselines.CPU, poolT = this.cfg.baselines.dbPoolUtilization;
    const cpuV = band(sig("resourceHeadroom.CPU"), cpuT * 0.75, cpuT);
    const poolV = band(sig("resourceHeadroom.dbPoolUtilization"), poolT * 0.75, poolT);
    push("resourceHeadroom.CPU", cpuV); push("resourceHeadroom.dbPoolUtilization", poolV);
    const resourceHeadroom = worse(cpuV, poolV);

    const since = sig("stability.timeSinceLastReplicaChange");
    let stability: Verdict = "PASS";
    if (since !== null && since < this.cfg.baselines.cooldownUpMs) {
      stability = "WARN"; triggers.push("stability.timeSinceLastReplicaChange");
    }

    return { perf, compatibility, decisionQuality, auditSafety, replicationHealth,
      loadPressure, resourceHeadroom, stability, hardFail, triggerSignals: triggers };
  }
}
```

Commit: `feat(sim-canary-controller): category verdict (8 categories, hard rules — spec 01 §2)`

### Task 9.8: Pass 1 (Safety) 결정 알고리즘 (spec 01 §3)

**Files:**
- Create: `src/decision/safety-decision.{service,test}.ts`

spec 01 §3 의사 코드 1:1. 우선순위 = 분기 순서. Hard rollback → Soft rollback (윈도우 N=10 중 ≥3 FAIL) → Hold (confidence < 0.6 OR any WARN) → Promote (모두 PASS + dwellTime). `triggerCategory`는 rollback에서만. weight sequence 5 → 25 → 50 → 100 단방향. weight=100 도달 시 `verdict=promote` 유지(catalog 승격은 02-canary-topology.md §"catalog 상태 전이"가 별도 처리).

- [ ] **Step 9.8.1: 실패 테스트** — 8 케이스: (a) compatibility hardFail → rollback weight=0, triggerCategory="compatibility", (b) auditSafety hardFail → rollback (perf WARN 동시여도 hardFail 우선), (c) 윈도우 10 중 prior 2 FAIL + 현재 perf=FAIL → rollback (≥3), (d) confidence<0.6 → hold, (e) any WARN → hold, triggerCategory 비워둠, (f) all PASS + dwell 경과 + currentWeight=5 → promote weight=25, (g) all PASS + dwell 미경과 → hold, (h) currentWeight=100 → promote 유지.

```typescript
it("hard rollback when compatibility hardFail", () => {
  const v = okVerdicts({ compatibility: "FAIL", hardFail: ["compatibility"], triggerSignals: ["compatibility.schemaCompatRate"] });
  const d = svc.decide({ verdicts: v, confidence: 0.9, currentWeight: 25, history: [], timeSincePromotionMs: 200_000 });
  expect(d.verdict).toBe("rollback"); expect(d.triggerCategory).toBe("compatibility");
  expect(d.action).toEqual({ kind: "weight-update", weight: 0, revision: expect.any(Number) });
});
it("promote 5→25 when all PASS + dwellTime elapsed", () => {
  const d = svc.decide({ verdicts: okVerdicts(), confidence: 0.9, currentWeight: 5, history: [], timeSincePromotionMs: 130_000 });
  expect(d.verdict).toBe("promote"); expect(d.action).toMatchObject({ kind: "weight-update", weight: 25 });
});
```

- [ ] **Step 9.8.2: 최소 구현 (spec 01 §3 의사 코드 그대로)**

```typescript
// src/decision/safety-decision.service.ts
import { Injectable } from "@nestjs/common";
import type { CategoryVerdicts, Verdict } from "../verdict/category-verdict.service.js";

export interface SafetyConfig { weightSequence: number[]; dwellMs: number; confidenceHold: number; windowCycles: number; failQuorum: number }
export type SafetyVerdict = "promote" | "hold" | "rollback";
export type WeightStep = 0 | 5 | 25 | 50 | 100;
export type TriggerCategory = keyof Pick<CategoryVerdicts, "perf" | "compatibility" | "decisionQuality" | "auditSafety" | "replicationHealth">;

export interface SafetyDecisionInput { verdicts: CategoryVerdicts; confidence: number; currentWeight: number; history: boolean[]; timeSincePromotionMs: number }
export interface SafetyDecisionOutput {
  verdict: SafetyVerdict; triggerCategory?: TriggerCategory; triggerSignals: string[];
  action: { kind: "weight-update"; weight: WeightStep; revision: number } | { kind: "noop" };
}

let revisionCounter = 0;
const nextRevision = () => ++revisionCounter;
const SAFETY_CATS = ["perf", "compatibility", "decisionQuality", "auditSafety", "replicationHealth"] as const;
const FAIL_CATS = ["perf", "decisionQuality", "replicationHealth", "loadPressure", "resourceHeadroom"] as const;

@Injectable()
export class SafetyDecisionService {
  constructor(private readonly cfg: SafetyConfig) {}
  decide(input: SafetyDecisionInput): SafetyDecisionOutput {
    const { verdicts: v, confidence, currentWeight, history, timeSincePromotionMs } = input;
    const rollbackAction = { kind: "weight-update", weight: 0 as WeightStep, revision: nextRevision() } as const;

    // 1) Hard rollback first — spec 01 §3
    if (v.hardFail.length > 0) {
      return { verdict: "rollback", triggerCategory: v.hardFail[0] as TriggerCategory, triggerSignals: v.triggerSignals, action: { ...rollbackAction } };
    }

    // 2) Soft rollback — windowCycles 중 failQuorum 이상 FAIL (현재 사이클 포함)
    const anyFailNow = FAIL_CATS.some((k) => v[k] === "FAIL");
    const windowFails = history.slice(-this.cfg.windowCycles).filter(Boolean).length + (anyFailNow ? 1 : 0);
    if (windowFails >= this.cfg.failQuorum) {
      const tc: TriggerCategory | undefined = v.perf === "FAIL" ? "perf" : v.decisionQuality === "FAIL" ? "decisionQuality" : v.replicationHealth === "FAIL" ? "replicationHealth" : undefined;
      return { verdict: "rollback", triggerCategory: tc, triggerSignals: v.triggerSignals, action: { ...rollbackAction } };
    }

    // 3) Hold — confidence 미달 OR any WARN
    const anyWarn = (SAFETY_CATS as readonly TriggerCategory[]).some((k) => (v[k] as Verdict) === "WARN");
    if (confidence < this.cfg.confidenceHold || anyWarn) {
      return { verdict: "hold", triggerSignals: v.triggerSignals, action: { kind: "noop" } };
    }

    // 4) Promote — 모두 PASS + dwellTime
    const allPass = (SAFETY_CATS as readonly TriggerCategory[]).every((k) => (v[k] as Verdict) === "PASS");
    if (allPass && timeSincePromotionMs >= this.cfg.dwellMs) {
      const seq = this.cfg.weightSequence;
      const idx = seq.indexOf(currentWeight);
      const next = (idx === -1 ? seq[0] : idx === seq.length - 1 ? seq[idx] : seq[idx + 1]) as WeightStep;
      return { verdict: "promote", triggerSignals: [], action: { kind: "weight-update", weight: next, revision: nextRevision() } };
    }

    return { verdict: "hold", triggerSignals: v.triggerSignals, action: { kind: "noop" } };
  }
}
```

Commit: `feat(sim-canary-controller): Pass 1 safety decision (spec 01 §3 pseudocode 1:1)`

### Task 9.9: Pass 2 (Resource) 결정 알고리즘 (spec 01 §4)

**Files:**
- Create: `src/decision/resource-decision.{service,test}.ts`

spec 01 §4 의사 코드 1:1. **Pass 1이 promote/stable 아니면 SKIP**(상위 사이클 스케줄러 가드, Task 9.12). 분기 순서: stability=WARN → hold / load=FAIL & headroom=FAIL → rejected(rejectedBy=resourceHeadroom + alert) / load=FAIL & headroom!=FAIL → scale-up(canary 5/25/50 → v2 우선, weight=100/0 → v1) / load=PASS & replicas>min & cooldown 경과 → scale-down(v1 우선) / else hold. cooldown 비대칭: up 60s / down 180s.

- [ ] **Step 9.9.1: 실패 테스트** — 8 케이스: (a) stability=WARN → hold, (b) load+headroom 둘 다 FAIL → rejected + rejectedBy="resourceHeadroom" + alert=true, (c) load=FAIL & headroom OK & weight∈{5,25,50} → scale-up v2+1, (d) weight=100 → scale-up v1+1, (e) weight=0 → scale-up v1+1, (f) load=PASS & cooldown 경과 → scale-down v1-1, (g) cooldown 미경과 → hold, (h) replicas at min → hold.

```typescript
it("rejected when load FAIL + headroom FAIL (alert event)", () => {
  const d = svc.decide({ verdicts: verdicts({ loadPressure: "FAIL", resourceHeadroom: "FAIL" }),
    currentWeight: 25, current: { v1: 2, v2: 1 }, timeSinceLastChangeMs: 200_000, confidence: 0.9 });
  expect(d.verdict).toBe("rejected"); expect(d.rejectedBy).toBe("resourceHeadroom"); expect(d.alert).toBe(true);
});
it("scale-up: canary → v2; weight=100 → v1", () => {
  expect(svc.decide({ verdicts: verdicts({ loadPressure: "FAIL" }), currentWeight: 25, current: { v1: 2, v2: 1 }, timeSinceLastChangeMs: 200_000, confidence: 0.9 }).action)
    .toEqual({ kind: "scale", target: { v1: 2, v2: 2 }, reason: expect.any(String) });
});
```

- [ ] **Step 9.9.2: 최소 구현 (spec 01 §4 의사 코드 그대로)**

```typescript
// src/decision/resource-decision.service.ts
import { Injectable } from "@nestjs/common";
import type { CategoryVerdicts } from "../verdict/category-verdict.service.js";

export interface ResourceConfig { cooldownUpMs: number; cooldownDownMs: number; minReplicasV1: number; minReplicasV2: number }
export type ResourceVerdict = "scale-up" | "scale-down" | "hold" | "rejected";

export interface ResourceDecisionInput {
  verdicts: CategoryVerdicts; currentWeight: number;
  current: { v1: number; v2: number }; timeSinceLastChangeMs: number; confidence: number;
}
export interface ResourceDecisionOutput {
  verdict: ResourceVerdict;
  rejectedBy?: "resourceHeadroom" | "stability"; alert?: boolean;
  action: { kind: "scale"; target: { v1: number; v2: number }; reason: string } | { kind: "noop" };
}

@Injectable()
export class ResourceDecisionService {
  constructor(private readonly cfg: ResourceConfig) {}
  decide(input: ResourceDecisionInput): ResourceDecisionOutput {
    const { verdicts: v, currentWeight, current, timeSinceLastChangeMs } = input;

    if (v.stability === "WARN") return { verdict: "hold", action: { kind: "noop" } };

    if (v.loadPressure === "FAIL" && v.resourceHeadroom === "FAIL")
      return { verdict: "rejected", rejectedBy: "resourceHeadroom", alert: true, action: { kind: "noop" } };

    if (v.loadPressure === "FAIL" && v.resourceHeadroom !== "FAIL") {
      const inCanary = currentWeight === 5 || currentWeight === 25 || currentWeight === 50;
      const target = inCanary ? { v1: current.v1, v2: current.v2 + 1 } : { v1: current.v1 + 1, v2: current.v2 };
      const reason = inCanary ? "canary in progress: scale v2" : `weight=${currentWeight}: scale v1`;
      return { verdict: "scale-up", action: { kind: "scale", target, reason } };
    }

    const totalReplicas = current.v1 + current.v2;
    const minReplicas = this.cfg.minReplicasV1 + this.cfg.minReplicasV2;
    if (v.loadPressure === "PASS" && totalReplicas > minReplicas && timeSinceLastChangeMs >= this.cfg.cooldownDownMs) {
      const canDecV1 = current.v1 > this.cfg.minReplicasV1;
      const canDecV2 = current.v2 > this.cfg.minReplicasV2;
      if (!canDecV1 && !canDecV2) return { verdict: "hold", action: { kind: "noop" } };
      const target = canDecV1 ? { v1: current.v1 - 1, v2: current.v2 } : { v1: current.v1, v2: current.v2 - 1 };
      return { verdict: "scale-down", action: { kind: "scale", target, reason: "load PASS + cooldown elapsed" } };
    }

    return { verdict: "hold", action: { kind: "noop" } };
  }
}
```

Commit: `feat(sim-canary-controller): Pass 2 resource decision (spec 01 §4 pseudocode 1:1)`

### Task 9.10: 결정 객체 빌드 + audit-recorder write — Plan A grammar #7/#8/#14/#15

**Files:**
- Create: `src/decision/decision-builder.{service,test}.ts`, `src/decision/decision.module.ts`

Plan A grammar로 `decisionId`/`cycleId`/category/signal 식별자를 합성. spec 01 §1 SafetyDecision/ResourceDecision interface 그대로. audit-recorder write는 `(cycleId, pass)` 복합 키 idempotent — `idempotency-key` 헤더 + 409 conflict 무시(append-only). evidence는 source weight + 신호값 record. confidence는 source weight 평균.

- [ ] **Step 9.10.1: 실패 테스트** — buildSafety가 grammar #7/#8로 id 합성(`decisionId === safety-decision-${cycleId}`, cycleId는 26-char Crockford ULID); evidence가 sources(metrics/ingest/audit) + signals 양쪽으로 채워짐; write 409 응답은 silent하게 처리(throw 하지 않음); 500 응답은 throw; idempotency-key 헤더가 `${cycleId}:${pass}` 형식.

- [ ] **Step 9.10.2: 최소 구현**

```typescript
// src/decision/decision-builder.service.ts
import { Injectable } from "@nestjs/common";
import { buildDecisionId, buildCycleId, buildDecisionCategory } from "sim-identifier-grammar";
import type { CategoryVerdicts } from "../verdict/category-verdict.service.js";
import type { SafetyDecisionOutput } from "./safety-decision.service.js";
import type { ResourceDecisionOutput } from "./resource-decision.service.js";
import type { SourceStatus, SignalSample } from "../metrics/metrics-scrape.service.js";
import { createLogger } from "../lib/logger.js";

export interface BuilderConfig { controllerId: string; auditUrl: string }

type Evidence = { kind: "data" | "rule"; source: string; content: unknown; weight: number };

export interface SafetyDecisionRecord {
  decisionId: string; cycleId: string; cycleAt: string; pass: "safety";
  verdict: SafetyDecisionOutput["verdict"];
  categoryVerdicts: Pick<CategoryVerdicts, "perf" | "compatibility" | "decisionQuality" | "auditSafety" | "replicationHealth">;
  triggerCategory?: SafetyDecisionOutput["triggerCategory"];
  triggerSignals: string[]; evidence: Evidence[]; confidence: number; action?: SafetyDecisionOutput["action"];
}
export interface ResourceDecisionRecord {
  decisionId: string; cycleId: string; cycleAt: string; pass: "resource";
  verdict: ResourceDecisionOutput["verdict"];
  categoryVerdicts: Pick<CategoryVerdicts, "loadPressure" | "resourceHeadroom" | "stability">;
  rejectedBy?: ResourceDecisionOutput["rejectedBy"];
  triggerSignals: string[]; evidence: Evidence[]; confidence: number; action?: ResourceDecisionOutput["action"];
}

const SAFETY_NAMES = ["perf", "compatibility", "decisionQuality", "auditSafety", "replicationHealth"] as const;
const RESOURCE_NAMES = ["loadPressure", "resourceHeadroom", "stability"] as const;

@Injectable()
export class DecisionBuilderService {
  private readonly logger = createLogger("sim-canary-controller:builder");
  constructor(private readonly cfg: BuilderConfig) {}

  newCycleId(cycleAt: number): string { return buildCycleId({ controllerId: this.cfg.controllerId, cycleAt }); }

  buildSafety(input: { cycleId?: string; cycleAt: number; verdicts: CategoryVerdicts; decision: SafetyDecisionOutput;
    sources: SourceStatus[]; signals: Record<string, SignalSample>; confidence: number }): SafetyDecisionRecord {
    const cycleId = input.cycleId ?? this.newCycleId(input.cycleAt);
    for (const name of SAFETY_NAMES) buildDecisionCategory({ pass: "safety", name });
    const v = input.verdicts;
    return {
      decisionId: buildDecisionId({ pass: "safety", cycleId }), cycleId,
      cycleAt: new Date(input.cycleAt).toISOString(), pass: "safety",
      verdict: input.decision.verdict,
      categoryVerdicts: { perf: v.perf, compatibility: v.compatibility, decisionQuality: v.decisionQuality,
        auditSafety: v.auditSafety, replicationHealth: v.replicationHealth },
      triggerCategory: input.decision.triggerCategory, triggerSignals: input.decision.triggerSignals,
      evidence: this.evidenceFrom(input.sources, input.signals),
      confidence: input.confidence, action: input.decision.action,
    };
  }

  buildResource(input: { cycleId: string; cycleAt: number; verdicts: CategoryVerdicts; decision: ResourceDecisionOutput;
    sources: SourceStatus[]; signals: Record<string, SignalSample>; confidence: number }): ResourceDecisionRecord {
    for (const name of RESOURCE_NAMES) buildDecisionCategory({ pass: "resource", name });
    const v = input.verdicts;
    return {
      decisionId: buildDecisionId({ pass: "resource", cycleId: input.cycleId }), cycleId: input.cycleId,
      cycleAt: new Date(input.cycleAt).toISOString(), pass: "resource",
      verdict: input.decision.verdict,
      categoryVerdicts: { loadPressure: v.loadPressure, resourceHeadroom: v.resourceHeadroom, stability: v.stability },
      rejectedBy: input.decision.rejectedBy, triggerSignals: v.triggerSignals,
      evidence: this.evidenceFrom(input.sources, input.signals),
      confidence: input.confidence, action: input.decision.action,
    };
  }

  private evidenceFrom(sources: SourceStatus[], signals: Record<string, SignalSample>): Evidence[] {
    return [
      ...sources.map((s) => ({ kind: "data" as const, source: `metrics:${s.name}`, content: { ok: s.ok }, weight: s.weight })),
      ...Object.entries(signals).map(([id, s]) => ({ kind: "data" as const, source: `signal:${s.sourceName}`, content: { signal: id, value: s.value }, weight: 1 })),
    ];
  }

  /** spec 01 §6: (cycleId, pass) 복합 키 멱등 write. 409 → 이미 적재됨(무시). */
  async write(record: SafetyDecisionRecord | ResourceDecisionRecord): Promise<void> {
    const res = await fetch(`${this.cfg.auditUrl}/v1/decisions`, {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": `${record.cycleId}:${record.pass}` },
      body: JSON.stringify(record), signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok && res.status !== 409) {
      this.logger.error({ status: res.status, decisionId: record.decisionId }, "audit write failed");
      throw new Error(`audit-recorder write failed: ${res.status}`);
    }
  }
}
```

`src/decision/decision.module.ts`: yaml `controller-config.yaml`을 `parseYaml(readFileSync(env.SIM_CONTROLLER_CONFIG_PATH))`로 로드 → CategoryVerdictService(baselines는 env에서 보강) / SafetyDecisionService / ResourceDecisionService / DecisionBuilderService를 useFactory로 wire.

Commit: `feat(sim-canary-controller): decision builder + audit-recorder write (grammar #7/#8/#14/#15)`

### Task 9.11: action 실행 — Plan C gateway `/admin/routing` push + docker compose --scale

**Files:**
- Create: `src/action/action-executor.{service,test}.ts`, `src/action/action.module.ts`

spec 01 §5 t=5s: gateway routing push와 compose scale은 서로 다른 부수 효과 채널 — 한쪽 실패가 다른 쪽 결정 기록을 무효화하지 않는다. 실패 시 다음 사이클이 같은 결정을 다시 적용 — idempotent. routing push는 `{ revision: N, weight }` 포함 (spec 01 §6 — gateway는 revision 큰 것만 적용). compose scale은 `target == current` 시 no-op.

- [ ] **Step 9.11.1: 실패 테스트** — 5 케이스: (a) safety weight-update → POST `/admin/routing` body에 `"revision":N` 포함, (b) safety noop → no fetch, (c) resource scale target == current → no exec, (d) scale-up v2+1 → exec(`["compose","-p",project,"up","-d","--no-recreate","--scale","sim-approval-api-v2=N"]`), (e) gateway 500 → throw.

- [ ] **Step 9.11.2: 최소 구현**

```typescript
// src/action/action-executor.service.ts
import { Injectable } from "@nestjs/common";
import { spawn } from "node:child_process";
import { createLogger } from "../lib/logger.js";

type ExecResult = { stdout: string; stderr: string };
export interface ActionConfig { gatewayUrl: string; composeProject: string; scaleExec?: (argv: string[]) => Promise<ExecResult> }
export type SafetyAction = { kind: "weight-update"; weight: number; revision: number } | { kind: "noop" };
export type ResourceAction = { kind: "scale"; target: { v1: number; v2: number }; reason: string } | { kind: "noop" };

const dockerExec = (argv: string[]): Promise<ExecResult> => new Promise((resolve, reject) => {
  const p = spawn("docker", argv, { stdio: ["ignore", "pipe", "pipe"] });
  let stdout = "", stderr = "";
  p.stdout.on("data", (b) => { stdout += String(b); });
  p.stderr.on("data", (b) => { stderr += String(b); });
  p.on("close", (code) => code === 0 ? resolve({ stdout, stderr }) : reject(new Error(`docker exited ${code}: ${stderr}`)));
});

@Injectable()
export class ActionExecutorService {
  private readonly logger = createLogger("sim-canary-controller:action");
  private readonly exec: NonNullable<ActionConfig["scaleExec"]>;
  constructor(private readonly cfg: ActionConfig) { this.exec = cfg.scaleExec ?? dockerExec; }

  async executeSafety(action: SafetyAction): Promise<void> {
    if (action.kind === "noop") return;
    const res = await fetch(`${this.cfg.gatewayUrl}/admin/routing`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ revision: action.revision, weight: action.weight }),
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) {
      this.logger.error({ status: res.status, weight: action.weight }, "routing push failed");
      throw new Error(`routing push failed: ${res.status}`);
    }
    this.logger.info({ weight: action.weight, revision: action.revision }, "routing push ok");
  }

  async executeResource(action: ResourceAction, current: { v1: number; v2: number }): Promise<void> {
    if (action.kind === "noop") return;
    if (action.target.v1 === current.v1 && action.target.v2 === current.v2) {
      this.logger.debug({ target: action.target }, "scale no-op"); return;
    }
    const argv = (svc: string, n: number) =>
      ["compose", "-p", this.cfg.composeProject, "up", "-d", "--no-recreate", "--scale", `${svc}=${n}`];
    if (action.target.v1 !== current.v1) await this.exec(argv("sim-approval-api-v1", action.target.v1));
    if (action.target.v2 !== current.v2) await this.exec(argv("sim-approval-api-v2", action.target.v2));
    this.logger.info({ target: action.target, reason: action.reason }, "compose scale ok");
  }
}
```

`src/action/action.module.ts`: `useFactory: () => new ActionExecutorService({ gatewayUrl: env.SIM_GATEWAY_ADMIN_URL, composeProject: env.SIM_COMPOSE_PROJECT })`.

Commit: `feat(sim-canary-controller): action executor (gateway routing push + compose scale)`

### Task 9.12: 30s 사이클 스케줄러 (NestJS Interval)

**Files:**
- Create: `src/cycle/{cycle-scheduler.service,cycle.module}.ts`

`@nestjs/schedule` `SchedulerRegistry`에 동적 `setInterval`을 `controller-cycle` 이름으로 등록. spec 01 §5 타임라인: t=0 scrape → t=1-3 verdict → t=3 Pass 1 write → t=4 (조건부) Pass 2 write → t=5 action 실행. lock 미보유 standby는 read-only(scrape만, write/action SKIP). Pass 1 write 실패 → Pass 2 SKIP. 핵심 1줄 요약: scheduler는 lock → scrape → evaluate → builder.write(safety) → if Pass 1 promote/stable → resource → builder.write(resource) → action을 직렬 실행, 다음 사이클은 `SIM_CONTROLLER_CYCLE_MS` 후.

```typescript
// src/cycle/cycle-scheduler.service.ts (요약 — runCycle 본체)
private async runCycle() {
  const cycleAt = Date.now();
  try {
    const acquired = await this.lock.tryAcquire();
    const result = await this.scrape.scrape();
    if (!acquired) return; // standby read-only — write/action SKIP
    const verdicts = this.verdict.evaluate(result);
    const confidence = result.sources.reduce((a, s) => a + s.weight, 0) / result.sources.length;
    const safetyOut = this.safety.decide({ verdicts, confidence, currentWeight: this.currentWeight,
      history: this.history, timeSincePromotionMs: Date.now() - this.lastPromotionAt });
    const cycleId = this.builder.newCycleId(cycleAt);
    try { await this.builder.write(this.builder.buildSafety({ cycleId, cycleAt, verdicts, decision: safetyOut, sources: result.sources, signals: result.signals, confidence })); }
    catch (err) { this.logger.error({ err }, "safety write failed; skipping resource"); return; }

    if (safetyOut.verdict !== "rollback") {
      const resOut = this.resource.decide({ verdicts, currentWeight: this.currentWeight, current: this.current,
        timeSinceLastChangeMs: Date.now() - this.lastReplicaChangeAt, confidence });
      try { await this.builder.write(this.builder.buildResource({ cycleId, cycleAt, verdicts, decision: resOut, sources: result.sources, signals: result.signals, confidence })); }
      catch (err) { this.logger.error({ err }, "resource write failed"); }
      try { await this.action.executeResource(resOut.action as never, this.current); }
      catch (err) { this.logger.error({ err }, "resource action failed (retry next cycle)"); }
      if (resOut.action.kind === "scale") { this.current = resOut.action.target; this.lastReplicaChangeAt = Date.now(); }
    }
    try { await this.action.executeSafety(safetyOut.action as never); }
    catch (err) { this.logger.error({ err }, "safety action failed (retry next cycle)"); }
    if (safetyOut.action.kind === "weight-update" && safetyOut.verdict === "promote") {
      this.currentWeight = safetyOut.action.weight; this.lastPromotionAt = Date.now();
    }
    const failNow = (["perf", "decisionQuality", "replicationHealth", "loadPressure", "resourceHeadroom"] as const)
      .some((k) => verdicts[k] === "FAIL");
    this.history = [...this.history.slice(-9), failNow];
  } catch (err) { this.logger.error({ err }, "cycle failed; next cycle continues"); }
}
```

state 필드(`history`, `currentWeight`, `lastPromotionAt`, `current`, `lastReplicaChangeAt`)는 service 인스턴스 필드. `onModuleInit()`에서 `setInterval(() => void this.runCycle(), env.SIM_CONTROLLER_CYCLE_MS)`를 `SchedulerRegistry.addInterval("controller-cycle", ...)`로 등록.

`cycle.module.ts`: 위 service provider + lock/metrics/decision/action 모듈 import.

Commit: `feat(sim-canary-controller): 30s cycle scheduler (spec 01 §5 timeline)`

### Task 9.13: 통합 테스트 (mock metrics → 결정 흐름 검증)

**Files:** Create: `src/integration/cycle-flow.test.ts`

scrape mock(fetch stub) + advisory lock acquired stub으로 사이클 1회 실행, audit POST와 gateway POST와 compose exec spy 검증. 8 시나리오 — (a) all PASS + dwell elapsed → promote 5→25, (b) compatibility FAIL → hard rollback weight=0, (c) auditSafety FAIL → hard rollback, (d) perf WARN → hold, (e) confidence<0.6 → hold, (f) load FAIL + headroom OK + canary 25% → scale-up v2+1, (g) load+headroom FAIL → rejected + alert, (h) all PASS + cooldown elapsed → scale-down v1-1.

```typescript
// src/integration/cycle-flow.test.ts (스니펫)
it("all PASS + dwellTime elapsed → promote 5→25 + routing push", async () => {
  setupScrapeMock({ "perf.errorRate": 0.005, "compatibility.schemaCompatRate": 1.0, /* ...rest=PASS values */ });
  await runOneCycle({ currentWeight: 5, timeSincePromotion: 130_000 });
  expect(routingPushSpy).toHaveBeenCalledWith(expect.objectContaining({ weight: 25 }));
});
```

Commit: `test(sim-canary-controller): integration cycle flow (8 scenarios)`

### Task 9.14: sim:up 추가 + 기존 시나리오 1~8 무회귀

**Files:** Modify `simulations/enterprise-pm/scripts/sim-up.sh` (services 배열에 `sim-canary-controller` 추가)

Plan A Task 1.4 패턴. controller는 metrics-collector / qa-sdk-ingest / audit-browser-api / gateway에 의존하므로 services 배열에서 그들 *다음*에 위치(부팅 순서). 핵심 1줄 요약: `pnpm sim:up` 후 12 서비스 healthy + `pnpm sim:scenarios run --all` 8/8 PASS 확인 → 단계 9 닫기.

```bash
cd /Users/junwoobang/workflow/qa-sdk/simulations/enterprise-pm
pnpm sim:up
docker compose -f docker-compose.sim.yaml ps --filter "health=healthy" | wc -l   # 기대: 12
pnpm sim:scenarios run --all                                                       # 기대: 8/8 PASS
```

Commit: `chore(sim): include sim-canary-controller in sim-up healthcheck wait`

---

## 단계 9 완료 정의 (Definition of Done)

- [ ] `pnpm --filter @qa-sdk/sim-canary-controller test` 모든 unit + integration test PASS
- [ ] `pnpm sim:up` 후 sim-canary-controller 포함 12 서비스 healthy
- [ ] 기존 시나리오 1~8 모두 PASS (무회귀)
- [ ] PG advisory lock 획득 로그가 active controller 1개에서만 보임
- [ ] audit-recorder에 `(cycleId, pass)` 복합 키 record가 사이클당 1~2건 적재됨
- [ ] gateway `/admin/routing` POST가 weight 변경 사이클에서만 발생
- [ ] docker compose --scale 호출이 target ≠ current인 사이클에서만 발생
- [ ] hard rule 트리거(compatibility/auditSafety FAIL) 시 단일 사이클로 weight=0 도달
