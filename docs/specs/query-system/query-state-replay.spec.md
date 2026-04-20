---
def:
  id: query-state-replay
  level: leaf
  tier: component
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: review
  layer: operation
  links:
    - target: query-api
      type: depends_on
---

# Query Service State Replay — 시점 상태 재구성

## 목적 ^purpose

특정 시점까지의 이벤트를 리플레이하여 해당 시각의 축 상태를 재구성한다. GET `/state/:contextId/:resourceId/at?ts=` 엔드포인트로 제공.

## 정의 ^defines

- **ReplayRecordStore** — 시간 범위 레코드 조회 포트
- **ReplayCache** — LRU + TTL 캐시 (100항목, 5분)
- **TransitionEnginePort** — 전이 엔진 추상 포트 (선택)
- **GET /at?ts=** — 시점 replay 엔드포인트

## 소비 ^consumes

- `RecordStore.findByTimeRange(params)` (`@qa-sdk/core`)
- `StateStorePort.snapshot()` (기존)
- `TransitionEnginePort.process()` (선택)

## 아키텍처

```
GET /state/:ctx/:res/at?ts=2026-04-01T12:00:00Z
  → [1] ReplayCache 확인 (hit → 즉시 반환, cached: true)
  → [2] ReplayRecordStore.findByTimeRange({ to: targetTime })
  → [3] address_context에서 contextId/resourceId 필터
  → [4-A] TransitionEngine 있으면 → engine.process(events) → snapshot (mode: engine-replay)
  → [4-B] 없으면 → address_context 병합 (mode: replay)
  → [5] ReplayCache 저장
  → [6] 응답 { state, recordCount, mode, cached }
```

## 핵심 타입

### ReplayRecordStore

```typescript
interface ReplayRecordStore {
  findByTimeRange(params: { to?: Date; limit?: number }): Promise<StoredRecord[]>;
}
```

query-service 내부 구현: raw SQL로 `event_records` 직접 쿼리 (ingest-server 의존 없음).

### ReplayCache

```typescript
interface ReplayCache {
  get(key: string): ReplayCacheEntry | undefined;
  set(key: string, entry: ReplayCacheEntry): void;
}
```

LRU: Map 재삽입 순서. TTL: get 시 만료 검사. 키: `contextId:resourceId:ts_truncated`.

### TransitionEnginePort

```typescript
interface TransitionEnginePort {
  process(events: readonly TransitionEventLike[]): { instances: readonly unknown[] };
}
```

선택적 — 있으면 정확한 전이 재구성, 없으면 address_context 축약 fallback.

### StateRouteDeps 확장

```typescript
interface StateRouteDeps {
  stateStore?: StateStorePort;
  transitionStore?: TransitionInstanceStorePort;
  recordStore?: ReplayRecordStore;
  transitionEngine?: TransitionEnginePort;
  replayCache?: ReplayCache;
}
```

## RecordStore.findByTimeRange (core 포트)

```typescript
interface TimeRangeParams {
  from?: Date;
  to?: Date;
  eventKey?: string;
  limit?: number;
}

interface RecordStore {
  // ...기존 메서드
  findByTimeRange(params: TimeRangeParams): Promise<StoredRecord[]>;
}
```

구현: D1RecordStore (drizzle gte/lte), InMemoryRecordStore (필터).

## 에러 처리

- invalid timestamp → 400
- recordStore 미연결 + stateStore 미연결 → 501
- recordStore 미연결 + stateStore 있음 → current-fallback 모드
- JSON.parse(외부 DB 데이터) → safeJsonParse try-catch

## 구현 위치

| 파일 | 역할 |
|------|------|
| `packages/query-service/src/routes/state.ts` | replay 엔드포인트 + 헬퍼 |
| `packages/query-service/src/lib/replay-record-store.ts` | ReplayRecordStore (raw SQL) |
| `packages/query-service/src/lib/replay-cache.ts` | LRU + TTL 캐시 |
| `packages/query-service/src/config/env.ts` | RECORD_STORE_PATH |
| `packages/query-service/src/server.ts` | recordStore 배선 |
| `packages/core/src/ports/record-store.port.ts` | TimeRangeParams + findByTimeRange 포트 |
