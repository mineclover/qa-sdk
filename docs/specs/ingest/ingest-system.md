---
def:
  id: ingest-system
  level: module
  tier: system
  address: def_document:v2:137221
  scope: flow
  aspect: process_flow
  depth: overview
  lifecycle: approved
  layer: operation
  svc: ingest-server
  tags: [structural, performance, observability, entry-point]
  links:
    - target: ingest-api-system
      type: depends_on
    - target: query-api-spec
      type: contains
    - target: scenario-api-spec
      type: contains
    - target: stream-api-spec
      type: contains
    - target: verdict-api-spec
      type: contains
    - target: admin-api-system
      type: depends_on
    - target: record-spec
      type: contains
    - target: trace-spec
      type: contains
    - target: session-spec
      type: contains
    - target: pipeline-phase-flow
      type: contains
    - target: ingest-infra-system
      type: depends_on
    - target: browser-session-spec
      type: contains
    - target: dlq-store-spec
      type: contains
    - target: transmission-spec
      type: contains
    - target: insights-api-spec
      type: contains
    - target: storage-system
      type: depends_on
---

# Ingest 시스템

## 목적 ^purpose

SDK에서 전송된 이벤트를 수신, 저장, 재구성, 판정하는 수집 파이프라인.

## 구성 ^overview

- `ingest-api-system`: SDK로부터 Transmission Envelope을 수신하고 저장/후속 파이프라인으로 넘기는 수집 API 그룹.
- `query-api-spec`: trace, session, record를 cursor 기반 pagination으로 조회하는 읽기 전용 API.
- `scenario-api-spec`: ScenarioSpec CRUD — 시나리오 스펙 등록, 조회, 삭제.
- `stream-api-spec`: 특정 trace 또는 session을 SSE로 구독하여 새 이벤트를 실시간 수신.
- `verdict-api-spec`: trace와 session 단위의 시나리오 verdict를 조회하고 강제 재계산하는 서버 API 계약과 의존 범위를 정의한다.
- `admin-api-system`: 운영 관리용 내부 엔드포인트와 DLQ 조작 규칙을 분리한 그룹.
- `record-spec`: core package의 canonical event record 구조와 저장/조회 동작을 정의한다.
- `trace-spec`: trace_id 단위 메타데이터 집계와 reconstruction 상태 관리.
- `session-spec`: qa_session_id 기반 세션 식별.
- `ingest-pipeline-flow`: Phase 1(동기 저장) + Phase 2(비동기 재구성/판정) 2단계 파이프라인 처리 흐름.
- `ingest-infra-system`: health check, rate limiting, request ID, graceful shutdown 등 ingest 인프라 제약 그룹.
- `browser-session-spec`: 브라우저 탭 범위의 세션을 `sessionStorage`에 영속화한다.
- `dlq-store-spec`: reconstruction / verdict 후처리 실패를 적재하는 dead-letter queue 포트 계약.
- `transmission-spec`: SDK가 전송하는 배치 단위와 수신 메타데이터 감사 저장소.

## 운영 개요

### 서비스 정체성

- `ServiceBootConfig`: `createServiceBootConfig("ingest-server")`
- 포트: 3200 (기본)
- 런타임 모드: `server` (기본) 또는 `worker` (BullMQ 전용)

### 런타임 모드

| 모드 | 진입 | 설명 |
|------|------|------|
| `server` | `ingest-server` (인자 없음) | HTTP 서버 + SSE + WebSocket + Phase 2 인라인/큐 |
| `worker` | `ingest-server worker` | HTTP 서버 없이 BullMQ 워커만 실행 |

### 서비스 의존

```
ingest-server
  → registry-service (이벤트 스키마 검증, REGISTRY_URL 설정 시)
  → decode-service (Phase 2 주소 디코딩, DECODE_SERVICE_URL 설정 시)
  → Redis (BullMQ 큐, TASK_QUEUE_ENABLED + REDIS_URL 설정 시)
  ← browser-sdk (POST /v1/ingest)
  ← CLI (POST /v1/ingest)
```

### 선택적 기능 의존 체인

```
CONVERGENCE_ENABLED
  → spec-core/convergence + spec-core/dkg (동적 import)
  → CONVERGENCE_DKG_SQLITE_PATH 또는 CONVERGENCE_REGISTRY_URL
  → PATTERN_CLASSIFICATION_ENABLED (선택적 하위 기능)

TRANSITION_ENGINE_ENABLED
  → spec-core/transition + demo-snapshot (동적 import)

GRPC_PORT
  → grpc/debug-server.js + @grpc/grpc-js (동적 import)
```

- 모든 선택적 기능은 dynamic import + try-catch로 격리
- 기능 실패가 서비스 시작을 차단하지 않음 (에러 격리 원칙)

## gRPC Debug Server

개발 환경 전용 실시간 이벤트 디버깅 서버. `GRPC_PORT` 환경변수 설정 시 활성화 (기본 50051).

### 프로토콜

`proto/debug.proto` — `qa.debug.DebugService`. `@grpc/grpc-js` + `@grpc/proto-loader` 동적 import.

### RPC 메서드

| RPC | 유형 | 설명 |
|-----|------|------|
| `StreamEvents` | 양방향 스트리밍 | 클라이언트가 `DebugCommand` 전송, 서버가 `EventRecord` 스트림 반환. `RecordStreamBroker.subscribeToScenario("*")`로 전체 이벤트 구독 |
| `GetActiveTraces` | 단방향 | `TraceStore.findUnreconstructed(limit)`로 미완료 trace 조회. limit 기본 50 |
| `ResolveAddr` | 단방향 | prefix + version + address → dim 값 해석. decode-service 위임 또는 로컬 catalog 사용 |
| `Subscribe` | 서버 스트리밍 | `StreamFilter` 기반 이벤트 구독. eventKeys, serviceIds, traceId 필터 지원 |

### 의존

```
GrpcDebugServerDeps
  ├── recordStreamBroker: RecordStreamBroker (필수)
  ├── traceStore: TraceStore (선택 — 없으면 GetActiveTraces가 빈 배열)
  ├── logger: pino Logger (선택)
  └── port: number (선택, 기본 50051)
```

### 프로토 메시지 구조

- **EventRecord**: logId, traceId, spanId, timestampMs, recordKind, eventKey, addressContext(map), serviceName, qaSessionId, payloadJson
- **DebugCommand**: Subscribe / Unsubscribe / GetActiveTraces / ResolveAddress / SetFilter / Ping (oneof)
- **StreamFilter**: prefixIds, serviceIds, eventKeys, traceId, sessionId, decodeAddresses, maxRecordsPerSec
- **TraceInfo**: traceId, sessionId, serviceName, recordCount, firstTimestampMs, lastTimestampMs

### 변환 함수

`toGrpcEvent(record)` — 내부 EventRecord(camelCase/snake_case 혼용) → gRPC EventRecord 정규화. 타임스탬프는 epoch ms로 변환, payload는 JSON.stringify.

### 에러 격리

- gRPC 서버 시작 실패 시 warn 로그 후 skip — HTTP 서비스에 영향 없음
- 스트림 쓰기 실패(클라이언트 종료 등)는 try-catch로 무시
- 클라이언트 종료(`end`/`error`/`cancelled` 이벤트) 시 구독 해제 보장
