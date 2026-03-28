---
def:
  id: pipeline-metric-agg
  address: def_document:v1:537
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: operation
  svc: ingest-server
  tags: [observability]
  links:
    - target: metrics-spec
      type: depends_on
---
# 메트릭 집계 (Phase 2)

## 목적 ^purpose

Phase 2 비동기 워커에서 metric RecordKind를 집계하는 기능. 시간 윈도우 기반 롤업, prefix별 카운트/합계/평균 계산.

## 구성 ^overview

메트릭 집계는 두 단계로 구성된다.

1. **aggregateMetrics** — StoredRecord 배열을 metric_name + address_context 기준으로 그룹핑하여 1분 윈도우 롤업
2. **aggregateMetricsForPendingTraces** — Phase 2 워커에서 미재구성 trace의 metric 레코드를 자동 수집

소스: `packages/ingest-server/src/lib/metric-aggregator.ts`

## aggregateMetrics 함수

### 시그니처

```typescript
async function aggregateMetrics(
  metrics: StoredRecord[],
  rollupStore: MetricRollupStore,
): Promise<number>  // upsert된 롤업 건수
```

### 그룹핑 키

`metric_name` + `address_context`의 JSON 직렬화를 결합하여 그룹핑한다.

```
키 = "${metricName}:${JSON.stringify(addressContext ?? {})}"
```

같은 metric_name이라도 address_context가 다르면 별도 그룹으로 집계된다.

### 시간 윈도우

- **윈도우 크기**: 1분 (`windowType: "1m"`)
- **windowStart**: 첫 레코드의 timestamp를 분 단위로 truncate (`seconds=0, ms=0`)
- **windowEnd**: `windowStart + 60,000ms`

### metricType별 집계 전략

| metricType | 집계 필드 | 설명 |
|------------|-----------|------|
| `counter` | `aggSum`, `aggCount` | 값 합산 |
| `gauge` | `aggLast`, `aggMin`, `aggMax`, `aggAvg`, `aggCount` | 마지막 값 + 통계 |
| `histogram` | `aggSum`, `aggCount` | 단순 합산 (버킷 머지는 향후 구현) |
| `summary` | `aggLast`, `aggCount` | 집계 불가, 마지막 값 보존 |
| (기타) | `aggSum`, `aggCount` | counter 방식으로 폴백 |

### MetricRollupInsert 출력 구조

```typescript
interface MetricRollupInsert {
  metricName: string;
  metricType: string;
  windowType: "1m";
  windowStart: Date;
  windowEnd: Date;
  addressContext?: Record<string, string>;
  labels?: Record<string, string>;
  aggSum?: number;
  aggLast?: number;
  aggMin?: number;
  aggMax?: number;
  aggAvg?: number;
  aggCount: number;
}
```

## Phase 2 워커 통합

소스: `packages/ingest-server/src/lib/phase-two-worker.ts`

### 실행 시점

`processPendingPhaseTwo()` 내부에서 reconstruction과 **독립적으로** 실행된다.

```
Phase 2 시작
  ├── reconstructPendingTraces()    ← reconstruction
  ├── aggregateMetricsForPendingTraces()  ← metric 집계 (독립)
  ├── computePendingVerdicts()      ← verdict (reconstruction 의존)
  └── convergence 알림              ← (에러 격리)
```

### aggregateMetricsForPendingTraces 흐름

1. `traceStore.findUnreconstructed()` — 미재구성 trace 목록 조회
2. 각 trace에 대해 `recordStore.findByTraceId(traceId)` — 전체 레코드 조회
3. `recordKind === "metric"` 필터링
4. `aggregateMetrics(metrics, metricRollupStore)` — 롤업 실행
5. 성공/실패 각각 info/error 로그

### 활성화 조건

`PhaseTwoWorkerDeps.metricRollupStore`가 설정된 경우에만 실행. 미설정 시 전체 단계를 건너뛴다.

### 에러 격리

개별 trace의 metric 집계 실패는 다른 trace에 영향을 주지 않는다. 에러는 trace 단위로 로깅되고, 다음 trace 처리를 계속한다.
