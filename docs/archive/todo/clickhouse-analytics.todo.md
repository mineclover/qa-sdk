---
def:
  id: clickhouse-analytics-todo
  level: leaf
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: draft
  layer: operation
  tags: [clickhouse, analytics, olap]
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

| # | 작업 | 우선순위 | 난이도 | 설명 |
|---|------|---------|--------|------|
| 1 | AnalyticsStore 포트 설계 | 중 | 중 | bulkInsert + 집계 쿼리 인터페이스 (RecordStore와 분리) |
| 2 | CH RecordAnalytics 구현 | 중 | 중 | 시계열 집계, 이벤트 빈도, 기간별 통계 |
| 3 | CH KeyObservationAnalytics | 낮 | 중 | packed_key 관측 대량 분석 |
| 4 | CH TraceAnalytics | 낮 | 중 | trace 패턴 분석, 서비스별 통계 |

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
