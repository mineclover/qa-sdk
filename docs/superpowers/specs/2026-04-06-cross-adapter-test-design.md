# 교차 어댑터 테스트 설계

> 2026-04-06. 동일 Store 포트 인터페이스를 D1/PG 양쪽에서 실행하는 테스트 인프라.

## 목적

Store 포트별 공통 테스트 함수를 정의하고, D1(SQLite)과 PG(Drizzle) 팩토리를 주입해서 양쪽 어댑터가 동일 동작을 보장하는지 검증한다.

## 구조

```
packages/store/src/__tests__/
  shared/                              ← 포트별 공통 테스트 함수
    record-store.shared.ts
    trace-store.shared.ts
    session-store.shared.ts
    verdict-store.shared.ts
    graph-store.shared.ts
    scenario-spec-store.shared.ts
    transmission-store.shared.ts
    dlq-store.shared.ts
    key-observation-store.shared.ts
  factories/                           ← 드라이버별 팩토리
    d1.factory.ts                      ← NodeSqliteDriver :memory: + D1 stores
    pg.factory.ts                      ← DATABASE_URL + Drizzle PG stores
  cross-adapter.d1.test.ts             ← D1 팩토리로 공통 테스트 실행
  cross-adapter.pg.test.ts             ← PG 팩토리로 공통 테스트 실행 (DATABASE_URL 필요)
```

## 공통 테스트 함수 패턴

```typescript
// shared/record-store.shared.ts
import type { RecordStore } from "@qa-sdk/core";

export function recordStoreTests(
  createStore: () => Promise<{ store: RecordStore; cleanup: () => Promise<void> }>,
) {
  let store: RecordStore;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    ({ store, cleanup } = await createStore());
  });
  afterEach(async () => cleanup());

  it("insertBatch + findByTraceId", async () => { ... });
  it("중복 삽입 무시", async () => { ... });
  it("findBySessionId", async () => { ... });
  // ...
}
```

## 팩토리 패턴

```typescript
// factories/d1.factory.ts
export function createD1RecordStore() {
  const db = createD1Db(); // NodeSqliteDriver :memory:
  return {
    store: new D1RecordStore(db),
    cleanup: async () => { /* DROP or re-create */ },
  };
}
```

```typescript
// factories/pg.factory.ts
export function createPgRecordStore() {
  const db = createDb(process.env.DATABASE_URL!);
  return {
    store: new DrizzleRecordStore(db),
    cleanup: async () => { /* TRUNCATE */ },
  };
}
```

## 테스트 실행

```bash
# D1 (항상 가능 — in-memory SQLite)
pnpm --filter @qa-sdk/store test -- --run cross-adapter.d1

# PG (DATABASE_URL 필요)
DATABASE_URL=postgres://... pnpm --filter @qa-sdk/store test -- --run cross-adapter.pg
```

## 대상 포트 (9개)

| 포트 | 핵심 검증 항목 |
|------|-------------|
| RecordStore | insertBatch, findByTraceId, pagination, eventKey 필터 |
| TraceStore | upsert count 누적, timestamp 확장, findUnreconstructed |
| SessionStore | upsert 멱등, findById, close |
| VerdictStore | insert, unique constraint, findByScenario |
| GraphStore | upsert, findByTraceId |
| ScenarioSpecStore | upsert, findByDomain, remove |
| TransmissionStore | insert |
| DlqStore | insert, findPending, markAttempted, markResolved |
| KeyObservationStore | observe, count 누적, summary, findStale, findUnregistered |

## 커버리지 매트릭스

테스트 결과에서 자동 출력:

```
Store 포트             | D1  | PG  |
-----------------------|-----|-----|
RecordStore           | 5/5 | 5/5 |
TraceStore            | 4/4 | 4/4 |
...
```
