# Query API

> 저장된 trace, session, record를 cursor 기반 pagination으로 조회.

## 상태

implemented

## 엔드포인트

### GET /v1/traces/:traceId

Trace 메타데이터 조회.

응답 200:
```json
{
  "traceId": "trc_...",
  "sessionId": "qas_..." | null,
  "recordCount": 42,
  "firstTimestamp": "2026-03-12T10:00:00.000Z",
  "lastTimestamp": "2026-03-12T10:05:00.000Z",
  "reconstructed": false
}
```

응답 404: trace 없음.

### GET /v1/traces/:traceId/records?cursor=&limit=

해당 trace의 EventRecord 목록 (cursor 기반 pagination).

### GET /v1/traces/:traceId/graph

해당 trace의 reconstruction된 RuntimeGraph 조회.

응답 200:
```json
{
  "trace_id": "trc_...",
  "nodes": [],
  "edges": [],
  "nodeCount": 0,
  "edgeCount": 0
}
```

응답 404: graph 없음 (trace가 없거나 아직 reconstruction되지 않음).

### GET /v1/sessions/:sessionId

Session 메타데이터 조회.

응답 200:
```json
{
  "sessionId": "qas_...",
  "scenarioId": null,
  "labels": null,
  "startedAt": "2026-03-12T10:00:00.000Z",
  "closedAt": null
}
```

응답 404: session 없음.

### GET /v1/sessions/:sessionId/records?cursor=&limit=

해당 session의 EventRecord 목록 (cursor 기반 pagination).

## Pagination

### 요청 파라미터

| 파라미터 | 타입 | 기본값 | 최대값 | 설명 |
|---|---|---|---|---|
| `cursor` | string | - | - | base64url 인코딩된 커서 |
| `limit` | number | 50 | 200 | 페이지 크기 |

### 커서 형식

base64url(`{ "timestamp": "<ISO-8601>", "logId": "<string>" }`)

### 응답 형식

```json
{
  "items": [ EventRecord, ... ],
  "next_cursor": "<base64url string>" | null,
  "has_more": true | false
}
```

## 동작

- items는 timestamp 오름차순 정렬
- cursor가 없으면 처음부터
- cursor가 유효하지 않으면 400 에러 (base64url 디코딩 실패, JSON 파싱 실패, 필수 필드 누락 모두 포함)
- limit > 200 이면 200으로 클램핑
- limit = 0 또는 음수이면 400 에러
- has_more=true 이면 next_cursor가 반드시 존재

## 의존 포트

```typescript
interface QueryDeps {
  graphStore: GraphStore;
  recordStore: RecordStore;
  traceStore: TraceStore;
  sessionStore: SessionStore;
}
```
