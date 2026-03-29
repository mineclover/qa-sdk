---
def:
  id: ingest-runtime-operations
  address: def_document:v2:275588
  scope: constraint
  aspect: infra_constraint
  depth: specification
  lifecycle: approved
  layer: domain
  svc: ingest-server
  tags: [observability]
  links:
    - target: ingest-infra-spec
      type: refines
---

# Ingest 런타임 운영 절차

## 목적 ^purpose

graceful shutdown과 미들웨어 적용 순서를 분리해 ingest 서비스의 운영 절차가 요청 처리 규칙과 뒤섞이지 않게 만든다.

## 구성 ^overview

- **Graceful Shutdown** — SIGTERM/SIGINT 수신 시 순차적 리소스 정리.
- **런타임 모드** — `server` (기본) 또는 `worker` (BullMQ 워커 전용).
- **Store Driver 선택** — `STORE_DRIVER` 환경변수로 저장소 어댑터 결정.
- **선택적 기능** — Convergence, Transition Engine, 패턴 분류의 동적 활성화.

## Graceful Shutdown 절차

```
SIGTERM/SIGINT 수신
  │
  ├─ 1. appLifecycle.beginShutdown()  → 새 요청 차단 (503)
  ├─ 2. server.close()               → 새 연결 수락 중단
  ├─ 3. closeIdleConnections()        → 유휴 연결 종료
  ├─ 4. streamConnectionRegistry.shutdown("server_shutdown")  → SSE 연결 정리
  ├─ 5. recordStreamBroker.shutdown() → 스트림 브로커 정리
  ├─ 6. Promise.all([
  │       serverClosed,               → HTTP 서버 종료 대기
  │       waitForInFlightIngestRequests  → 진행 중 요청 완료 대기
  │     ])
  ├─ 7. closeDb()
  │   ├─ convergenceScheduler.stop()
  │   ├─ convergencePipeline.close()
  │   ├─ cleanupScheduler.stop()
  │   ├─ taskQueue.close()
  │   └─ closeClient(TRACE_DATABASE_URL)
  └─ 8. process.exit(0)
```

**타임아웃:** 30초 (DEFAULT_SHUTDOWN_TIMEOUT_MS). 초과 시:

- 에러 로그 (활성 SSE 수, 진행 중 요청 수)
- `closeAllConnections()` 강제 종료
- `process.exit(1)`

## Worker 모드 운영

`ingest-server worker` 인자로 시작:

- HTTP 서버 없이 BullMQ 워커만 실행
- 필수: `TASK_QUEUE_ENABLED=true` + `REDIS_URL`
- `installWorkerShutdown`: taskQueue.close() + DB 연결 종료

## Store Driver 선택

두 가지 경로로 저장소를 결정한다.

### 경로 1: server.ts 직접 분기 (현행)

`server.ts`의 `createRuntimeStores()`가 `TRACE_DATABASE_URL` 유무로 분기:

| 조건 | 저장소 구성 | 용도 |
|------|-----------|------|
| `TRACE_DATABASE_URL` 미설정 | 전체 `InMemory*Store` (8종) | 개발/데모 |
| `TRACE_DATABASE_URL` 설정 | `createDb()` + 전체 `Drizzle*Store` (8종) | 운영 (PostgreSQL) |

**pg 모드 Store 구성:**
- `DrizzleDlqStore`, `DrizzleGraphStore`, `DrizzleRecordStore`
- `DrizzleScenarioSpecStore`, `DrizzleSessionStore`, `DrizzleTraceStore`
- `DrizzleTransmissionStore`, `DrizzleVerdictStore`

**memory 모드:** 동일 인터페이스의 `InMemory*Store` 사용 (DB 없이 동작).

### 경로 2: store-factory.ts (STORE_DRIVER)

`stores/store-factory.ts`의 `createStores(opts)` — `STORE_DRIVER` 환경변수 기반 자동 생성.

| 드라이버 | 저장소 구성 | 비고 |
|---------|-----------|------|
| `memory` (기본) | 전체 InMemory (8종) | dynamic import, DB 없이 동작 |
| `pg` | Drizzle + PostgreSQL (8종) | `TRACE_DATABASE_URL` 필수 |
| `d1` | D1/SQLite core 4종 + 나머지 InMemory | Record, Trace, Session, Verdict만 D1 |
| `clickhouse` | ClickHouse RecordStore + 나머지 InMemory | RecordStore만 ClickHouse |

**D1 모드 store 매핑:**

| Store | 구현 | 비고 |
|-------|------|------|
| `RecordStore` | `D1RecordStore` | SQL DDL 기반 |
| `TraceStore` | `D1TraceStore` | SQL DDL 기반 |
| `SessionStore` | `D1SessionStore` | SQL DDL 기반 |
| `VerdictStore` | `D1VerdictStore` | SQL DDL 기반 |
| `TransmissionStore` | `InMemoryTransmissionStore` | D1 구현 후순위 |
| `GraphStore` | `InMemoryGraphStore` | D1 구현 후순위 |
| `ScenarioSpecStore` | `InMemoryScenarioSpecStore` | D1 구현 후순위 |
| `DlqStore` | `InMemoryDlqStore` | D1 구현 후순위 |

**ClickHouse 모드:** `ClickhouseRecordStore`만 구현, 나머지 7종 InMemory.

### 트랜잭션 경계

`TRACE_DATABASE_URL` 설정 시:
- `withTraceTransaction`으로 trace + session + record를 Drizzle 트랜잭션으로 원자적 저장
- 트랜잭션 내에서 별도 `DrizzleRecordStore(tx)`, `DrizzleTraceStore(tx)`, `DrizzleSessionStore(tx)` 인스턴스 생성

미설정 시: 각 store에 개별 호출 (InMemory 환경).

## 선택적 기능 활성화

| 기능 | 환경변수 | 동적 import | 실패 처리 |
|------|---------|------------|----------|
| Convergence Pipeline | `CONVERGENCE_ENABLED` | `spec-core/convergence`, `spec-core/dkg` | error 로그 후 disabled |
| 패턴 분류 | `PATTERN_CLASSIFICATION_ENABLED` | `spec-core/convergence.classifyPattern` | warn 로그 후 skip |
| Transition Engine | `TRANSITION_ENGINE_ENABLED` | `spec-core/transition` | error 로그 후 disabled |
| gRPC Debug Server | `GRPC_PORT` | `grpc/debug-server.js` | warn 로그 후 skip |
| Cleanup Scheduler | `CLEANUP_CRON_ENABLED` | 내부 | disabled |

- 모든 선택적 기능은 동적 import + try/catch로 격리
- 기능 실패가 서비스 시작을 차단하지 않음 (에러 격리 원칙)

## 데이터 정리 (Cleanup)

`CLEANUP_CRON_ENABLED=true` 시 주기적 만료 데이터 정리:

- `cleanupExpiredData()` — 만료된 trace, record, session 삭제
- `TRACE_DATABASE_URL` 필수 (InMemory에서는 동작하지 않음)
- cron 스케줄러로 주기적 실행

## Metrics 수집

`createMetricsCollector()`로 내부 메트릭 수집:

- `ingest_requests_total` — 요청 수 (status별)
- `ingest_records_total` — 수집된 레코드 수
- `/v1/metrics` 엔드포인트로 Prometheus 형식 노출

## 환경 변수 전체 목록

`config/env.ts` zod 스키마로 검증. `process.env` 직접 접근 금지.

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `STORE_DRIVER` | `memory` | 저장소 드라이버 (`memory`/`pg`/`d1`/`clickhouse`) |
| `TRACE_DATABASE_URL` | - | PostgreSQL URL (`STORE_DRIVER=pg` 시 필수) |
| `SQLITE_PATH` | - | SQLite 경로 (`STORE_DRIVER=d1` 시 Node.js 로컬용) |
| `REDIS_URL` | - | Redis URL (`TASK_QUEUE_ENABLED=true` 시 필수) |
| `PORT` | `3200` | 서비스 포트 |
| `CORS_ORIGIN` | `*` | CORS 허용 origin |
| `CLEANUP_CRON_ENABLED` | `false` | 만료 데이터 정리 스케줄러 |
| `TASK_QUEUE_ENABLED` | `false` | BullMQ Phase 2 큐 사용 여부 |
| `SSE_SUBSCRIPTION_LIMIT` | `10` | SSE 구독 제한 수 |
| `DLQ_MAX_RETRY_ATTEMPTS` | `3` | DLQ 최대 재시도 횟수 |
| `RATE_LIMIT_WINDOW_MS` | `60000` | 슬라이딩 윈도우 크기 (ms) |
| `RATE_LIMIT_MAX_REQUESTS` | `100` | 윈도우당 최대 POST 요청 수 |
| `WORKER_CONCURRENCY` | `5` | BullMQ 워커 동시 처리 수 |
| `REGISTRY_URL` | - | registry-service URL (이벤트 스키마 검증) |
| `REGISTRY_VALIDATION_MODE` | `warn` | 검증 모드 (`strict`/`warn`/`off`) |
| `CONVERGENCE_ENABLED` | `false` | Convergence Pipeline 활성화 |
| `CONVERGENCE_FLUSH_INTERVAL_MS` | `60000` | convergence flush 주기 (ms) |
| `CONVERGENCE_RECORD_THRESHOLD` | `100` | convergence 자동 flush 임계치 (레코드 수) |
| `CONVERGENCE_DKG_SQLITE_PATH` | - | DKG SQLite 경로 |
| `CONVERGENCE_SCHEDULE_INTERVAL_MS` | `300000` | convergence 스케줄 주기 (5분) |
| `CONVERGENCE_REGISTRY_URL` | - | convergence용 registry URL |
| `CATALOG_ID` | `demo` | catalog ID |
| `PATTERN_CLASSIFICATION_ENABLED` | `false` | 패턴 분류 활성화 |
| `DECODE_SERVICE_URL` | - | decode-service URL (Phase 2 주소 디코딩) |
| `TRANSITION_ENGINE_ENABLED` | `false` | Transition Engine 활성화 |
| `TRANSITION_VIOLATION_MODE` | `warn` | 전이 위반 처리 모드 (`strict`/`warn`) |
| `TRANSITION_STATE_PATH` | - | 전이 상태 파일 경로 |

**zod 교차 검증:** `TASK_QUEUE_ENABLED=true` + `REDIS_URL` 미설정 → 검증 에러.

## createApp 팩토리

`createApp(deps)` — Hono 앱 인스턴스를 생성하는 팩토리 함수.

**라우트 구성:**

| 경로 | 핸들러 | 설명 |
|------|--------|------|
| `/health`, `/health/live`, `/health/ready` | `createHealthRoutes` | liveness/readiness probe |
| `POST /v1/ingest` | `createIngestRoutes` | 이벤트 수집 (Phase 1 + 2) |
| `/v1/traces/:traceId/diagram` | `createTraceDiagramRoutes` | trace 다이어그램 |
| `/v1/traces`, `/v1/sessions`, `/v1/records` | `createQueryRoutes` | 조회 API |
| `/v1/stream/*` | `createStreamRoutes` | SSE 스트림 |
| `/v1/scenarios` | `createScenarioRoutes` | 시나리오 CRUD |
| `/v1/sessions/*` | `createSessionRoutes` | 세션 관리 |
| `/v1/verdicts` | `createVerdictRoutes` | verdict 조회/재계산 |
| `/v1/insights/*` | `createInsightsRoutes` | 인사이트 (correlation, service-prefixes) |
| `/v1/labels` | `createLabelsRoutes` | 라벨링 API |
| `/v1/admin/dlq` | `createDlqRoutes` | DLQ 관리 |
| `/v1/admin/cleanup` | `createCleanupRoutes` | 데이터 정리 |
| `/v1/metrics` | `createMetricsRoutes` | Prometheus 메트릭 |
| `/v1/patterns` | `createPatternRoutes` | 패턴 분류 결과 |
| `/v1/ws` | WebSocket | 실시간 record 스트림 |
| `/v1/debug-ws` | WebSocket | 디버그용 실시간 스트림 |

## DEMO_SCENARIOS 자동 등록

서버 시작 시 `demo-snapshot`의 `DEMO_SCENARIOS`를 `scenarioSpecStore.upsert()` 로 자동 등록한다.
`demo-snapshot` 미사용 환경에서는 무시 (try-catch 격리).
