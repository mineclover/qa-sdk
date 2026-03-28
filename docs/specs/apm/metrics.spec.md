---
def:
  id: metrics-spec
  address: def_document:v2:343178
  scope: data
  aspect: system_data
  depth: specification
  lifecycle: approved
  layer: domain
  tags: [observability, performance]
  links:
    - target: address-context-spec
      type: depends_on
    - target: record-spec
      type: depends_on
---
# Metric RecordKind — 메트릭 수집 및 집계

## 목적 ^purpose

EventRecord의 RecordKind를 "metric"으로 확장하고, 메트릭 전용 필드와 Phase 2 집계 모델을 정의한다.

## 구성 ^overview

- **RecordKind 확장**: 기존 `"log" | "span"`에 `"metric"`을 추가하여 메트릭 수집 경로 활성화
- **4가지 MetricType**: counter(단조 증가 합산), gauge(현재값 last-value), histogram(버킷별 분포), summary(클라이언트 분위수, 서버 집계 불가)
- **네이밍 규칙**: `{domain}.{resource}.{measurement}` dot-notation (예: `k8s.pod.cpu_usage`, `http.request.duration_ms`)
- **필수 필드**: record_kind가 "metric"일 때 metric_type, metric_name, metric_value 3개 필수 + metric_labels/unit/buckets/quantiles 선택
- **3단계 집계 윈도우**: 1분(raw, 7일 보존) → 1시간(90일) → 1일(1년) 롤업, MetricType별 전략 차별화
- **하위 호환성**: metric 전용 필드 전부 optional이며, 기존 log/span 처리 코드에 영향 없음. verdict 경로는 log/span 전용 유지
- **Zod 검증**: refine()으로 record_kind === "metric" 시 필수 필드 존재를 런타임 검증

## RecordKind 확장

> 타입 정의: `packages/core/src/types/record.ts` — `RecordKind`
>
> `"log" | "span" | "metric"` — metric 타입이 추가된 상태.

---

## Metric 전용 필드

### EventRecord 확장

> 타입 정의: `packages/core/src/types/record.ts` — `EventRecord` (metric 전용 필드 포함), `MetricType`

### 필드 명세

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `metric_type` | `MetricType` | metric일 때 필수 | 메트릭 종류. OpenTelemetry 호환 |
| `metric_name` | `string` | metric일 때 필수 | 메트릭 이름. dot-notation (예: `k8s.pod.cpu_usage`) |
| `metric_value` | `number` | metric일 때 필수 | 현재 측정값 |
| `metric_unit` | `string` | 선택 | 단위 (예: `percent`, `ms`, `bytes`, `count`) |
| `metric_labels` | `Record<string, string>` | 선택 | 추가 차원 라벨. 축이 아닌 자유 형태 |
| `metric_buckets` | `number[]` | histogram일 때 | 히스토그램 버킷 경계 |
| `metric_quantiles` | `number[]` | summary일 때 | 분위수 목록 (예: `[0.5, 0.9, 0.99]`) |

### 메트릭 네이밍 규칙

```
{domain}.{resource}.{measurement}
```

| 패턴 | 예시 | 설명 |
|---|---|---|
| `k8s.pod.*` | `k8s.pod.cpu_usage`, `k8s.pod.memory_bytes` | K8s Pod 메트릭 |
| `k8s.node.*` | `k8s.node.disk_io_bytes` | K8s Node 메트릭 |
| `http.request.*` | `http.request.duration_ms`, `http.request.count` | HTTP 요청 메트릭 |
| `git.pipeline.*` | `git.pipeline.duration_ms`, `git.pipeline.success_rate` | CI/CD 파이프라인 |
| `app.*` | `app.queue.depth`, `app.cache.hit_rate` | 애플리케이션 커스텀 |

---

## MetricType 시맨틱

### Counter

단조 증가하는 누적값. 항상 양수 delta.

```typescript
apm.metric("http.request.count", 1, { type: "counter" });
```

- 집계: 시간 윈도우 내 **합산**
- 쿼리: rate (변화율) 또는 cumulative (누적)

### Gauge

특정 시점의 현재 값. 증가/감소 가능.

```typescript
apm.metric("k8s.pod.cpu_usage", 0.85, { type: "gauge", unit: "percent" });
```

- 집계: 시간 윈도우의 **마지막 값** (last-value)
- 쿼리: 현재값, min/max/avg

### Histogram

값의 분포를 버킷으로 관찰.

```typescript
apm.metric("http.request.duration_ms", 142, {
  type: "histogram",
  unit: "ms",
  buckets: [10, 50, 100, 250, 500, 1000],
});
```

- 집계: 버킷별 카운트 **합산**, 총합/총개수 합산
- 쿼리: 분위수 추정 (p50, p95, p99)

### Summary

클라이언트 측 분위수 계산. 서버 집계 불가.

```typescript
apm.metric("db.query.duration_ms", 23, {
  type: "summary",
  unit: "ms",
  quantiles: [0.5, 0.9, 0.99],
});
```

- 집계: **불가** (사전 계산된 분위수는 수학적으로 합산 불가)
- 용도: 단일 인스턴스의 분위수 관찰에만 적합

---

## Phase 2 집계 모델

### 집계 윈도우

| 윈도우 | 보존 기간 | 용도 |
|---|---|---|
| 1분 (raw) | 7일 | 실시간 대시보드, 알림 |
| 1시간 | 90일 | 트렌드 분석, 보고서 |
| 1일 | 1년 | 장기 용량 계획 |

### 집계 전략 (MetricType별)

| MetricType | 분 → 시 | 시 → 일 | 저장 필드 |
|---|---|---|---|
| counter | sum(values) | sum(hourly_sums) | `sum`, `count` |
| gauge | last(values) | last(hourly_lasts) | `last`, `min`, `max`, `avg` |
| histogram | merge(buckets) | merge(hourly_buckets) | `bucket_counts[]`, `sum`, `count` |
| summary | — (원본 보존) | — | `quantile_values[]` |

### 집계 테이블

```sql
CREATE TABLE metric_rollups (
  id BIGSERIAL PRIMARY KEY,
  metric_name TEXT NOT NULL,
  address_context JSONB,
  window_type TEXT NOT NULL,       -- '1m' | '1h' | '1d'
  window_start TIMESTAMPTZ NOT NULL,
  window_end TIMESTAMPTZ NOT NULL,
  metric_type TEXT NOT NULL,       -- 'counter' | 'gauge' | 'histogram' | 'summary'
  agg_sum DOUBLE PRECISION,
  agg_count BIGINT,
  agg_min DOUBLE PRECISION,
  agg_max DOUBLE PRECISION,
  agg_avg DOUBLE PRECISION,
  agg_last DOUBLE PRECISION,
  agg_buckets JSONB,              -- histogram bucket counts
  agg_quantiles JSONB,            -- summary quantile values
  labels JSONB,                   -- metric_labels 복사
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_metric_rollups_name_window
  ON metric_rollups (metric_name, window_type, window_start);

CREATE INDEX idx_metric_rollups_address
  ON metric_rollups USING GIN (address_context);
```

### Unit 2 Aggregator 재사용

Unit 2의 Aggregator 포트 인터페이스를 확장:

```typescript
// 개념 예시 — Unit 2 Aggregator 포트 인터페이스 확장
interface Aggregator {
  projectAxis(index: number, axis: number): number;
  aggregate(window: TimeWindow, records: EventRecord[]): AggregateResult;
}

// APM metric aggregation은 같은 인터페이스로:
// - projectAxis → address_context의 축별 추출 (calcAddressRanges 활용)
// - aggregate → MetricType별 rollup 전략 적용
```

---

## Zod 스키마

> Zod 스키마: `packages/core/src/schema/record.schema.ts` — `metricTypeSchema`, `eventRecordSchema`
>
> `record_kind === "metric"` 시 `metric_type`, `metric_name`, `metric_value` 필수 검증 (`.refine()`).

## 하위 호환성

- `RecordKind`에 `"metric"` 추가는 union 확장 — 기존 `"log"` | `"span"` 처리 코드 영향 없음
- metric 전용 필드는 모두 optional — 기존 레코드에 영향 없음
- Phase 2 worker는 `record_kind === "metric"` 분기로 집계 로직 활성화
- 기존 reconstruction → verdict 경로는 log/span에서만 동작 (metric은 집계 전용 경로)
