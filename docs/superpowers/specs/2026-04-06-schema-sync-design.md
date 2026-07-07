---
status: source-backed
sources:
  - packages/store/src/db/schema.ts
  - packages/store/src/adapters/drizzle/key-observation.adapter.ts
  - packages/ingest-server/src/stores/d1-schema.sql.ts
  - packages/ingest-server/src/stores/d1-graph-store.ts
  - packages/ingest-server/src/stores/d1-scenario-spec-store.ts
  - packages/ingest-server/src/stores/clickhouse-schema.sql.ts
  - packages/ingest-server/src/stores/clickhouse-record-store.ts
  - packages/ingest-server/src/__tests__/cross-adapter/cross-adapter.d1.test.ts
---

# 스키마 동기화 설계

> 2026-04-06. D1/PG/CH 3종 드라이버 스키마를 11 테이블 공통으로 정합.

## 목적

D1/SQLite, PostgreSQL, ClickHouse 3종 드라이버의 테이블 셋을 동일하게 맞추고, 누락된 Store 어댑터를 구현하여 어떤 드라이버에서든 동일 인터페이스로 동작하게 한다.

## 현황 → 목표

| 테이블 | D1 | PG | CH | 작업 |
|--------|:--:|:--:|:--:|------|
| qa_sessions | ✓ | ✓ | ✓ | 없음 |
| traces | ✓ | ✓ | ✓ | 없음 |
| event_records | ✓ | ✓ | ✓ | 없음 |
| verdict_reports | ✓ | ✓ | ✓ | 없음 |
| transmissions | ✓ | ✓ | ✗ | CH DDL 추가 |
| dead_letter_queue | ✓ | ✓ | ✗ | CH DDL 추가 |
| insight_labels | ✓ | ✗ | ✗ | PG 스키마+Store, CH DDL |
| key_observations | ✓ | ✗ | ✓ | PG 스키마+Store |
| key_observation_prefixes | ✓ | ✗ | ✓ | PG 스키마+Store |
| runtime_graphs | ✗ | ✓ | ✗ | D1 스키마+DDL+Store, CH DDL |
| scenario_specs | ✗ | ✓ | ✗ | D1 스키마+DDL+Store, CH DDL |

## 작업 분류

### Group A: PG에 누락 테이블 추가

1. **key_observations + key_observation_prefixes** → `store/src/db/schema.ts`에 PG 테이블 추가
   - DrizzleKeyObservationStore 구현 (`store/src/adapters/drizzle/`)
   - store-factory.ts의 createPgStores에 등록

2. **insight_labels** → `store/src/db/schema.ts`에 PG 테이블 추가
   - 현재 port 없음 → InsightLabelStore port 필요 여부 확인 (D1에 DrizzleInsightsStore가 이미 사용)

### Group B: D1에 누락 테이블 추가

3. **runtime_graphs** → `ingest-server/src/db/schema.ts` + `d1-schema.sql.ts` DDL 추가
   - D1GraphStore 구현 (`ingest-server/src/stores/`)
   - store-factory.ts의 createD1Stores에서 InMemoryGraphStore → D1GraphStore 교체

4. **scenario_specs** → `ingest-server/src/db/schema.ts` + `d1-schema.sql.ts` DDL 추가
   - D1ScenarioSpecStore 구현
   - store-factory.ts의 createD1Stores에서 InMemoryScenarioSpecStore → D1ScenarioSpecStore 교체

### Group C: CH에 누락 테이블 추가 (DDL만)

5. **transmissions** → `clickhouse-schema.sql.ts` DDL
6. **dead_letter_queue** → `clickhouse-schema.sql.ts` DDL
7. **insight_labels** → `clickhouse-schema.sql.ts` DDL
8. **runtime_graphs** → `clickhouse-schema.sql.ts` DDL
9. **scenario_specs** → `clickhouse-schema.sql.ts` DDL

### Group D: 인덱스 정합

10. D1에 `idx_verdict_reports_verdict`, `idx_dlq_trace_phase` 추가
11. PG `idx_traces_reconstructed`를 composite (reconstructed, createdAt)로 변경

## 타입 매핑 규칙

| 개념 | D1/SQLite | PG | CH |
|------|-----------|----|----|
| JSON | TEXT + JSON.stringify | JSONB | String |
| 타임스탬프 | TEXT (ISO-8601) | timestamp with time zone | DateTime64(3) |
| 불리언 | INTEGER (0/1) | boolean | UInt8 |
| 정수 | INTEGER | integer | UInt32/Int32 |

어댑터가 이 차이를 흡수. 인터페이스는 JS 타입(string, number, boolean, Date, object)으로 통일.

## 테스트

- PG 새 Store: PG integration test에 추가 (DATABASE_URL 필요)
- D1 새 Store: d1-stores.test.ts에 추가 (NodeSqliteDriver :memory:)
- CH: DDL만이므로 테스트 없음
