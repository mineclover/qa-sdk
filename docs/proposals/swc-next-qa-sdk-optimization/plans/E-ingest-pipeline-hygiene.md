# Track E — Ingest 파이프라인 정리 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** G2(hot path)·G3(incremental convergence)가 비교 대상으로 삼을 ingest 경로를 하나로 정리한다: 쓰이지 않는 코드를 지우고, 선언만 되고 배선되지 않은 단계를 연결하고, inline·queue 경로가 같은 단계를 실행하게 하며, 관측 지표의 빈칸을 채운다.

**Architecture:** 동작 변경은 결정 게이트(D-3·D-4·D-5) 확정분만 수행한다. 각 변경은 "현재 동작을 고정하는 테스트 → 변경 → 같은 테스트 + 새 기대값" 순서다. inline/queue 경로는 공용 함수 `runPostVerdictStages`로 수렴시켜 G3의 differential test 전제를 만든다. 성능 최적화(배치 INSERT 등)는 이 트랙에서 하지 않는다(G2, C baseline 이후).

**Tech Stack:** TypeScript, Hono, vitest(fake timers), drizzle, NodeSqliteDriver

**Spec:** [README](../README.md) R-8, D-3·D-4·D-5 / [00-code-inventory.md](../00-code-inventory.md) §2, X-9~X-12

## Global Constraints

- 서비스 로깅 `createLogger`, `console.*` 금지, `logger.error({ err }, "…")`, 오류 삼킴 금지
- 에러 격리: convergence 실패가 Phase 2 verdict를 차단하지 않는다 (CLAUDE.md 설계 원칙)
- `createRuntimeStores`는 async — 호출부 `await`
- 환경변수는 `config/env.ts` zod 스키마로만 읽는다. B가 같은 파일에 키 2개를 추가하므로 PR 순서를 맞춘다
- D1/CF Worker 경로(`src/worker.ts`)가 쓰는 D1 store는 삭제하지 않는다
- 이 트랙은 SQLite INSERT 배치화·트랜잭션 도입을 하지 않는다 (G2 소관, C baseline 필요)
- `git restore`/`reset`/`clean` 금지 — 다른 에이전트가 같은 작업 트리를 쓴다

## Review Focus

1. **`TASK_QUEUE_ENABLED=true`로 같은 envelope 처리** → inline과 같은 transition·convergence 호출이 일어난다. 테스트: Task 3 Step 1.
2. **convergence 실패** → verdict 저장은 성공하고 오류는 로그·counter에 남는다. 테스트: Task 3 Step 1.
3. **flush 주기** → 한 interval에 flush 1회 (timer 2개 → 1개). 테스트: Task 4 Step 1.
4. **`STORE_DRIVER=clickhouse`** → 조용한 SQLite 대체 대신 경고 로그 1회 + 명시적 동작. 테스트: Task 2 Step 1.
5. **metric 레코드 ingest** → `metric_*` 필드가 저장 후 조회에서 보존된다(현재 유실). 테스트: Task 6 Step 1.

---

## File Structure

| 경로 | 책임 |
|---|---|
| `packages/ingest-server/src/lib/metrics-collector.ts` (+test) | labeled counter·gauge |
| `packages/ingest-server/src/routes/metrics.ts` | Prometheus 출력 확장 |
| `packages/ingest-server/src/stores/store-factory.ts` | 삭제 (D-3) |
| `packages/ingest-server/src/server.ts` | transition 배선, store driver 경고, timer 정리 |
| `packages/ingest-server/src/lib/post-verdict-stages.ts` (신규, +test) | inline·queue 공용 Phase 2.5/3 |
| `packages/ingest-server/src/lib/phase-two-worker.ts` | 공용 함수 사용 |
| `packages/ingest-server/src/lib/convergence-pipeline.ts`, `convergence-scheduler.ts` | timer 단일화 (D-4) |
| `packages/ingest-server/src/config/env.ts` | 미사용 키 정리 |
| `packages/ingest-server/src/db/schema.ts`, `stores/d1-schema.sql.ts`, `drizzle/**` | DDL 정합, `metric_*` 컬럼 |

**Interfaces — Produces:**

```ts
// metrics-collector.ts (B가 소비)
export interface MetricsCollector {
  increment(name: string, labels?: Readonly<Record<string, string>>, by?: number): void;
  setGauge(name: string, value: number, labels?: Readonly<Record<string, string>>): void;
  snapshot(): readonly { name: string; type: 'counter' | 'gauge'; labels: Readonly<Record<string, string>>; value: number }[];
}
// post-verdict-stages.ts (G3가 소비)
export interface PostVerdictStageDeps { /* transitionFns?, transitionCatalog?, convergencePipeline?, recordStore, logger, metrics */ }
export function runPostVerdictStages(deps: PostVerdictStageDeps, traceIds: readonly string[]): Promise<{ transitions: number; convergenceNotified: number }>;
```

`PostVerdictStageDeps`의 정확한 필드는 Task 3 Step 2에서 `IngestDeps`(`routes/ingest.ts:47-74`)와 `processPendingPhaseTwo`가 실제로 쓰는 필드를 옮겨 확정한다.

---

### Task 0: Baseline·전제 재확인

- [ ] **Step 1:** `cd /Users/junwoobang/workflow/qa-sdk && corepack pnpm --filter @qa-sdk/ingest-server build && corepack pnpm --filter @qa-sdk/ingest-server test 2>&1 | grep -E "Tests|FAIL" | tail -3` → PASS
- [ ] **Step 2: dead code 재확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk && grep -rn "store-factory\|resolveStoreDriver\|_transitionFns\|_transitionCatalog\|in-memory-task-queue" packages/ingest-server/src packages/*/src --include='*.ts' | grep -v node_modules
grep -n "QA_PG_SCHEMA\|TRANSITION_VIOLATION_MODE\|TRANSITION_STATE_PATH" -r packages/ingest-server/src
```

기록: 각 심볼의 참조 위치. 00-code-inventory §2·§5와 다르면 문서를 먼저 고친다.

---

### Task 1: Labeled metrics (B 선행 의존)

**Files:** `lib/metrics-collector.ts` (+test), `routes/metrics.ts`

- [ ] **Step 1: 실패하는 테스트**

```ts
import { describe, expect, it } from 'vitest';
import { createMetricsCollector } from './metrics-collector.js';

describe('MetricsCollector', () => {
  it('label 조합별로 counter를 분리한다', () => {
    const m = createMetricsCollector();
    m.increment('snapshot_gate_total', { result: 'ok' });
    m.increment('snapshot_gate_total', { result: 'ok' });
    m.increment('snapshot_gate_total', { result: 'missing' });
    expect(m.snapshot()).toEqual(
      expect.arrayContaining([
        { name: 'snapshot_gate_total', type: 'counter', labels: { result: 'ok' }, value: 2 },
        { name: 'snapshot_gate_total', type: 'counter', labels: { result: 'missing' }, value: 1 },
      ]),
    );
  });

  it('label key 순서가 달라도 같은 series다', () => {
    const m = createMetricsCollector();
    m.increment('x', { a: '1', b: '2' });
    m.increment('x', { b: '2', a: '1' });
    expect(m.snapshot().filter((s) => s.name === 'x')).toHaveLength(1);
  });

  it('gauge는 마지막 값을 유지한다', () => {
    const m = createMetricsCollector();
    m.setGauge('convergence_buffer_depth', 5);
    m.setGauge('convergence_buffer_depth', 2);
    expect(m.snapshot()).toContainEqual({ name: 'convergence_buffer_depth', type: 'gauge', labels: {}, value: 2 });
  });
});
```

기존 collector의 공개 함수 이름이 다르면 기존 API는 유지하고 위 메서드를 추가한다(기존 호출부 `routes/ingest.ts:143-147` 무변경).

- [ ] **Step 2: 구현** — series key는 `name + canonical label 문자열`(key 정렬). label cardinality 보호: label 값 길이 64자 초과 시 잘라내고, series 수가 1,000을 넘으면 새 series를 `name{overflow="true"}`로 합친다(원본 계획 인프라 매트릭스 "cardinality 증가" 대응).
- [ ] **Step 3:** `routes/metrics.ts` Prometheus 출력에 counter·gauge series를 `# TYPE` 헤더와 함께 추가. 기존 출력 줄은 유지.
- [ ] **Step 4:** 추가 계측 — convergence buffer depth gauge(`convergence-pipeline.ts` `notifyCompletion`·flush 후), Phase 2 처리 실패 counter(`phase_two_failures_total{stage}`), decode-client skip counter(`decode_skipped_total`) — 각각 기존 `logger.error`/skip 지점에서 함께 증가.
- [ ] **Step 5: Commit** — `feat(ingest): labeled counter·gauge와 파이프라인 계측 추가`

---

### Task 2: 미사용 store factory 제거 (D-3)

**Files:** `stores/store-factory.ts` (삭제), `server.ts`, `config/env.ts`

- [ ] **Step 1: 고정 테스트** — `createRuntimeStores`에 대한 기존 테스트가 있으면 그대로 두고, 없으면 `STORE_DRIVER` 값(`memory`, `sqlite`, `clickhouse`)별 반환 store 종류를 검증하는 테스트를 추가한다. `clickhouse`에 대해 "경고 로그 1회 + SQLite store"를 기대값으로 쓴다(현재는 경고 없음 → FAIL).
- [ ] **Step 2: 구현** — `store-factory.ts` 삭제. `resolveStoreDriver`(env.ts:161)가 이 파일에서만 쓰이면 함께 삭제. `createRuntimeStores`에서 `clickhouse`/`d1` driver는 `logger.warn({ driver }, 'server 모드는 이 STORE_DRIVER를 지원하지 않아 SQLite를 사용합니다')`. 삭제로 참조를 잃는 `ClickhouseRecordStore` 등은 파일을 지우지 말고, Task 0 Step 2 결과 다른 참조가 0이면 00-code-inventory X-9에 "후속 판정" 항목으로 기록만 한다.
- [ ] **Step 3:** build·test PASS → Commit `refactor(ingest): 미사용 store-factory 제거, 미지원 driver 경고`

---

### Task 3: Post-verdict 단계 공용화와 transition 배선 (D-5)

**Files:** `lib/post-verdict-stages.ts` (신규, +test), `lib/phase-two-worker.ts`, `server.ts:232-246`, `routes/ingest.ts`의 `IngestDeps` 타입 참조만(필드 추가는 이 트랙 범위 — B와 겹치지 않게 `IngestDeps` 정의 파일이 `routes/ingest.ts`이면 B와 PR 순서 조율)

- [ ] **Step 1: 실패하는 테스트**

```ts
import { describe, expect, it, vi } from 'vitest';
import { runPostVerdictStages } from './post-verdict-stages.js';

function deps(overrides = {}) {
  return {
    transitionFns: { evaluate: vi.fn(async () => []) },
    transitionCatalog: {},
    convergencePipeline: { notifyCompletion: vi.fn() },
    recordStore: { findByTraceId: vi.fn(async () => []) },
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    metrics: { increment: vi.fn(), setGauge: vi.fn(), snapshot: () => [] },
    ...overrides,
  };
}

describe('runPostVerdictStages', () => {
  it('transition을 평가하고 convergence에 trace를 알린다', async () => {
    const d = deps();
    await runPostVerdictStages(d as never, ['t1', 't2']);
    expect(d.convergencePipeline.notifyCompletion).toHaveBeenCalledWith(['t1', 't2']);
  });

  it('convergence 실패는 던지지 않고 기록한다 (verdict 비차단)', async () => {
    const d = deps({ convergencePipeline: { notifyCompletion: vi.fn(() => { throw new Error('boom'); }) } });
    await expect(runPostVerdictStages(d as never, ['t1'])).resolves.toBeDefined();
    expect(d.logger.error).toHaveBeenCalledWith(expect.objectContaining({ err: expect.any(Error) }), expect.any(String));
    expect(d.metrics.increment).toHaveBeenCalledWith('phase_two_failures_total', { stage: 'convergence' });
  });

  it('transition이 비활성이면 convergence만 실행한다', async () => {
    const d = deps({ transitionFns: undefined });
    await runPostVerdictStages(d as never, ['t1']);
    expect(d.convergencePipeline.notifyCompletion).toHaveBeenCalled();
  });
});
```

`transitionFns`의 실제 메서드 이름은 `phase-two-worker.ts:170-227`의 현재 호출을 따른다(위 `evaluate`는 자리 표시가 아니라, 실제 이름으로 바꿔 쓴다 — `grep -n "transitionFns\." packages/ingest-server/src/lib/phase-two-worker.ts`).

- [ ] **Step 2: 구현** — `processPendingPhaseTwo`의 Phase 2.5(:170-227)와 convergence 알림(:231-237)을 `runPostVerdictStages`로 옮긴다. `processPhaseTwoTask`(queue 경로, :77)의 verdict 완료 지점에서도 같은 함수를 호출한다. `server.ts:232-246`의 `_transitionFns`/`_transitionCatalog`를 `createApp` deps로 전달한다(이름에서 `_` 제거). transition 결과는 지금처럼 로그만 남기고 저장은 G3 범위로 남긴다(주석에 G3 링크).
- [ ] **Step 3: 동등성 테스트** — 같은 envelope fixture를 inline 경로와 in-memory task queue 경로(`lib/in-memory-task-queue.ts`)로 각각 처리했을 때 `notifyCompletion` 인자와 transition 평가 횟수가 같은지 검증하는 통합 테스트를 추가한다.
- [ ] **Step 4:** test PASS → Commit `refactor(ingest): inline·queue 경로의 post-verdict 단계 공용화와 transition 배선`

---

### Task 4: Convergence timer 단일화 (D-4)

**Files:** `lib/convergence-pipeline.ts:219`, `lib/convergence-scheduler.ts`, `server.ts:219-224`

- [ ] **Step 1: 실패하는 테스트** — fake timer로 runner + scheduler를 server와 같은 방식으로 구성하고, `CONVERGENCE_*` interval 1주기 진행 시 `flush` 호출이 정확히 1회인지 검증(현재 2개 timer → 주기에 따라 2회).
- [ ] **Step 2: 구현** — runner 생성자의 `setInterval`을 제거하고 threshold·buffer cap 기반 즉시 flush만 남긴다. 주기 flush는 `convergence-scheduler`만 담당. runner `dispose()`가 timer를 정리하던 코드가 있으면 함께 정리.
- [ ] **Step 3:** test PASS → Commit `refactor(ingest): convergence 주기 flush를 scheduler로 단일화`

---

### Task 5: 미사용 env key 정리 (X-12)

- [ ] **Step 1:** Task 3 이후 `TRANSITION_VIOLATION_MODE`, `TRANSITION_STATE_PATH`가 transition 초기화에 쓰일 자리가 생기면 배선하고 테스트를 추가한다. 쓰이지 않으면 스키마에서 제거한다. `QA_PG_SCHEMA`는 `stores/pg/*`의 schema 이름 하드코딩과 대조해 배선 또는 제거.
- [ ] **Step 2:** `docs/specs/infra-engine/infra-service-operations.md`와 `docs/CONVENTIONS.md` env var 테이블에서 해당 키를 찾아 갱신.
- [ ] **Step 3: Commit** — `chore(ingest): 미사용 환경변수 정리`

---

### Task 6: DDL 정합과 `metric_*` 유실 수정

**Files:** `db/schema.ts`, `stores/d1-schema.sql.ts`, `drizzle/**` (신규 migration)

- [ ] **Step 1: 실패하는 테스트 2개**
  - DDL 정합: drizzle schema의 테이블·컬럼 목록과, `NodeSqliteDriver(':memory:')`에 런타임 migration을 적용한 뒤 `PRAGMA table_info`로 읽은 목록이 같은지 검사(현재 런타임 migration은 7개 테이블 — 00-code-inventory §2).
  - metric 보존: `record_kind: 'metric'`, `metric_name`, `metric_value` 등 `RecordInsert`의 metric 필드를 가진 레코드를 `insertBatch` 후 조회하면 필드가 보존된다.
- [ ] **Step 2: 구현** — additive migration만 쓴다(컬럼·테이블 추가, 삭제·rename 없음). drizzle-kit으로 migration 생성 후 `d1-schema.sql.ts`를 같은 DDL로 갱신. PG 스키마(`stores/pg/schema.ts`)에도 같은 컬럼 추가 여부를 확인하고, PG migration은 별도 커밋.
- [ ] **Step 3:** test PASS → Commit `fix(ingest): metric 필드 저장 컬럼 추가와 런타임 DDL 정합`
- [ ] **Step 4:** 00-code-inventory §2·§5 갱신 → Commit `docs: ingest 정리 결과 반영`
