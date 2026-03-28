---
def:
  id: api-client-spec
  address: def_document:v1:2689
  scope: data
  aspect: external_data
  depth: specification
  lifecycle: approved
  layer: domain
  svc: shopping-web
  tags: [tier-frontend]
  links:
    - target: ingest-api-spec
      type: depends_on
---
# API 클라이언트 — REST 래퍼 + SSE 구독

## 목적 ^purpose

viz-web에서 ingest-server와 통신하기 위한 REST fetch 래퍼와 EventSource 기반 SSE 구독 클라이언트.

## 구성 ^overview

- **REST 클라이언트**: 단일 `request<T>(path, init?)` 헬퍼로 모든 REST 호출에 일관된 에러 처리를 적용한다
- **엔드포인트**: scenarios CRUD, trace 메타/레코드/그래프/verdicts 조회, session 레코드/verdicts 조회, verdicts 재계산 등 10개 함수
- **SSE 구독**: `subscribeToTrace(traceId, handlers)` — EventSource로 실시간 레코드 수신, close 이벤트 처리, unsubscribe 함수 반환
- **페이지네이션**: `getSessionRecords`는 cursor 기반으로 limit=200씩 요청하며 최대 1,000개까지 수집한다
- **설정**: `INGEST_SERVER_URL`/`ROLEPLAY_WEB_URL`은 config.ts에서 읽으며, `VITE_*` 환경변수로 오버라이드 가능하다
- **무상태 설계**: 클라이언트는 상태를 갖지 않으며, 인증/세션 관리는 범위 밖이다
- **재시도 전략**: REST는 재시도 미포함(호출자 책임), SSE는 EventSource 내장 재연결에 의존한다
- **와이어 포맷**: SSE는 `event: record`/`event: close` + heartbeat 프레임 구조를 따른다

## 상태

implemented

## 설계 원칙

- 모든 REST 호출은 단일 `request<T>()` 헬퍼를 통해 일관된 에러 처리를 적용한다.
- SSE 구독은 `EventSource` API를 직접 사용하며, 추가 라이브러리 없이 구현한다.
- 클라이언트는 상태를 갖지 않는다 (stateless). 인증 토큰 등 세션 관리는 범위 밖이다.
- 서버 URL은 `config.ts`의 `INGEST_SERVER_URL`에서 읽으며, 환경변수 `VITE_INGEST_SERVER_URL`로 오버라이드 가능하다.

## REST 클라이언트 (ingest-client.ts)

### 내부 헬퍼

> 타입 정의: packages/viz-web/src/api/ingest-client.ts — request

- `INGEST_SERVER_URL + path`로 fetch 호출
- 기본 헤더: `Content-Type: application/json`
- 응답이 `!res.ok`이면 `Error`를 throw한다 (상태 코드 + 응답 body 포함)

### 엔드포인트 함수

| 함수 | HTTP | 경로 | 반환 타입 |
|---|---|---|---|
| `listScenarios(domain?)` | GET | `/v1/scenarios` | `ScenarioSpec[]` |
| `getScenario(scenarioId)` | GET | `/v1/scenarios/:id` | `ScenarioSpec` |
| `createScenario(spec)` | POST | `/v1/scenarios` | `{ accepted, scenario_id }` |
| `getTrace(traceId)` | GET | `/v1/traces/:id` | `TraceMetadata` |
| `getTraceRecords(traceId, cursor?, limit?)` | GET | `/v1/traces/:id/records` | `TraceRecordsPage` |
| `getTraceGraph(traceId)` | GET | `/v1/traces/:id/graph` | `RuntimeGraph` |
| `getTraceVerdicts(traceId)` | GET | `/v1/traces/:id/verdicts` | `VerdictList` |
| `getSessionRecords(sessionId)` | GET | `/v1/sessions/:id/records` (cursor 기반 페이지네이션) | `StoredRecord[]` |
| `getSessionVerdicts(sessionId)` | GET | `/v1/sessions/:id/verdicts` | `VerdictList` |
| `recomputeVerdicts(traceId)` | POST | `/v1/traces/:id/verdicts/recompute` | `{ recomputed }` |

### getSessionRecords

cursor 기반 페이지네이션으로 세션의 모든 레코드를 수집한다. `limit=200`으로 요청하며 `next_cursor`가 없거나 누적 레코드가 1,000개를 초과하면 중단한다. snake_case REST 응답을 `StoredRecord` (camelCase)로 변환한다.

### 보조 타입

> 타입 정의: packages/viz-web/src/api/ingest-client.ts — TraceMetadata, TraceRecordsPage, VerdictList

- URL 경로 파라미터는 `encodeURIComponent()`로 인코딩한다.
- 쿼리 파라미터는 `URLSearchParams`로 구성한다.

## SSE 클라이언트 (sse-client.ts)

> 타입 정의: packages/viz-web/src/api/sse-client.ts — SseHandlers, subscribeToTrace

### 동작

1. `EventSource`를 `GET /v1/streams/traces/:traceId`에 연결한다.
2. `event: record` — `data`를 `JSON.parse()` → `StoredRecord`로 역직렬화 → `onRecord()` 호출. 파싱 실패 시 무시.
3. `event: close` — `data`에서 `reason`을 추출 → `onClose()` 호출 → `source.close()`.
4. `onerror` — `onError()` 호출. EventSource의 자동 재연결에 위임.
5. 반환값은 unsubscribe 함수로, 호출 시 `source.close()`를 실행한다.

### SSE 와이어 포맷 (서버 참조)

```
event: record
data: {"log_id":"log_...","trace_id":"trc_...","event_key":"click",...}

: heartbeat

event: close
data: {"reason":"server_shutdown"}
```

## 설정 (config.ts)

> 타입 정의: packages/viz-web/src/config.ts — INGEST_SERVER_URL, ROLEPLAY_WEB_URL

- Vite 환경변수 `VITE_INGEST_SERVER_URL`, `VITE_ROLEPLAY_WEB_URL`로 오버라이드 가능.
- `/// <reference types="vite/client" />`로 `import.meta.env` 타입을 보장한다.

## 제약 조건

- REST 클라이언트는 재시도(retry) 로직을 포함하지 않는다. 재시도는 호출자 책임이다.
- SSE 재연결은 `EventSource` 내장 동작에 의존한다. 커스텀 backoff는 구현하지 않는다.
- heartbeat 프레임(`: heartbeat`)은 EventSource가 자동으로 무시하며, 별도 핸들링이 불필요하다.
- `Content-Type: application/json` 헤더는 GET 요청에도 포함되지만, 서버 동작에 영향을 주지 않는다.
