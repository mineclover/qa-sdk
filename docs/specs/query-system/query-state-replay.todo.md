---
def:
  id: query-state-replay-todo
  level: leaf
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: review
  layer: operation
  links:
    - target: query-api
      type: depends_on
---

# Query Service State Replay — 구현 TODO

## 목적 ^purpose

시간 기반 상태 리플레이 기능 구현 현황을 추적한다.

## 차단 해소 — 완료 (2026-04-05)

### RecordStore 시간 범위 쿼리

- [x] `TimeRangeParams` 인터페이스 (from, to, eventKey, limit)
- [x] `RecordStore.findByTimeRange(params)` 포트 추가
- [x] `D1RecordStore.findByTimeRange` — drizzle gte/lte 구현
- [x] `InMemoryRecordStore.findByTimeRange` — 필터 구현
- [x] core index.ts TimeRangeParams export

### query-service 배선

- [x] `StateRouteDeps.recordStore` — ReplayRecordStore 포트 추가
- [x] GET /state/:contextId/:resourceId/at?ts= — 실제 replay 구현
- [x] recordStore 있으면 시점 replay, 없으면 현재 상태 fallback
- [x] invalid timestamp 400 에러 처리
- [x] placeholder `"replay not yet implemented"` 제거

## 고도화 — 완료 (2026-04-05)

### H1: server.ts RecordStore 인스턴스 배선

- [x] env.ts `RECORD_STORE_PATH` 환경변수 추가 (선택, SQLITE_PATH fallback)
- [x] `createReplayRecordStore(driver)` — query-service 내부 구현 (ingest-server 의존 없음)
- [x] stateRoutesDeps.recordStore 주입 (동적 import + fail-open)

### H2: TransitionEngine 통합

- [x] `TransitionEnginePort` 추상 포트 (process 메서드)
- [x] `toTransitionEvent(StoredRecord)` 어댑터 함수
- [x] engine 있으면 정확한 전이 replay (`engine-replay` 모드), 없으면 축약 fallback
- [x] `StateRouteDeps.transitionEngine` 선택적 주입

### H3: LRU 캐시

- [x] `replay-cache.ts` — createReplayCache(maxSize, ttlMs) + replayCacheKey
- [x] 캐시 히트 → `cached: true` 응답 + DB 스킵
- [x] LRU: Map 재삽입 순서 기반, TTL 만료 자동 제거
- [x] `StateRouteDeps.replayCache` 선택적 주입
