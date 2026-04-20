---
def:
  id: store-adapter-parity
  level: module
  tier: system
  scope: data
  aspect: system_data
  depth: specification
  lifecycle: approved
  layer: operation
  svc: ingest-server
  tags: [persistence, adapter, parity, testing]
  links:
    - target: ingest-infra-system
      type: refines
    - target: ingest-runtime-operations
      type: contains
    - target: key-observation-store
      type: contains
---

# Store Adapter Parity

## 목적 ^purpose

D1(SQLite)과 PostgreSQL 두 드라이버에서 동일한 Store 포트 인터페이스를 구현하고, 교차 어댑터 테스트로 동작 일관성을 보장한다.

## 구성 ^overview

- **9 Store 포트** — @qa-sdk/core에 정의된 인터페이스. 드라이버 무관.
- **D1 어댑터 9종** — ingest-server/stores/d1-*.ts. SQLite + Drizzle ORM.
- **PG 어댑터 9종** — store/adapters/drizzle/*.adapter.ts. PostgreSQL + Drizzle ORM.
- **교차 테스트 31 케이스** — 동일 테스트를 D1/PG 양쪽에서 실행.
- **ClickHouse** — DDL만 (11 테이블). OLAP 전용 AnalyticsStore는 별도 설계.

## Store 포트 × 드라이버 매트릭스 ^defines

| Store 포트 | 포트 파일 | D1 어댑터 | PG 어댑터 | 교차 테스트 |
|-----------|----------|----------|----------|:---:|
| RecordStore | `core/ports/record-store.port.ts` | `d1-record-store.ts` | `record.adapter.ts` | 5 |
| TraceStore | `core/ports/trace-store.port.ts` | `d1-trace-store.ts` | `trace.adapter.ts` | 4 |
| SessionStore | `core/ports/session-store.port.ts` | `d1-session-store.ts` | `session.adapter.ts` | 4 |
| VerdictStore | `core/ports/verdict-store.port.ts` | `d1-verdict-store.ts` | `verdict.adapter.ts` | 3 |
| GraphStore | `core/ports/graph-store.port.ts` | `d1-graph-store.ts` | `graph.adapter.ts` | 3 |
| ScenarioSpecStore | `core/ports/scenario-spec-store.port.ts` | `d1-scenario-spec-store.ts` | `scenario-spec.adapter.ts` | 4 |
| TransmissionStore | `core/ports/transmission-store.port.ts` | `d1-transmission-store.ts` | `transmission.adapter.ts` | 1 |
| DlqStore | `core/ports/dlq-store.port.ts` | `d1-dlq-store.ts` | `dlq.adapter.ts` | 3 |
| KeyObservationStore | `core/ports/key-observation-store.port.ts` | `d1-key-observation-store.ts` | `key-observation.adapter.ts` | 4 |
| **합계** | 9 포트 | 9 어댑터 | 9 어댑터 | **31** |

## 포트별 인터페이스 요약 ^method

### RecordStore

```typescript
insertBatch(records: RecordInsert[]): Promise<void>
findByTraceId(traceId: string): Promise<StoredRecord[]>
findByTraceIdPaginated(traceId, params?): Promise<StoredRecordPage>
findBySessionId(sessionId: string): Promise<StoredRecord[]>
findBySessionIdPaginated(sessionId, params?): Promise<StoredRecordPage>
findByTraceAndEventKey(traceId, eventKey): Promise<StoredRecord[]>
findByTimeRange(params: TimeRangeParams): Promise<StoredRecord[]>
```

### TraceStore

```typescript
upsert(params: TraceUpsert): Promise<void>    // recordCount 누적, timestamp 확장
findById(traceId: string): Promise<StoredTrace | null>
findUnreconstructed(limit?: number): Promise<StoredTrace[]>
findRecent(limit?: number): Promise<StoredTrace[]>
markReconstructed(traceId: string): Promise<void>
```

### SessionStore

```typescript
upsert(params: SessionUpsert): Promise<void>  // 멱등
findById(sessionId: string): Promise<StoredSession | null>
close(sessionId: string): Promise<void>
```

### VerdictStore

```typescript
insert(params: VerdictInsert): Promise<void>
findByTraceId(traceId: string): Promise<StoredVerdict[]>
findByScenarioAndTrace(scenarioId, traceId): Promise<StoredVerdict | null>
```

### GraphStore

```typescript
upsert(traceId: string, graph: RuntimeGraph): Promise<void>
findByTraceId(traceId: string): Promise<RuntimeGraph | null>
```

### ScenarioSpecStore

```typescript
upsert(spec: ScenarioSpec): Promise<void>
findById(scenarioId: string): Promise<ScenarioSpec | null>
findAll(limit?: number): Promise<ScenarioSpec[]>
findByDomain(domain: string, limit?: number): Promise<ScenarioSpec[]>
remove(scenarioId: string): Promise<boolean>
```

### TransmissionStore

```typescript
insert(params: TransmissionInsert): Promise<void>
```

### DlqStore

```typescript
insert(params: DlqInsert): Promise<void>
findPending(limit?: number): Promise<StoredDlqItem[]>
markAttempted(id: string): Promise<void>
markResolved(id: string): Promise<void>
```

### KeyObservationStore

```typescript
observe(entry: KeyObservationEntry): Promise<void>
observeBatch(entries: readonly KeyObservationEntry[]): Promise<void>
findByPrefix(prefixId, opts?): Promise<KeyObservation[]>
summary(): Promise<KeyObservationSummary>
findStale(before: string, limit?: number): Promise<KeyObservation[]>
findUnregistered(opts?): Promise<KeyObservation[]>
prefixSummary(prefixId?: string): Promise<PrefixObservationSummary[]>
```

## 스키마 동기화 ^defines

### 11 테이블 — D1/PG/CH 공통

| 테이블 | 용도 |
|--------|------|
| qa_sessions | QA 세션 |
| traces | trace 집계 |
| event_records | 이벤트 레코드 |
| verdict_reports | 판정 결과 |
| transmissions | envelope 메타 |
| dead_letter_queue | DLQ |
| insight_labels | 인사이트 레이블 |
| key_observations | packed_key 관측 |
| key_observation_prefixes | prefix 집계 |
| runtime_graphs | 실행 그래프 |
| scenario_specs | 시나리오 정의 |

### 타입 매핑

| 개념 | D1/SQLite | PostgreSQL | ClickHouse |
|------|-----------|------------|------------|
| JSON | TEXT + stringify | JSONB | String |
| 타임스탬프 | TEXT (ISO-8601) | timestamptz | DateTime64(3) |
| 불리언 | INTEGER (0/1) | boolean | UInt8 |

어댑터가 타입 차이를 흡수. 포트 인터페이스는 JS 네이티브 타입(string, number, boolean, Date, object)으로 통일.

### 인덱스 정합

D1과 PG 모두 동일 인덱스 셋 보유:
- `idx_traces_reconstructed` — composite (reconstructed, createdAt)
- `idx_verdict_reports_verdict` — overallVerdict
- `idx_dlq_trace_phase` — (traceId, phase)

## 교차 어댑터 테스트 ^delegates

### 구조

```
ingest-server/src/__tests__/cross-adapter/
  shared/                          ← 포트별 공통 테스트 함수 (9 파일)
  factories/
    d1.factory.ts                  ← NodeSqliteDriver :memory:
    pg.factory.ts                  ← DATABASE_URL 조건부
  cross-adapter.d1.test.ts         ← D1 실행 (항상)
  cross-adapter.pg.test.ts         ← PG 실행 (DATABASE_URL 필요)
```

### 실행

```bash
# D1 (항상 가능)
pnpm --filter ingest-server test -- --run cross-adapter.d1

# PG (DATABASE_URL 필요)
DATABASE_URL=postgres://... pnpm --filter ingest-server test -- --run cross-adapter.pg
```

### 테스트 원칙

- 각 shared test는 store factory를 주입받아 **어댑터 무관**하게 동작
- PG FK 제약은 factory 레이어에서 부모 행 시딩으로 해결
- D1은 FK 미강제 (SQLite 기본 설정)
- cleanup: D1은 :memory: 재생성, PG는 TRUNCATE CASCADE

## ClickHouse 분리 ^consumes

ClickHouse는 OLAP 분석 전용. CRUD 포트와 분리된 AnalyticsStore 인터페이스로 별도 설계.
- DDL 11 테이블 완료
- Store 어댑터: RecordStore 1종만 기존 구현 (ClickhouseRecordStore)
- 향후: `docs/specs/ingest/ingest-infra-system/clickhouse-analytics.todo.md` 참조

## store-factory 드라이버 선택 ^delegates

```typescript
type StoreDriver = "memory" | "pg" | "d1" | "clickhouse";
```

`STORE_DRIVER` 환경변수로 선택. 각 드라이버별 `createXxxStores()` 팩토리가 StoreSet을 반환.

| 드라이버 | 9 포트 커버리지 | 비고 |
|---------|:---:|------|
| memory | 9/9 | InMemory 어댑터 (dev/test) |
| d1 | 9/9 | D1/SQLite (CF Workers, 경량 배포) |
| pg | 9/9 | PostgreSQL (운영) |
| clickhouse | 1/9 | RecordStore만 (OLAP 전용) |
