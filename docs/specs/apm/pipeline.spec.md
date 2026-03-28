---
def:
  id: ingest-pipeline-flow
  address: def_document:v1:1073
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: deprecated
  tags: [observability, performance]
  links:
    - target: ingest-api-spec
      type: refines
    - target: transmission-spec
      type: depends_on
    - target: record-spec
      type: depends_on
    - target: trace-spec
      type: depends_on
    - target: session-spec
      type: depends_on
    - target: scenario-store-spec
      type: depends_on
    - target: dlq-store-spec
      type: depends_on
---
# Pipeline — 파이프라인 고도화

## 목적 ^purpose

Phase 1(동기 저장) + Phase 2(비동기 재구성/판정) 2단계 파이프라인 처리 흐름.

## 현재 파이프라인

```
POST /v1/ingest
  │
  ▼
Phase 1 (동기)
  ├─ envelope 검증
  ├─ transmission 저장
  ├─ records → trace_id 그룹핑
  ├─ registry 검증
  ├─ DB 저장 (records, traces, sessions)
  ├─ stream broker publish
  └─ Phase 2 task enqueue
  │
  ▼
Phase 2 (비동기)
  ├─ reconstruct pending traces
  └─ compute pending verdicts
```

---

## Phase 1 변경 — enrichAddressContext 미들웨어

### 위치

기존 Phase 1 흐름에서 **registry 검증 직후, DB 저장 직전**에 삽입한다.

```
Phase 1 (동기)
  ├─ envelope 검증
  ├─ transmission 저장
  ├─ records → trace_id 그룹핑
  ├─ registry 검증
  ├─ ★ enrichAddressContext           ← 신규
  ├─ DB 저장 (records, traces, sessions)
  ├─ stream broker publish
  └─ Phase 2 task enqueue
```

### enrichAddressContext 로직

> 구현: `packages/ingest-server/src/lib/enrich-address-context.ts` — `enrichAddressContext()`
>
> infra_context + record.address_context 머지. fast path: 컨텍스트 없으면 skip, infra만 있으면 참조 공유 (zero-allocation), 양쪽 다 있으면 spread 머지 (record 우선).

### 성능 특성

| 케이스 | 비용 |
|---|---|
| infra_context 없음 | O(1) — 즉시 반환 |
| infra_context만 있음 | O(n) — 참조 대입만 (객체 복사 없음) |
| 양쪽 다 있음 | O(n × k) — k = key 수. spread 머지 |

> 실제 사용에서 record별 override는 드물다. 대부분 infra_context 참조 공유로 처리.

---

## Phase 2 변경 — metric aggregation

### 확장된 Phase 2 흐름

```
Phase 2 (비동기)
  ├─ reconstruct pending traces       ← 기존 (log/span)
  ├─ ★ aggregate pending metrics      ← 신규 (metric)
  └─ compute pending verdicts         ← 기존 (log/span)
```

### 분기 전략

```typescript
// 개념 예시 — Phase 2 worker 분기 전략
async function phase2Worker(traceId: string): Promise<void> {
  const records = await recordStore.findByTraceId(traceId);

  const logs = records.filter((r) => r.record_kind === "log");
  const spans = records.filter((r) => r.record_kind === "span");
  const metrics = records.filter((r) => r.record_kind === "metric");

  // 기존 경로: log/span → reconstruction → verdict
  if (logs.length > 0 || spans.length > 0) {
    await reconstructPendingTraces(traceId, [...logs, ...spans]);
    await computePendingVerdicts(traceId);
  }

  // 신규 경로: metric → aggregation
  if (metrics.length > 0) {
    await aggregatePendingMetrics(metrics);
  }
}
```

### aggregatePendingMetrics

```typescript
// 개념 예시 — metric aggregation 흐름
async function aggregatePendingMetrics(metrics: EventRecord[]): Promise<void> {
  // 1. metric_name + address_context 기준으로 그룹핑
  const groups = groupBy(metrics, (m) =>
    `${m.metric_name}:${JSON.stringify(m.address_context ?? {})}`
  );

  for (const [key, group] of groups) {
    const metricType = group[0].metric_type!;
    const windowStart = truncateToMinute(group[0].timestamp);

    // 2. MetricType별 집계
    const agg = aggregateByType(metricType, group);

    // 3. rollup 테이블에 upsert
    await metricRollupStore.upsert({
      metric_name: group[0].metric_name!,
      address_context: group[0].address_context,
      window_type: "1m",
      window_start: windowStart,
      ...agg,
    });
  }
}
```

> 구현: `packages/ingest-server/src/lib/metric-aggregator.ts` — `aggregateByType()`
>
> MetricType별 집계 전략: counter(sum), gauge(last/min/max/avg), histogram(bucket merge), summary(원본 보존)

### Rollup 스케줄

| 단계 | 트리거 | 입력 | 출력 |
|---|---|---|---|
| raw → 1분 | Phase 2 worker (이벤트 도착 시) | EventRecord (metric) | metric_rollups (1m) |
| 1분 → 1시간 | cron (매시 정각) | metric_rollups (1m) | metric_rollups (1h) |
| 1시간 → 1일 | cron (매일 자정) | metric_rollups (1h) | metric_rollups (1d) |

---

## Range Query

### 엔드포인트

```
POST /v1/apm/query
```

### 요청

```typescript
// 개념 예시 — Range Query 요청 인터페이스
interface ApmQueryRequest {
  /** composite prefix ID */
  prefix_id: string;

  /** stride를 확정한 version — 주소의 v 세그먼트 */
  v: string;

  /** 축별 제약. null = wildcard (모든 값 허용) */
  constraints: Record<string, string | null>;

  /** envelope 전략 composite용 snapshot 필터 */
  entry_snapshot?: string;

  /** 시간 범위 */
  time_range: { from: string; to: string };

  /** 결과 종류 */
  record_kind?: RecordKind;

  /** 페이지네이션 */
  limit?: number;
  cursor?: string;
}
```

### 처리 흐름

```
1. constraints 파싱
   │
   ▼
2. calcAddressRanges(shape, constraints) → [min, max][]
   │  ※ null 축 = wildcard → 해당 축의 모든 값
   │
   ▼
3. SQL 생성
   │  WHERE address_context->>'k8s_workload_addr' BETWEEN 'prefix:v1:min' AND 'prefix:v1:max'
   │    AND timestamp >= :from AND timestamp <= :to
   │    AND (:record_kind IS NULL OR record_kind = :record_kind)
   │  ORDER BY timestamp DESC
   │  LIMIT :limit
   │
   ▼
4. 응답 반환
```

### calcAddressRanges 연동

> 구현: `packages/apm/src/address-ranges.ts` — `buildAddressRanges()`
>
> `calcAddressRanges` (weighted-index) 활용. constraints를 `CoordConstraint[]`로 변환 후 주소 범위 계산.

### 응답

```typescript
// 개념 예시 — Range Query 응답 인터페이스
interface ApmQueryResponse {
  records: EventRecord[];
  total: number;
  next_cursor?: string;
  ranges_used: [number, number][];  // 디버깅: 사용된 주소 범위
}
```

### 예시

```bash
# prod-east 클러스터의 모든 네임스페이스에서 deployment 타입 이벤트 조회
curl -X POST /v1/apm/query -d '{
  "prefix_id": "k8s_workload_addr",
  "v": "v1",
  "constraints": {
    "schema_version": "s1",
    "k8s_cluster": "prod-east",
    "k8s_namespace": null,
    "k8s_workload_type": "deployment",
    "k8s_service": null
  },
  "time_range": {
    "from": "2026-03-19T00:00:00Z",
    "to": "2026-03-19T23:59:59Z"
  },
  "limit": 50
}'
```

---

## SSE 확장 — 축별 구독

### 기존 SSE

```
GET /v1/streams?session_id=xxx
```

### 확장: 축별 구독

```
GET /v1/apm/streams?prefix_id=k8s_workload_addr&v=v1&constraints=schema_version:s1,k8s_namespace:production
```

### 쿼리 파라미터

| 파라미터 | 설명 | 예시 |
|---|---|---|
| `prefix_id` | 구독할 composite | `k8s_workload_addr` |
| `v` | stride를 확정한 version | `v1` |
| `constraints` | 축별 필터 (key:value 쌍, 쉼표 구분). schema_version도 축으로 필터 가능 | `schema_version:s1,k8s_namespace:production` |
| `record_kind` | 선택적 종류 필터 | `metric` |

### 서버 측 필터링

```typescript
// 개념 예시 — stream broker에서 수신한 레코드를 축 기준으로 필터
function matchesSubscription(
  record: EventRecord,
  subscription: ApmSubscription,
): boolean {
  const addrStr = record.address_context?.[subscription.prefix_id];
  if (!addrStr) return false;

  const { address } = parseAddressString(addrStr);
  const ranges = subscription.addressRanges; // 구독 시 사전 계산

  return ranges.some(([min, max]) => address >= min && address <= max);
}
```

### SSE 이벤트 형식

```
event: apm_record
data: {"log_id":"01J...","record_kind":"metric","metric_name":"k8s.pod.cpu_usage",...}

event: apm_record
data: {"log_id":"01J...","record_kind":"log","event_key":"http.request.handled",...}
```

---

## PartialBinder SDK 연동

### Boot-time 초기화

K8s Downward API 환경변수를 사용하여 클러스터/네임스페이스를 boot-time에 고정:

```typescript
import { createBinder } from "@qa-sdk/weighted-index";

// K8s Pod 환경변수 (Downward API)
// env:
//   - name: K8S_CLUSTER
//     valueFrom: { fieldRef: { fieldPath: metadata.labels['cluster'] } }
//   - name: K8S_NAMESPACE
//     valueFrom: { fieldRef: { fieldPath: metadata.namespace } }

const k8sBinder = createBinder(codec, "k8s_workload_addr", {
  schema_version: "s1",                        // 현재 스키마 마이너 버전
  k8s_cluster: process.env.K8S_CLUSTER!,       // e.g., "prod-east"
  k8s_namespace: process.env.K8S_NAMESPACE!,   // e.g., "production"
}, "v1");  // stride를 확정한 version
// → binder.bound = { schema_version: "s1", k8s_cluster: "prod-east", k8s_namespace: "production" }
// → binder.free  = ["k8s_workload_type", "k8s_service"]
```

### Runtime Resolve

```typescript
// 나머지 차원만 지정하여 주소 생성
const addr = k8sBinder.resolveId({
  k8s_workload_type: "deployment",
  k8s_service: "gateway",
});
// → 1D integer address

// infra_context로 엔벨로프에 설정
const envelope: TransmissionEnvelope = {
  // ...
  infra_context: {
    k8s_workload_addr: `k8s_workload_addr:v1:${addr}`,
  },
  records: [...],
};
```

### 체이닝

```typescript
// 단계적 바인딩
const clusterBinder = createBinder(codec, "k8s_workload_addr", {
  schema_version: "s1",
  k8s_cluster: "prod-east",
});

// 네임스페이스별 분기
const prodBinder = clusterBinder.bind({ k8s_namespace: "production" });
const stagBinder = clusterBinder.bind({ k8s_namespace: "staging" });

// 최종 resolve
prodBinder.resolveId({ k8s_workload_type: "deployment", k8s_service: "gateway" });
```

---

## 에러 처리

| 상황 | 처리 |
|---|---|
| address_context에 알 수 없는 prefix_id | 경고 로그 + 레코드는 그대로 저장 (address_context 무시 아님) |
| 주소가 capacity 범위 밖 | DLQ 전송 (`phase: "address_validation"`) |
| v 세그먼트 불일치 | Range Query 시 404 반환 (해당 version의 stride 없음), SSE 구독 시 에러 이벤트 |
| metric 필수 필드 누락 | Phase 1 검증에서 DLQ 전송 |

## 모니터링 메트릭 (자체 관측)

| 메트릭 | 타입 | 설명 |
|---|---|---|
| `apm.ingest.address_context.merge_count` | counter | enrichAddressContext 머지 횟수 |
| `apm.ingest.address_context.skip_count` | counter | 컨텍스트 없어서 skip한 횟수 |
| `apm.metric.aggregation.duration_ms` | histogram | metric aggregation 소요 시간 |
| `apm.metric.rollup.upsert_count` | counter | rollup upsert 횟수 |
| `apm.query.range_count` | histogram | Range Query 시 생성된 범위 수 |
| `apm.stream.subscription_count` | gauge | 활성 SSE 구독 수 |
