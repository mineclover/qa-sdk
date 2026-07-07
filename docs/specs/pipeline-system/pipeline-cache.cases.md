---
def:
  id: pipeline-cache-cases
  type: spec
  tier: component
  scope: flow
  aspect: user_scenario
  depth: validation
  lifecycle: approved
  layer: operation
  tags: [scenario, pipeline, cache]
  links:
    - target: pipeline-cache
      type: refines
    - target: pipeline-system
      type: depends_on
  sources:
    - packages/core/src/ports/key-cache.port.ts
    - packages/store/src/adapters/memory/key-cache.adapter.ts
    - packages/store/src/adapters/memory/key-cache.adapter.test.ts
    - packages/store/src/adapters/redis/key-cache.adapter.ts
    - packages/store/src/adapters/redis/key-cache.adapter.test.ts
    - packages/decode-service/src/lib/decode-cache.ts
---

# Pipeline KeyCache — 소비자 기대 시나리오

## 목적 ^purpose

`pipeline-cache`(KeyCache 포트: get/set/delete/clear/has/stats)가 `pipeline-system`에 의존할 때 기대하는 계약. cache는 pipeline-system의 Phase 2 재구성 경로, Redis L2 어댑터, monitoring metric 전제 위에서 동작한다.

## 시나리오 1: TTL 만료 lazy eviction ^overview

**전제**: `pipeline-system`이 pipeline-cache의 `InMemoryKeyCache` 구현을 "ttlMs 기준 lazy 만료, ttlMs=0 영구"로 고정한다.

**동작**: `cache.set(k, v, 1000)` 후 2초 경과하고 `cache.get(k)` 호출.

**기대**:
- 반환값 `undefined`
- 내부적으로 항목 삭제 + `evictions++`, `misses++`
- `stats()` 는 동기 반환, 누적 카운터 비감소

**실패 시 수정 대상**: `pipeline-system.md`의 pipeline-cache 명세 — 만료 판정 시점(write 시 proactive vs read 시 lazy)을 명문화. 혼재 구현 시 hit 율이 어댑터 선택에 따라 불안정.

## 시나리오 2: maxSize 초과 LRU 제거 ^overview

**전제**: `pipeline-system`이 `InMemoryKeyCache`의 maxSize 기본값(10,000)과 LRU 정책을 공식화한다.

**동작**: 10,001번째 키를 `set`한다.

**기대**:
- Map 첫 번째(가장 오래된) 항목 제거
- `evictions++`, `size === 10000` 유지
- 최근 `get()` 된 키는 제거 대상에서 제외 (순서 갱신 규약)

**실패 시 수정 대상**: `pipeline-system.md` — maxSize 기본값과 LRU 동작을 port 계약 또는 adapter doc에 기재. 어댑터별 정책 차이가 cache miss 쓰나미를 유발.

## 시나리오 3: L1/L2 구조 확장성 ^overview

**전제**: `pipeline-system`의 `redis-cache-adapter` 문서가 L2 Redis 어댑터를 pipeline-cache의 포트-어댑터 구조 위에서 설계.

**동작**: L1(InMemory)에서 miss 시 L2(Redis) 조회 순차 fallback.

**기대**:
- L2 hit → L1에 write-back (다음 tick 동안 재use)
- L2 timeout/오류 → L1 miss로 간주, cache 전체 실패 금지(fail-open)
- `stats()`는 L1 로컬 카운터만 반환 (L2 집계는 별도 경로)

**실패 시 수정 대상**: `pipeline-system.md`의 `redis-cache-adapter` — write-back 정책과 timeout 기준. L1/L2 책임 경계가 모호하면 cache stampede 또는 정합성 drift.

## 시나리오 4: clear() 통계 초기화 의미 ^overview

**전제**: `pipeline-cache` 명세가 "`clear()` 시 hits/misses/evictions 전부 0 리셋"을 규정한다.

**동작**: 모니터링 대시보드가 1분 간격으로 `stats()`를 수집하다가 관리 작업으로 `clear()` 발생.

**기대**:
- clear 이후 첫 `stats()` 호출 → 모든 카운터 0
- 다음 get/set 부터 정상 카운팅
- monitor는 누적값 reset 이벤트를 감지할 수 있어야 함(값이 역행할 때 delta 보정)

**실패 시 수정 대상**: `pipeline-system.md`의 `pipeline-monitoring` — clear 후 통계 리셋 계약을 알리지 않으면 metric backend에서 counter 역행이 에러로 판정.
