---
def:
  id: task-pipeline-unit
  scope: flow
  aspect: process_flow
  depth: implementation
  lifecycle: approved
  tags: [tier-infra]
  links:
    - target: pipeline-enrichment
      type: refines
    - target: pipeline-metric-agg
      type: refines
---

# Unit 2 — 이벤트 수집 + 집계 파이프라인

## 목적 ^purpose

A1 (이벤트 생성) → A5 (집계) → A6 (메트릭 저장) 경로를 구축하여
인덱싱 시스템의 packed_key 기반 운영 분석을 가능하게 한다.

## 흐름 심볼

`[A1]` Event Create · `[A5]` Aggregate · `[A6]` Metrics Store

## 현재 상태

| 단계 | 상태 | 비고 |
|---|---|---|
| A1 이벤트 생성 | 🔧 | MetaCodec.encode() 완성, 흐름 미연결 |
| A2→A4 MQ | Unit 1에서 구축 | 선행 |
| **A5 집계** | 📋 | Aggregator 인터페이스 없음, projectAxis() 미구현 |
| **A6 Metrics Store** | 📋 | 테이블/스키마 없음 |
| A7 보존 | ✅ | event_records immutable |

## 선행 조건

- **unit-1-async-worker** — A2→A4 MQ 인프라

## spec.todo 매핑

I-1, I-2, I-3, I-4, I-5, I-6

## 작업 항목

### Phase A — 포트 인터페이스 (I-1, I-2)

| # | spec.todo | 작업 | 위치 |
|---|---|---|---|
| 1 | I-1 | KeyCache 포트 인터페이스 | `packages/key-cache/src/key-cache.ts` |
| 2 | I-1 | InMemory KeyCache 어댑터 | `packages/key-cache/src/adapters/memory.ts` |
| 3 | I-2 | Aggregator 포트 인터페이스 | `packages/pipeline/src/aggregator.ts` |
| 4 | I-6 | `projectAxis()` 함수 | `packages/pipeline/src/axis-projection.ts` |

```ts
// key-cache.ts
interface KeyCache<K = bigint, V = unknown> {
  get(key: K): Promise<V | undefined>;
  set(key: K, value: V, ttlMs?: number): Promise<void>;
  delete(key: K): Promise<boolean>;
  has(key: K): Promise<boolean>;
}

// aggregator.ts
interface Aggregator {
  groupByKey(keys: bigint[]): Promise<Map<bigint, AggregateResult>>;
  projectAxis(keys: bigint[], axisIndex: number, shape: number[]): Promise<Map<number, AggregateResult>>;
}

// axis-projection.ts
function projectAxis(key: number, axisIndex: number, strides: number[], shape: number[]): number {
  return Math.floor(key / strides[axisIndex]) % shape[axisIndex];
}
```

### Phase B — 집계 로직 (I-2, I-3)

| # | spec.todo | 작업 | 위치 |
|---|---|---|---|
| 5 | I-2 | Transition 계산 | `packages/pipeline/src/transition.ts` |
| 6 | I-2 | Path 계산 | `packages/pipeline/src/path.ts` |
| 7 | I-3 | Materialized View 스키마 | `packages/pipeline/src/materialized-view.ts` |

Transition 계산:
1. 이벤트 순서 정렬
2. (A → B) 전이 쌍 추출
3. count + duration 집계
4. window별 (분/시/일) 버킷

Path 계산:
1. trace_id 기준 이벤트 묶기
2. event sequence → 정규화
3. path_id (해시) 생성
4. count 증가

### Phase C — 저장 + 캐시 어댑터 (I-3, I-4)

| # | spec.todo | 작업 | 위치 |
|---|---|---|---|
| 8 | I-3 | Metrics Store 테이블 | DB 스키마 (transition_metrics, path_metrics) |
| 9 | I-4 | Redis KeyCache 어댑터 | `packages/key-cache/src/adapters/redis.ts` |
| 10 | I-4 | Cloudflare KV KeyCache 어댑터 | `packages/key-cache/src/adapters/cloudflare-kv.ts` |

### Phase D — MQ 연결 (I-5)

| # | spec.todo | 작업 | 위치 |
|---|---|---|---|
| 11 | I-5 | Aggregation Consumer | `packages/pipeline/src/consumer.ts` |
| 12 | A1 | Event → packed_key 연결 | ingest-server 또는 worker에서 `MetaCodec.encode()` 호출 → MQ 발행 |

## 인덱싱 시스템 활용 지점

| 파이프라인 단계 | 인덱싱 모듈 | 역할 |
|---|---|---|
| Event → packed_key | `MetaCodec.encode()` | 다차원 좌표 → 1D 주소 |
| 축별 집계 | `projectAxis()` | 전체 decode 없이 축 추출 |
| 범위 기반 집계 | `matchRanges()` | 축 조건 → 주소 범위 → DB BETWEEN |
| 배치 인코딩 | `weighted-wasm encodeBatch()` | WASM 가속 |
| GPU 집계 | `GPUEncoder.reduceByKey()` | 대량 group-by |

## 산출물

- `packages/key-cache/` 패키지 (포트 + Memory + Redis + KV)
- `packages/pipeline/` 패키지 (Aggregator + Transition + Path + Materialized View + Consumer)
- `projectAxis()` 함수
- A 흐름 커버리지: 57% → **100%** (A1, A5, A6 추가)
