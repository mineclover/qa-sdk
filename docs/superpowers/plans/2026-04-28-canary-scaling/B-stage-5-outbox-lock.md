## 단계 5: outbox 다중 dispatcher 안전성 (이전 평가 #1)

**Spec 참조:** `04-scaling-infra.md` §2

approval-api replica가 N개로 scale될 때 모든 replica 안에서 outbox dispatcher가 동시에 폴링한다. 본 단계는 (a) `FOR UPDATE SKIP LOCKED` 폴링 락(§2.1), (b) `(idempotency_key, consumer)` UNIQUE consumer-log(§2.2), (c) `WHERE status IN ('pending','failed')` 동시성 가드 + retry/DLQ 전이(§2.3)를 추가해 중복 dispatch 0·중복 효과 0을 보장하고, idempotency_key는 Plan A Task 2.13의 `buildIdempotencyKey`만 사용하도록 강제한다.

> **Import scope**: `sim-identifier-grammar` 패키지는 unscoped (Plan A Task 2.1.1 — `"name": "sim-identifier-grammar"`). 본 단계의 모든 import는 `from "sim-identifier-grammar"` (NOT `@qa-sdk/sim-identifier-grammar`).
>
> **Event name grammar**: 도메인 outbox event는 spec 03 §2.5 grammar #5 — `${domain}.${aggregate}.${verbPast}` 3-tier kebab. 4 슬라이스 fixture는 `approval.budget.submitted` / `approval.budget.approved` / `approval.budget.rejected` / `approval.expense.submitted` 등으로 3-tier 정합. 2-tier(`budget.created`) 또는 underscore(`expense.status_changed`) 표기는 grammar 위반.
>
> **Entity ID canonicalize**: 도메인 entity id가 underscore/mixed-case(예: `br_001`, `exp_1`)인 경우, idempotency key 합성 직전에 `toGrammarSafeAggregateId(rawId)` helper로 grammar-safe 형태로 변환한다 (Task 5.6 참조). raw 보간 금지.

### File Structure (단계 5)

| 종류 | 경로 |
|---|---|
| Modify | `simulations/enterprise-pm/services/approval-api/src/approval/pg/schema.ts` (outbox 컬럼 4종 + status enum 확장 + DDL/RESET 동기화 + ALTER TABLE 마이그레이션) |
| Create | `simulations/enterprise-pm/services/approval-api/src/approval/shared/outbox/outbox-consumer-log.schema.ts` (`sim.outbox_consumer_log` Drizzle + DDL + RESET DDL) |
| Create | `simulations/enterprise-pm/services/approval-api/src/approval/shared/outbox/outbox-consumer-log.test.ts` |
| Create | `simulations/enterprise-pm/services/approval-api/src/approval/shared/outbox/outbox-dispatcher.ts` (SKIP LOCKED 폴링 + status 전이 + retry/DLQ + idempotency consumer-log) |
| Create | `simulations/enterprise-pm/services/approval-api/src/approval/shared/outbox/outbox-dispatcher.test.ts` |
| Create | `simulations/enterprise-pm/services/approval-api/src/approval/shared/outbox/outbox-dispatcher.status-guard.test.ts` |
| Create | `simulations/enterprise-pm/services/approval-api/src/approval/shared/outbox/outbox-dispatcher.dlq.test.ts` |
| Create | `simulations/enterprise-pm/services/approval-api/src/approval/shared/outbox/outbox-dispatcher.contention.test.ts` (락 경합 단위 테스트) |
| Create | `simulations/enterprise-pm/services/approval-api/src/approval/shared/outbox/idempotency-key-source.ts` (`toGrammarSafeAggregateId` helper — entity id canonicalize) |
| Create | `simulations/enterprise-pm/services/approval-api/src/approval/shared/outbox/idempotency-key-source.test.ts` |
| Modify | `simulations/enterprise-pm/packages/sim-domain-slice-kit/src/outbox.port.ts` (`OutboxRecord.idempotencyKey: string` 추가) |
| Modify | `simulations/enterprise-pm/packages/sim-domain-slice-kit/src/outbox/drizzle.ts` (idempotencyKey 가드 + `idempotency_key` / `retry_count` 컬럼 매핑) |
| Modify | `simulations/enterprise-pm/services/approval-api/src/approval/{budget,expense,resource,timeoff}/application/use-cases/*.use-case.ts` (publisher 호출부에 `buildIdempotencyKey` 결과 주입) |

> 시나리오 #15(`outbox-multi-dispatcher-lock`) 부하·복합 검증은 Plan E `05-error-and-scenarios.md` §3로 분리한다. 본 단계는 *핵심 메커니즘 단위 테스트*만 책임진다.

### Task 5.1: `sim.outbox_consumer_log` 테이블 마이그레이션

**Files:**
- Create: `…/approval/shared/outbox/outbox-consumer-log.schema.ts`
- Create: `…/approval/shared/outbox/outbox-consumer-log.test.ts`
- Modify: `…/approval/pg/schema.ts` (re-export + RESET DDL 묶음에 포함)

spec 04 §2.2의 consumer-log 테이블을 도메인 schema로 추가. `(idempotency_key, consumer)` UNIQUE 제약이 race를 흡수해 한 행만 살아남는다. 위치는 *모든 슬라이스가 공유*하는 outbox table과 같은 무게이므로 `db-bootstrap` 같은 인프라 패키지가 아니라 `approval/shared/outbox/`에 둔다 — Drizzle table object + raw DDL을 함께 export하는 패턴은 기존 `pg/schema.ts`(`SIM_APPROVAL_PG_DDL`)와 동일.

- [ ] **Step 5.1.1: DDL + Drizzle table 작성**

`outbox-consumer-log.schema.ts`:

```typescript
// @def.boundary sim-approval-api
import { pgSchema, text, bigint, uniqueIndex } from "drizzle-orm/pg-core";

const sim = pgSchema("sim");

export const outboxConsumerLog = sim.table(
  "outbox_consumer_log",
  {
    idempotency_key: text("idempotency_key").notNull(),
    consumer: text("consumer").notNull(),
    processed_at: bigint("processed_at", { mode: "number" }).notNull(),
  },
  (t) => [uniqueIndex("uq_sim_outbox_consumer_log_key").on(t.idempotency_key, t.consumer)],
);

export const SIM_OUTBOX_CONSUMER_LOG_PG_DDL = `
CREATE SCHEMA IF NOT EXISTS sim;
CREATE TABLE IF NOT EXISTS sim.outbox_consumer_log (
  idempotency_key TEXT NOT NULL,
  consumer TEXT NOT NULL,
  processed_at BIGINT NOT NULL,
  CONSTRAINT uq_sim_outbox_consumer_log_key UNIQUE (idempotency_key, consumer)
);
`;

export const SIM_OUTBOX_CONSUMER_LOG_PG_RESET_DDL = `
DROP TABLE IF EXISTS sim.outbox_consumer_log CASCADE;
CREATE TABLE sim.outbox_consumer_log (
  idempotency_key TEXT NOT NULL,
  consumer TEXT NOT NULL,
  processed_at BIGINT NOT NULL,
  CONSTRAINT uq_sim_outbox_consumer_log_key UNIQUE (idempotency_key, consumer)
);
`;
```

- [ ] **Step 5.1.2: up/down DDL + ON CONFLICT 동작 검증**

`outbox-consumer-log.test.ts` (vitest + postgres, `QA_TEST_PG=1` gate — 기존 `approval/pg/adapter.test.ts` 패턴):

```typescript
const PG_AVAILABLE = process.env.QA_TEST_PG === "1";

describe.skipIf(!PG_AVAILABLE)("sim.outbox_consumer_log DDL", () => {
  // beforeEach: SIM_OUTBOX_CONSUMER_LOG_PG_RESET_DDL 적용
  // afterEach: DROP TABLE + sql.end()

  it("up: 컬럼 3종 + UNIQUE 제약 생성", async () => {
    // information_schema.columns / table_constraints 조회
    // expect: ['consumer','idempotency_key','processed_at'] + 'uq_sim_outbox_consumer_log_key'
  });

  it("ON CONFLICT (idempotency_key, consumer) DO NOTHING — 두 번째 INSERT는 RETURNING 비어 있음", async () => {
    // 같은 (key, consumer) 두 번 INSERT → 첫 RETURNING 1행, 둘째 0행
  });

  it("같은 key + 다른 consumer 는 둘 다 통과 (cross-consumer 격리)", async () => {
    // (key, 'A') + (key, 'B') 둘 다 RETURNING 1행
  });
});
```

- [ ] **Step 5.1.3: schema TS 등록**

`approval/pg/schema.ts`에서 다음을 re-export하고 `SIM_APPROVAL_PG_DDL` 끝과 `SIM_APPROVAL_PG_RESET_DDL`에 outbox_consumer_log DDL을 합친다 (RESET 순서: 본 테이블은 FK 없음, 기존 outbox 테이블 reset 직후 추가):

```typescript
export {
  outboxConsumerLog,
  SIM_OUTBOX_CONSUMER_LOG_PG_DDL,
  SIM_OUTBOX_CONSUMER_LOG_PG_RESET_DDL,
} from "../shared/outbox/outbox-consumer-log.schema.js";
```

- [ ] **Step 5.1.4: Commit**

```bash
QA_TEST_PG=1 pnpm --filter sim-approval-api test outbox-consumer-log
git add simulations/enterprise-pm/services/approval-api/src/approval/shared/outbox/outbox-consumer-log.{schema,test}.ts \
        simulations/enterprise-pm/services/approval-api/src/approval/pg/schema.ts
git commit -m "feat(sim-approval-api): sim.outbox_consumer_log table (UNIQUE idempotency_key,consumer)"
```

### Task 5.2: outbox dispatcher 폴링 SQL을 `FOR UPDATE SKIP LOCKED`로 교체

**Files:**
- Modify: `…/approval/pg/schema.ts` (outbox events 컬럼 4종 + status enum 확장 + ALTER TABLE)
- Modify: `simulations/enterprise-pm/packages/sim-domain-slice-kit/src/outbox.port.ts` (`OutboxRecord.idempotencyKey`)
- Modify: `simulations/enterprise-pm/packages/sim-domain-slice-kit/src/outbox/drizzle.ts` (`idempotency_key` 컬럼 매핑)
- Create: `…/approval/shared/outbox/outbox-dispatcher.ts`
- Create: `…/approval/shared/outbox/outbox-dispatcher.test.ts`

현재 `approvalOutboxEvents`는 `id, aggregate_id, event_name, event_version, payload, occurred_at, scope_id, status` 8개 컬럼이고 status enum은 `["pending","published","failed"]`. spec 04 §2.1/§2.3은 `idempotency_key`(SELECT 결과 컬럼), `dispatched_at`(SET), `retry_count`+`next_attempt_at`(backoff)을 요구하므로 ALTER TABLE 마이그레이션과 enum 확장(`dispatched`/`dlq` 추가)이 필요하다.

- [ ] **Step 5.2.1: 실패 테스트 작성**

`outbox-dispatcher.test.ts` 핵심 케이스 3건 (`QA_TEST_PG=1` gate):

```typescript
import { buildIdempotencyKey } from "sim-identifier-grammar";
import { createOutboxDispatcher } from "./outbox-dispatcher.js";
import {
  SIM_APPROVAL_PG_RESET_DDL,
  SIM_OUTBOX_CONSUMER_LOG_PG_RESET_DDL,
} from "../../pg/schema.js";

describe.skipIf(!PG_AVAILABLE)("createOutboxDispatcher", () => {
  // beforeEach: 두 RESET DDL 적용 + N개 outbox row seed (idempotency_key는 buildIdempotencyKey 결과)

  it("seed 5 → 한 dispatcher가 5개 모두 dispatched + consumer-log 5행", async () => {
    const disp = createOutboxDispatcher({ db, sql, consumerName: "sim-approval-api",
      consume: async (e) => calls.push(e.idempotencyKey), batchSize: 10, maxRetries: 5 });
    expect(await disp.tick()).toBe(5);
    // SELECT FROM sim.outbox_consumer_log → 5
    // SELECT status FROM sim.approval_outbox_events → all 'dispatched'
  });

  it("두 번째 tick은 0 row (status='pending' 가드)", async () => { /* tick 후 다시 tick=0 */ });

  it("consumer throw → status='failed' + retry_count=1 + next_attempt_at 설정", async () => { /* … */ });
});
```

- [ ] **Step 5.2.2: 테스트 실패 확인**

```bash
QA_TEST_PG=1 pnpm --filter sim-approval-api test outbox-dispatcher
```
기대: FAIL (모듈 없음 + outbox 컬럼 없음).

- [ ] **Step 5.2.3: 최소 구현**

(a) `approval/pg/schema.ts`의 `approvalOutboxEvents`를 다음과 같이 확장:

```typescript
status: text("status", { enum: ["pending", "dispatched", "failed", "dlq"] })
  .notNull().default("pending"),
idempotency_key: text("idempotency_key").notNull(),
dispatched_at: bigint("dispatched_at", { mode: "number" }),
retry_count: integer("retry_count").notNull().default(0),
next_attempt_at: bigint("next_attempt_at", { mode: "number" }),
```

`SIM_APPROVAL_PG_DDL` / `SIM_APPROVAL_PG_RESET_DDL`의 outbox 정의도 동일하게 갱신:

```sql
CREATE TABLE IF NOT EXISTS sim.approval_outbox_events (
  id TEXT PRIMARY KEY,
  aggregate_id TEXT NOT NULL,
  event_name TEXT NOT NULL,
  event_version BIGINT NOT NULL,
  payload TEXT NOT NULL,
  occurred_at BIGINT NOT NULL,
  scope_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','dispatched','failed','dlq')),
  idempotency_key TEXT NOT NULL,
  dispatched_at BIGINT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  next_attempt_at BIGINT
);
CREATE INDEX IF NOT EXISTS idx_sim_approval_outbox_status
  ON sim.approval_outbox_events(status, occurred_at);
```

기존 dev/CI DB용 ALTER TABLE 마이그레이션도 export:

```typescript
export const SIM_APPROVAL_PG_OUTBOX_ALTER_DDL = `
ALTER TABLE sim.approval_outbox_events
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS dispatched_at BIGINT,
  ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_attempt_at BIGINT;
ALTER TABLE sim.approval_outbox_events
  DROP CONSTRAINT IF EXISTS approval_outbox_events_status_check;
ALTER TABLE sim.approval_outbox_events
  ADD CONSTRAINT approval_outbox_events_status_check
  CHECK (status IN ('pending','dispatched','failed','dlq'));
UPDATE sim.approval_outbox_events SET idempotency_key = id WHERE idempotency_key IS NULL;
ALTER TABLE sim.approval_outbox_events ALTER COLUMN idempotency_key SET NOT NULL;
`;
```

(b) `sim-domain-slice-kit/src/outbox.port.ts`의 `OutboxRecord`에 `idempotencyKey: string` 필수 필드 추가, `outbox/drizzle.ts`의 INSERT row에 `idempotency_key: record.idempotencyKey`, `retry_count: 0` 매핑 추가.

(c) `outbox-dispatcher.ts` (spec 04 §2.1/§2.2/§2.3 SQL을 그대로 옮김):

```typescript
// @def.boundary sim-approval-api
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { Sql } from "postgres";
import { buildIdempotencyKey, parseIdempotencyKey } from "sim-identifier-grammar";

export interface OutboxEvent {
  id: string; aggregateId: string; eventName: string;
  payload: string; idempotencyKey: string;
}
export type OutboxConsumer = (evt: OutboxEvent) => Promise<void>;

export interface OutboxDispatcherOptions {
  db: PostgresJsDatabase; sql: Sql;
  consumerName: string;       // grammar #1 service prefix
  consume: OutboxConsumer;
  batchSize: number;          // 기본 10 (§2.5)
  maxRetries: number;         // 기본 5 (§2.3)
}

const BACKOFF_MS = [1_000, 2_000, 4_000, 8_000, 16_000];
const backoff = (n: number) => BACKOFF_MS[Math.min(n - 1, BACKOFF_MS.length - 1)];

export interface OutboxDispatcher { tick(): Promise<number>; }

export function createOutboxDispatcher(opts: OutboxDispatcherOptions): OutboxDispatcher {
  return {
    async tick() {
      let processed = 0;
      await opts.sql.begin(async (tx) => {
        // §2.1 폴링 — 'pending' 또는 backoff 만료된 'failed' row 모두 대상.
        // 'failed' 누락 시 retry 사이클이 정지하므로 IN ('pending','failed') 필수.
        const rows = await tx<{
          id: string; aggregate_id: string; event_name: string;
          payload: string; idempotency_key: string;
        }[]>`
          SELECT id, aggregate_id, event_name, payload, idempotency_key
          FROM sim.approval_outbox_events
          WHERE status IN ('pending', 'failed')
            AND (next_attempt_at IS NULL OR next_attempt_at <= ${Date.now()})
          ORDER BY occurred_at
          LIMIT ${opts.batchSize}
          FOR UPDATE SKIP LOCKED`;

        for (const row of rows) {
          parseIdempotencyKey(row.idempotency_key); // grammar #12 형식 가드
          const evt: OutboxEvent = {
            id: row.id, aggregateId: row.aggregate_id, eventName: row.event_name,
            payload: row.payload, idempotencyKey: row.idempotency_key,
          };

          try {
            // §2.2 — consume-then-claim 순서. 먼저 consume, 성공 시에만 consumer-log INSERT.
            // claim-then-consume 순서는 다른 dispatcher가 이미 처리한 row에 대해
            // 본 dispatcher가 silent skip(continue)하면서 자기 자신은 consume을 *건너뛰므로*
            // "내가 처리하지 않은 row의 status를 dispatched로 바꾸는" race가 발생.
            // 본 dispatcher가 먼저 consume하고, 그 결과만 consumer-log로 영속화하면
            // ON CONFLICT가 같은 (key, consumer) 중복 INSERT race를 자연 흡수.
            await opts.consume(evt);

            const claimed = await tx<{ idempotency_key: string }[]>`
              INSERT INTO sim.outbox_consumer_log (idempotency_key, consumer, processed_at)
              VALUES (${evt.idempotencyKey}, ${opts.consumerName}, ${Date.now()})
              ON CONFLICT (idempotency_key, consumer) DO NOTHING
              RETURNING idempotency_key`;

            // §2.3 status 전이 — AND status IN ('pending','failed') 가드로 동시성 자연 no-op.
            await tx`
              UPDATE sim.approval_outbox_events
              SET status = 'dispatched', dispatched_at = ${Date.now()}
              WHERE id = ${row.id} AND status IN ('pending', 'failed')`;

            // claimed.length === 0 이면 다른 dispatcher 가 이미 동일 (key, consumer) 처리.
            // 본 dispatcher 도 이미 consume 했으므로 결과적으로 중복 효과 0. 다음 row.
            if (claimed.length > 0) processed++;
          } catch {
            const next = await tx<{ retry_count: number }[]>`
              UPDATE sim.approval_outbox_events
              SET retry_count = retry_count + 1
              WHERE id = ${row.id} AND status IN ('pending', 'failed')
              RETURNING retry_count`;
            const newCount = next[0]?.retry_count ?? 0;
            if (newCount > opts.maxRetries) {
              await tx`UPDATE sim.approval_outbox_events SET status='dlq' WHERE id=${row.id}`;
              // DLQ 진입 자체를 outbox 이벤트로 발행 (controller 신호).
              // DLQ event의 idempotency_key 도 grammar #12 (3-tier) 형식 준수.
              // raw `dlq:${...}` 보간은 grammar 위반 — buildIdempotencyKey 사용 강제.
              const dlqEventName = "approval.outbox.dlq-entered";
              const dlqOccurredAt = Date.now();
              const dlqIdempotencyKey = buildIdempotencyKey({
                aggregateId: `dlq-${row.id}`.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
                eventName: dlqEventName,
                occurredAt: dlqOccurredAt,
              });
              await tx`
                INSERT INTO sim.approval_outbox_events
                  (id, aggregate_id, event_name, event_version, payload,
                   occurred_at, scope_id, status, idempotency_key, retry_count)
                VALUES (${`dlq-${row.id}`}, ${row.aggregate_id},
                  ${dlqEventName}, 1,
                  ${JSON.stringify({ originId: row.id, eventName: row.event_name })},
                  ${dlqOccurredAt}, 'tx-dlq', 'pending',
                  ${dlqIdempotencyKey}, 0)`;
            } else {
              await tx`
                UPDATE sim.approval_outbox_events
                SET status='failed', next_attempt_at=${Date.now() + backoff(newCount)}
                WHERE id=${row.id}`;
            }
          }
        }
      });
      return processed;
    },
  };
}
```

- [ ] **Step 5.2.4: 테스트 통과**

```bash
QA_TEST_PG=1 pnpm --filter sim-approval-api test outbox-dispatcher
```
기대: 3 PASS.

- [ ] **Step 5.2.5: Commit**

```bash
git add simulations/enterprise-pm/services/approval-api/src/approval/shared/outbox/outbox-dispatcher.{ts,test.ts} \
        simulations/enterprise-pm/services/approval-api/src/approval/pg/schema.ts \
        simulations/enterprise-pm/packages/sim-domain-slice-kit/src/outbox.port.ts \
        simulations/enterprise-pm/packages/sim-domain-slice-kit/src/outbox/drizzle.ts
git commit -m "feat(sim-approval-api): outbox dispatcher with FOR UPDATE SKIP LOCKED + idempotency consumer-log"
```

### Task 5.3: dispatch status 전이 동시성 가드

**Files:**
- Create: `…/approval/shared/outbox/outbox-dispatcher.status-guard.test.ts`

spec 04 §2.3의 `WHERE id=$1 AND status IN ('pending','failed')` 가드는 두 dispatcher가 같은 row를 UPDATE할 때 두 번째 시도가 자연스럽게 no-op(`ROW_COUNT=0`)이 되게 한다. Task 5.2 dispatcher가 이 형태를 이미 따르므로 본 task는 *동시성 자체에 대한 회귀 단위 테스트*만 추가한다. (`'pending'` 단일 가드는 retry 사이클의 `'failed'` row를 잡지 못하므로 `IN ('pending','failed')`로 확장.)

- [ ] **Step 5.3.1: 실패 테스트 작성**

`outbox-dispatcher.status-guard.test.ts` (`QA_TEST_PG=1`):

```typescript
describe.skipIf(!PG_AVAILABLE)("outbox status 전이 동시성 가드", () => {
  // beforeEach: RESET DDL 두 개 + outbox row 1건 seed (idempotency_key=buildIdempotencyKey)
  // sqlA, sqlB 두 별도 connection 준비

  it("동시 두 트랜잭션 UPDATE 시도 → 정확히 1 ROW_COUNT만 1, 나머지 0", async () => {
    const [r1, r2] = await Promise.all([
      sqlA.begin(async (tx) =>
        (await tx`UPDATE sim.approval_outbox_events
                  SET status='dispatched', dispatched_at=${Date.now()}
                  WHERE id='evt-1' AND status IN ('pending','failed')`).count),
      sqlB.begin(async (tx) =>
        (await tx`UPDATE sim.approval_outbox_events
                  SET status='dispatched', dispatched_at=${Date.now()}
                  WHERE id='evt-1' AND status IN ('pending','failed')`).count),
    ]);
    expect([r1, r2].sort()).toEqual([0, 1]);
    // 최종 status='dispatched' 확인
  });

  it("status 가드 누락 시 두 트랜잭션 모두 ROW_COUNT=1 (가드 필요성 음성 통제)", async () => {
    // 동일 흐름을 가드 없이 — r1+r2 = 2
  });
});
```

- [ ] **Step 5.3.2: 테스트 실패 확인 → 통과 확인**

```bash
QA_TEST_PG=1 pnpm --filter sim-approval-api test outbox-dispatcher.status-guard
```
Task 5.2 구현이 가드를 포함하므로 PASS여야 한다. FAIL 시 dispatcher의 두 UPDATE문(`dispatched` 전이 / claimed.length===0 분기)에 `AND status='pending'`이 누락된 것 — 진단 후 패치.

- [ ] **Step 5.3.3: 최소 보강 (필요 시)**

`outbox-dispatcher.ts`의 두 UPDATE문에 `AND status IN ('pending','failed')`을 추가. 일반적으로 본 step은 no-op (5.2가 이미 포함).

- [ ] **Step 5.3.4: 테스트 통과**

```bash
QA_TEST_PG=1 pnpm --filter sim-approval-api test outbox-dispatcher.status-guard
```
기대: 2 PASS.

- [ ] **Step 5.3.5: Commit**

```bash
git add simulations/enterprise-pm/services/approval-api/src/approval/shared/outbox/outbox-dispatcher.status-guard.test.ts
git commit -m "test(sim-approval-api): outbox status='pending' guard regression"
```

### Task 5.4: DLQ 진입 (retry_count > 5) + DLQ outbox 이벤트 발행

**Files:**
- Create: `…/approval/shared/outbox/outbox-dispatcher.dlq.test.ts`

backoff `1s → 2s → 4s → 8s → 16s` 후 6번째 실패에서 status='dlq'로 격리하고, DLQ 진입 자체를 별도 outbox 이벤트(`approval.outbox.dlq-entered`)로 발행해 controller가 안전 가드 카테고리 신호로 수신한다 (spec 04 §2.3 마지막 문단). Task 5.2 dispatcher가 이미 그 동작을 포함하므로 backoff 시퀀스 + DLQ 전이 + DLQ 이벤트 발행을 단위 검증한다.

- [ ] **Step 5.4.1: 실패 테스트 작성**

`outbox-dispatcher.dlq.test.ts` (`QA_TEST_PG=1`):

```typescript
describe.skipIf(!PG_AVAILABLE)("outbox dispatcher DLQ", () => {
  // beforeEach: RESET DDL 두 개 + outbox row 1건 seed (status='pending')
  const failing = async () => { throw new Error("downstream-down"); };

  it("연속 5회 실패 후 6번째 실패에서 DLQ + DLQ 이벤트 발행", async () => {
    const disp = createOutboxDispatcher({ db, sql, consumerName: "sim-approval-api",
      consume: failing, batchSize: 10, maxRetries: 5 });
    for (let i = 0; i < 6; i++) {
      // 매 사이클: next_attempt_at=NULL 으로만 되감아 즉시 재시도 (status 자체는
      // 'failed' 그대로 — dispatcher가 IN ('pending','failed')로 폴링하므로 충분).
      await sql`UPDATE sim.approval_outbox_events
                 SET next_attempt_at=NULL
                 WHERE id='evt-fail' AND status IN ('pending','failed')`;
      await disp.tick();
    }
    const final = await sql<{ status: string; retry_count: number }[]>
      `SELECT status, retry_count FROM sim.approval_outbox_events WHERE id='evt-fail'`;
    expect(final[0].status).toBe("dlq");
    expect(final[0].retry_count).toBeGreaterThan(5);

    const dlqEvts = await sql<{ id: string }[]>
      `SELECT id FROM sim.approval_outbox_events WHERE event_name='approval.outbox.dlq-entered'`;
    expect(dlqEvts.length).toBe(1);
    expect(dlqEvts[0].id).toBe("dlq-evt-fail");
  });

  it("backoff 시퀀스 1s → 2s → 4s → 8s → 16s (±200ms 허용)", async () => {
    const disp = createOutboxDispatcher({ db, sql, consumerName: "sim-approval-api",
      consume: failing, batchSize: 10, maxRetries: 5 });
    const expected = [1_000, 2_000, 4_000, 8_000, 16_000];
    for (let i = 0; i < expected.length; i++) {
      await sql`UPDATE sim.approval_outbox_events
                 SET next_attempt_at=NULL WHERE id='evt-fail'`;
      const before = Date.now();
      await disp.tick();
      const row = await sql<{ next_attempt_at: number | null }[]>
        `SELECT next_attempt_at FROM sim.approval_outbox_events WHERE id='evt-fail'`;
      const delta = (row[0].next_attempt_at ?? 0) - before;
      expect(delta).toBeGreaterThanOrEqual(expected[i] - 200);
      expect(delta).toBeLessThanOrEqual(expected[i] + 200);
    }
  });
});
```

- [ ] **Step 5.4.2: 테스트 실패 확인 → 통과 확인**

```bash
QA_TEST_PG=1 pnpm --filter sim-approval-api test outbox-dispatcher.dlq
```
Task 5.2가 이미 DLQ 분기 + `BACKOFF_MS`를 포함하므로 PASS여야 한다.

- [ ] **Step 5.4.3: 최소 보강 (필요 시)**

dispatcher catch 분기에서 (a) `newCount > maxRetries` 시 `status='dlq'` SET, (b) `dlq-${id}` outbox INSERT, (c) `BACKOFF_MS` 배열 적용을 spec 04 §2.3과 1:1 비교.

- [ ] **Step 5.4.4: 테스트 통과**

```bash
QA_TEST_PG=1 pnpm --filter sim-approval-api test outbox-dispatcher.dlq
```
기대: 2 PASS.

- [ ] **Step 5.4.5: Commit**

```bash
git add simulations/enterprise-pm/services/approval-api/src/approval/shared/outbox/outbox-dispatcher.dlq.test.ts
git commit -m "test(sim-approval-api): outbox DLQ entry + backoff sequence"
```

### Task 5.5: 락 경합 시나리오 단위 테스트 (N=3 dispatcher disjoint)

**Files:**
- Create: `…/approval/shared/outbox/outbox-dispatcher.contention.test.ts`

dispatcher N=3개가 동시에 폴링할 때 (a) 처리한 row 집합이 서로 *disjoint*, (b) 총 row 수가 INSERT row 수와 정확히 일치 (중복 0, 누락 0). 시나리오 #15 (`outbox-multi-dispatcher-lock` 부하·복합 검증)는 Plan E `05-error-and-scenarios.md` §3에서 별도, 본 task는 *핵심 메커니즘 단위 테스트*에 한정한다 (spec 04 §2.4의 검증 모양과 1:1).

- [ ] **Step 5.5.1: 실패 테스트 작성**

`outbox-dispatcher.contention.test.ts` (`QA_TEST_PG=1`):

```typescript
describe.skipIf(!PG_AVAILABLE)("N dispatcher contention (SKIP LOCKED disjoint)", () => {
  const N = 3, ROWS = 30;
  // beforeEach: RESET DDL 두 개 + ROWS 건 outbox seed (idempotency_key 모두 buildIdempotencyKey)
  //             N개 별도 postgres connection pool 준비

  it("N=3 dispatcher 동시 polling — disjoint + 총합 = INSERT row 수", async () => {
    const claimed: string[][] = pools.map(() => []);
    const dispatchers = pools.map((sql, idx) =>
      createOutboxDispatcher({
        db: drizzle({ client: sql }), sql,
        consumerName: `sim-approval-api-${idx}`,
        consume: async (e) => { claimed[idx].push(e.id); },
        batchSize: 10, maxRetries: 5,
      }),
    );
    // 각 dispatcher 가 10회씩 tick → 총 30 회 병렬
    const ticks = await Promise.all(
      dispatchers.flatMap((d) => Array.from({ length: 10 }, () => d.tick())),
    );
    expect(ticks.reduce((a, b) => a + b, 0)).toBe(ROWS);

    const all = claimed.flat().sort();
    expect(new Set(all).size).toBe(ROWS);   // disjoint
    expect(all.length).toBe(ROWS);          // 총합 일치

    const remaining = await setup<{ status: string }[]>
      `SELECT status FROM sim.approval_outbox_events`;
    expect(remaining.every((r) => r.status === "dispatched")).toBe(true);

    const log = await setup<{ idempotency_key: string }[]>
      `SELECT idempotency_key FROM sim.outbox_consumer_log`;
    expect(log.length).toBe(ROWS);
  });
});
```

- [ ] **Step 5.5.2: 테스트 실패 확인**

```bash
QA_TEST_PG=1 pnpm --filter sim-approval-api test outbox-dispatcher.contention
```
5.2가 SKIP LOCKED + ON CONFLICT DO NOTHING 두 단계를 정확히 적용했다면 PASS. FAIL 진단:
- (a) SKIP LOCKED 누락 → 두 dispatcher가 같은 row claim 시도 → 일부 row가 'pending' 상태로 남음 (totalProcessed < ROWS)
- (b) status 가드 누락 → 같은 row 두 번 처리 (totalProcessed > ROWS)

- [ ] **Step 5.5.3: 최소 보강 (필요 시)**

dispatcher 폴링 SQL의 `FOR UPDATE SKIP LOCKED`와 consumer-log INSERT의 `ON CONFLICT (idempotency_key, consumer) DO NOTHING RETURNING` 두 패턴이 spec 04 §2.1·§2.2와 정확히 일치하는지 확인.

- [ ] **Step 5.5.4: 테스트 통과**

```bash
QA_TEST_PG=1 pnpm --filter sim-approval-api test outbox-dispatcher.contention
```
기대: 1 PASS.

- [ ] **Step 5.5.5: Commit**

```bash
git add simulations/enterprise-pm/services/approval-api/src/approval/shared/outbox/outbox-dispatcher.contention.test.ts
git commit -m "test(sim-approval-api): outbox dispatcher N=3 contention disjoint invariant"
```

### Task 5.6: idempotency_key는 grammar #12(`buildIdempotencyKey`) 사용 강제

**Files:**
- Modify: `simulations/enterprise-pm/packages/sim-domain-slice-kit/src/outbox/drizzle.ts` (런타임 가드)
- Modify: `…/approval/{budget,expense,resource,timeoff}/application/use-cases/*.use-case.ts` (publisher 호출부 정렬)
- Modify: `…/approval/shared/outbox/outbox-dispatcher.ts` (consumer 측에서 `parseIdempotencyKey` 통과)
- Create: `…/approval/shared/outbox/idempotency-key-source.test.ts`

slice publisher가 outbox row INSERT 시 `idempotency_key`는 *반드시* Plan A Task 2.13의 `buildIdempotencyKey` 결과여야 한다 — raw 보간(`${aggregateId}:${eventName}:${Date.now()}`)이 잠입하면 grammar 검증을 우회한다. 본 task는 (a) `OutboxRecord.idempotencyKey` 누락/빈 값 → `OutboxPort.append`가 즉시 throw하는 런타임 가드, (b) 4 slice publisher 호출부에 `buildIdempotencyKey` 결과 주입, (c) consumer 측 dispatcher가 `parseIdempotencyKey`로 row 형식을 한 번 더 검증해 raw 보간이 끼어든 row를 즉시 식별. 정적 ESLint custom rule "no-raw-idempotency-key-string" 일반화는 Plan A Task 2.19 lint 스크립트의 후속 확장으로 분리한다(본 task 범위 외).

- [ ] **Step 5.6.1: 실패 테스트 작성**

`idempotency-key-source.test.ts`:

```typescript
import { buildIdempotencyKey, parseIdempotencyKey } from "sim-identifier-grammar";
import { createDrizzleOutboxPort } from "@qa-sdk/sim-domain-slice-kit";
import type { OutboxRecord, TransactionScope } from "@qa-sdk/sim-domain-slice-kit";

class FakeBuilder {
  rows: Record<string, unknown>[] = [];
  insert(_t: unknown) {
    return { values: (row: Record<string, unknown>) =>
      (this.rows.push(row), Promise.resolve()) };
  }
}
const scope: TransactionScope = { id: "tx-1", startedAt: new Date() };

describe("slice outbox publisher idempotency_key 강제", () => {
  it("idempotencyKey 누락 → throw", async () => {
    const port = createDrizzleOutboxPort({ db: new FakeBuilder(), table: {} });
    const bad = { aggregateId: "proj-001", eventName: "approval.budget.submitted",
      eventVersion: 1, payload: {}, occurredAt: new Date(1714250400000) } as unknown as OutboxRecord;
    await expect(port.append(bad, scope)).rejects.toThrow(/idempotencyKey/);
  });

  it("idempotencyKey 빈 문자열 → throw", async () => {
    const port = createDrizzleOutboxPort({ db: new FakeBuilder(), table: {} });
    await expect(port.append({
      aggregateId: "proj-001", eventName: "approval.budget.submitted",
      eventVersion: 1, payload: {}, occurredAt: new Date(1714250400000),
      idempotencyKey: "",
    }, scope)).rejects.toThrow(/idempotencyKey/);
  });

  it("buildIdempotencyKey 결과만 통과 + row.idempotency_key 컬럼에 그대로 전달", async () => {
    const fake = new FakeBuilder();
    const port = createDrizzleOutboxPort({ db: fake, table: {} });
    const idemp = buildIdempotencyKey({
      aggregateId: "proj-001", eventName: "approval.budget.submitted",
      occurredAt: 1714250400000,
    });
    await port.append({
      aggregateId: "proj-001", eventName: "approval.budget.submitted",
      eventVersion: 1, payload: {}, occurredAt: new Date(1714250400000),
      idempotencyKey: idemp,
    }, scope);
    expect(fake.rows[0].idempotency_key).toBe(idemp);
    expect(parseIdempotencyKey(fake.rows[0].idempotency_key as string)).toEqual({
      aggregateId: "proj-001", eventName: "approval.budget.submitted",
      occurredAt: 1714250400000,
    });
  });

  it("raw 보간 문자열은 grammar #12 형식이 아니면 parseIdempotencyKey가 throw — consumer 측 가드", () => {
    expect(() => parseIdempotencyKey("proj-001-1714250400000")).toThrow();
  });
});
```

- [ ] **Step 5.6.2: 테스트 실패 확인**

```bash
QA_TEST_PG=0 pnpm --filter sim-approval-api test idempotency-key-source
```
기대: 처음 두 케이스 FAIL (`createDrizzleOutboxPort`가 아직 idempotencyKey require 안 함).

- [ ] **Step 5.6.3: 최소 구현**

(a) `sim-domain-slice-kit/src/outbox/drizzle.ts`의 `append` 시작부에 가드 추가:

```typescript
async append(record: OutboxRecord, scope: TransactionScope): Promise<void> {
  if (!record.idempotencyKey || record.idempotencyKey.length === 0) {
    throw new Error(
      "OutboxRecord.idempotencyKey is required — use buildIdempotencyKey from @qa-sdk/sim-identifier-grammar",
    );
  }
  const row = {
    id: randomUUID(),
    aggregate_id: record.aggregateId,
    event_name: record.eventName,
    event_version: record.eventVersion,
    payload: serialize(record.payload),
    occurred_at: record.occurredAt.getTime(),
    scope_id: scope.id,
    status: "pending" as const,
    idempotency_key: record.idempotencyKey,
    retry_count: 0,
  };
  // …(builder 호출 동일)…
}
```

(b) 4 slice use-case (`budget`, `expense`, `resource`, `timeoff`)의 `outbox.append({...})` 호출부에 `buildIdempotencyKey` 결과를 명시 주입. 도메인 entity id가 underscore/mixed-case이면 (예: `br_001`, `exp_1`) `toGrammarSafeAggregateId(rawId)`로 canonicalize한 뒤 `buildIdempotencyKey`에 전달한다 (raw 보간 금지). event name은 grammar #5 (3-tier kebab) 정합:

```typescript
import { buildIdempotencyKey } from "sim-identifier-grammar";
import { toGrammarSafeAggregateId } from "../../../shared/outbox/idempotency-key-source.js";
// …
const eventName = "approval.budget.submitted"; // grammar #5: domain.aggregate.verbPast
await this.outbox.append({
  aggregateId: budget.id,                      // outbox row의 aggregate_id 컬럼은 원본 그대로
  eventName,
  eventVersion: 1,
  payload: budget.toSnapshot(),
  occurredAt: now,
  idempotencyKey: buildIdempotencyKey({
    aggregateId: toGrammarSafeAggregateId(budget.id), // grammar #12 형식 강제
    eventName,
    occurredAt: now,
  }),
}, scope);
```

(나머지 expense/resource/timeoff은 eventName만 슬라이스에 맞춰 교체 — 모두 `approval.{slice}.{verbPast}` 3-tier kebab. `budget.created`/`expense.status_changed` 등 2-tier 또는 underscore 표기는 grammar 위반.)

> **Helper 위치**: `toGrammarSafeAggregateId`는 `simulations/enterprise-pm/services/approval-api/src/approval/shared/outbox/idempotency-key-source.ts`에 둔다. underscore→hyphen, 대문자→소문자, grammar 외 문자→hyphen, 첫 글자가 [a-z]가 아니면 `x-` prefix, trailing hyphen 제거. 결과 길이 < 2면 throw (정상 entity id라면 도달 불가). 본 helper는 raw 보간이 아닌 *명시적 정규화* — fallback approximation 금지 (`feedback_no-fallback-approximation`).

(c) consumer 측 — `outbox-dispatcher.ts`의 폴링 row 처리 루프 시작부에 `parseIdempotencyKey(row.idempotency_key)` 호출을 둬 raw 보간 row를 즉시 throw 시킨다 (Task 5.2 dispatcher 코드에 이미 포함됨). dispatcher 내부 DLQ event 발행도 `buildIdempotencyKey({aggregateId, eventName, occurredAt})`만 사용 — raw `dlq:${...}` 보간 금지.

- [ ] **Step 5.6.4: 테스트 통과**

```bash
QA_TEST_PG=0 pnpm --filter sim-approval-api test idempotency-key-source
QA_TEST_PG=1 pnpm --filter sim-approval-api test outbox
```
기대: idempotency-key-source 4 PASS + Task 5.2~5.5 회귀 PASS (publisher 호출부에 idempotencyKey 추가가 기존 use-case 흐름을 망가뜨리지 않음 확인).

- [ ] **Step 5.6.5: Commit**

```bash
git add simulations/enterprise-pm/packages/sim-domain-slice-kit/src/outbox.port.ts \
        simulations/enterprise-pm/packages/sim-domain-slice-kit/src/outbox/drizzle.ts \
        simulations/enterprise-pm/services/approval-api/src/approval/budget/application/use-cases/ \
        simulations/enterprise-pm/services/approval-api/src/approval/expense/application/use-cases/ \
        simulations/enterprise-pm/services/approval-api/src/approval/resource/application/use-cases/ \
        simulations/enterprise-pm/services/approval-api/src/approval/timeoff/application/use-cases/ \
        simulations/enterprise-pm/services/approval-api/src/approval/shared/outbox/idempotency-key-source.ts \
        simulations/enterprise-pm/services/approval-api/src/approval/shared/outbox/idempotency-key-source.test.ts \
        simulations/enterprise-pm/services/approval-api/src/approval/shared/outbox/outbox-dispatcher.ts
git commit -m "feat(sim-approval-api): enforce buildIdempotencyKey at outbox publisher + dispatcher"
```
