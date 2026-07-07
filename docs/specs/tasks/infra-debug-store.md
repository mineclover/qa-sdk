---
def:
  id: task-infra-debug-store
  type: knowledge
  knowledge_kind: guide
  tier: component
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: approved
  layer: operation
  svc: ingest-server
  tags: [runtime, task-record]
  links:
    - target: ingest-system
      type: traces_to
sources:
  - packages/ingest-server/src/lib/debug-store.ts
  - packages/ingest-server/src/lib/in-memory-debug-store.ts
  - packages/ingest-server/src/lib/in-memory-debug-store.test.ts
  - packages/ingest-server/src/routes/ingest.ts
  - packages/ingest-server/src/worker.ts
---

# D3 — Debug Store (TTL 임시 저장)

> 디버깅 흐름의 유일한 갭. 실시간 스트림을 놓친 소비자가 최근 이벤트를 조회할 수 있게 한다.

## 목적 ^purpose

D3 Debug Store task의 구현 완료 위치를 추적한다. 현재 동작의 SSOT는 ingest-server의 DebugStore 포트, InMemory 어댑터, ingest/worker wiring과 테스트다.

## 흐름 심볼

`[D3]` — Debug Store (TTL 저장)

## 현재 상태

| 단계 | 상태 |
|---|---|
| D1 생성 | ✅ RecordStreamBroker.publish() |
| D2 전송 | ✅ SSE + WebSocket |
| **D3 저장** | ✅ `DebugStore` + `InMemoryDebugStore` |
| D4 표시 | ✅ viz-web |

## 선행 조건

없음.

## 작업 항목

| # | 작업 | 위치 | 설명 |
|---|---|---|---|
| 1 | DebugStore 포트 인터페이스 | `packages/ingest-server/src/lib/debug-store.ts` | `append(record, ttlMs)`, `getRecentByTrace(traceId, limit)`, `getRecentBySession(sessionId, limit)` |
| 2 | InMemory 어댑터 | `packages/ingest-server/src/lib/in-memory-debug-store.ts` | `Map` + TTL 타이머. 메모리 상한 (maxEntries) |
| 3 | ingest-server 연결 | `ingest-server/src/routes/ingest.ts` | RecordStreamBroker.publish() 직후 DebugStore.append() 호출 |
| 4 | 조회 엔드포인트 | `ingest-server/src/routes/debug.ts` | `GET /v1/debug/traces/:traceId/recent`, `GET /v1/debug/sessions/:sessionId/recent` |
| 5 | viz-web 연동 | `viz-web/src/api/` | late-joiner가 WebSocket 연결 후 recent 조회로 버퍼 채움 |

## 설계 고려

- TTL 기본값: 5분 (env로 조정)
- 메모리 상한: 10,000 entries (FIFO eviction)
- D2 (SSE/WS) 경로와 독립 — 둘 다 받아도 중복 제거는 클라이언트 책임 (record_id 기준)

## 산출물

- DebugStore 인터페이스 + InMemory 어댑터
- 조회 엔드포인트 2개
- D 흐름 커버리지: 75% → **100%**

## 관련 소스

- `packages/ingest-server/src/lib/debug-store.ts`
- `packages/ingest-server/src/lib/in-memory-debug-store.ts`
- `packages/ingest-server/src/lib/in-memory-debug-store.test.ts`
- `packages/ingest-server/src/routes/ingest.ts`
