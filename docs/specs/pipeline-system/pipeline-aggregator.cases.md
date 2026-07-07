---
def:
  id: pipeline-aggregator-cases
  type: spec
  tier: component
  scope: flow
  aspect: user_scenario
  depth: validation
  lifecycle: approved
  layer: operation
  tags: [scenario, pipeline, aggregation]
  links:
    - target: pipeline-aggregator
      type: refines
    - target: pipeline-system
      type: depends_on
  sources:
    - packages/core/src/ports/aggregator.port.ts
    - packages/store/src/adapters/memory/aggregator.adapter.ts
    - packages/store/src/adapters/memory/aggregator.adapter.test.ts
    - packages/core/src/lib/clock.ts
    - packages/core/src/ports/key-cache.port.ts
    - packages/ingest-server/src/lib/phase-two-worker.ts
---

# Pipeline Aggregator — 소비자 기대 시나리오

## 목적 ^purpose

`pipeline-aggregator`(packed_key 그룹핑 + 축 프로젝션 포트)가 `pipeline-system`에 의존할 때 기대하는 계약. aggregator는 Phase 2 비동기 재구성 단계에서 pipeline-system이 제공하는 pipeline-phase-flow, store 어댑터, metric 경로와 정합성을 유지해야 한다.

## 시나리오 1: Phase 2 비동기 집계 진입점 ^overview

**전제**: `pipeline-system`의 `pipeline-phase-flow`가 "Phase 1 = 동기 저장, Phase 2 = 비동기 재구성/judgment"로 구분한다.

**동작**: Phase 2 워커가 `aggregator.groupByKey(keys, { from, to, limit })`를 호출하여 metric 집계를 수행한다.

**기대**:
- 호출은 Phase 1 완료 후에만 트리거 (envelope 검증/store 확정 전에는 aggregator 진입 금지)
- 옵션 `from`/`to`가 ISO-8601이면 `compareTimestamps`로 비교 (문자열 비교 금지)
- `limit` 생략 시 시스템 기본값 적용, 음수/0은 0-row 반환 (throw 아님)

**실패 시 수정 대상**: `pipeline-system.md`의 `pipeline-phase-flow` — 단계 경계가 모호하면 aggregator가 unsettled 데이터를 집계하여 결과가 변동.

## 시나리오 2: projectAxis decode 함수 주입 규약 ^overview

**전제**: `pipeline-system`이 decode 책임을 aggregator 내부가 아닌 외부 주입 함수(`DecodeFn`)로 위임하도록 설계.

**동작**: 호출자가 `aggregator.projectAxis(keys, axes, options)`에 `decode: (key) => axisValues` 를 주입한다.

**기대**:
- decode 미주입 시 명시적 에러 (silent skip 금지)
- decode 실패한 key → 해당 항목 제외 + 계측 metric 증가
- 같은 axes 배열 순서 → 같은 결과 순서 (결정론적)

**실패 시 수정 대상**: `pipeline-system.md`가 pipeline-aggregator의 decode 의존을 명시 — decode 포트가 pipeline-system 계약에 포함되지 않으면 aggregator가 구현에 따라 다른 모듈을 import 하여 의존 방향 위반.

## 시나리오 3: 시간 범위 축소 시 O(1) 캐시 ^overview

**전제**: `pipeline-system`의 `pipeline-cache`가 packed_key 기준 hot path O(1) lookup을 제공한다.

**동작**: 같은 keys + (from, to) 반복 호출 시 aggregator가 캐시를 활용한다.

**기대**:
- TTL 유효 구간에서 반복 호출 → store 조회 스킵
- cache miss 시에만 InMemoryAggregator 또는 store 어댑터로 위임
- cache 무효화는 pipeline-system이 발행하는 invalidation 이벤트에 따라 자동

**실패 시 수정 대상**: `pipeline-system.md` — aggregator ↔ cache 간 공용 key 포맷 정의. packed_key 네임스페이스가 분리되어 있으면 cache hit rate = 0.

## 시나리오 4: InMemory 어댑터 동등성 보장 ^overview

**전제**: `pipeline-system`이 테스트/개발용 InMemoryAggregator를 공식 어댑터로 인정한다.

**동작**: CI 테스트에서 InMemory, production에서 SQL 어댑터를 같은 ports 계약으로 사용한다.

**기대**:
- 두 구현 모두 `AggregateEntry` (key, count, lastSeen, payloadSummary?) 스키마 준수
- 정렬(count 내림차순) 규칙 동일
- `lastSeen` ISO-8601 문자열 규격 동일

**실패 시 수정 대상**: `pipeline-system.md`의 port/adapter 계약 — `AggregateEntry` 타입이 port에 고정되지 않으면 InMemory와 SQL이 어긋나 테스트가 프로덕션을 대표하지 못함.
