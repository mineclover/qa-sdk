---
def:
  id: stream-api-spec
  scope: interface
  aspect: event_contract
  depth: specification
  lifecycle: approved
  tags: [tier-infra]
  links:
    - target: record-spec
      type: depends_on
    - target: trace-spec
      type: depends_on
    - target: session-spec
      type: depends_on
---
# SSE 실시간 스트리밍

## 목적 ^purpose

특정 trace 또는 session을 SSE로 구독하여 새 이벤트를 실시간 수신.

## 상태

implemented

## 엔드포인트

### GET /v1/streams/traces/:traceId

SSE 연결. 해당 trace에 새 record가 저장될 때마다 push.

### GET /v1/streams/sessions/:sessionId

SSE 연결. 해당 session에 새 record가 저장될 때마다 push.

## SSE 이벤트 형식

```
event: record
data: {"log_id":"log_...","trace_id":"trc_...","event_key":"page_view",...}

```

Heartbeat는 아래 comment 형식으로 15초마다 전송:

```
: heartbeat

```

## 동작

1. 클라이언트가 SSE 연결 (Hono `streamSSE` 사용)
2. 연결 시 기존 저장된 record는 전송하지 않음 (연결 이후 새 record만)
3. 15초마다 SSE comment heartbeat(`: heartbeat`) 전송
4. ingest 시점에 `RecordStreamBroker.publish(record)` → 활성 구독자에게 즉시 전달
5. 클라이언트 연결 종료 시 `stream.onAbort` → heartbeat timer 정리 + unsubscribe 호출
6. 동일 `traceId` 또는 `sessionId` 에 대한 동시 SSE 구독 수는 기본 10개로 제한
7. 제한 초과 시 JSON 에러와 함께 `429 Too Many Requests` 반환
8. 서버 설정 `SSE_SUBSCRIPTION_LIMIT` 으로 제한 값 변경 가능

## 내부 구조

### RecordStreamBroker

```typescript
class RecordStreamBroker {
  subscribeToTrace(traceId: string, listener: RecordListener): () => void;
  subscribeToSession(sessionId: string, listener: RecordListener): () => void;
  publish(record: StoredRecord): void;
  getTraceSubscriberCount(traceId: string): number;
  getSessionSubscriberCount(sessionId: string): number;
}
```

- `Map<string, Set<RecordListener>>` 기반 in-process pub/sub
- publish 시 `structuredClone(record)` 로 구독자 간 데이터 격리
- listener 에러는 silent catch (다른 구독자에 영향 없음)
- 구독 해제 시 listener set이 비면 key 자체 삭제 (메모리 정리)

### 연결 관리

- `createStreamWriter(stream)` — record 이벤트와 heartbeat comment write를 동일 Promise chain으로 직렬화
- `startHeartbeat(writer)` — 15초 interval로 `: heartbeat` comment 전송
- `waitForDisconnect(stream, cleanup)` — `stream.onAbort` 대기 후 heartbeat/구독 cleanup
- stream 라우트 진입 시 broker subscriber count를 확인하고 `subscriptionLimit` 이상이면 `429` 반환
- disconnect cleanup 이후에는 같은 trace/session key로 새 구독 가능

## 미구현

- **Last-Event-ID**: 재연결 시 누락 이벤트 복구 미지원 (v1 scope 외)
