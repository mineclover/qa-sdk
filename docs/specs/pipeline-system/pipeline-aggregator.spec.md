---
def:
  id: pipeline-aggregator
  tier: system
  scope: interface
  aspect: api_contract
  depth: specification
  lifecycle: approved
  layer: operation
  tags: [aggregation, port]
  links:
    - target: pipeline-aggregator-test
      type: contains
    - target: pipeline-system
      type: depends_on
contains:
  - pipeline-aggregator-test
---
# Aggregator — packed_key 집계 포트

## 목적 ^purpose

packed_key 기반 그룹핑과 축 프로젝션 집계를 추상화한다. DB의 GROUP BY에 직접 매핑되는 극고속 groupByKey와, decode 후 특정 축만 추출하는 유연한 projectAxis 두 가지 모드를 제공한다.

## 정의 ^defines

- `Aggregator` — 집계 포트 인터페이스 (groupByKey, projectAxis)
- `AggregateEntry` — 그룹핑 결과 항목 (key, count, lastSeen, payloadSummary?)
- `AxisProjectionEntry` — 축 프로젝션 결과 항목 (axisValues, count)
- `AggregateOptions` — 집계 쿼리 옵션 (from?, to?, limit?)
- `InMemoryAggregator` — 개발/테스트용 인메모리 구현체
- `DecodeFn` — 외부 주입 decode 함수 시그니처

## 소비 ^consumes

- `packages/core/src/ports/aggregator.port.ts` — 포트 정의
- `packages/store/src/adapters/memory/aggregator.adapter.ts` — InMemory 구현

## 구성 ^overview

### 포트 인터페이스 (Aggregator)

| 메서드 | 시그니처 | 설명 |
|--------|---------|------|
| `groupByKey` | `(keys, options?) => Promise<AggregateEntry[]>` | packed_key 기반 GROUP BY |
| `projectAxis` | `(keys, axes, options?) => Promise<AxisProjectionEntry[]>` | decode → 축 프로젝션 집계 |

### AggregateOptions

| 필드 | 타입 | 설명 |
|------|------|------|
| `from` | `string?` | 시간 범위 시작 (ISO-8601) |
| `to` | `string?` | 시간 범위 끝 (ISO-8601) |
| `limit` | `number?` | 최대 반환 그룹 수 |

### groupByKey

- 지정된 키 집합에 대해 count + lastSeen을 집계한다.
- 결과는 count 내림차순 정렬.
- payloadSummary는 마지막으로 본 항목의 payload를 전달 (있는 경우).
- 시간 범위(from/to) 필터와 limit 적용 가능.

### projectAxis

- decode 함수를 주입받아 packed_key를 entity 매핑으로 변환.
- 지정된 축(axes) 값만 추출 → 조합별 count 집계.
- decode 함수 미설정 시 에러 (`"projectAxis에는 decode 함수가 필요합니다"`).
- decode 결과가 undefined인 항목은 건너뜀 (decode 실패 허용).
- 결과는 count 내림차순 정렬.

### InMemoryAggregator 구현

- `ingest(key, timestamp, payload?)` — 테스트용 데이터 주입 메서드.
- 내부 StoredItem 배열에 저장.
- `filterByTime()` — from/to 옵션에 따른 시간 범위 필터 (`compareTimestamps()` 사용).
- **프로덕션 대체**: DB GROUP BY 또는 Materialized View로 교체 가능.
