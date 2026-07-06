---
def:
  tier: component
  id: gate-flow
  address: def_document:v2:137349
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: approved
  layer: domain
  svc: gate-service
  tags: [security]
  links:
    - target: gate-api
      type: refines
    - target: gate-engine-func
      type: refines
sources:
  - packages/gate-service/src/lib/gate-service.ts
  - packages/gate-service/src/routes/gate.ts
  - packages/gate-service/src/services/cache-invalidation.ts
  - packages/gate-service/src/middleware/error-handler.ts
  - packages/gate-service/src/server.ts
  - packages/gate-service/src/worker.ts
  - packages/index-meta/src/gate-engine.ts
  - packages/index-meta/src/gate-aware-query.ts
---
# Gate 운영 흐름

## 목적 ^purpose

encode, 상태변경, query 3개 경로에서 gate 상태가 어떤 순서로 확인되고 전파되는지를 정의한다.

## 구성 ^overview

3개 경로: encode(checkGate→허용/차단), 상태변경(recompute→cascade→캐시무효화), query(filterRanges).

## 흐름 1: encode 경로

```
클라이언트 → encode 요청
  → checkGate(prefix, version, address)
  → state = active? → 허용
  → state = open?   → 허용 (shouldVerify=true)
  → state = inactive/reserved? → 차단 + 진단 코드 반환
```

## 흐름 2: 상태 변경 전파

```
release/setFlag 이벤트 발생
  → recompute(prefix, version) 트리거
  → DimStateSpec 재생성
  → AddressStateCacheRecord 갱신
  → composite 참조 그래프 탐색
  → cascadeRecompute → 상위 prefix도 갱신
  → 캐시 무효화 알림 (미구현: MQ 경로)
```

## 흐름 3: query 경로

```
query-service → gateFilterRanges(prefix, version, ranges, mode)
  → gate 차단 범위 제거
  → 유효 범위만 반환
```

## createGateService 팩토리

`createGateService(deps)` — `GateService` 인스턴스를 생성하는 팩토리 함수.

| 의존성 | 타입 | 필수 | 설명 |
|--------|------|------|------|
| `addressStateStore` | `AddressStateStore` | - | 상태 캐시 저장소. 미지정 시 `InMemoryAddressStateStore` |
| `gateEngine` | `GateEngine \| null` | - | 엔진 인스턴스. 미지정 시 `null` (읽기 전용 모드) |

**제약:** `gateEngine` 제공 시 `addressStateStore`도 필수. 미지정이면 에러.

**GateService 동작 모드:**

- `engine = null` (기본): 읽기 전용 캐시. `recompute`/`cascadeRecompute` 호출 시 no-op.
- `engine != null`: 상태 재계산 기능 활성화. `index-meta` 패키지의 GateEngine 인스턴스 필요.

record 미존재 시 `checkGate` → `ACTIVE_GATE_RESULT` 반환 (fail-open).

## 환경 변수

`config/env.ts` zod 스키마로 검증. `process.env` 직접 접근 금지.

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `PORT` | `3400` | 서비스 포트 |
| `SQLITE_DRIVER` | `node` | SQLite 드라이버 (`node` / `better`) |
| `SQLITE_PATH` | `data/gate-service.sqlite` | AddressStateStore SQLite 경로 |

## 미들웨어 스택

```
1. requestId (모든 경로) — X-Request-Id 전파 (기존 헤더 우선, 없으면 UUID 발급)
... 라우트 핸들러 ...
N. errorHandler (onError) — AppError, ZodError, IndexMetaError 분기 처리
```

**에러 핸들러 분류:**

| 에러 타입 | HTTP | 처리 |
|-----------|------|------|
| `AppError` | 에러 코드별 (400/404/500) | `{ error: { code, message } }` |
| `ZodError` | 400 | path별 메시지 결합 |
| `IndexMetaError` | `fromIndexMetaError` 변환 | AppError로 래핑 |
| 기타 | 500 | `INTERNAL_ERROR` + pino error 로그 |

## 배포 토폴로지

### Standalone (Node.js)

```
server.ts
  → createSqliteDriver(SQLITE_DRIVER, SQLITE_PATH)
  → SqlAddressStateStore(driver)
  → createGateService({ addressStateStore })
  → createApp({ gateService, logger })
  → serve(port: 3400)
  → installSimpleShutdown (SIGTERM/SIGINT 처리)
```

- `ServiceBootConfig`: `createServiceBootConfig("gate-service")`
- `warnPortConflict`: 포트 충돌 경고 (다른 서비스와 겹칠 때)
- ownedPrefixes: `[]` — 읽기 전용 서비스, 이벤트 생산 없음

### Cloudflare Workers

```
worker.ts
  → D1SqlDriver(env.DB) — D1 바인딩
  → SqlAddressStateStore(driver)
  → createApp({ addressStateStore })
```

- `gateEngine` 미지정 → 읽기 전용 모드 (Worker에서는 recompute 불필요)
- 요청마다 드라이버/스토어 인스턴스 생성 (Workers 모델)

## 라우트 구성

| 경로 | 핸들러 | 설명 |
|------|--------|------|
| `GET /health` | `createHealthRoutes` | engine 설정 여부 + uptime + version |
| `GET /metrics` | `createMetricsRoutes` | Prometheus 형식 (uptime, heap, rss, engine 상태) |
| `/gate/*` | `createGateRoutes` | check, classify, recompute, cascade, filter-ranges, state |
