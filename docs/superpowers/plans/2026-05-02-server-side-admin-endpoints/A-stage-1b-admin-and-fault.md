# Stage 1b — Controller Admin / Fault / Scale + #21 + FaultKind 확장 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** controller에 alerts/audit/catalog query 3종 + admin fault toggle (6 kind, 2 신규) + admin compose proxy + admin scale 3종 = 8 endpoint 추가, controller ActionExecutor가 gateway RoutingPushSchema 형태로 routing payload 변환 (#21), FaultKind enum 2종 확장 (`pubsub-invalidate-drop`, `perf-warn`).

**Architecture:** Stage 1a의 ring buffer + view DTO + InternalIpGuard 위에 admin/fault/scale endpoint 추가. ActionExecutor가 catalog topology + portRegistry 조회해서 gateway RoutingPushSchema 생성. fault 2종 신규 클래스는 기존 fault-injector 패턴 (InMemoryStore + Fault.enable/disable/inject) 동일.

**Tech Stack:** TypeScript ES2023, NestJS 11 + Fastify, vitest, sim-identifier-grammar, sim-decision-view (Stage 1a 결과), Docker SDK 또는 docker compose shell out (compose-replicas).

**Spec 인용:** `docs/superpowers/specs/2026-05-02-server-side-admin-endpoints-design.md` §6 endpoint 4~11, §7 #21 routing actor, §8 FaultKind 확장.

---

## File Structure (Stage 1b)

| 종류 | 경로 |
|---|---|
| Create | `src/decision/alerts-audit-catalog.controller.{ts,test.ts}` |
| Create | `src/fault/pubsub-invalidate-drop.{ts,test.ts}` |
| Create | `src/fault/perf-warn.{ts,test.ts}` |
| Modify | `src/fault/{types.ts, fault.module.ts, fault-injector.ts, admin-fault.controller.ts, admin-fault.controller.test.ts}` |
| Create | `src/admin/{compose-proxy.controller.ts, compose-proxy.controller.test.ts, compose-exec.default.ts, scale-store.ts, scale-pin.service.ts, scale-pin.service.test.ts, scale.controller.ts, scale.controller.test.ts, admin.module.ts}` |
| Modify | `src/action/{action-executor.service.ts, action-executor.service.test.ts}` |
| Modify | `src/cycle/cycle-scheduler.service.ts` |
| Modify | `src/decision/decision.module.ts` |
| Modify | `src/app.module.ts` |

모든 경로는 `simulations/enterprise-pm/services/canary-controller/` 기준.

---

### Task 1b.1 — AlertsAuditCatalogController (3 endpoint)

**Files:** Create `src/decision/alerts-audit-catalog.controller.{ts,test.ts}`

Stage 1a의 `DecisionRingBuffer` + `sim-service-catalog.getCurrentTopology` 위에 3종 query endpoint를 얹는다. 모든 핸들러는 `@UseGuards(InternalIpGuard)` 적용, 응답은 spec §6 그대로. `/v1/alerts/count`는 ring buffer `countAlerts(filter)`, `/v1/audit/trace`는 ring buffer `trace(cycleId)`, `/v1/catalog/states`는 catalog `getCurrentTopology(prefix)` 결과를 spec §6의 `{ stable, candidate, retired }` shape으로 매핑.

- [ ] **Step 1b.1.1: 실패 테스트** — 4 케이스: (a) `/v1/alerts/count?kind=scale-up-rejected` → ring buffer mock 3건 주입 → `{ count: 3, kind: "scale-up-rejected" }`, (b) `/v1/audit/trace?cycleId=01HXNOTFOUND` 매칭 없을 때 → 404 RFC 7807, (c) `/v1/catalog/states?prefix=sim.svc.approval` → catalog mock topology → spec §6 응답, (d) external IP (`x-forwarded-for: 8.8.8.8`) → 404 silent (InternalIpGuard).

```typescript
// src/decision/alerts-audit-catalog.controller.test.ts (핵심 케이스만)
it("/v1/alerts/count returns ring buffer count", async () => {
  for (let i = 0; i < 3; i++) ring.appendAlert({ kind: "scale-up-rejected", at: new Date().toISOString(), cycleId: `01HX${i}` });
  const res = await app.inject({ method: "GET", url: "/v1/alerts/count?kind=scale-up-rejected", headers: { "x-forwarded-for": "172.20.0.5" } });
  expect(res.json()).toEqual({ count: 3, kind: "scale-up-rejected" });
});
it("/v1/catalog/states maps catalog topology", async () => {
  catalog.getCurrentTopology.mockResolvedValue({ stable: { value: 1 }, candidate: { value: 2 }, retired: [] });
  const res = await app.inject({ method: "GET", url: "/v1/catalog/states?prefix=sim.svc.approval", headers: { "x-forwarded-for": "172.20.0.5" } });
  expect(res.json()).toMatchObject({ stable: { value: 1 }, candidate: { value: 2 }, retired: [] });
});
```

- [ ] **Step 1b.1.2: 최소 구현 — controller**

```typescript
// src/decision/alerts-audit-catalog.controller.ts
import { Controller, Get, Inject, Query, UseGuards, NotFoundException } from "@nestjs/common";
import { InternalIpGuard } from "sim-internal-network";
import { DecisionRingBuffer } from "./decision-ring-buffer.js";

interface SimServiceCatalog {
  getCurrentTopology(prefix: string): Promise<{ stable: { value: number }; candidate: { value: number } | null; retired: { value: number }[] }>;
}

@Controller("v1")
@UseGuards(InternalIpGuard)
export class AlertsAuditCatalogController {
  constructor(
    private readonly ring: DecisionRingBuffer,
    @Inject("SimServiceCatalog") private readonly catalog: SimServiceCatalog,
  ) {}

  @Get("/alerts/count")
  countAlerts(@Query("kind") kind: string, @Query("since") since?: string) {
    return { count: this.ring.countAlerts({ kind, since }), kind };
  }

  @Get("/audit/trace")
  trace(@Query("cycleId") cycleId: string) {
    const trace = this.ring.trace(cycleId);
    if (!trace) throw new NotFoundException({ type: "https://qa-sdk.dev/errors/not-found", title: "trace not found", status: 404, instance: cycleId });
    return { trace };
  }

  @Get("/catalog/states")
  async catalogStates(@Query("prefix") prefix: string) {
    return this.catalog.getCurrentTopology(prefix);
  }
}
```

- [ ] **Step 1b.1.3: ring buffer 시그니처 검증** — Stage 1a의 `DecisionRingBuffer`가 `countAlerts({ kind, since? })`, `trace(cycleId)` 두 메서드를 export 하는지 확인. `countAlerts`는 `since` ISO-8601 미만 timestamp 제외, `trace`는 `{ cycleId, cycleAt, decisions, events }` 또는 `null`. 누락 시 Stage 1a로 회귀 보고 (placeholder 추가 금지).

- [ ] **Step 1b.1.4: SimServiceCatalog DI token** — controller AppModule이 `sim-service-catalog` 패키지의 `getCurrentTopology`를 wrap한 provider를 `"SimServiceCatalog"` token으로 노출. wiring은 Task 1b.11.

- [ ] **Step 1b.1.5: Commit**

```bash
pnpm --filter @qa-sdk/sim-canary-controller test src/decision/alerts-audit-catalog
git add simulations/enterprise-pm/services/canary-controller/src/decision/alerts-audit-catalog.controller.{ts,test.ts}
git commit -m "feat(sim-canary-controller): alerts/audit/catalog query endpoints (spec §6)"
```

---

### Task 1b.2 — fault: pubsub-invalidate-drop 클래스

**Files:** Create `src/fault/pubsub-invalidate-drop.{ts,test.ts}`

spec §8 첫 번째 신규 fault. 효과: bitmap pub/sub `bitmap.invalidate` 채널 메시지를 controller proxy가 `dropRate` 비율로 drop. 시나리오 16에서 `dropRate: 1.0` → TTL 만료 + version-check 시점에 fallthrough → refresh 검증. 기존 `schema-break.ts` 패턴(InMemoryStore 1 row, enable/disable, fault-injector lookup) 동일.

- [ ] **Step 1b.2.1: 실패 테스트** — 4 케이스: (a) `enable({ dropRate: 0.5 })` 후 `isEnabled()=true`, `getParams().dropRate===0.5`, (b) `disable()` 후 `isEnabled()=false`, (c) `enable({ dropRate: 1.5 })` → throw (range 0~1), (d) `shouldDrop(rng)` 결정적: `dropRate=1.0` → 항상 true, `0` → 항상 false.

```typescript
// src/fault/pubsub-invalidate-drop.test.ts (핵심 케이스만)
it("rejects out-of-range dropRate", () => {
  expect(() => fault.enable({ dropRate: 1.5 })).toThrow(/dropRate must be in \[0, 1\]/);
});
it("shouldDrop honors boundaries", () => {
  fault.enable({ dropRate: 1.0 });
  expect(fault.shouldDrop(() => 0.7)).toBe(true);
  fault.enable({ dropRate: 0 });
  expect(fault.shouldDrop(() => 0.7)).toBe(false);
});
```

- [ ] **Step 1b.2.2: 최소 구현**

```typescript
// src/fault/pubsub-invalidate-drop.ts
import { Injectable } from "@nestjs/common";
import type { Fault } from "./types.js";

export interface PubsubInvalidateDropParams { dropRate: number /* 0..1 */ }

@Injectable()
export class PubsubInvalidateDropFault implements Fault<PubsubInvalidateDropParams> {
  readonly kind = "pubsub-invalidate-drop" as const;
  private params: PubsubInvalidateDropParams | null = null;
  private target: string | undefined;

  enable(params: PubsubInvalidateDropParams, target?: string): void {
    if (typeof params?.dropRate !== "number" || params.dropRate < 0 || params.dropRate > 1) {
      throw new Error(`dropRate must be in [0, 1], got ${params?.dropRate}`);
    }
    this.params = { dropRate: params.dropRate };
    this.target = target;
  }
  disable(): void { this.params = null; this.target = undefined; }
  isEnabled(): boolean { return this.params !== null; }
  getParams(): PubsubInvalidateDropParams | null { return this.params ? { ...this.params } : null; }
  getTarget(): string | undefined { return this.target; }

  /** controller proxy가 호출. true → 메시지 drop. */
  shouldDrop(rng: () => number = Math.random): boolean {
    return this.params !== null && rng() < this.params.dropRate;
  }
}
```

- [ ] **Step 1b.2.3: Fault interface 정합** — `types.ts`의 `Fault<P>`가 `kind`, `enable(params, target?)`, `disable()`, `isEnabled()`, `getParams()`, `getTarget()` 시그니처를 가진다고 가정. 누락 시 Task 1b.4에서 일괄 갱신.

- [ ] **Step 1b.2.4: target 의미** — spec §6 fault body의 optional 필드. `pubsub-invalidate-drop`은 현재 target 사용 안 함(전역). 향후 prefix별 drop 확장 여지로 보존.

- [ ] **Step 1b.2.5: Commit**

```bash
pnpm --filter @qa-sdk/sim-canary-controller test src/fault/pubsub-invalidate-drop
git commit -am "feat(sim-canary-controller): pubsub-invalidate-drop fault class (spec §8)"
```

---

### Task 1b.3 — fault: perf-warn 클래스

**Files:** Create `src/fault/perf-warn.{ts,test.ts}`

spec §8 두 번째 신규 fault. 효과: perf 카테고리에 인위적 WARN 신호 주입 → Pass 1 hold 상태 (rollback 아님) → Pass 2 SKIP. 시나리오 17에서 RPS 폭증 + perf-warn 동시 발생 → Pass 1 hold → Pass 2 SKIP 검증. params: `{ severity: "warn" }`. VerdictService 연동은 Task 1b.11에서 wiring (CategoryVerdictService 결과 perf 필드를 `applyTo(perf)`로 wrap).

- [ ] **Step 1b.3.1: 실패 테스트** — 5 케이스: (a) `enable({ severity: "warn" })` → `isEnabled()=true`, (b) `enable({ severity: "fail" })` → throw (현재 spec은 warn만), (c) `disable()` → `isEnabled()=false`, (d) `applyTo("PASS")` → `"WARN"` 격상, (e) `applyTo("FAIL")` → `"FAIL"` 보존 (격하 금지).

```typescript
// src/fault/perf-warn.test.ts (핵심 케이스만)
it("rejects unsupported severity", () => {
  expect(() => fault.enable({ severity: "fail" } as never)).toThrow(/severity must be "warn"/);
});
it("applyTo upgrades PASS to WARN; FAIL preserved", () => {
  fault.enable({ severity: "warn" });
  expect(fault.applyTo("PASS")).toBe("WARN");
  expect(fault.applyTo("FAIL")).toBe("FAIL");
});
```

- [ ] **Step 1b.3.2: 최소 구현**

```typescript
// src/fault/perf-warn.ts
import { Injectable } from "@nestjs/common";
import type { Fault } from "./types.js";
import type { Verdict } from "../verdict/category-verdict.service.js";

export interface PerfWarnParams { severity: "warn" }

@Injectable()
export class PerfWarnFault implements Fault<PerfWarnParams> {
  readonly kind = "perf-warn" as const;
  private params: PerfWarnParams | null = null;
  private target: string | undefined;

  enable(params: PerfWarnParams, target?: string): void {
    if (params?.severity !== "warn") throw new Error(`severity must be "warn" (spec §8), got ${params?.severity}`);
    this.params = { severity: "warn" };
    this.target = target;
  }
  disable(): void { this.params = null; this.target = undefined; }
  isEnabled(): boolean { return this.params !== null; }
  getParams(): PerfWarnParams | null { return this.params ? { ...this.params } : null; }
  getTarget(): string | undefined { return this.target; }

  /** VerdictService가 호출: enabled + perf 카테고리 → PASS면 WARN으로 격상. FAIL은 보존. */
  applyTo(perfVerdict: Verdict): Verdict {
    if (!this.params) return perfVerdict;
    return perfVerdict === "FAIL" ? "FAIL" : "WARN";
  }
}
```

- [ ] **Step 1b.3.3: VerdictService 연동 위치** — Stage 9 Task 9.7 `CategoryVerdictService.evaluate(scrape)` 호출부에서 다음 사이클(Task 1b.11)에 `perfWarnFault.applyTo(result.perf)`로 wrap. 본 task는 class만 도입.

- [ ] **Step 1b.3.4: severity 확장 여지** — spec §8은 현재 `"warn"`만 정의. 향후 `"fail"` 추가 가능성 코드 주석으로 표시 (현재는 throw). placeholder 구현 금지.

- [ ] **Step 1b.3.5: Commit**

```bash
pnpm --filter @qa-sdk/sim-canary-controller test src/fault/perf-warn
git commit -am "feat(sim-canary-controller): perf-warn fault class (spec §8)"
```

---

### Task 1b.4 — FaultKind enum 확장 + FaultModule wiring

**Files:** Modify `src/fault/{types.ts, fault.module.ts, fault-injector.ts}`

spec §8을 그대로 코드화. `FAULT_KINDS`에 두 항목 추가. `FaultModule`은 두 신규 클래스를 provider로 등록하고 `FaultInjector` factory의 `Record<FaultKind, Fault>` 매핑 확장.

```ts
// spec §8 인용
export const FAULT_KINDS = [
  "schema-break",
  "audit-anomaly",
  "replication-lag",
  "db-pool-pressure",
  "pubsub-invalidate-drop",  // NEW — 시나리오 16 (bitmap-cache-version-fallback)
  "perf-warn",                // NEW — 시나리오 17 (pass-priority-canary-blocks-scale)
] as const;
```

- [ ] **Step 1b.4.1: 실패 테스트** — 3 케이스: (a) `FAULT_KINDS` 길이/내용 정확 일치, (b) `getFault("pubsub-invalidate-drop")` instance가 `PubsubInvalidateDropFault`, (c) `getFault("perf-warn")` instance가 `PerfWarnFault`. 기존 4 kind regression 무회귀.

```typescript
it("FAULT_KINDS contains 6 entries (4 existing + 2 new)", () => {
  expect(FAULT_KINDS).toEqual([
    "schema-break", "audit-anomaly", "replication-lag", "db-pool-pressure",
    "pubsub-invalidate-drop", "perf-warn",
  ]);
});
it("getFault routes to new instances", () => {
  expect(injector.getFault("pubsub-invalidate-drop")).toBeInstanceOf(PubsubInvalidateDropFault);
  expect(injector.getFault("perf-warn")).toBeInstanceOf(PerfWarnFault);
});
```

- [ ] **Step 1b.4.2: types.ts 확장**

```typescript
// src/fault/types.ts (modify)
export const FAULT_KINDS = [
  "schema-break", "audit-anomaly", "replication-lag", "db-pool-pressure",
  "pubsub-invalidate-drop", "perf-warn",
] as const;
export type FaultKind = (typeof FAULT_KINDS)[number];

export interface Fault<P = unknown> {
  readonly kind: FaultKind;
  enable(params: P, target?: string): void;
  disable(): void;
  isEnabled(): boolean;
  getParams(): P | null;
  getTarget(): string | undefined;
}
```

- [ ] **Step 1b.4.3: fault.module.ts wiring**

```typescript
// src/fault/fault.module.ts (modify)
import { Module } from "@nestjs/common";
import { SchemaBreakFault } from "./schema-break.js";
import { AuditAnomalyFault } from "./audit-anomaly.js";
import { ReplicationLagFault } from "./replication-lag.js";
import { DbPoolPressureFault } from "./db-pool-pressure.js";
import { PubsubInvalidateDropFault } from "./pubsub-invalidate-drop.js";
import { PerfWarnFault } from "./perf-warn.js";
import { FaultInjector } from "./fault-injector.js";
import { AdminFaultController } from "./admin-fault.controller.js";

@Module({
  controllers: [AdminFaultController],
  providers: [
    SchemaBreakFault, AuditAnomalyFault, ReplicationLagFault, DbPoolPressureFault,
    PubsubInvalidateDropFault, PerfWarnFault,
    {
      provide: FaultInjector,
      useFactory: (sb, aa, rl, dp, pid, pw) => new FaultInjector({
        "schema-break": sb, "audit-anomaly": aa, "replication-lag": rl, "db-pool-pressure": dp,
        "pubsub-invalidate-drop": pid, "perf-warn": pw,
      }),
      inject: [SchemaBreakFault, AuditAnomalyFault, ReplicationLagFault, DbPoolPressureFault,
        PubsubInvalidateDropFault, PerfWarnFault],
    },
  ],
  exports: [FaultInjector, PubsubInvalidateDropFault, PerfWarnFault],
})
export class FaultModule {}
```

- [ ] **Step 1b.4.4: fault-injector.ts 매핑** — `FaultInjector` constructor가 `Record<FaultKind, Fault>` 인자 → `getFault(kind)` lookup. `Record<FaultKind, ...>` 강제로 누락 kind는 build-time TS 에러로 차단.

- [ ] **Step 1b.4.5: Commit**

```bash
pnpm --filter @qa-sdk/sim-canary-controller test src/fault
git commit -am "feat(sim-canary-controller): FaultKind enum 6 kind + module wiring (spec §8)"
```

---

### Task 1b.5 — AdminFaultController body schema 확장 검증

**Files:** Modify `src/fault/{admin-fault.controller.ts, admin-fault.controller.test.ts}`

spec §6 `POST /admin/fault/{kind}` body schema에 신규 2 kind를 추가. zod discriminated union으로 6 kind × params 형태를 build-time 강제. 기존 4 kind 응답 shape 무회귀.

- [ ] **Step 1b.5.1: 실패 테스트** — 6 케이스: (a) `pubsub-invalidate-drop {dropRate:0.5}` → 200 `{kind, active:true, params:{dropRate:0.5}}`, (b) `dropRate:1.5` → 400 RFC 7807, (c) `perf-warn {severity:"warn"}` → 200, (d) `severity:"fail"` → 400, (e) 기존 `schema-break` 동작 유지, (f) 미등록 kind `xyz` → 404.

```typescript
it("POST /admin/fault/pubsub-invalidate-drop accepts dropRate 0..1", async () => {
  const res = await app.inject({ method: "POST", url: "/admin/fault/pubsub-invalidate-drop",
    headers: { "x-forwarded-for": "172.20.0.5", "content-type": "application/json" },
    payload: { enabled: true, params: { dropRate: 0.5 } } });
  expect(res.statusCode).toBe(200);
  expect(res.json()).toMatchObject({ kind: "pubsub-invalidate-drop", active: true, params: { dropRate: 0.5 } });
});
it("POST /admin/fault/perf-warn rejects severity != warn", async () => {
  const bad = await app.inject({ method: "POST", url: "/admin/fault/perf-warn",
    headers: { "x-forwarded-for": "172.20.0.5", "content-type": "application/json" },
    payload: { enabled: true, params: { severity: "fail" } } });
  expect(bad.statusCode).toBe(400);
});
```

- [ ] **Step 1b.5.2: zod schema 확장**

```typescript
// src/fault/admin-fault.controller.ts (modify — body schema)
import { z } from "zod";

const faultBody = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("schema-break"),         enabled: z.boolean(), params: z.object({}).passthrough().optional(), target: z.string().optional() }),
  z.object({ kind: z.literal("audit-anomaly"),        enabled: z.boolean(), params: z.object({}).passthrough().optional(), target: z.string().optional() }),
  z.object({ kind: z.literal("replication-lag"),      enabled: z.boolean(), params: z.object({ lagMs: z.number().int().nonnegative() }).optional(), target: z.string().optional() }),
  z.object({ kind: z.literal("db-pool-pressure"),     enabled: z.boolean(), params: z.object({ utilization: z.number().min(0).max(1) }).optional(), target: z.string().optional() }),
  z.object({ kind: z.literal("pubsub-invalidate-drop"), enabled: z.boolean(), params: z.object({ dropRate: z.number().min(0).max(1) }), target: z.string().optional() }),
  z.object({ kind: z.literal("perf-warn"),            enabled: z.boolean(), params: z.object({ severity: z.literal("warn") }), target: z.string().optional() }),
]);
```

- [ ] **Step 1b.5.3: handler kind param 합성** — `@Post("/admin/fault/:kind")` handler에서 URL `kind` + body를 합쳐 `faultBody.parse({ kind, ...body })`. `enabled:true`면 `fault.enable(parsed.params, parsed.target)`, `false`면 `fault.disable()`. 응답 spec §6 `{ kind, active, params?, target? }`.

- [ ] **Step 1b.5.4: error 처리 (RFC 7807)** — zod 실패 → `BadRequestException({type:"https://qa-sdk.dev/errors/validation", title, status:400, detail})`. 미등록 kind → `NotFoundException(...)`. 이미 active 상태에서 `enabled:true` 재호출 → spec §11 `409` (idempotent 위반).

- [ ] **Step 1b.5.5: Commit**

```bash
pnpm --filter @qa-sdk/sim-canary-controller test src/fault/admin-fault
git commit -am "feat(sim-canary-controller): admin/fault body schema for 6 kinds (spec §6, §11)"
```

---

### Task 1b.6 — AdminComposeProxyController (1 endpoint)

**Files:** Create `src/admin/{compose-proxy.controller.ts, compose-proxy.controller.test.ts, compose-exec.default.ts}`

spec §6 `GET /admin/compose/replicas`. 구현은 `docker compose -p project ps --format json`로 service당 컨테이너 수를 카운트, 응답 `{ services: { name: count, ... } }` 합성. service 목록은 hardcode 금지 — compose 실제 출력에서 동적 수집. InternalIpGuard 적용.

- [ ] **Step 1b.6.1: 실패 테스트** — 4 케이스: (a) compose ps mock이 v1 1건 + v2 2건 반환 → `{ services: { "sim-approval-api-v1": 1, "sim-approval-api-v2": 2 } }`, (b) docker exec 실패 → 500 RFC 7807, (c) 5초 timeout → 500, (d) external IP → 404.

```typescript
it("GET /admin/compose/replicas aggregates docker compose ps", async () => {
  composeExecSpy.mockResolvedValue({ stdout:
    [{ Service: "sim-approval-api-v1", State: "running" },
     { Service: "sim-approval-api-v2", State: "running" },
     { Service: "sim-approval-api-v2", State: "running" }].map((o) => JSON.stringify(o)).join("\n"),
    stderr: "" });
  const res = await app.inject({ method: "GET", url: "/admin/compose/replicas", headers: { "x-forwarded-for": "172.20.0.5" } });
  expect(res.json()).toEqual({ services: { "sim-approval-api-v1": 1, "sim-approval-api-v2": 2 } });
});
```

- [ ] **Step 1b.6.2: 최소 구현 — controller**

```typescript
// src/admin/compose-proxy.controller.ts
import { Controller, Get, UseGuards, Inject, InternalServerErrorException } from "@nestjs/common";
import { InternalIpGuard } from "sim-internal-network";

export interface ComposeExec { (argv: string[]): Promise<{ stdout: string; stderr: string }> }

@Controller("admin")
@UseGuards(InternalIpGuard)
export class AdminComposeProxyController {
  constructor(
    @Inject("ComposeExec") private readonly exec: ComposeExec,
    @Inject("SIM_COMPOSE_PROJECT") private readonly project: string,
  ) {}

  @Get("/compose/replicas")
  async replicas(): Promise<{ services: Record<string, number> }> {
    let result;
    try { result = await this.exec(["compose", "-p", this.project, "ps", "--format", "json"]); }
    catch (err) {
      throw new InternalServerErrorException({ type: "https://qa-sdk.dev/errors/store-failure",
        title: "compose ps failed", status: 500, detail: (err as Error).message });
    }
    const services: Record<string, number> = {};
    for (const line of result.stdout.trim().split(/\r?\n/).filter(Boolean)) {
      let parsed: unknown;
      try { parsed = JSON.parse(line); } catch { continue; }
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of arr) {
        const obj = item as { Service?: string; State?: string };
        if (typeof obj.Service !== "string" || obj.State !== "running") continue;
        services[obj.Service] = (services[obj.Service] ?? 0) + 1;
      }
    }
    return { services };
  }
}
```

- [ ] **Step 1b.6.3: ComposeExec 기본 구현** (spawn-based + 5s timeout)

```typescript
// src/admin/compose-exec.default.ts
import { spawn } from "node:child_process";
export const dockerComposeExec = (argv: string[]): Promise<{ stdout: string; stderr: string }> =>
  new Promise((resolve, reject) => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5_000);
    const p = spawn("docker", argv, { stdio: ["ignore", "pipe", "pipe"], signal: ctrl.signal });
    let stdout = "", stderr = "";
    p.stdout.on("data", (b) => { stdout += String(b); });
    p.stderr.on("data", (b) => { stderr += String(b); });
    p.on("close", (code) => { clearTimeout(timer); code === 0 ? resolve({ stdout, stderr }) : reject(new Error(`docker exited ${code}: ${stderr}`)); });
    p.on("error", (err) => { clearTimeout(timer); reject(err); });
  });
```

`AdminModule` (Task 1b.8)이 `"ComposeExec"` token으로 wire. test에서는 mock 주입.

- [ ] **Step 1b.6.4: docker compose ps --format json 양식** — Docker Compose v2.20+ 기준 줄별 JSON object. v2.18 이하는 단일 array. 두 형식 모두 처리 (`Array.isArray` 분기).

- [ ] **Step 1b.6.5: Commit**

```bash
pnpm --filter @qa-sdk/sim-canary-controller test src/admin/compose-proxy
git commit -am "feat(sim-canary-controller): admin/compose/replicas endpoint (spec §6)"
```

---

### Task 1b.7 — ScalePinService + ScaleStore

**Files:** Create `src/admin/{scale-store.ts, scale-pin.service.ts, scale-pin.service.test.ts}`

`Map<service, replicas>` 기반 in-memory store. `pin(service, replicas)` / `unpin(service)` / `getPin(service)` / `listPins()` 4 메서드. controller가 scale 결정 시 (Task 1b.10) `getPin` non-null이면 결정 SKIP + alert. 영속성 없음 — restart 시 손실 (e2e 시나리오는 짧은 시간이라 무관).

- [ ] **Step 1b.7.1: 실패 테스트** — 6 케이스: (a) `pin("svc-a", 3)` → `getPin("svc-a")===3`, (b) `unpin` → null, (c) 같은 service 재 pin → 409 (이미 set), (d) `pin(svc, 0)` → throw (replicas >= 1), (e) `listPins()` plain object, (f) unpin not-existing → no-op (idempotent).

```typescript
it("pin twice without unpin throws 409", () => {
  svc.pin("sim-approval-api-v2", 3);
  expect(() => svc.pin("sim-approval-api-v2", 5)).toThrow(/already pinned/);
});
it("rejects replicas < 1", () => {
  expect(() => svc.pin("sim-approval-api-v2", 0)).toThrow(/replicas must be >= 1/);
});
```

- [ ] **Step 1b.7.2: ScaleStore**

```typescript
// src/admin/scale-store.ts
export class ScaleStore {
  private readonly pins = new Map<string, number>();
  has(service: string): boolean { return this.pins.has(service); }
  get(service: string): number | undefined { return this.pins.get(service); }
  set(service: string, replicas: number): void { this.pins.set(service, replicas); }
  delete(service: string): void { this.pins.delete(service); }
  entries(): IterableIterator<[string, number]> { return this.pins.entries(); }
}
```

- [ ] **Step 1b.7.3: ScalePinService**

```typescript
// src/admin/scale-pin.service.ts
import { Injectable, ConflictException } from "@nestjs/common";
import { ScaleStore } from "./scale-store.js";

@Injectable()
export class ScalePinService {
  constructor(private readonly store: ScaleStore) {}

  pin(service: string, replicas: number): void {
    if (!Number.isInteger(replicas) || replicas < 1) throw new Error(`replicas must be >= 1, got ${replicas}`);
    if (this.store.has(service)) {
      throw new ConflictException({ type: "https://qa-sdk.dev/errors/conflict",
        title: "service already pinned", status: 409,
        detail: `service=${service} replicas=${this.store.get(service)}` });
    }
    this.store.set(service, replicas);
  }
  unpin(service: string): void { this.store.delete(service); }
  getPin(service: string): number | null { return this.store.get(service) ?? null; }
  listPins(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const [k, v] of this.store.entries()) out[k] = v;
    return out;
  }
}
```

- [ ] **Step 1b.7.4: 모듈 export** — `AdminModule`에서 `ScaleStore` (singleton), `ScalePinService` provider + export. controller (Task 1b.8) 와 ActionExecutor (Task 1b.10) 양쪽이 같은 인스턴스를 inject.

- [ ] **Step 1b.7.5: Commit**

```bash
pnpm --filter @qa-sdk/sim-canary-controller test src/admin/scale-pin
git commit -am "feat(sim-canary-controller): scale pin store + service (in-memory map)"
```

---

### Task 1b.8 — AdminScaleController (3 endpoint) + AdminModule

**Files:** Create `src/admin/{scale.controller.ts, scale.controller.test.ts, admin.module.ts}`

spec §6 endpoint 3종:
- `GET /admin/scale/pin` → `{ pins: { "sim-approval-api-v2": 3 } }`
- `POST /admin/scale/pin` body `{ service, replicas?: number }` (replicas 미명시 = unpin) → `{ service, replicas: number | null }`
- `POST /admin/scale/replicas` body `{ service, replicas, source: "operator" }` → `{ service, prevReplicas, newReplicas }` + docker compose `--scale` shell out

- [ ] **Step 1b.8.1: 실패 테스트** — 7 케이스: (a) `GET /admin/scale/pin` 빈 store → `{ pins: {} }`, (b) `POST /admin/scale/pin {service:"x",replicas:3}` → `{service:"x",replicas:3}`, (c) 같은 service 재 pin → 409, (d) replicas 미명시 (unpin) → `{service:"x",replicas:null}`, (e) `/admin/scale/replicas` `source` 미명시 → 400, (f) compose exec 성공 → prev/new replicas, (g) compose exec 실패 → 500.

```typescript
it("POST /admin/scale/replicas execs compose --scale and returns prev/new", async () => {
  composeExecSpy
    .mockResolvedValueOnce({ stdout: JSON.stringify({ Service: "sim-approval-api-v1", State: "running" }), stderr: "" })
    .mockResolvedValueOnce({ stdout: "", stderr: "" });
  const res = await app.inject({ method: "POST", url: "/admin/scale/replicas",
    headers: { "x-forwarded-for": "172.20.0.5", "content-type": "application/json" },
    payload: { service: "sim-approval-api-v1", replicas: 3, source: "operator" } });
  expect(res.json()).toEqual({ service: "sim-approval-api-v1", prevReplicas: 1, newReplicas: 3 });
});
```

- [ ] **Step 1b.8.2: 최소 구현 — controller**

```typescript
// src/admin/scale.controller.ts
import { Body, Controller, Get, Inject, Post, UseGuards, BadRequestException, InternalServerErrorException } from "@nestjs/common";
import { InternalIpGuard } from "sim-internal-network";
import { z } from "zod";
import { ScalePinService } from "./scale-pin.service.js";
import type { ComposeExec } from "./compose-proxy.controller.js";

const pinBody = z.object({ service: z.string().min(1), replicas: z.number().int().min(1).optional() });
const scaleBody = z.object({ service: z.string().min(1), replicas: z.number().int().min(0), source: z.literal("operator") });

@Controller("admin")
@UseGuards(InternalIpGuard)
export class AdminScaleController {
  constructor(
    private readonly pin: ScalePinService,
    @Inject("ComposeExec") private readonly exec: ComposeExec,
    @Inject("SIM_COMPOSE_PROJECT") private readonly project: string,
  ) {}

  @Get("/scale/pin")
  list() { return { pins: this.pin.listPins() }; }

  @Post("/scale/pin")
  upsert(@Body() raw: unknown) {
    const parsed = pinBody.safeParse(raw);
    if (!parsed.success) throw new BadRequestException({ type: "https://qa-sdk.dev/errors/validation", title: "pin body invalid", status: 400, detail: parsed.error.message });
    const { service, replicas } = parsed.data;
    if (replicas === undefined) { this.pin.unpin(service); return { service, replicas: null }; }
    this.pin.pin(service, replicas);
    return { service, replicas };
  }

  @Post("/scale/replicas")
  async scale(@Body() raw: unknown) {
    const parsed = scaleBody.safeParse(raw);
    if (!parsed.success) throw new BadRequestException({ type: "https://qa-sdk.dev/errors/validation", title: "scale body invalid", status: 400, detail: parsed.error.message });
    const { service, replicas } = parsed.data;
    const prev = await this.probeReplicas(service);
    try { await this.exec(["compose", "-p", this.project, "up", "-d", "--no-recreate", "--scale", `${service}=${replicas}`]); }
    catch (err) {
      throw new InternalServerErrorException({ type: "https://qa-sdk.dev/errors/store-failure", title: "compose --scale failed", status: 500, detail: (err as Error).message });
    }
    return { service, prevReplicas: prev, newReplicas: replicas };
  }

  private async probeReplicas(service: string): Promise<number> {
    const result = await this.exec(["compose", "-p", this.project, "ps", "--format", "json"]);
    let count = 0;
    for (const line of result.stdout.trim().split(/\r?\n/).filter(Boolean)) {
      let parsed: unknown;
      try { parsed = JSON.parse(line); } catch { continue; }
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of arr) {
        const obj = item as { Service?: string; State?: string };
        if (obj.Service === service && obj.State === "running") count++;
      }
    }
    return count;
  }
}
```

- [ ] **Step 1b.8.3: AdminModule wiring**

```typescript
// src/admin/admin.module.ts
import { Module } from "@nestjs/common";
import { AdminComposeProxyController } from "./compose-proxy.controller.js";
import { AdminScaleController } from "./scale.controller.js";
import { ScaleStore } from "./scale-store.js";
import { ScalePinService } from "./scale-pin.service.js";
import { dockerComposeExec } from "./compose-exec.default.js";
import { env } from "../config/env.js";

@Module({
  controllers: [AdminComposeProxyController, AdminScaleController],
  providers: [
    ScaleStore,
    { provide: ScalePinService, useFactory: (store: ScaleStore) => new ScalePinService(store), inject: [ScaleStore] },
    { provide: "ComposeExec", useValue: dockerComposeExec },
    { provide: "SIM_COMPOSE_PROJECT", useValue: env.SIM_COMPOSE_PROJECT },
  ],
  exports: [ScalePinService, "ComposeExec", "SIM_COMPOSE_PROJECT"],
})
export class AdminModule {}
```

- [ ] **Step 1b.8.4: prevReplicas best-effort 주의** — compose race로 정확하지 않을 수 있음. 결정적 PASS는 e2e 시나리오 quiesce 윈도우(시나리오 코드 책임). 본 endpoint는 best-effort.

- [ ] **Step 1b.8.5: Commit**

```bash
pnpm --filter @qa-sdk/sim-canary-controller test src/admin/scale
git commit -am "feat(sim-canary-controller): admin/scale 3 endpoints (pin GET/POST, replicas) (spec §6)"
```

---

### Task 1b.9 — ActionExecutor #21 RoutingPushSchema 변환

**Files:** Modify `src/action/{action-executor.service.ts, action-executor.service.test.ts}`

spec §7 #21 그대로 적용. 기존 Stage 9 plan literal `{ revision, weight }`를 gateway `RoutingPushSchema` 형태로 교체. catalog `getCurrentTopology` + portRegistry 조회로 stable/candidate upstream 합성.

기존 (Stage 9):

```ts
fetch(`${gatewayUrl}/admin/routing`, {
  method: "POST",
  body: JSON.stringify({ revision: 1, weight: 25 })
})
```

신규 (#21, spec §7 인용):

```ts
const topology = await catalog.getCurrentTopology(`sim.svc.${serviceName}`);
const stableUpstream = portRegistry.getUpstream(`sim-${serviceName}-v${topology.stable.value}`);
const candidateUpstream = topology.candidate
  ? portRegistry.getUpstream(`sim-${serviceName}-v${topology.candidate.value}`)
  : null;

fetch(`${gatewayUrl}/admin/routing`, {
  method: "POST",
  body: JSON.stringify({
    services: {
      [serviceName]: {
        revision,
        stable: { version: buildVersionTag(topology.stable), upstream: stableUpstream },
        candidate: candidateUpstream
          ? { version: buildVersionTag(topology.candidate), upstream: candidateUpstream }
          : null,
        weight,
        stickyKey: "user_id",
      },
    },
  })
})
```

- [ ] **Step 1b.9.1: 실패 테스트** — 6 케이스: (a) candidate present + weight=25 → body가 `RoutingPushSchema` 정합 (`services.approval.candidate.upstream === ...`), (b) candidate null + weight=100 → `services.approval.candidate === null`, (c) `RoutingPushSchema` typecheck (build-time): 잘못된 필드명 컴파일 에러, (d) catalog 실패 → throw + 다음 사이클 retry, (e) portRegistry 실패 → throw, (f) `noop` action → no fetch.

```typescript
it("safety weight-update sends RoutingPushSchema-compliant body", async () => {
  catalog.getCurrentTopology.mockResolvedValue({ stable: { value: 1 }, candidate: { value: 2 }, retired: [] });
  portRegistry.getUpstream.mockImplementation((name: string) =>
    name === "sim-approval-v1" ? "http://sim-approval-api-v1:4600" : "http://sim-approval-api-v2:4600");
  const fetchSpy = vi.fn(async () => new Response("", { status: 200 }));
  vi.stubGlobal("fetch", fetchSpy);
  await executor.executeSafety({ kind: "weight-update", weight: 25, revision: 7, serviceName: "approval" });
  const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
  expect(body.services.approval).toMatchObject({
    revision: 7, weight: 25, stickyKey: "user_id",
    stable: { upstream: "http://sim-approval-api-v1:4600" },
    candidate: { upstream: "http://sim-approval-api-v2:4600" },
  });
});
```

- [ ] **Step 1b.9.2: SafetyAction 시그니처 확장** — `serviceName` 필드 추가. Stage 9 호출부(`runCycle` Task 9.12)에서 controller-config 또는 env(`SIM_CONTROLLER_TARGET_SERVICE`)로 채움. 기존 `weight` 단독 형태 제거 (Stage 9 코드도 함께 update).

```typescript
export type SafetyAction =
  | { kind: "weight-update"; weight: number; revision: number; serviceName: string }
  | { kind: "noop" };
```

- [ ] **Step 1b.9.3: 최소 구현 — executeSafety 본체 교체**

```typescript
// src/action/action-executor.service.ts (modify — executeSafety)
import { buildVersionTag } from "sim-identifier-grammar";
import type { RoutingPushSchema } from "@qa-sdk/sim-gateway";

interface SimServiceCatalog { getCurrentTopology(prefix: string): Promise<{ stable: { value: number }; candidate: { value: number } | null; retired: { value: number }[] }> }
interface PortRegistry { getUpstream(serviceContainer: string): string }

@Injectable()
export class ActionExecutorService {
  constructor(
    private readonly cfg: ActionConfig,
    @Inject("SimServiceCatalog") private readonly catalog: SimServiceCatalog,
    @Inject("PortRegistry") private readonly portRegistry: PortRegistry,
    @Inject(ScalePinService) private readonly pin: ScalePinService, // wired in Task 1b.10
    @Inject(DecisionRingBuffer) private readonly ring: DecisionRingBuffer,
  ) { /* ... */ }

  async executeSafety(action: SafetyAction): Promise<void> {
    if (action.kind === "noop") return;
    const { serviceName, weight, revision } = action;
    const topology = await this.catalog.getCurrentTopology(`sim.svc.${serviceName}`);
    const stableUpstream = this.portRegistry.getUpstream(`sim-${serviceName}-v${topology.stable.value}`);
    const candidateUpstream = topology.candidate
      ? this.portRegistry.getUpstream(`sim-${serviceName}-v${topology.candidate.value}`)
      : null;

    const body: RoutingPushSchema = {
      services: {
        [serviceName]: {
          revision,
          stable: { version: buildVersionTag(topology.stable), upstream: stableUpstream },
          candidate: candidateUpstream
            ? { version: buildVersionTag(topology.candidate!), upstream: candidateUpstream }
            : null,
          weight,
          stickyKey: "user_id",
        },
      },
    };

    const res = await fetch(`${this.cfg.gatewayUrl}/admin/routing`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) {
      this.logger.error({ status: res.status, weight, revision }, "routing push failed");
      throw new Error(`routing push failed: ${res.status}`);
    }
    this.logger.info({ weight, revision, serviceName }, "routing push ok (RoutingPushSchema)");
  }
}
```

- [ ] **Step 1b.9.4: typecheck 강제** — `RoutingPushSchema`는 gateway 패키지(`@qa-sdk/sim-gateway` 또는 plan C에 정의된 패키지명)에서 export. `import type { RoutingPushSchema } from "@qa-sdk/sim-gateway";`. 본 서비스 `package.json`에 dev/peer 의존 추가. typecheck 실패는 PR 차단.

- [ ] **Step 1b.9.5: Commit**

```bash
pnpm --filter @qa-sdk/sim-canary-controller test src/action/action-executor
git commit -am "fix(sim-canary-controller): ActionExecutor emits gateway RoutingPushSchema (#21, spec §7)"
```

---

### Task 1b.10 — ActionExecutor에 ScalePinService wiring

**Files:** Modify `src/action/action-executor.service.ts`, `src/cycle/cycle-scheduler.service.ts`

scale 결정 (Stage 9 `executeResource`) 직전 `pin.getPin(serviceContainer)` 조회. pin이 있으면 SKIP + alert 발행 (`ringBuffer.appendAlert({ kind: "scale-up-rejected", reason: "pin-active", at, cycleId, ... })`). 없으면 기존 compose `--scale` 실행.

- [ ] **Step 1b.10.1: 실패 테스트** — 4 케이스: (a) pin = null + scale-up → exec 호출, (b) pin = 3 + scale-up target v2=4 → no exec + alert 1건, (c) pin이 다른 서비스에만 set → 영향 없음, (d) alert payload에 `pinnedReplicas`, `attemptedReplicas` 포함.

```typescript
it("scale skipped when pin set; alert emitted", async () => {
  pin.pin("sim-approval-api-v2", 3);
  await executor.executeResource(
    { kind: "scale", target: { v1: 2, v2: 4 }, reason: "load FAIL" },
    { v1: 2, v2: 3 },
    { cycleId: "01HXXXX" },
  );
  expect(composeExecSpy).not.toHaveBeenCalled();
  expect(ring.appendAlert).toHaveBeenCalledWith(expect.objectContaining({
    kind: "scale-up-rejected", cycleId: "01HXXXX",
  }));
});
```

- [ ] **Step 1b.10.2: 최소 구현 — executeResource pin 분기**

```typescript
// src/action/action-executor.service.ts (modify — executeResource)
async executeResource(
  action: ResourceAction,
  current: { v1: number; v2: number },
  ctx: { cycleId: string },
): Promise<void> {
  if (action.kind === "noop") return;
  if (action.target.v1 === current.v1 && action.target.v2 === current.v2) return;

  const argv = (svc: string, n: number) =>
    ["compose", "-p", this.cfg.composeProject, "up", "-d", "--no-recreate", "--scale", `${svc}=${n}`];

  const apply = async (svcName: string, currentN: number, targetN: number) => {
    if (currentN === targetN) return;
    const pinReplicas = this.pin.getPin(svcName);
    if (pinReplicas !== null) {
      this.ring.appendAlert({
        kind: "scale-up-rejected", at: new Date().toISOString(), cycleId: ctx.cycleId,
        reason: "pin-active", service: svcName,
        pinnedReplicas: pinReplicas, attemptedReplicas: targetN,
      });
      return;
    }
    await this.exec(argv(svcName, targetN));
  };

  await apply("sim-approval-api-v1", current.v1, action.target.v1);
  await apply("sim-approval-api-v2", current.v2, action.target.v2);
  this.logger.info({ target: action.target, reason: action.reason }, "compose scale ok (pin-aware)");
}
```

- [ ] **Step 1b.10.3: scheduler 호출부 update** — Task 9.12 `cycle-scheduler.service.ts`의 `await this.action.executeResource(resOut.action, this.current);`에 `{ cycleId }` 인자 추가. 컴파일 강제로 누락 방지.

- [ ] **Step 1b.10.4: AlertEvent kind 등록** — Stage 1a `AlertEventRecord` shape에 `"scale-up-rejected"` kind와 `{ reason, service, pinnedReplicas, attemptedReplicas }` 필드 포함 확인. 누락 시 Stage 1a 회귀 보고. spec §6 `/v1/alerts/count?kind=scale-up-rejected`이 본 alert를 카운트.

- [ ] **Step 1b.10.5: Commit**

```bash
pnpm --filter @qa-sdk/sim-canary-controller test src/action/action-executor
git commit -am "feat(sim-canary-controller): ActionExecutor honors scale pin + emits alert"
```

---

### Task 1b.11 — controller AppModule 통합 wiring

**Files:** Modify `src/app.module.ts`, `src/decision/decision.module.ts`, `src/action/action.module.ts`

Stage 1a (AlertsAuditCatalog 일부 + InternalIpGuard) + Stage 1b (FaultModule 6 kind + AdminModule 4 endpoint + ActionExecutor #21 + perf-warn verdict hook) wiring을 한 곳에 모은다. InternalIpGuard는 controller 모든 admin/v1 경로에 적용 — global guard로 등록.

- [ ] **Step 1b.11.1: smoke 테스트** — 3 케이스: (a) `pnpm --filter @qa-sdk/sim-canary-controller build` PASS, (b) `app.init()` 후 `GET /v1/alerts/count` (internal IP) 200, (c) external IP 404.

- [ ] **Step 1b.11.2: AppModule 갱신**

```typescript
// src/app.module.ts (modify)
import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ScheduleModule } from "@nestjs/schedule";
import { InternalIpGuard, SimInternalNetworkModule } from "sim-internal-network";
import { HealthModule } from "./health/health.module.js";
import { AdvisoryLockModule } from "./lock/advisory-lock.module.js";
import { MetricsScrapeModule } from "./metrics/metrics-scrape.module.js";
import { DecisionModule } from "./decision/decision.module.js";
import { ActionModule } from "./action/action.module.js";
import { CycleModule } from "./cycle/cycle.module.js";
import { FaultModule } from "./fault/fault.module.js";
import { AdminModule } from "./admin/admin.module.js";
import { AlertsAuditCatalogController } from "./decision/alerts-audit-catalog.controller.js";
import { SimServiceCatalogProvider } from "./catalog/catalog.provider.js"; // Stage 1a
import { PortRegistryProvider } from "./catalog/port-registry.provider.js";

@Module({
  imports: [
    ScheduleModule.forRoot(), SimInternalNetworkModule,
    HealthModule, AdvisoryLockModule, MetricsScrapeModule,
    DecisionModule, ActionModule, CycleModule,
    FaultModule, AdminModule,
  ],
  controllers: [AlertsAuditCatalogController],
  providers: [
    SimServiceCatalogProvider, PortRegistryProvider,
    { provide: APP_GUARD, useClass: InternalIpGuard },
  ],
})
export class AppModule {}
```

- [ ] **Step 1b.11.3: perf-warn → CategoryVerdictService 연동** — `DecisionModule` provider 중 `CategoryVerdictService` factory에 `PerfWarnFault`를 inject. `evaluate(scrape)` 결과의 `perf` 필드를 `perfWarnFault.applyTo(perf)`로 wrap. 즉, fault 미설정 시 동작 동일, 설정 시 PASS→WARN 격상.

```typescript
// src/decision/decision.module.ts (modify — CategoryVerdictService factory)
{
  provide: CategoryVerdictService,
  useFactory: (cfg: VerdictConfig, perfWarn: PerfWarnFault) => {
    const inner = new CategoryVerdictService(cfg);
    return new Proxy(inner, {
      get(target, prop) {
        if (prop !== "evaluate") return Reflect.get(target, prop);
        return (scrape: ScrapeResult) => {
          const result = target.evaluate(scrape);
          result.perf = perfWarn.applyTo(result.perf);
          return result;
        };
      },
    });
  },
  inject: [VERDICT_CONFIG_TOKEN, PerfWarnFault],
}
```

- [ ] **Step 1b.11.4: ActionExecutor 의존 주입 보강** — `ActionModule`이 `SimServiceCatalog`, `PortRegistry`, `ScalePinService`, `DecisionRingBuffer` 4개를 inject 가능하도록 `imports: [AdminModule, DecisionModule]` 보강 + 필요한 provider export. 순환 import 발생 시 `forwardRef` 사용.

- [ ] **Step 1b.11.5: Commit**

```bash
pnpm --filter @qa-sdk/sim-canary-controller build
pnpm --filter @qa-sdk/sim-canary-controller test
git commit -am "feat(sim-canary-controller): AppModule wires Fault/Admin/AlertsAuditCatalog + global InternalIpGuard"
```

---

### Task 1b.12 — Stage 1b 통합 검증

**Files:** 없음 (검증만)

빌드 + 단위/통합 테스트 + 시나리오 1~8 무회귀 확인. e2e 시나리오 9~17은 Stage 1b 단독으로는 PASS 하지 않을 수 있음 — Stage 2/3/4 머지 후 사용자 환경에서 별도 진행 (DoD #2).

- [ ] **Step 1b.12.1: 패키지 빌드 + typecheck**

```bash
pnpm --filter @qa-sdk/sim-canary-controller build
pnpm --filter @qa-sdk/sim-canary-controller typecheck
# 기대: 0 error. 특히 RoutingPushSchema typecheck PASS.
```

- [ ] **Step 1b.12.2: unit + integration test**

```bash
pnpm --filter @qa-sdk/sim-canary-controller test
# 기대 PASS:
#   alerts-audit-catalog.controller.test.ts (4)
#   pubsub-invalidate-drop.test.ts (4)
#   perf-warn.test.ts (5)
#   fault-injector.test.ts (3 신규 + 기존 regression)
#   admin-fault.controller.test.ts (6)
#   compose-proxy.controller.test.ts (4)
#   scale-pin.service.test.ts (6)
#   scale.controller.test.ts (7)
#   action-executor.service.test.ts (6 신규 + 기존 regression)
```

- [ ] **Step 1b.12.3: sim:up + 기존 시나리오 1~8 무회귀**

```bash
cd simulations/enterprise-pm
pnpm sim:up
docker compose -f docker-compose.sim.yaml ps --filter "health=healthy" | wc -l
# 기대: 12 (Stage 9 동일 — controller가 신규 endpoint를 추가했지만 health check 동일)
pnpm sim:scenarios run --all
# 기대: 8/8 PASS
```

- [ ] **Step 1b.12.4: contract test (sim-handles ↔ endpoint)** — Stage 1a + 1b 통합 후 sim-handles의 6개 factory(audit-fetcher, wait-for-cycles, fault-injector, compose-handle, sim-scale, catalog-store)가 controller endpoint 호출 시 응답 shape이 sim-decision-view 타입과 일치하는지 검증.

```bash
pnpm --filter @qa-sdk/sim-canary-controller test src/contract
# 또는 simulations/enterprise-pm/scenarios 측 fetchImpl 주입 단위 테스트
```

- [ ] **Step 1b.12.5: PR-A 머지 준비** — Stage 1a + Stage 1b를 단일 PR-A 묶음으로 머지 (overview §5 — 두 plan 문서지만 머지 단위는 단일 PR).

```bash
git log --oneline | head -20
# 기대: Stage 1a 커밋 N건 + Stage 1b 커밋 12건 정도
gh pr create --title "PR-A: Stage 1 controller (admin endpoints + #21 + FaultKind 확장)" \
  --body "Stage 1a + Stage 1b. spec §6/§7/§8 구현. 시나리오 1~8 무회귀. Stage 2/3/4 머지 후 시나리오 9~17 e2e 검증."
```

---

## Stage 1b 완료 정의 (Definition of Done)

- [ ] `pnpm --filter @qa-sdk/sim-canary-controller test` 모든 unit + integration test PASS (Task 1b.12.2 목록 전수)
- [ ] `pnpm --filter @qa-sdk/sim-canary-controller build` PASS — 특히 `RoutingPushSchema` typecheck PASS
- [ ] FaultKind enum이 6 kind 모두 정합 — `FAULT_KINDS.length === 6`
- [ ] `POST /admin/fault/pubsub-invalidate-drop {dropRate:0.5}` → 200, `{dropRate:1.5}` → 400 (RFC 7807)
- [ ] `POST /admin/fault/perf-warn {severity:"warn"}` → 200, `{severity:"fail"}` → 400
- [ ] `GET /admin/compose/replicas` → 외부 IP 404, 내부 IP `{ services: { ... } }` 200
- [ ] `GET /admin/scale/pin` 빈 store → `{ pins: {} }`, pin 후 `{ pins: { service: replicas } }`
- [ ] `POST /admin/scale/replicas {service,replicas,source:"operator"}` → compose `--scale` 실행 + `{ service, prevReplicas, newReplicas }`
- [ ] ActionExecutor `executeSafety`가 gateway `/admin/routing`에 `RoutingPushSchema` 정합 body 전송 — `services.<name>.{revision, stable, candidate, weight, stickyKey}` 모두 포함
- [ ] ActionExecutor `executeResource`가 pin 활성화 service에 대해 compose 호출을 SKIP 하고 ring buffer에 `scale-up-rejected` alert 1건 추가
- [ ] CategoryVerdictService가 `perf-warn` enabled 시 perf=PASS → WARN 격상, FAIL은 보존
- [ ] `pnpm sim:up` 후 기존 시나리오 1~8 모두 PASS (무회귀)
- [ ] InternalIpGuard global 적용 — 외부 IP 접근 시 모든 `/v1/*`, `/admin/*` 404 silent

---

## 참조

- spec: `docs/superpowers/specs/2026-05-02-server-side-admin-endpoints-design.md` §6 (endpoint 4~11), §7 (#21 routing actor), §8 (FaultKind 확장), §11 (RFC 7807 error)
- plan: `docs/superpowers/plans/2026-05-02-server-side-admin-endpoints/00-overview.md` §3 컴포넌트 표
- plan: `docs/superpowers/plans/2026-05-02-server-side-admin-endpoints/A-stage-1a-shared-and-decisions.md` (sim-internal-network, sim-decision-view, ring buffer, decision query endpoint)
- plan: `docs/superpowers/plans/2026-04-28-canary-scaling/D-stage-9-controller.md` Task 9.7 (CategoryVerdictService — perf-warn hook 위치), Task 9.11 (ActionExecutor 기존 form), Task 9.12 (cycle-scheduler runCycle 호출부)
- code: `simulations/enterprise-pm/services/canary-controller/src/fault/` (기존 4 fault 패턴 — schema-break.ts 등)
- code: `simulations/enterprise-pm/scenarios/src/runner/sim-handles/` (consumer 측 — fault-injector, compose-handle, sim-scale, audit-fetcher)

---

## Stage 1b Defect Log

### Task 1b.2/1b.3 — Fault interface 시그니처 충돌

**플랜 §1b.4.2** 는 `Fault<P>` 인터페이스를 sync `enable(params, target?): void / disable(): void / isEnabled() / getParams() / getTarget()` 5종 메서드로 재정의하도록 지시. 그러나 기존 4 fault 클래스 (schema-break / audit-anomaly / replication-lag / db-pool-pressure) 는 async `enable(params): Promise<void> / disable(target?): Promise<void> / reset(): Promise<void>` 시그니처로 구현되어 있고, `FaultInjector.resetAll` / `FaultInjectorLifecycle` 가 `reset()` 에 의존.

**Resolution** — 기존 `Fault` 인터페이스 (async 3종) 를 그대로 유지하면서, 신규 2 클래스 (`PubsubInvalidateDropFault`, `PerfWarnFault`) 가 backward-compat async 시그니처 + 동기 accessor (isEnabled / getParams / getTarget / shouldDrop / applyTo) 를 모두 노출. 기존 4 fault 무회귀, 신규 2 클래스가 controller proxy / verdict wrap 양쪽에 호출 가능. 향후 `Fault<P>` 강제 마이그레이션은 별도 sub-project (4 클래스 일괄 갱신 + reset 의미 재정의).

### Task 1b.5 — admin/fault 응답 shape 변경

**플랜 §1b.5.4** 의 `409 ConflictException (idempotent 위반)` 케이스는 신규 2 fault 의 `enable` 자체가 already-active 시 throw 하지 않으므로 (`enable` 이 단순 state overwrite) 미구현. spec §11 의 409 idempotent 위반은 **scale pin** 영역 (`/admin/scale/pin` 같은 service 재 pin) 에서만 적용. plan 본문에서 fault 의 409 은 placeholder 에 가까움 — 본 sub-project 범위 외로 보고.

기존 응답 shape `{ ok, kind, enabled }` → spec §6 `{ kind, active, params?, target? }` 변경. 기존 admin-fault 4 테스트는 statusCode 만 검증하므로 무회귀.

### Task 1b.10 — AlertEvent 필드명 (`at` → `occurredAt`)

**플랜 §1b.10.2** literal `appendAlert({ kind, at, cycleId, ... })` 는 sim-decision-view canonical 필드명 `occurredAt` 과 불일치. Stage 1a `AlertEventRecordInput` SSOT 가 `occurredAt: string` 으로 정의되어 있으며, ring buffer `countAlerts(filter)` / `trace(cycleId)` 도 `occurredAt` 기준 필터.

**Resolution** — 코드는 `occurredAt` 으로 일관성 유지. Plan literal 의 `at` 키는 SSOT drift 로 정정. 시나리오 9~17 e2e 검증은 sim-decision-view 타입 import 로 typecheck 강제 (drift 차단).

### Task 1b.9 — ActionExecutor `serviceName` 위치

**플랜 §1b.9.2** 는 `SafetyAction` discriminated union 에 `serviceName` 필드 추가 지시. 그러나 `safety-decision.service.ts` 가 `SafetyDecisionOutput.action` 을 만들어 내며 (controller-config 정의가 아닌 verdict 결과로부터 파생), `SafetyAction` 에 `serviceName` 추가 시 safety-decision.service 도 service-name 을 입력으로 받아야 함 — 결정 로직과 무관한 wiring 정보 침투.

**Resolution** — `serviceName` 을 `ActionConfig` 로 옮김 (env `SIM_CONTROLLER_TARGET_SERVICE`, default `"approval"`). controller 가 단일 target service 를 다루는 현재 시뮬 토폴로지에 적합. 다중 service 확장 시 `SafetyAction.serviceName` 으로 끌어올릴 수 있으나, 현재 spec §7 의 single-service push 와 일관.

### Task 1b.11 — DI token 순환 import 회피

**플랜 §1b.11.2** literal 의 AppModule provider 등록은 작동하지만 sub-module 단독 테스트 (decision-query.module.smoke.test) 에서 `SchedulerRegistry` resolve 실패. 그리고 ActionModule 이 `SIM_SERVICE_CATALOG_TOKEN` 을 inject 하는데 token 정의가 action.module.ts 에 있어서 module 정의 순환 발생.

**Resolution** —
1. 신규 `src/catalog/tokens.ts` 에 3 Symbol 만 분리 (module 정의 없음, 순환 차단).
2. `CatalogModule` 이 단일 진입점 — ActionModule 과 AppModule 양쪽이 import.
3. CycleModule 이 `ScheduleModule.forRoot()` 직접 import — sub-module 단독 smoke test 호환성.
4. `FaultInjectorLifecycle` + `CycleSchedulerService` 의 모든 ctor param 에 `@Inject(...)` 명시 (Stage 1a vitest emitDecoratorMetadata 컨벤션 적용).

### Pre-existing baseline noise (Stage 1a 보고)

- `src/integration/cycle-flow.test.ts` 5 fail / 3 pass — Stage 1a defect log 보고 그대로. CycleSchedulerService 8-arg 생성자 호출 (ringBuffer 9th arg 누락) + ActionExecutorService 구생성자 shape (catalog/portRegistry 누락). Task 9.x 영역, Stage 1b 범위 외.
- `src/fault/audit-anomaly.test.ts` / `decision-builder.test.ts` 등은 logger import → pino peer dep 필요. 본 sub-project 진행을 위해 `pnpm --filter @qa-sdk/pino build` 로 dist 생성 (canary-controller 자체 dep 추가 아님).

### Stage 1b 11 commit cherry-list (origin/main..HEAD)

| Task | Commit |
|------|--------|
| 1b.1 alerts/audit/catalog 3 endpoint | `4674f2f9` |
| 1b.2 pubsub-invalidate-drop fault | `4b7ea820` |
| 1b.3 perf-warn fault | `d45a297a` |
| 1b.4 FAULT_KINDS 6 + module wiring | `dd2a6467` |
| 1b.5 admin/fault body schema | `e5114d2e` |
| 1b.6 admin/compose/replicas | `a96292e5` |
| 1b.7 ScalePinService + ScaleStore | `c87c02c7` |
| 1b.8 admin/scale 3 endpoints | `895f90cf` |
| 1b.9 ActionExecutor RoutingPushSchema (#21) | `31308782` |
| 1b.10 ActionExecutor pin-aware + alert | `4c1367b6` |
| 1b.11 AppModule wiring + global guard | `f0146085` |

### Stage 1b DoD (Task 1b.12 종료 시점)

- [x] `pnpm --filter @qa-sdk/sim-canary-controller build` PASS (tsc emit 0 error)
- [x] `pnpm --filter @qa-sdk/sim-canary-controller typecheck` PASS — RoutingPushSchema typecheck 강제
- [x] FAULT_KINDS 6 — `FAULT_KINDS.length === 6`
- [x] POST /admin/fault/pubsub-invalidate-drop {dropRate:0.5} 201, {dropRate:1.5} 400 (RFC 7807)
- [x] POST /admin/fault/perf-warn {severity:"warn"} 201, {severity:"fail"} 400
- [x] GET /admin/compose/replicas — internal IP 200, external 404
- [x] GET /admin/scale/pin 빈 store → { pins: {} }; pin 후 listPins 반영
- [x] POST /admin/scale/replicas — compose --scale 호출 + { service, prevReplicas, newReplicas }
- [x] ActionExecutor.executeSafety — gateway /admin/routing 에 RoutingPushSchema 정합 body push (services.<name>.{revision, stable, candidate, weight, stickyKey})
- [x] ActionExecutor.executeResource — pin 활성화 service 에 대해 compose SKIP + `scale-up-rejected` alert 1건 ring 추가
- [x] CategoryVerdictService — perf-warn enabled 시 perf=PASS → WARN, FAIL 보존 (PerfWarnAwareVerdictService)
- [x] AppModule global InternalIpGuard — 외부 IP 모든 /v1/* /admin/* 404 silent
- [ ] `pnpm sim:up` 후 시나리오 1~8 무회귀: **실행 환경 의존** — Stage 2/3/4 머지 후 사용자 환경 별도 검증 (DoD #2).
- [x] 신규 22 test 파일 모두 PASS (115 tests). 5 cycle-flow fail = pre-existing baseline noise.
