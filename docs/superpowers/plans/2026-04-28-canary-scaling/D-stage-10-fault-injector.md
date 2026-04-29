## 단계 10: fault-injector 모듈

**Spec 참조:** `04-scaling-infra.md` §4.4 + `05-error-and-scenarios.md` §3 (시나리오 #10·#11·#13·#14)

본 단계는 controller(단계 9 결과) 안에 `fault-injector` 모듈을 추가해, 시뮬 시나리오 runner가 결정 모델의 fail-closed 분기를 의도적으로 트리거할 수 있는 표면을 제공한다. 4종 fault — schema break / audit anomaly / replication lag / dbPool 압박 — 를 단일 enable/disable 인터페이스로 통합하고 controller 라이프사이클(`finally` 절 reset)에 결합해 시나리오 종료 후 상태가 누수되지 않도록 한다.

### File Structure (단계 10)

| 종류 | 경로 |
|---|---|
| Create | `packages/sim-controller/src/fault/types.ts` |
| Create | `packages/sim-controller/src/fault/fault-injector.ts` |
| Create | `packages/sim-controller/src/fault/schema-break.ts` |
| Create | `packages/sim-controller/src/fault/audit-anomaly.ts` |
| Create | `packages/sim-controller/src/fault/replication-lag.ts` |
| Create | `packages/sim-controller/src/fault/db-pool-pressure.ts` |
| Create | `packages/sim-controller/src/fault/admin-router.ts` |
| Create | `packages/sim-controller/src/fault/{fault-injector,schema-break,audit-anomaly,replication-lag,db-pool-pressure,admin-router}.test.ts` |
| Modify | `packages/sim-controller/src/index.ts` (FaultInjector re-export) |
| Modify | `packages/sim-controller/src/controller.ts` (생성자 주입 + `finally`에서 `resetAll()`) |
| Modify | `packages/sim-controller/src/server.ts` (단계 9 Fastify 인스턴스에 admin-router 등록) |

### Task 10.1: fault-injector 모듈 골격 + Registry

**Files:**
- Create: `packages/sim-controller/src/fault/types.ts`
- Create: `packages/sim-controller/src/fault/fault-injector.ts`
- Create: `packages/sim-controller/src/fault/fault-injector.test.ts`
- Modify: `packages/sim-controller/src/index.ts`

각 fault는 `enable / disable / reset`을 노출하며, Registry는 `FaultKind` enum 키로 시점에 inject한다. controller 본 사이클은 fault 상태를 _읽지 않고_, fault가 의존하는 측정원(audit-recorder-store, pg, dbPool gauge)에 직접 주입한다 — 결정 모델은 정상 측정 경로를 통해 verdict를 산출한다.

- [ ] **Step 10.1.1: 실패 테스트 작성**

`packages/sim-controller/src/fault/fault-injector.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { FaultInjector } from "./fault-injector.js";
import type { Fault, FaultKind } from "./types.js";

class StubFault implements Fault {
  enabled = false; lastParams: unknown = null; resetCount = 0;
  async enable(p: unknown) { this.enabled = true; this.lastParams = p; }
  async disable() { this.enabled = false; }
  async reset() { this.enabled = false; this.resetCount += 1; }
}

describe("FaultInjector registry", () => {
  let a: StubFault, b: StubFault, inj: FaultInjector;
  beforeEach(() => {
    a = new StubFault(); b = new StubFault();
    inj = new FaultInjector({ "schema-break": a, "audit-anomaly": b } as Record<FaultKind, Fault>);
  });
  it("enable routes params to matching fault only", async () => {
    await inj.enable("schema-break", { fieldName: "x" });
    expect(a.enabled).toBe(true);
    expect(a.lastParams).toEqual({ fieldName: "x" });
    expect(b.enabled).toBe(false);
  });
  it("disable leaves other faults untouched", async () => {
    await inj.enable("schema-break", {}); await inj.enable("audit-anomaly", {});
    await inj.disable("schema-break");
    expect(a.enabled).toBe(false); expect(b.enabled).toBe(true);
  });
  it("resetAll invokes reset on every fault exactly once", async () => {
    await inj.resetAll();
    expect(a.resetCount).toBe(1); expect(b.resetCount).toBe(1);
  });
  it("rejects unknown FaultKind", async () => {
    await expect(inj.enable("nope" as FaultKind, {})).rejects.toThrow();
  });
});
```

- [ ] **Step 10.1.2: 테스트 실패 확인**

```bash
pnpm --filter sim-controller test fault-injector
```

기대: FAIL (모듈 미존재).

- [ ] **Step 10.1.3: 최소 구현**

`packages/sim-controller/src/fault/types.ts`:

```typescript
// spec: docs/superpowers/specs/2026-04-28-canary-scaling/05-error-and-scenarios.md §3
export type FaultKind =
  | "schema-break"      // 시나리오 #10
  | "audit-anomaly"     // 시나리오 #11
  | "replication-lag"   // 시나리오 #14
  | "db-pool-pressure"; // 시나리오 #13

export interface Fault {
  enable(params: unknown): Promise<void>;
  disable(): Promise<void>;
  reset(): Promise<void>;
}
```

`packages/sim-controller/src/fault/fault-injector.ts`:

```typescript
import type { Fault, FaultKind } from "./types.js";

export class FaultInjector {
  constructor(private readonly registry: Record<FaultKind, Fault>) {}
  private resolve(kind: FaultKind): Fault {
    const f = this.registry[kind];
    if (!f) throw new Error(`unknown fault kind: ${kind}`);
    return f;
  }
  async enable(kind: FaultKind, params: unknown) { await this.resolve(kind).enable(params); }
  async disable(kind: FaultKind)                  { await this.resolve(kind).disable(); }
  async resetAll() {
    for (const kind of Object.keys(this.registry) as FaultKind[]) {
      await this.registry[kind].reset();
    }
  }
}
```

- [ ] **Step 10.1.4: 테스트 통과 + index re-export**

```bash
pnpm --filter sim-controller test fault-injector
```

기대: 4 PASS. `src/index.ts`에 `export { FaultInjector } from "./fault/fault-injector.js"; export type { Fault, FaultKind } from "./fault/types.js";` 추가.

- [ ] **Step 10.1.5: Commit**

```bash
git add packages/sim-controller/src/fault/types.ts \
        packages/sim-controller/src/fault/fault-injector.ts \
        packages/sim-controller/src/fault/fault-injector.test.ts \
        packages/sim-controller/src/index.ts
git commit -m "feat(sim-controller): fault-injector registry skeleton"
```

### Task 10.2: schema break 주입 (시나리오 #10)

**Files:**
- Create: `packages/sim-controller/src/fault/schema-break.ts`
- Create: `packages/sim-controller/src/fault/schema-break.test.ts`

시나리오 #10은 v2 outbox event에 호환 깨지는 신규 필수 필드를 강제 주입해 controller Pass 1 `compatibility` hard rule이 FAIL로 떨어지는지 검증한다(spec 05 §3). 본 fault는 `/v1/insights/schema-compat` 응답을 _덮어쓰지 않고_, outbox publisher fixture가 다음 발행부터 추가 필드를 첨부하도록 토글한다 — 결정 모델은 정상 측정 경로로 hard FAIL을 본다.

- [ ] **Step 10.2.1: 실패 테스트 작성**

`packages/sim-controller/src/fault/schema-break.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { SchemaBreakFault, type SchemaBreakStore } from "./schema-break.js";

class InMem implements SchemaBreakStore {
  state: { active: boolean; fieldName: string | null } = { active: false, fieldName: null };
  async setBreak(f: string)  { this.state = { active: true, fieldName: f }; }
  async clearBreak()         { this.state = { active: false, fieldName: null }; }
  async readBreak()          { return this.state; }
}

describe("SchemaBreakFault (시나리오 #10)", () => {
  let s: InMem, f: SchemaBreakFault;
  beforeEach(() => { s = new InMem(); f = new SchemaBreakFault(s); });
  it("enable writes required field marker", async () => {
    await f.enable({ fieldName: "v2.required.tenantTier" });
    expect((await s.readBreak()).active).toBe(true);
    expect((await s.readBreak()).fieldName).toBe("v2.required.tenantTier");
  });
  it("disable clears marker + reset is idempotent", async () => {
    await f.enable({ fieldName: "v2.required.tenantTier" }); await f.disable();
    expect((await s.readBreak()).active).toBe(false);
    await f.reset(); await f.reset();
    expect((await s.readBreak()).active).toBe(false);
  });
  it("rejects enable without fieldName", async () => {
    await expect(f.enable({})).rejects.toThrow();
  });
});
```

- [ ] **Step 10.2.2: 테스트 실패 확인**

```bash
pnpm --filter sim-controller test schema-break
```

기대: FAIL.

- [ ] **Step 10.2.3: 최소 구현**

`packages/sim-controller/src/fault/schema-break.ts`:

```typescript
import { z } from "zod";
import type { Fault } from "./types.js";

export interface SchemaBreakStore {
  setBreak(fieldName: string): Promise<void>;
  clearBreak(): Promise<void>;
  readBreak(): Promise<{ active: boolean; fieldName: string | null }>;
}

const ParamsSchema = z.object({ fieldName: z.string().min(1) });

export class SchemaBreakFault implements Fault {
  constructor(private readonly store: SchemaBreakStore) {}
  async enable(params: unknown) {
    const { fieldName } = ParamsSchema.parse(params);
    await this.store.setBreak(fieldName);
  }
  async disable() { await this.store.clearBreak(); }
  async reset()   { await this.store.clearBreak(); }
}
```

- [ ] **Step 10.2.4: 테스트 통과 확인**

```bash
pnpm --filter sim-controller test schema-break
```

기대: 3 PASS. assertion 1세트 — `enable → store.active=true, fieldName=주입값` + `disable → store.active=false`로 fault 토글이 결정 모델 측정 표면에 정확히 반영됨을 증명.

- [ ] **Step 10.2.5: Commit**

```bash
git add packages/sim-controller/src/fault/schema-break.ts \
        packages/sim-controller/src/fault/schema-break.test.ts
git commit -m "feat(sim-controller): schema-break fault for scenario #10"
```

### Task 10.3: audit anomaly 주입 (시나리오 #11)

**Files:**
- Create: `packages/sim-controller/src/fault/audit-anomaly.ts`
- Create: `packages/sim-controller/src/fault/audit-anomaly.test.ts`

시나리오 #11은 v2 단계 skip으로 audit-recorder critical anomaly 1건이 자동 분류되는 흐름이다(spec 05 §3). 본 fault는 audit-recorder-store에 `severity="critical"` row 1건을 append-only 적재 — CON-005에 따라 controller Pass 1 `auditSafety`가 즉시 FAIL을 산출하고 결정 객체가 `verdict="rollback", triggerCategory="auditSafety"`로 떨어진다.

- [ ] **Step 10.3.1: 실패 테스트 작성**

`packages/sim-controller/src/fault/audit-anomaly.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { AuditAnomalyFault, type AuditAnomalyStore } from "./audit-anomaly.js";

class InMem implements AuditAnomalyStore {
  rows: Array<{ severity: string; reason: string; recordedAt: number }> = [];
  async appendAnomaly(r: typeof this.rows[number]) { this.rows.push(r); }
  async clearInjected() { this.rows = []; }
}

describe("AuditAnomalyFault (시나리오 #11)", () => {
  let s: InMem, f: AuditAnomalyFault;
  beforeEach(() => { s = new InMem(); f = new AuditAnomalyFault(s, () => 1714291200000); });
  it("enable appends exactly 1 critical anomaly row", async () => {
    await f.enable({ reason: "stage-skip-detected" });
    expect(s.rows).toHaveLength(1);
    expect(s.rows[0]).toEqual({ severity: "critical", reason: "stage-skip-detected", recordedAt: 1714291200000 });
  });
  it("repeated enable appends multiple rows (append-only) + disable clears", async () => {
    await f.enable({ reason: "first" }); await f.enable({ reason: "second" });
    expect(s.rows).toHaveLength(2);
    await f.disable();
    expect(s.rows).toHaveLength(0);
  });
  it("rejects enable without reason", async () => {
    await expect(f.enable({})).rejects.toThrow();
  });
});
```

- [ ] **Step 10.3.2: 테스트 실패 확인**

```bash
pnpm --filter sim-controller test audit-anomaly
```

기대: FAIL.

- [ ] **Step 10.3.3: 최소 구현**

`packages/sim-controller/src/fault/audit-anomaly.ts`:

```typescript
import { z } from "zod";
import type { Fault } from "./types.js";

export interface AuditAnomalyStore {
  appendAnomaly(row: { severity: string; reason: string; recordedAt: number }): Promise<void>;
  clearInjected(): Promise<void>;
}

const ParamsSchema = z.object({ reason: z.string().min(1) });

export class AuditAnomalyFault implements Fault {
  constructor(
    private readonly store: AuditAnomalyStore,
    private readonly now: () => number = () => Date.now(),
  ) {}
  async enable(params: unknown) {
    const { reason } = ParamsSchema.parse(params);
    // CON-005: severity "critical" 고정.
    await this.store.appendAnomaly({ severity: "critical", reason, recordedAt: this.now() });
  }
  async disable() { await this.store.clearInjected(); }
  async reset()   { await this.store.clearInjected(); }
}
```

- [ ] **Step 10.3.4: 테스트 통과 확인**

```bash
pnpm --filter sim-controller test audit-anomaly
```

기대: 3 PASS. assertion 1세트 — `enable → rows.length=1, severity=critical` + `disable → rows.length=0`로 anomaly 적재/정리가 결정 모델 입력 표면에 정확히 반영됨을 증명.

- [ ] **Step 10.3.5: Commit**

```bash
git add packages/sim-controller/src/fault/audit-anomaly.ts \
        packages/sim-controller/src/fault/audit-anomaly.test.ts
git commit -m "feat(sim-controller): audit-anomaly fault for scenario #11"
```

### Task 10.4: lag injection (시나리오 #14)

**Files:**
- Create: `packages/sim-controller/src/fault/replication-lag.ts`
- Create: `packages/sim-controller/src/fault/replication-lag.test.ts`

시나리오 #14는 lag-injector 3000ms 주입으로 controller `replicationHealth`가 WARN으로 떨어지고 BFF read 라우팅이 일시 primary fallback하는 흐름이다(spec 04 §4.4 + spec 05 §3). 구현은 spec 04 §4.4의 두 SQL을 그대로 사용한다 — primary `pg_replication_slot_advance` + standby `pg_sleep`. slot명은 Plan A Task 2.14의 `buildReplicationSlot({ purpose: "read_replica" })` grammar #13으로 빌드(직접 문자열 입력 금지). lag-injector는 idempotent하지 않으므로 reset 필수(spec 04 §4.4).

- [ ] **Step 10.4.1: 실패 테스트 작성**

`packages/sim-controller/src/fault/replication-lag.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { ReplicationLagFault, type PgQueryRunner } from "./replication-lag.js";

class FakePg implements PgQueryRunner {
  calls: Array<{ sql: string; params: unknown[] }> = [];
  async query(sql: string, params: unknown[]) { this.calls.push({ sql, params }); }
}

describe("ReplicationLagFault (시나리오 #14)", () => {
  let primary: FakePg, replica: FakePg, f: ReplicationLagFault;
  beforeEach(() => { primary = new FakePg(); replica = new FakePg(); f = new ReplicationLagFault(primary, replica); });

  it("enable issues slot_advance on primary + pg_sleep on replica using grammar #13 slot", async () => {
    await f.enable({ ms: 3000 });
    expect(primary.calls[0].sql).toMatch(/pg_replication_slot_advance/);
    expect(primary.calls[0].params).toEqual(["sim_read_replica_slot"]);
    expect(replica.calls[0].sql).toMatch(/pg_sleep/);
    expect(replica.calls[0].params).toEqual([3]); // 3000ms / 1000
  });
  it("disable is no-op (사이클 회복) + reset advances slot to current_wal_lsn", async () => {
    await f.enable({ ms: 3000 }); primary.calls = []; replica.calls = [];
    await f.disable();
    expect(primary.calls).toHaveLength(0); expect(replica.calls).toHaveLength(0);
    await f.reset();
    expect(primary.calls.some(c => /pg_replication_slot_advance/.test(c.sql) && /pg_current_wal_lsn/.test(c.sql))).toBe(true);
  });
  it("rejects ms < 0 or non-integer", async () => {
    await expect(f.enable({ ms: -1 })).rejects.toThrow();
    await expect(f.enable({ ms: 1.5 })).rejects.toThrow();
  });
});
```

- [ ] **Step 10.4.2: 테스트 실패 확인**

```bash
pnpm --filter sim-controller test replication-lag
```

기대: FAIL.

- [ ] **Step 10.4.3: 최소 구현**

`packages/sim-controller/src/fault/replication-lag.ts`:

```typescript
import { z } from "zod";
import { buildReplicationSlot } from "sim-identifier-grammar";
import type { Fault } from "./types.js";

export interface PgQueryRunner {
  query(sql: string, params: unknown[]): Promise<void>;
}

const ParamsSchema = z.object({ ms: z.number().int().nonnegative() });

export class ReplicationLagFault implements Fault {
  // Plan A Task 2.14 grammar #13 — 직접 문자열 입력 금지
  private readonly slotName = buildReplicationSlot({ purpose: "read_replica" });
  constructor(private readonly primary: PgQueryRunner, private readonly replica: PgQueryRunner) {}

  async enable(params: unknown) {
    const { ms } = ParamsSchema.parse(params);
    // (a) primary — slot advance 지연
    await this.primary.query(
      `SELECT pg_replication_slot_advance($1, pg_current_wal_lsn())`,
      [this.slotName],
    );
    // (b) standby — recovery 임시 sleep
    await this.replica.query(`SELECT pg_sleep($1)`, [ms / 1000]);
  }
  async disable() { /* no-op: 사이클 회복으로 자연 해소 */ }
  async reset() {
    // spec 04 §4.4: 시나리오 종료 시 slot을 current_wal_lsn까지 재진행해 lag 0 보장.
    await this.primary.query(
      `SELECT pg_replication_slot_advance($1, pg_current_wal_lsn())`,
      [this.slotName],
    );
  }
}
```

- [ ] **Step 10.4.4: 테스트 통과 확인**

```bash
pnpm --filter sim-controller test replication-lag
```

기대: 3 PASS. assertion 1세트 — `enable → primary slot_advance(grammar #13) + replica pg_sleep(ms/1000)` + `reset → primary slot_advance to current_wal_lsn`으로 lag injection이 spec 04 §4.4 SQL과 일치함을 증명.

- [ ] **Step 10.4.5: Commit**

```bash
git add packages/sim-controller/src/fault/replication-lag.ts \
        packages/sim-controller/src/fault/replication-lag.test.ts
git commit -m "feat(sim-controller): replication-lag fault for scenario #14 (grammar #13 slot)"
```

### Task 10.5: dbPool 압박 시뮬 (시나리오 #13)

**Files:**
- Create: `packages/sim-controller/src/fault/db-pool-pressure.ts`
- Create: `packages/sim-controller/src/fault/db-pool-pressure.test.ts`

시나리오 #13은 dbPool 인위 축소(pool=4) + 동시 요청 ≥4 지속으로 controller Pass 2가 `verdict="rejected", rejectedBy="resourceHeadroom"`을 산출하고 replica 변동 0을 보이는지 검증한다(spec 05 §3). 본 fault는 metrics-collector 측 `db_pool_utilization` gauge에 forced active/max를 주입한다 — controller `resource-headroom.dbPoolUtilization` 카테고리 입력으로 즉시 반영된다.

- [ ] **Step 10.5.1: 실패 테스트 작성**

`packages/sim-controller/src/fault/db-pool-pressure.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { DbPoolPressureFault, type DbPoolGaugeStore } from "./db-pool-pressure.js";

class InMem implements DbPoolGaugeStore {
  state = new Map<string, { active: number; max: number }>();
  async setForcedUtilization(svc: string, active: number, max: number) { this.state.set(svc, { active, max }); }
  async clear(svc?: string) { svc ? this.state.delete(svc) : this.state.clear(); }
}

describe("DbPoolPressureFault (시나리오 #13)", () => {
  let g: InMem, f: DbPoolPressureFault;
  beforeEach(() => { g = new InMem(); f = new DbPoolPressureFault(g); });

  it("enable forces utilization=1.0 by default + supports custom active below max", async () => {
    await f.enable({ service: "approval-api-v2", poolMax: 4 });
    expect(g.state.get("approval-api-v2")).toEqual({ active: 4, max: 4 });
    await f.enable({ service: "approval-api-v2", poolMax: 4, active: 3 });
    expect(g.state.get("approval-api-v2")).toEqual({ active: 3, max: 4 });
  });
  it("disable clears only the target service, reset clears all", async () => {
    await f.enable({ service: "approval-api-v2", poolMax: 4 });
    await f.enable({ service: "reporting-api-v1", poolMax: 4 });
    await f.disable("approval-api-v2");
    expect(g.state.has("approval-api-v2")).toBe(false);
    expect(g.state.has("reporting-api-v1")).toBe(true);
    await f.reset();
    expect(g.state.size).toBe(0);
  });
  it("rejects active > poolMax", async () => {
    await expect(f.enable({ service: "x", poolMax: 4, active: 5 })).rejects.toThrow();
  });
});
```

- [ ] **Step 10.5.2: 테스트 실패 확인**

```bash
pnpm --filter sim-controller test db-pool-pressure
```

기대: FAIL.

- [ ] **Step 10.5.3: 최소 구현**

`packages/sim-controller/src/fault/db-pool-pressure.ts`:

```typescript
import { z } from "zod";
import type { Fault } from "./types.js";

export interface DbPoolGaugeStore {
  setForcedUtilization(service: string, active: number, max: number): Promise<void>;
  clear(service?: string): Promise<void>;
}

const ParamsSchema = z
  .object({
    service: z.string().min(1),
    poolMax: z.number().int().positive(),
    active:  z.number().int().nonnegative().optional(),
  })
  .superRefine((v, ctx) => {
    const a = v.active ?? v.poolMax;
    if (a > v.poolMax) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `active (${a}) must be ≤ poolMax (${v.poolMax})` });
    }
  });

export class DbPoolPressureFault implements Fault {
  constructor(private readonly gauge: DbPoolGaugeStore) {}
  async enable(params: unknown) {
    const v = ParamsSchema.parse(params);
    const active = v.active ?? v.poolMax; // 기본 utilization=1.0
    await this.gauge.setForcedUtilization(v.service, active, v.poolMax);
  }
  // disable에 service 지정 가능 — admin-router가 body로 위임.
  async disable(service?: string) { await this.gauge.clear(service); }
  async reset()                   { await this.gauge.clear(); }
}
```

- [ ] **Step 10.5.4: 테스트 통과 확인**

```bash
pnpm --filter sim-controller test db-pool-pressure
```

기대: 4 PASS. assertion 1세트 — `enable → gauge[service]={active:max,max}` + `disable(service) → gauge[service]=undefined`로 dbPool 압박이 controller `resourceHeadroom` 입력에 반영됨을 증명.

- [ ] **Step 10.5.5: Commit**

```bash
git add packages/sim-controller/src/fault/db-pool-pressure.ts \
        packages/sim-controller/src/fault/db-pool-pressure.test.ts
git commit -m "feat(sim-controller): db-pool-pressure fault for scenario #13"
```

### Task 10.6: fault toggle CLI/HTTP API (admin-router)

**Files:**
- Create: `packages/sim-controller/src/fault/admin-router.ts`
- Create: `packages/sim-controller/src/fault/admin-router.test.ts`
- Modify: `packages/sim-controller/src/server.ts`

본 task는 시나리오 runner가 호출하는 단일 HTTP 표면을 노출한다. spec 05 §3.2 helper(`injectLag`, `burstLoad`, `dropInvalidate`)는 모두 `POST /admin/fault/:kind` body `{enabled, params?}`로 라우팅된다. controller 본 사이클은 fault 상태를 _읽지 않고_ 단계 9 metrics scrape 경로가 자연스레 측정한다. admin-router는 단계 9 server.ts Fastify 인스턴스에 plugin으로 register되며, controller `start()`의 `finally` 절은 `await faultInjector.resetAll()`을 호출해 시나리오 종료 후 상태 누수를 막는다.

- [ ] **Step 10.6.1: 실패 테스트 작성**

`packages/sim-controller/src/fault/admin-router.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { adminFaultRouter } from "./admin-router.js";
import type { Fault, FaultKind } from "./types.js";
import { FaultInjector } from "./fault-injector.js";

class StubFault implements Fault {
  enabled = false; lastParams: unknown = null;
  async enable(p: unknown) { this.enabled = true; this.lastParams = p; }
  async disable() { this.enabled = false; }
  async reset() { this.enabled = false; }
}

describe("admin-router POST /admin/fault/:kind", () => {
  let app: FastifyInstance, stub: StubFault, inj: FaultInjector;
  beforeEach(async () => {
    stub = new StubFault();
    inj = new FaultInjector({ "schema-break": stub } as Record<FaultKind, Fault>);
    app = Fastify();
    await app.register(adminFaultRouter, { injector: inj });
  });

  it("enabled=true routes params to FaultInjector.enable", async () => {
    const res = await app.inject({
      method: "POST", url: "/admin/fault/schema-break",
      payload: { enabled: true, params: { fieldName: "v2.required" } },
    });
    expect(res.statusCode).toBe(200);
    expect(stub.enabled).toBe(true);
    expect(stub.lastParams).toEqual({ fieldName: "v2.required" });
  });
  it("enabled=false routes to FaultInjector.disable", async () => {
    await stub.enable({});
    const res = await app.inject({
      method: "POST", url: "/admin/fault/schema-break",
      payload: { enabled: false },
    });
    expect(res.statusCode).toBe(200); expect(stub.enabled).toBe(false);
  });
  it("rejects unknown FaultKind with 400", async () => {
    const res = await app.inject({ method: "POST", url: "/admin/fault/unknown-kind", payload: { enabled: true } });
    expect(res.statusCode).toBe(400);
  });
  it("rejects malformed body (missing enabled) with 400", async () => {
    const res = await app.inject({ method: "POST", url: "/admin/fault/schema-break", payload: { params: {} } });
    expect(res.statusCode).toBe(400);
  });
});
```

- [ ] **Step 10.6.2: 테스트 실패 확인**

```bash
pnpm --filter sim-controller test admin-router
```

기대: FAIL.

- [ ] **Step 10.6.3: 최소 구현 + server.ts wiring**

`packages/sim-controller/src/fault/admin-router.ts`:

```typescript
import { z } from "zod";
import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import type { FaultInjector } from "./fault-injector.js";
import type { FaultKind } from "./types.js";

const KINDS: readonly FaultKind[] = [
  "schema-break", "audit-anomaly", "replication-lag", "db-pool-pressure",
] as const;

const BodySchema = z.object({
  enabled: z.boolean(),
  params:  z.record(z.unknown()).optional(),
});

export interface AdminFaultRouterOptions { injector: FaultInjector; }

export const adminFaultRouter: FastifyPluginAsync<AdminFaultRouterOptions> = async (
  app: FastifyInstance,
  opts,
) => {
  app.post<{ Params: { kind: string }; Body: unknown }>(
    "/admin/fault/:kind",
    async (req, reply) => {
      const kind = req.params.kind as FaultKind;
      if (!KINDS.includes(kind)) {
        return reply.code(400).send({ error: `unknown fault kind: ${kind}` });
      }
      const parsed = BodySchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: parsed.error.format() });
      }
      const { enabled, params } = parsed.data;
      if (enabled) await opts.injector.enable(kind, params ?? {});
      else         await opts.injector.disable(kind);
      return reply.code(200).send({ ok: true, kind, enabled });
    },
  );
};
```

`server.ts` 수정 (단계 9 Fastify 인스턴스에 plugin register, controller finally에서 resetAll):

```typescript
import { adminFaultRouter } from "./fault/admin-router.js";

// 단계 9에서 만든 Fastify app + FaultInjector를 받은 뒤:
await app.register(adminFaultRouter, { injector: faultInjector });

// controller.start()의 try {} finally {} 블록에서:
//   } finally { await faultInjector.resetAll(); }
```

- [ ] **Step 10.6.4: 테스트 통과 확인**

```bash
pnpm --filter sim-controller test admin-router
```

기대: 4 PASS. assertion 1세트 — `POST /admin/fault/schema-break {enabled:true, params:{...}} → 200 + stub.enabled=true` + `POST {enabled:false} → 200 + stub.enabled=false`로 시나리오 runner가 단일 HTTP 표면으로 enable/disable 토글이 가능함을 증명.

- [ ] **Step 10.6.5: Commit**

```bash
git add packages/sim-controller/src/fault/admin-router.ts \
        packages/sim-controller/src/fault/admin-router.test.ts \
        packages/sim-controller/src/server.ts
git commit -m "feat(sim-controller): admin-router POST /admin/fault/:kind for scenario runners"
```
