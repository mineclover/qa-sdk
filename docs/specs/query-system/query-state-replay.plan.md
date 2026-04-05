---
def:
  id: query-state-replay-plan
  level: leaf
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: draft
  layer: operation
  links:
    - target: query-state-replay-todo
      type: depends_on
---

# Query Service State Replay — 고도화 구현 계획

## 목적 ^purpose

시점 replay의 3건 고도화 (배선 + 전이 엔진 + 캐싱) 구현 순서와 검증 기준을 정의한다.

## 구현 파일

| 파일 | 변경 |
|------|------|
| `packages/query-service/src/config/env.ts` | RECORD_STORE_PATH 환경변수 |
| `packages/query-service/src/server.ts` | D1RecordStore 인스턴스 생성 + stateRoutesDeps 주입 |
| `packages/query-service/src/routes/state.ts` | TransitionEngine replay 로직 + 캐시 |
| `packages/query-service/src/lib/replay-cache.ts` | LRU 캐시 (신규) |

## 단계

### H1: RecordStore 인스턴스 배선

1. env.ts에 `RECORD_STORE_PATH` 추가 (선택, 기본값 `SQLITE_PATH` 공유)
2. server.ts에서 createSqliteDriver 재사용 또는 별도 driver 생성
3. D1RecordStore 인스턴스를 stateRoutesDeps.recordStore로 주입
4. 초기화 실패 시 warn + recordStore undefined (fail-open)
5. 검증: GET /state/:ctx/:res/at?ts= 에서 mode: "replay" 응답 확인

### H2: TransitionEngine 통합

1. spec-core/transition에서 동적 import (기존 stateStore와 같은 패턴)
2. `toTransitionEvent(stored: StoredRecord)` 어댑터 함수 작성
   - logId → log_id, timestamp → ISO string, eventKey → event_key
   - addressContext → address_context (이미 동일 구조)
3. state.ts replay 로직에서:
   - records → toTransitionEvent 매핑
   - fresh InMemoryStateStore 생성
   - TransitionEngine.process(events) 호출
   - stateStore.snapshot(contextId, resourceId) 반환
4. TransitionEngine 없으면 현재 방식 (address_context 축약) fallback
5. 검증: replay 결과가 전이 규칙을 따르는지 테스트

### H3: LRU 캐시

1. `replay-cache.ts` 작성 — 간단한 Map + TTL + maxSize
2. 캐시 키: `${contextId}:${resourceId}:${ts_truncated_to_second}`
3. hit → DB 쿼리 + 전이 엔진 replay 스킵
4. miss → 정상 replay → 결과 캐시
5. TTL 5분, 최대 100항목
6. stateRouteDeps에 optional cache 주입
7. 검증: 동일 요청 2회 → 2번째 응답에 `cached: true` 표시

## 검증 기준

| 기준 | 방법 |
|------|------|
| 배선 정상 | tsc --noEmit + 서버 시작 시 recordStore 로그 |
| 전이 재구성 | 테스트: 레코드 삽입 → replay → snapshot 일치 |
| 캐시 히트 | 동일 요청 2회 → DB 호출 1회 |
| fail-open | recordStore/engine 미연결 → fallback 응답 |

## 의존

- `@qa-sdk/spec-core/transition` — TransitionEngine, InMemoryStateStore
- `@qa-sdk/core` — RecordStore.findByTimeRange (이미 구현)
- `ingest-server` — D1RecordStore (이미 구현)

## 예상 규모

- H1: ~30줄 (env + server.ts)
- H2: ~60줄 (어댑터 + replay 로직)
- H3: ~50줄 (LRU 캐시)
- 테스트: ~100줄
