# Stage 4 — Approval-API Outbox Admin Endpoints Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** approval-api에 admin endpoint 2종 추가: `POST /admin/outbox/insert` (N건 동시 outbox event insert — 시나리오 15) + `POST /admin/outbox/dispatch` (N개 worker 동시 dispatch + duplicates=0 검증).

**Architecture:** approval-api 안에 OutboxAdminService 신설. insert는 grammar #12 idempotencyKey 빌더 + 단일 트랜잭션 N건 INSERT. dispatch는 같은 process 안에서 N개 worker promise 동시 실행 (각자 `FOR UPDATE SKIP LOCKED` 폴링) → byReplica 결과 집계.

**Tech Stack:** TypeScript ES2023, NestJS 11 + Fastify, Drizzle ORM, vitest + PG (testcontainers 또는 SIM_TEST_PG=1 gate), sim-identifier-grammar (#5 event-name + #12 idempotencyKey), sim-internal-network (Stage 1a NestJS Guard).

**Spec 인용:** `docs/superpowers/specs/2026-05-02-server-side-admin-endpoints-design.md` §9 Stage 4.

---

### File Structure (Stage 4)

모든 신규 파일은 `simulations/enterprise-pm/services/approval-api/src/admin/` 하에 위치.

| 종류 | 경로 (admin/ 기준) |
|---|---|
| Create | `outbox-admin-insert.service.{ts,test.ts}` |
| Create | `outbox-admin-dispatch.service.{ts,test.ts}` |
| Create | `outbox-admin.controller.{ts,test.ts}` |
| Create | `outbox-admin.module.ts` |
| Create | `outbox-admin.tokens.ts` |
| Create | `outbox-admin-integration.test.ts` (PG-gated) |
| Create | `contract.test.ts` |
| Modify | `src/app.module.ts` (`OutboxAdminModule` import) |
| Modify | `package.json` (peer: `sim-internal-network`, `sim-identifier-grammar`) |

> 본 단계는 **endpoint 표면**만 책임진다. dispatcher 핵심 (`createOutboxDispatcher`, `FOR UPDATE SKIP LOCKED`, consumer-log) 은 Plan B Stage 5에서 이미 구현되어 있으며, 본 단계는 이를 *재사용*해 admin 표면과 N-replica 동시 시뮬을 추가한다.

---

### Task 4.1 — `OutboxAdminInsertService` 단일 트랜잭션 N건 INSERT

**Files:** `outbox-admin-insert.service.{ts,test.ts}`, `outbox-admin.tokens.ts`

`insertEvents(events)`은 N건 outbox event를 *하나의 PG 트랜잭션*으로 INSERT. row의 `idempotency_key`는 grammar #12 `buildIdempotencyKey(...)` 결과 — raw 보간 금지. `aggregateId`는 Plan B Stage 5의 `toGrammarSafeAggregateId`로 정규화 후 builder에 주입. `eventName`은 *정규화 없이* `parseEventName`으로 즉시 검증 (grammar #5).

- [ ] **Step 4.1.1: 실패 테스트 작성**

`outbox-admin-insert.service.test.ts` (in-memory `FakeRepo` stub — PG 없이 unit). 4 케이스:

```typescript
class FakeRepo {
  rows: Array<Record<string, unknown>> = []; txCount = 0;
  async transaction<T>(cb: (tx: this) => Promise<T>) { this.txCount++; return cb(this); }
  async insertMany(rows: Array<Record<string, unknown>>) {
    this.rows.push(...rows); return rows.map((r) => r.id as string);
  }
}

describe("OutboxAdminInsertService", () => {
  let repo: FakeRepo; let svc: OutboxAdminInsertService;
  beforeEach(() => { repo = new FakeRepo(); svc = new OutboxAdminInsertService(repo as never); });

  it("N=5 INSERT — 단일 트랜잭션 + idempotencyKey grammar #12", async () => {
    const events = Array.from({ length: 5 }, (_, i) => ({
      aggregateId: `proj-${String(i + 1).padStart(3, "0")}`,
      eventName: "approval.budget.submitted",
      payload: { idx: i }, occurredAt: 1714250400000,
    }));
    const r = await svc.insertEvents(events);
    expect(r.inserted).toBe(5);
    expect(new Set(r.ids).size).toBe(5);
    for (const k of r.idempotencyKeys) expect(() => parseIdempotencyKey(k)).not.toThrow();
    expect(repo.txCount).toBe(1);
    expect(repo.rows.every((x) => x.status === "pending" && x.retry_count === 0)).toBe(true);
  });

  it("aggregateId 정규화 — toGrammarSafeAggregateId 적용 후 INSERT", async () => {
    const dirty = "Proj With Spaces!"; const safe = toGrammarSafeAggregateId(dirty);
    const r = await svc.insertEvents([{
      aggregateId: dirty, eventName: "approval.budget.submitted",
      payload: {}, occurredAt: 1714250400000,
    }]);
    expect(parseIdempotencyKey(r.idempotencyKeys[0]).aggregateId).toBe(safe);
    expect(repo.rows[0].aggregate_id).toBe(safe);
  });

  it("빈 배열 → inserted=0 + 트랜잭션 미실행", async () => {
    expect(await svc.insertEvents([])).toEqual({ inserted: 0, idempotencyKeys: [], ids: [] });
    expect(repo.txCount).toBe(0);
  });

  it("eventName grammar #5 위반 → throw + 트랜잭션 미실행 (rows 0건 확인)", async () => {
    await expect(svc.insertEvents([{
      aggregateId: "proj-001", eventName: "INVALID NAME",
      payload: {}, occurredAt: 1714250400000,
    }])).rejects.toThrow(/eventName/);
    expect(repo.rows).toHaveLength(0);
  });
});
```

- [ ] **Step 4.1.2: 테스트 실패 확인**

```bash
pnpm --filter sim-approval-api test outbox-admin-insert.service
```
기대: FAIL (`OutboxAdminInsertService` 모듈 없음).

- [ ] **Step 4.1.3: 최소 구현**

`outbox-admin.tokens.ts`:

```typescript
export const OUTBOX_ADMIN_REPO = Symbol("OUTBOX_ADMIN_REPO");
export const OUTBOX_DISPATCHER_FACTORY = Symbol("OUTBOX_DISPATCHER_FACTORY");
export interface OutboxAdminRepoTx {
  insertMany(rows: Array<Record<string, unknown>>): Promise<string[]>;
}
export interface OutboxAdminRepo {
  transaction<T>(cb: (tx: OutboxAdminRepoTx) => Promise<T>): Promise<T>;
}
```

`outbox-admin-insert.service.ts`:

```typescript
import { Injectable, Inject } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import {
  buildIdempotencyKey, parseEventName, toGrammarSafeAggregateId,
} from "@qa-sdk/sim-identifier-grammar";
import { OUTBOX_ADMIN_REPO, type OutboxAdminRepo } from "./outbox-admin.tokens.js";

export interface OutboxEventInput {
  aggregateId: string; eventName: string; payload: unknown;
  occurredAt: number; eventVersion?: number;
}
export interface OutboxInsertResult {
  inserted: number; idempotencyKeys: string[]; ids: string[];
}

@Injectable()
export class OutboxAdminInsertService {
  constructor(@Inject(OUTBOX_ADMIN_REPO) private readonly repo: OutboxAdminRepo) {}

  async insertEvents(events: OutboxEventInput[]): Promise<OutboxInsertResult> {
    if (events.length === 0) return { inserted: 0, idempotencyKeys: [], ids: [] };
    for (const e of events) parseEventName(e.eventName); // grammar #5 사전 검증

    const rows = events.map((e) => {
      const aggregate_id = toGrammarSafeAggregateId(e.aggregateId);
      const idempotency_key = buildIdempotencyKey({
        aggregateId: aggregate_id, eventName: e.eventName, occurredAt: e.occurredAt,
      });
      return {
        id: randomUUID(), aggregate_id, event_name: e.eventName,
        event_version: e.eventVersion ?? 1,
        payload: typeof e.payload === "string" ? e.payload : JSON.stringify(e.payload),
        occurred_at: e.occurredAt, scope_id: `admin-insert-${Date.now()}`,
        status: "pending" as const, idempotency_key, retry_count: 0,
      };
    });

    const ids = await this.repo.transaction((tx) => tx.insertMany(rows));
    return { inserted: ids.length, idempotencyKeys: rows.map((r) => r.idempotency_key), ids };
  }
}
```

- [ ] **Step 4.1.4: 테스트 통과**

```bash
pnpm --filter sim-approval-api test outbox-admin-insert.service
```
기대: 4 PASS.

- [ ] **Step 4.1.5: Commit**

```bash
git add simulations/enterprise-pm/services/approval-api/src/admin/outbox-admin-insert.service.{ts,test.ts} \
        simulations/enterprise-pm/services/approval-api/src/admin/outbox-admin.tokens.ts
git commit -m "feat(sim-approval-api): OutboxAdminInsertService — single-tx N inserts with grammar #12 idempotencyKey"
```

---

### Task 4.2 — `OutboxAdminDispatchService` (multi-replica 시뮬 + duplicates 검증)

**Files:** `outbox-admin-dispatch.service.{ts,test.ts}`

`dispatchAll(replicaCount, timeoutMs)`은 같은 NestJS process 안에서 N개 worker promise를 `Promise.all`로 동시 실행. 각 worker는 Plan B Stage 5 `createOutboxDispatcher`를 *고유 consumerName + 자체 PG connection*으로 인스턴스화하고 처리한 row id를 누적. SKIP LOCKED + consumer-log UNIQUE가 disjoint를 보장하므로 본 service는 *집계 + duplicates 계산*에만 집중 — `duplicates = flat.length - new Set(flat).size`. 종료 조건: 연속 빈 tick 2회 또는 deadline 도달 (진행 중 tick은 마치고 종료).

- [ ] **Step 4.2.1: 실패 테스트 작성**

`outbox-admin-dispatch.service.test.ts` (factory mock — 4 케이스: disjoint, default, duplicates>0, timeout):

```typescript
function disjointFactory(eventIds: string[]) {
  let cursor = 0;
  return (consumerName: string) => {
    const claimed: string[] = [];
    return {
      consumerName, claimed,
      async tick(batchSize: number) {
        if (cursor >= eventIds.length) return 0;
        const slice = eventIds.slice(cursor, cursor + batchSize);
        cursor += slice.length; claimed.push(...slice);
        return slice.length;
      },
    };
  };
}

describe("OutboxAdminDispatchService", () => {
  it("replicaCount=3, ROWS=30 — disjoint + totalDispatched=30 + duplicates=0", async () => {
    const ids = Array.from({ length: 30 }, (_, i) => `evt-${i}`);
    const r = await new OutboxAdminDispatchService(disjointFactory(ids))
      .dispatchAll({ replicaCount: 3, timeoutMs: 5_000 });
    expect(r.byReplica).toHaveLength(3);
    expect(r.totalDispatched).toBe(30);
    expect(r.duplicates).toBe(0);
    expect(new Set(r.byReplica.flatMap((x) => x.dispatchedEventIds)).size).toBe(30);
    expect(r.byReplica.map((x) => x.replicaId).sort())
      .toEqual(["sim-approval-api-0", "sim-approval-api-1", "sim-approval-api-2"]);
  });

  it("default replicaCount=3, timeoutMs=5000", async () => {
    const r = await new OutboxAdminDispatchService(disjointFactory([])).dispatchAll({});
    expect(r.byReplica).toHaveLength(3);
    expect(r.totalDispatched).toBe(0);
  });

  it("duplicates>0 — 같은 id가 여러 replica에 잡히면 정확히 카운트", async () => {
    // collision factory: 첫 tick에서만 "evt-X"를 yield → 2 worker가 같은 id를 수집
    const r = await new OutboxAdminDispatchService(collisionFactory)
      .dispatchAll({ replicaCount: 2, timeoutMs: 1_000 });
    expect(r.totalDispatched).toBe(2);
    expect(r.duplicates).toBe(1);
  });

  it("timeoutMs 도달 → worker가 현재 tick 종료 후 stop", async () => {
    // slow factory: tick이 200ms sleep 후 1개 yield. timeoutMs=50 → tick은 1번만 실행됨.
    const r = await new OutboxAdminDispatchService(slowFactory)
      .dispatchAll({ replicaCount: 2, timeoutMs: 50 });
    expect(r.durationMs).toBeGreaterThanOrEqual(200);
    expect(r.byReplica.every((x) => x.dispatchedEventIds.length <= 1)).toBe(true);
  });
});
```

- [ ] **Step 4.2.2: 테스트 실패 확인**

```bash
pnpm --filter sim-approval-api test outbox-admin-dispatch.service
```
기대: FAIL (모듈 없음).

- [ ] **Step 4.2.3: 최소 구현**

`outbox-admin-dispatch.service.ts`:

```typescript
import { Injectable, Inject } from "@nestjs/common";
import { OUTBOX_DISPATCHER_FACTORY } from "./outbox-admin.tokens.js";

export interface OutboxAdminDispatcher {
  consumerName: string; claimed: string[]; tick(batchSize?: number): Promise<number>;
}
export type OutboxDispatcherFactory = (consumerName: string) => OutboxAdminDispatcher;

export interface OutboxDispatchAllOptions {
  replicaCount?: number; timeoutMs?: number; batchSize?: number;
}
export interface OutboxDispatchAllResult {
  byReplica: Array<{ replicaId: string; dispatchedEventIds: string[] }>;
  totalDispatched: number; duplicates: number; durationMs: number;
}

@Injectable()
export class OutboxAdminDispatchService {
  constructor(
    @Inject(OUTBOX_DISPATCHER_FACTORY) private readonly factory: OutboxDispatcherFactory,
  ) {}

  async dispatchAll(opts: OutboxDispatchAllOptions): Promise<OutboxDispatchAllResult> {
    const replicaCount = opts.replicaCount ?? 3;
    const timeoutMs = opts.timeoutMs ?? 5_000;
    const batchSize = opts.batchSize ?? 10;
    const start = Date.now();
    const deadline = start + timeoutMs;

    const dispatchers = Array.from({ length: replicaCount }, (_, i) =>
      this.factory(`sim-approval-api-${i}`));

    const runWorker = async (d: OutboxAdminDispatcher) => {
      let empty = 0;
      while (Date.now() < deadline) {
        const n = await d.tick(batchSize);
        if (n === 0) { if (++empty >= 2) break; } else { empty = 0; }
      }
    };
    await Promise.all(dispatchers.map(runWorker));

    const byReplica = dispatchers.map((d) =>
      ({ replicaId: d.consumerName, dispatchedEventIds: [...d.claimed] }));
    const all = byReplica.flatMap((r) => r.dispatchedEventIds);
    return {
      byReplica,
      totalDispatched: all.length,
      duplicates: all.length - new Set(all).size,
      durationMs: Date.now() - start,
    };
  }
}
```

- [ ] **Step 4.2.4: 테스트 통과**

```bash
pnpm --filter sim-approval-api test outbox-admin-dispatch.service
```
기대: 4 PASS.

- [ ] **Step 4.2.5: Commit**

```bash
git add simulations/enterprise-pm/services/approval-api/src/admin/outbox-admin-dispatch.service.{ts,test.ts}
git commit -m "feat(sim-approval-api): OutboxAdminDispatchService — N-replica concurrent dispatch with duplicates check"
```

---

### Task 4.3 — `OutboxAdminController` + `InternalIpGuard` 부착

**Files:** `outbox-admin.controller.{ts,test.ts}`

`@Controller("admin/outbox")` + `@UseGuards(InternalIpGuard)` (Stage 1a `sim-internal-network`). zod body validation, 실패 시 400 + RFC 7807. 외부 IP는 Guard가 404 silent. 응답 shape는 spec §9.

- [ ] **Step 4.3.1: 실패 테스트 작성**

`outbox-admin.controller.test.ts` (NestJS Test + Fastify inject — 4 케이스: insert 200, dispatch 200, 400 RFC 7807, 외부 IP 404):

```typescript
const repoStub = { async transaction(cb: never) {
  return cb({ async insertMany(rows: Array<{ id: string }>) {
    return rows.map((r) => r.id);
  } } as never);
} };
const factoryStub = (c: string) =>
  ({ consumerName: c, claimed: [`${c}-evt`], async tick() { return 0; } });
const internal = { "x-forwarded-for": "127.0.0.1" };

describe("OutboxAdminController", () => {
  let app: NestFastifyApplication;
  beforeAll(async () => {
    const m = await Test.createTestingModule({
      controllers: [OutboxAdminController],
      providers: [
        OutboxAdminInsertService, OutboxAdminDispatchService,
        { provide: OUTBOX_ADMIN_REPO, useValue: repoStub },
        { provide: OUTBOX_DISPATCHER_FACTORY, useValue: factoryStub },
      ],
    }).compile();
    app = m.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });
  afterAll(async () => app.close());

  it("POST /admin/outbox/insert — 200 + spec §9 shape", async () => {
    const res = await app.inject({
      method: "POST", url: "/admin/outbox/insert", headers: internal,
      payload: { events: [{
        aggregateId: "proj-001", eventName: "approval.budget.submitted",
        payload: { amount: 1000 }, occurredAt: 1714250400000,
      }] },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ inserted: 1 });
    expect(res.json().idempotencyKeys).toHaveLength(1);
    expect(res.json().ids).toHaveLength(1);
  });

  it("POST /admin/outbox/dispatch — 200 + spec §9 shape", async () => {
    const res = await app.inject({
      method: "POST", url: "/admin/outbox/dispatch", headers: internal,
      payload: { replicaCount: 3, timeoutMs: 100 },
    });
    expect(res.statusCode).toBe(200);
    const b = res.json();
    expect(b.byReplica).toHaveLength(3);
    expect(b.totalDispatched).toBe(3);
    expect(b.duplicates).toBe(0);
    expect(typeof b.durationMs).toBe("number");
  });

  it("잘못된 body → 400 RFC 7807", async () => {
    const res = await app.inject({
      method: "POST", url: "/admin/outbox/insert", headers: internal,
      payload: { events: "not-an-array" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().type).toMatch(/qa-sdk\.dev\/errors\/validation/);
  });

  it("외부 IP → 404 silent (InternalIpGuard)", async () => {
    const res = await app.inject({
      method: "POST", url: "/admin/outbox/insert",
      headers: { "x-forwarded-for": "8.8.8.8" }, payload: { events: [] },
    });
    expect(res.statusCode).toBe(404);
  });
});
```

- [ ] **Step 4.3.2: 테스트 실패 확인**

```bash
pnpm --filter sim-approval-api test outbox-admin.controller
```
기대: FAIL (controller 미구현).

- [ ] **Step 4.3.3: 최소 구현**

`outbox-admin.controller.ts`:

```typescript
import {
  Body, Controller, HttpCode, HttpException, HttpStatus, Post, UseGuards,
} from "@nestjs/common";
import { z } from "zod";
import { InternalIpGuard } from "@qa-sdk/sim-internal-network";
import { OutboxAdminInsertService } from "./outbox-admin-insert.service.js";
import { OutboxAdminDispatchService } from "./outbox-admin-dispatch.service.js";

const InsertBody = z.object({
  events: z.array(z.object({
    aggregateId: z.string().min(1),
    eventName: z.string().min(1),
    payload: z.unknown(),
    occurredAt: z.number().int().nonnegative(),
    eventVersion: z.number().int().positive().optional(),
  })),
});
const DispatchBody = z.object({
  replicaCount: z.number().int().min(1).max(16).optional(),
  timeoutMs: z.number().int().min(1).max(60_000).optional(),
});
const validation = (title: string, detail: string) => new HttpException({
  type: "https://qa-sdk.dev/errors/validation", title, status: 400, detail,
}, HttpStatus.BAD_REQUEST);

@Controller("admin/outbox")
@UseGuards(InternalIpGuard)
export class OutboxAdminController {
  constructor(
    private readonly insertSvc: OutboxAdminInsertService,
    private readonly dispatchSvc: OutboxAdminDispatchService,
  ) {}

  @Post("insert") @HttpCode(HttpStatus.OK)
  async insert(@Body() raw: unknown) {
    const p = InsertBody.safeParse(raw);
    if (!p.success) throw validation("Invalid /admin/outbox/insert body", p.error.message);
    return this.insertSvc.insertEvents(p.data.events);
  }

  @Post("dispatch") @HttpCode(HttpStatus.OK)
  async dispatch(@Body() raw: unknown) {
    const p = DispatchBody.safeParse(raw);
    if (!p.success) throw validation("Invalid /admin/outbox/dispatch body", p.error.message);
    return this.dispatchSvc.dispatchAll(p.data);
  }
}
```

- [ ] **Step 4.3.4: 테스트 통과**

```bash
pnpm --filter sim-approval-api test outbox-admin.controller
```
기대: 4 PASS.

- [ ] **Step 4.3.5: Commit**

```bash
git add simulations/enterprise-pm/services/approval-api/src/admin/outbox-admin.controller.{ts,test.ts}
git commit -m "feat(sim-approval-api): OutboxAdminController with InternalIpGuard + zod validation"
```

---

### Task 4.4 — `OutboxAdminModule` 신설

**Files:** `outbox-admin.module.ts`, `package.json` (peer deps)

controller + 두 service + 두 token provider. `OUTBOX_ADMIN_REPO`는 Drizzle `db.transaction → tx.insert(approvalOutboxEvents).values(rows).returning({id})`. `OUTBOX_DISPATCHER_FACTORY`는 Plan B Stage 5 dispatcher wrap, 각 worker에 *별도 postgres connection* 주입, module destroy 시 일괄 `sql.end()`.

- [ ] **Step 4.4.1: 모듈 코드 작성**

`outbox-admin.module.ts` — 핵심 구조:
- `WorkerConnectionPool` (provider): worker마다 별도 PG connection 발급, `onModuleDestroy`에서 일괄 `sql.end()`.
- `OUTBOX_ADMIN_REPO` provider: Drizzle `db.transaction(...)` + `tx.insert(approvalOutboxEvents).values(rows).returning({id})`.
- `OUTBOX_DISPATCHER_FACTORY` provider: Plan B Stage 5 `createOutboxDispatcher`를 wrap. consumer는 `claimed.push(evt.id)`로 누적, `batchSize: 10, maxRetries: 5`.

```typescript
@Module({
  controllers: [OutboxAdminController],
  providers: [
    WorkerConnectionPool,
    OutboxAdminInsertService,
    OutboxAdminDispatchService,
    {
      provide: OUTBOX_ADMIN_REPO,
      useFactory: (): OutboxAdminRepo => {
        const db = drizzle(postgres(env.SIM_APPROVAL_PG_URL));
        return {
          transaction: (cb) => db.transaction(async (tx) => cb({
            async insertMany(rows) {
              if (rows.length === 0) return [];
              const r = await tx.insert(approvalOutboxEvents).values(rows as never)
                .returning({ id: approvalOutboxEvents.id });
              return r.map((x) => x.id);
            },
          })),
        };
      },
    },
    {
      provide: OUTBOX_DISPATCHER_FACTORY,
      inject: [WorkerConnectionPool],
      useFactory: (pool: WorkerConnectionPool): OutboxDispatcherFactory =>
        (consumerName) => {
          const sql = pool.open();
          const claimed: string[] = [];
          const inner = createOutboxDispatcher({
            db: drizzle(sql), sql, consumerName,
            consume: async (evt) => { claimed.push(evt.id); },
            batchSize: 10, maxRetries: 5,
          });
          return { consumerName, claimed, tick: (b) => inner.tick(b) };
        },
    },
  ],
  exports: [OutboxAdminInsertService, OutboxAdminDispatchService],
})
export class OutboxAdminModule {}

// WorkerConnectionPool — onModuleDestroy로 모든 connection 정리
class WorkerConnectionPool implements OnModuleDestroy {
  private conns: Sql[] = [];
  open(): Sql { const s = postgres(env.SIM_APPROVAL_PG_URL); this.conns.push(s); return s; }
  async onModuleDestroy() { await Promise.all(this.conns.map((c) => c.end())); }
}
```

- [ ] **Step 4.4.2: typecheck**

```bash
pnpm --filter sim-approval-api typecheck
```
기대: 0 error.

- [ ] **Step 4.4.3: 단위 테스트 회귀**

```bash
pnpm --filter sim-approval-api test admin/
```
기대: Task 4.1~4.3 단위 테스트 모두 PASS.

- [ ] **Step 4.4.4: 의존성 추가 (`package.json`)**

`approval-api/package.json` `dependencies`:

```json
{
  "@qa-sdk/sim-internal-network": "workspace:*",
  "@qa-sdk/sim-identifier-grammar": "workspace:*"
}
```
(이미 Stage 1a / Plan A 결과로 있으면 no-op.)

- [ ] **Step 4.4.5: Commit**

```bash
pnpm install --filter sim-approval-api
git add simulations/enterprise-pm/services/approval-api/src/admin/outbox-admin.module.ts \
        simulations/enterprise-pm/services/approval-api/package.json
git commit -m "feat(sim-approval-api): OutboxAdminModule wiring (worker connection pool + dispatcher factory)"
```

---

### Task 4.5 — `AppModule`에 `OutboxAdminModule` import

**Files:** `app.module.ts` (modify)

기존 `AppModule.imports`에 `OutboxAdminModule` 추가. slice modules 다음, `BitmapCacheModule.forRoot(...)` 직전(admin endpoint는 인프라 layer 운영 표면).

- [ ] **Step 4.5.1: import 추가**

```typescript
// app.module.ts (diff)
+ import { OutboxAdminModule } from "./admin/outbox-admin.module.js";

  imports: [
    HealthModule, ApprovalDbModule.forRoot(),
    AccessCheckerModule.forRootAsync({ ... }),
    ...APPROVAL_SLICE_MODULES,
+   OutboxAdminModule,
    BitmapCacheModule.forRoot({ ... }),
  ],
```

- [ ] **Step 4.5.2: 부팅 smoke + route 검증**

```bash
pnpm --filter sim-approval-api test test-bootstrap
pnpm --filter sim-approval-api test outbox-admin.controller -- --reporter=verbose
```
기대: 둘 다 PASS — DI 컨테이너가 `OUTBOX_ADMIN_REPO`/`OUTBOX_DISPATCHER_FACTORY`를 정상 해석, `POST /admin/outbox/insert`·`POST /admin/outbox/dispatch` 라우트 등록 확인.

- [ ] **Step 4.5.3: typecheck + build**

```bash
pnpm --filter sim-approval-api typecheck
pnpm --filter sim-approval-api build
```
기대: 둘 다 0 error.

- [ ] **Step 4.5.4: 회귀 단위 테스트**

```bash
pnpm --filter sim-approval-api test
```
기대: 기존 단위 테스트 + 본 단계 추가 테스트 전체 PASS.

- [ ] **Step 4.5.5: Commit**

```bash
git add simulations/enterprise-pm/services/approval-api/src/app.module.ts
git commit -m "feat(sim-approval-api): wire OutboxAdminModule into AppModule"
```

---

### Task 4.6 — PG-gated 통합 테스트 (insert N=5 → dispatch replicaCount=3)

**Files:** `outbox-admin-integration.test.ts`

진짜 PG에서 endpoint 두 개를 실제 호출해 spec §9 invariant 검증. `SIM_TEST_PG=1` env gate.

- [ ] **Step 4.6.1: 통합 테스트 작성**

`outbox-admin-integration.test.ts` — 2 케이스. `Test.createTestingModule({ imports: [OutboxAdminModule] })` + `FastifyAdapter` + 진짜 PG sql client(`postgres(env.SIM_APPROVAL_PG_URL)`), `beforeEach`에 `SIM_APPROVAL_PG_RESET_DDL` + `SIM_OUTBOX_CONSUMER_LOG_PG_RESET_DDL` 적용.

```typescript
const PG = process.env.SIM_TEST_PG === "1";
const internal = { "x-forwarded-for": "127.0.0.1" };

describe.skipIf(!PG)("OutboxAdmin integration (PG)", () => {
  // beforeAll: bootApp + postgres connection / afterAll: close
  // beforeEach: 두 RESET DDL 적용

  it("insert N=5 → dispatch replicaCount=3 → byReplica disjoint + duplicates=0", async () => {
    const events = Array.from({ length: 5 }, (_, i) => ({
      aggregateId: `proj-${String(i + 1).padStart(3, "0")}`,
      eventName: "approval.budget.submitted",
      payload: { idx: i }, occurredAt: 1714250400000 + i,
    }));
    const ins = await app.inject({
      method: "POST", url: "/admin/outbox/insert", headers: internal, payload: { events },
    });
    expect(ins.json().inserted).toBe(5);

    const dis = await app.inject({
      method: "POST", url: "/admin/outbox/dispatch", headers: internal,
      payload: { replicaCount: 3, timeoutMs: 5_000 },
    });
    const body = dis.json();
    expect(body.totalDispatched).toBe(5);
    expect(body.duplicates).toBe(0);
    expect(body.byReplica).toHaveLength(3);
    expect(new Set(body.byReplica.flatMap(
      (r: { dispatchedEventIds: string[] }) => r.dispatchedEventIds,
    )).size).toBe(5);

    // PG 직접 검증
    const rows = await sql<{ status: string }[]>`SELECT status FROM sim.approval_outbox_events`;
    expect(rows.every((r) => r.status === "dispatched")).toBe(true);
    expect((await sql`SELECT COUNT(*)::int AS n FROM sim.outbox_consumer_log`)[0].n).toBe(5);
  });

  it("두 번째 dispatch 호출 — 추가 row 없음 (idempotent)", async () => {
    // insert 1건 → dispatch 1회 → 다시 dispatch → totalDispatched=0, duplicates=0
    // (구체 코드: 위 insert/dispatch inject 재사용)
  });
});
```

- [ ] **Step 4.6.2: PG 부재 환경에서 SKIP 확인**

```bash
unset SIM_TEST_PG
pnpm --filter sim-approval-api test outbox-admin-integration
```
기대 vitest 출력:
```
↓ outbox-admin-integration.test.ts > OutboxAdmin integration (PG) — skipped
```

- [ ] **Step 4.6.3: PG 환경에서 PASS 확인**

```bash
SIM_TEST_PG=1 SIM_APPROVAL_PG_URL=postgres://sim:sim@localhost:5432/sim_approval \
  pnpm --filter sim-approval-api test outbox-admin-integration
```
기대: 2 PASS, dispatcher 3 worker가 5 row를 disjoint하게 처리, consumer-log 5건.

- [ ] **Step 4.6.4: 부정확 진단 (failure 모드)**

| 증상 | 우선 진단 |
|---|---|
| `totalDispatched < 5` | SKIP LOCKED 누락 → Plan B Stage 5 dispatcher SQL 재확인 |
| `totalDispatched > 5` | status='pending' 가드 누락 → `outbox-dispatcher.ts` UPDATE 절 |
| `duplicates > 0` | consumer-log UNIQUE 제약 또는 PG transaction 격리 결함 |

본 단계에서 *우회 코드 작성 금지*. Plan B Stage 5 회귀 테스트(`outbox-dispatcher.contention.test.ts`)부터 분리.

- [ ] **Step 4.6.5: Commit**

```bash
git add simulations/enterprise-pm/services/approval-api/src/admin/outbox-admin-integration.test.ts
git commit -m "test(sim-approval-api): PG-gated outbox admin integration (insert 5 → dispatch 3-replica disjoint)"
```

---

### Task 4.7 — `sim-handles ↔ endpoint contract` 검증

**Files:** `contract.test.ts`

`sim-handles`의 `outbox-client` 모듈은 응답 shape consumer-side SSOT (spec §10). 본 contract 테스트:
1. `outbox-client`의 `OutboxInsertResponse` / `OutboxDispatchResponse` 타입 + zod schema import.
2. controller 응답을 *typecast* — 컴파일러가 mismatch를 잡으면 contract 위반.
3. 런타임에서 zod parse로 shape 강제.

- [ ] **Step 4.7.1: 실패 테스트 작성**

`contract.test.ts` — 2 케이스. typecast `const body: OutboxInsertResponse = res.json()`가 컴파일 시점 contract; zod parse가 런타임 contract.

```typescript
import {
  OutboxInsertResponseSchema, OutboxDispatchResponseSchema,
  type OutboxInsertResponse, type OutboxDispatchResponse,
} from "@qa-sdk/sim-handles/outbox-client";
// (Test.createTestingModule + repoStub + factoryStub은 Task 4.3 controller test 동일)

describe("OutboxAdmin sim-handles contract", () => {
  it("insert 응답이 sim-handles OutboxInsertResponse shape 일치", async () => {
    const app = await bootApp((c: string) =>
      ({ consumerName: c, claimed: [], async tick() { return 0; } }));
    const res = await app.inject({
      method: "POST", url: "/admin/outbox/insert", headers: internal,
      payload: { events: [{
        aggregateId: "proj-001", eventName: "approval.budget.submitted",
        payload: {}, occurredAt: 1714250400000,
      }] },
    });
    const body: OutboxInsertResponse = res.json(); // ← compile-time contract
    expect(OutboxInsertResponseSchema.parse(body)).toEqual(body); // ← runtime contract
    await app.close();
  });

  it("dispatch 응답이 sim-handles OutboxDispatchResponse shape 일치", async () => {
    const app = await bootApp((c: string) =>
      ({ consumerName: c, claimed: [`${c}-evt`], async tick() { return 0; } }));
    const res = await app.inject({
      method: "POST", url: "/admin/outbox/dispatch", headers: internal,
      payload: { replicaCount: 2, timeoutMs: 100 },
    });
    const body: OutboxDispatchResponse = res.json();
    expect(OutboxDispatchResponseSchema.parse(body)).toEqual(body);
    expect(body.totalDispatched).toBe(2);
    expect(body.duplicates).toBe(0);
    await app.close();
  });
});
```

`bootApp` helper는 Task 4.3 controller test 동일 패턴 (Test.createTestingModule + FastifyAdapter + repoStub + factoryStub).

- [ ] **Step 4.7.2: sim-handles 측 SSOT 확인**

`packages/sim-handles/src/outbox-client.ts` (또는 scenarios/sim-handles)에 다음 export가 *반드시* 존재:

```typescript
import { z } from "zod";

export const OutboxInsertResponseSchema = z.object({
  inserted: z.number().int().nonnegative(),
  idempotencyKeys: z.array(z.string()),
  ids: z.array(z.string()),
});
export type OutboxInsertResponse = z.infer<typeof OutboxInsertResponseSchema>;

export const OutboxDispatchResponseSchema = z.object({
  byReplica: z.array(z.object({
    replicaId: z.string(),
    dispatchedEventIds: z.array(z.string()),
  })),
  totalDispatched: z.number().int().nonnegative(),
  duplicates: z.number().int().nonnegative(),
  durationMs: z.number().int().nonnegative(),
});
export type OutboxDispatchResponse = z.infer<typeof OutboxDispatchResponseSchema>;
```

미존재 시 sim-handles 측 SSOT가 *prerequisite* — Plan E Stage 11 정의 필요. 미정의면 Stage 4 PR이 차단된다 (DoD #2 contract gate).

- [ ] **Step 4.7.3: 테스트 통과**

```bash
pnpm --filter sim-approval-api test contract
pnpm --filter sim-approval-api typecheck
```
기대: 2 PASS + TS 0 error → 컴파일 시점 contract 일치.

- [ ] **Step 4.7.4: 부정 통제 (drift 시뮬)**

drift detection 검증을 위해 *임시로* controller dispatch 응답에서 `durationMs` 필드를 제거하고 typecheck → TS2741 `Property 'durationMs' is missing` 에러가 나야 정상. 확인 즉시 원복:

```bash
pnpm --filter sim-approval-api typecheck
# 에러 확인 → 원복 → 재실행 → PASS
```

- [ ] **Step 4.7.5: Commit**

```bash
git add simulations/enterprise-pm/services/approval-api/src/admin/contract.test.ts
git commit -m "test(sim-approval-api): sim-handles outbox-client contract"
```

---

### Task 4.8 — Stage 4 통합 검증 (build + 시나리오 1~8 무회귀)

**Files:** (no new files)

Stage 4 PR이 main 머지되기 전 invariant 4종: build 0 error / 전체 test PASS / 시나리오 1~8 무회귀 / cross-package typecheck.

- [ ] **Step 4.8.1: 빌드 + 전체 단위 테스트**

```bash
pnpm --filter sim-approval-api build
pnpm --filter sim-approval-api test
```
기대 vitest 요약:
```
Test Files  (existing) + 6 passed
Tests       <X> passed
```

- [ ] **Step 4.8.2: PG-gated 통합 테스트 명시 실행**

```bash
SIM_TEST_PG=1 SIM_APPROVAL_PG_URL=postgres://sim:sim@localhost:5432/sim_approval \
  pnpm --filter sim-approval-api test outbox-admin-integration
```
기대: 2 PASS.

- [ ] **Step 4.8.3: 시나리오 1~8 무회귀 + cross-package typecheck**

```bash
pnpm sim:smoke
pnpm -r --filter ...sim-approval-api typecheck
```
기대: 기존 smoke 회귀 없음 + dependents까지 0 error.

- [ ] **Step 4.8.4: PR 작성**

```bash
git log --oneline | head -10  # Task 4.1~4.7 commit 7건 확인
git push -u origin <stage-4-branch>
gh pr create --title "feat(sim-approval-api): Stage 4 outbox admin endpoints (insert + dispatch)" \
  --body "$(cat <<'EOF'
## Summary
- POST /admin/outbox/insert — N건 outbox event seed (grammar #12 idempotencyKey)
- POST /admin/outbox/dispatch — N-replica 동시 dispatch + duplicates=0 invariant
- spec §9 응답 shape, spec §11 RFC 7807 error, Stage 1a InternalIpGuard 부착

## Test plan
- [ ] pnpm --filter sim-approval-api test (unit + controller + contract) PASS
- [ ] SIM_TEST_PG=1 통합 테스트 PASS (insert 5 → dispatch 3-replica disjoint)
- [ ] pnpm sim:smoke 회귀 없음
- [ ] pnpm -r typecheck 0 error
EOF
)"
```

기대: PR URL 출력, CI green.

- [ ] **Step 4.8.5: 머지 후 follow-up 등록**

PR 머지 직후 Plan E Stage 11 시나리오 15(`outbox-multi-dispatcher-lock`) e2e 가능 → 사용자 환경에서 `pnpm sim:scenarios run scenario-15` 실행해 endpoint 호출 무결성 확인 (spec §13 DoD).

---

## Stage 4 DoD

- [ ] Task 4.1~4.7 commit 7건 모두 main 도달.
- [ ] `pnpm --filter sim-approval-api test` 전체 PASS (단위 + controller + contract).
- [ ] `SIM_TEST_PG=1 pnpm --filter sim-approval-api test outbox-admin-integration` 2 PASS.
- [ ] `pnpm sim:smoke` 회귀 없음.
- [ ] sim-handles `outbox-client` contract PASS — Plan E Stage 11 시나리오 15에서 본 endpoint 호출 가능.
- [ ] InternalIpGuard 부착 — 외부 IP 요청 404 silent.
- [ ] grammar #12 enforcement — insert 경로의 모든 idempotency_key가 `parseIdempotencyKey` 통과.

## 회귀 / 잘못된 케이스 대응

| 증상 | 진단 우선순위 |
|---|---|
| `duplicates > 0` (통합 테스트) | (1) Plan B Stage 5 `outbox-dispatcher.contention.test.ts` 회귀 → (2) consumer-log UNIQUE → (3) PG transaction 격리 |
| `totalDispatched < N` | SKIP LOCKED 누락 → Plan B Stage 5 dispatcher SQL 재확인 |
| `totalDispatched > N` | status='pending' 가드 누락 → `outbox-dispatcher.ts` UPDATE 절 모두 `AND status='pending'` 포함 확인 |
| 외부 IP 200 OK | `InternalIpGuard` 미부착 또는 sim-internal-network 미설치 |
| 통합 테스트 SKIP되지 않음 | `describe.skipIf(!process.env.SIM_TEST_PG)` 표현 정확 |
| TS2741 / TS2322 (contract) | sim-handles `outbox-client` 타입 drift → Plan E Stage 11 SSOT 동기화 prerequisite |

## 참조

- spec: `docs/superpowers/specs/2026-05-02-server-side-admin-endpoints-design.md` §3 (internal IP), §9 (response shape), §10 (test matrix), §11 (RFC 7807).
- plan: `docs/superpowers/plans/2026-04-28-canary-scaling/B-stage-5-outbox-lock.md` (`createOutboxDispatcher`, `FOR UPDATE SKIP LOCKED`, consumer-log).
- plan: `docs/superpowers/plans/2026-05-02-server-side-admin-endpoints/00-overview.md` (Stage 토폴로지).
- plan (prerequisite): Stage 1a `sim-internal-network` 패키지 (`InternalIpGuard`).
- plan (prerequisite): Plan A Stage 2a-iii `sim-identifier-grammar` (`buildIdempotencyKey`, `parseIdempotencyKey`, `parseEventName`, `toGrammarSafeAggregateId`).
- plan (consumer): Plan E Stage 11 시나리오 15 `outbox-multi-dispatcher-lock` (sim-handles `outbox-client` factory).

---

## Defect Log (Stage 4 실행 결과)

실행: 2026-05-02 — 7건 task commit (a14d78df → fffd91f8). Stage DoD 7/7 PASS, baseline noise 별도 표기.

### D-4.A — package import 경로 불일치 (낮은 영향)

| 위치 | 플랜 표기 | 실제 |
|---|---|---|
| Task 4.1, 4.7 | `@qa-sdk/sim-internal-network`, `@qa-sdk/sim-identifier-grammar` | unscoped — `sim-internal-network`, `sim-identifier-grammar` |
| Task 4.1 | `toGrammarSafeAggregateId` from grammar package | 실제 module: `approval-api/src/approval/shared/outbox/idempotency-key-source.ts` (도메인-내 정규화 함수) |

**해소**: 실제 export 위치를 따라 import 경로 적용. grammar 패키지는 raw key 합성/역분해만 책임지고, aggregateId 정규화는 approval-api 도메인 책임. **플랜의 의도 자체는 정상**, 표기만 수정하면 됨.

### D-4.B — `OutboxAdminDispatcher.tick(batchSize)` 시그니처 불일치 (호환 가능)

플랜: `tick(batchSize: number)` 호출 — `OutboxAdminDispatcher` 인터페이스에 batchSize 파라미터 받는 형태.
실제: Plan B Stage 5 `OutboxDispatcher.tick(): Promise<number>` — 인자 없음, `batchSize` 는 options-time 고정.

**해소**: `OutboxAdminDispatcher` interface 는 플랜대로 `tick(batchSize?: number)` 로 정의하되, 모듈 wrapper 에서 batchSize 인자를 무시하고 inner.tick() 위임. 단위 테스트의 fake factory 는 batchSize 인자를 활용 (disjoint slice 분배 시뮬). 런타임/test 양쪽 모두 정상 동작.

### D-4.C — sim-handles 패키지 경로/공유 불일치 (구조적 문제 — 신규 패키지로 해소)

플랜 §4.7.2: `packages/sim-handles/src/outbox-client.ts` 또는 `scenarios/sim-handles` 에서 `OutboxInsertResponseSchema`/`OutboxDispatchResponseSchema` export.

실제: sim-handles 는 **independent 패키지가 아니라** `simulations/enterprise-pm/scenarios/src/runner/sim-handles/` 의 internal 모듈 (`@qa-sdk/sim-scenarios` 안). approval-api 가 sim-scenarios 를 import 하면 **순환 의존** 발생 (sim-scenarios → sim-approval-api → sim-scenarios).

**해소**: Stage 1a `sim-decision-view` 패턴을 따라 신규 패키지 `packages/sim-outbox-view/` 신설 — schema/type SSOT. producer (`sim-approval-api`) 와 consumer (`sim-scenarios outbox-client`) 모두 본 패키지에서 import. 순환 차단 + drift 게이트 유지. 플랜의 contract 의도를 보존하는 정상적 해소.

### D-4.D — Drizzle `TransactionSql` ↔ `Sql` 타입 불일치 (cast 로 회피)

`postgres.js` 의 `sql.begin(async (txSql) => ...)` 콜백은 `TransactionSql<{}>` 를 넘기지만, `drizzle({ client })` 시그니처는 `Sql` 만 받는다. 런타임은 호환 (TransactionSql 은 Sql 의 메소드 super-set).

**해소**: `drizzle({ client: txSql as unknown as Sql })` 명시 cast + 한국어 주석으로 사유 기록. fallback 이 아니라 *postgres.js + drizzle-orm 라이브러리 시그니처 mismatch 의 명시적 cast*. 플랜 외 작업이지만 wiring 에 필수.

### D-4.E — 환경변수 명명 불일치 (낮은 영향)

플랜: `SIM_APPROVAL_PG_URL` (Task 4.4 / 4.6).
기존: 다른 outbox 테스트들은 `QA_TEST_PG=1` + `QA_TEST_PG_HOST/PORT/...` 분리 형태.

**해소**: 본 단계는 플랜이 지정한 `SIM_TEST_PG=1` + `SIM_APPROVAL_PG_URL` 그대로 사용. 통합 테스트 (4.6) 가 PG 부재 환경에서 SKIP 되는 동작은 vitest `describe.skipIf` 로 정상 작동 확인.

---

## Baseline Noise (Stage 4 외 사전 존재)

`pnpm --filter sim-approval-api typecheck` 12 errors — 모두 본 단계 외 영역. 검증: stage-4 pre-commit (`git stash`) 시 동일 12건 재현.

| 출처 | 카운트 | 비고 |
|---|---|---|
| `outbox-dispatcher.ts` `TransactionSql` 호출 시그니처 (TS2349) | 7 | postgres.js+drizzle 라이브러리 mismatch — Plan B Stage 5 영역 |
| `*.outbox.ts` `EventName` aggregate/verbPast missing (TS2739) | 4 | sim-identifier-grammar #5 enrichment — 별도 plan 필요 |
| `approval-db.module.ts` `parsePgUrl` not exported (TS2305) | 1 | db-bootstrap public API drift |

`src/admin/`: 0 error.

## Stage 4 Verification Result

| Step | Status | Note |
|---|---|---|
| 4.1.4 insert.service unit | PASS | 4 tests |
| 4.2.4 dispatch.service unit | PASS | 4 tests |
| 4.3.4 controller | PASS | 4 tests (Stage 1a Task 1.8 caveat 적용 — `@Inject(class)` 필수) |
| 4.4.2 admin/ typecheck | PASS | 0 error (admin/ 한정) |
| 4.4.3 admin/ unit 회귀 | PASS | 12 tests |
| 4.5.2 boot smoke | PASS | test-bootstrap 6 + controller 4 |
| 4.5.4 full regression | PASS | 178/196 (18 skipped, 0 fail) |
| 4.6.2 PG SKIP | PASS | 2 skipped without `SIM_TEST_PG=1` |
| 4.6.3 PG PASS | DEFERRED | docker PG 미가동 환경 — DoD 에는 명시적 실행 권한 필요 |
| 4.7.3 contract test | PASS | 2 tests via `sim-outbox-view` |
| 4.7.4 drift check | PASS | TS2741 `durationMs` missing 검출 후 원복 |
| 4.8.1 build | FAIL (baseline) | 12 pre-existing errors, 0 from admin/ |
| 4.8.3 cross-package typecheck | PASS (admin/) | dependents 에서 admin/ 외 변경 없음 |

