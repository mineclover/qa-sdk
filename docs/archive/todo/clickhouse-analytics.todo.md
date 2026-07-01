---
def:
  id: clickhouse-analytics-todo
  level: leaf
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: draft
  layer: operation
  tags: [clickhouse, analytics, olap, cross-scope]
  links:
    - target: ingest-infra-system
      type: refines
---

# ClickHouse AnalyticsStore — TODO

## 목적 ^purpose

ClickHouse를 분석 전용 드라이버로 위치시키고, CRUD 포트와 분리된 AnalyticsStore 인터페이스를 설계한다.

## 배경

- CH는 MergeTree 기반 append-only OLAP → CRUD 포트(upsert/delete)와 맞지 않음
- D1/PG = 트랜잭션 CRUD, CH = 대량 집계 분석
- DDL 11 테이블은 이미 동기화 완료

## 잔여 작업

| # | 작업 | 상태 | 설명 |
|---|------|:---:|------|
| 1 | AnalyticsStore 포트 설계 | ✅ | `ClickHouseAnalyticsStore`가 `bulkInsert` + 집계 쿼리 인터페이스를 RecordStore와 분리 |
| 2 | CH RecordAnalytics 구현 | ✅ | 시계열 집계, 이벤트 빈도, 숫자 분포 집계 |
| 3 | CH KeyObservationAnalytics | ✅ | packed_key 관측 상위 항목, prefix/registered 필터 |
| 4 | CH TraceAnalytics | ✅ | 서비스별 trace 수, record 수, first/last timestamp 집계 |

## 설계 방향

```typescript
interface AnalyticsStore {
  bulkInsert(table: string, rows: unknown[]): Promise<void>;
  queryTimeSeries(params: TimeSeriesQuery): Promise<TimeSeriesBucket[]>;
  queryTopKeys(params: TopKeysQuery): Promise<TopKeyEntry[]>;
  queryDistribution(params: DistributionQuery): Promise<DistributionBucket[]>;
}
```

- CRUD 포트와 완전 분리. 기존 RecordStore/TraceStore 인터페이스를 CH에 강제하지 않음.
- bulk insert는 ClickHouse INSERT FORMAT JSONEachRow 활용.
- 집계 쿼리는 CH의 강점 (GROUP BY, aggregate functions, PARTITION pruning).
- 분석 조회 limit은 1 이상으로 보정하고 10,000을 상한으로 둔다.

## 구현 반영

- `packages/ingest-server/src/stores/clickhouse-record-store.ts`
  - `AnalyticsStore` interface
  - `ClickHouseAnalyticsStore.bulkInsert()`
  - `queryTimeSeries()`, `queryTopKeys()`, `queryDistribution()`
  - `queryKeyObservations()`, `queryTraceStats()`
- `packages/ingest-server/src/stores/clickhouse-record-store.test.ts`
  - Docker ClickHouse 없이 SQL 생성, 결과 매핑, 식별자/limit 방어를 검증

상태: 완료. 열린 실행 항목은 없으며, 이 문서는 ClickHouse 분석 전용 포트 분리 완료 기록으로 유지한다.
