---
def:
  tier: component
  id: query-gate-integration
  address: def_document:v2:138370
  scope: flow
  aspect: relation
  depth: specification
  lifecycle: approved
  layer: mediation
  svc: query-service
  tags: [runtime, observability, testing]
  links:
    - target: gate-api
      type: depends_on
    - target: query-api
      type: refines
sources:
  - packages/query-service/src/app.ts
  - packages/query-service/src/server.ts
  - packages/query-service/src/worker.ts
  - packages/query-service/src/lib/query-service.ts
  - packages/query-service/src/lib/gate-client.ts
  - packages/query-service/src/routes/query.ts
  - packages/query-service/src/config/env.ts
  - packages/query-service/src/app.test.ts
  - packages/query-service/src/lib/gate-client.test.ts
---
# Query-Gate 통합

## 목적 ^purpose

질의 결과에 gate 상태를 합성하는 통합 경로. gateMode(fail-open/fail-closed)와 withGate 플래그로 gate 필터 적용 여부를 제어한다.

소스: `packages/query-service/src/lib/query-service.ts`, `packages/query-service/src/lib/gate-client.ts`, `packages/query-service/src/app.ts`, `packages/query-service/src/server.ts`

## 구성 ^overview

- **HttpGateStateClient** — gate-service에서 prefix/version별 상태 범위를 HTTP로 조회.
- **NoopGateStateClient** — `createApp()`에 gateClient를 주입하지 않을 때 항상 null 반환 (gate 필터 미적용).
- **gateFailureMode** — gate 호출 실패 시 `fail-open`(허용) 또는 `fail-closed`(503 에러).
- **GateAwareResult** — 정책 해소 결과에 gate 상태를 합성한 확장 결과 타입.

## gate 상태 조회 경로

```
query-service → HttpGateStateClient
  → GET /gate/state/:prefix/:versionId (gate-service)
  → AddressStateCacheRecord | null
```

**AddressStateCacheRecord 구조:**

| 필드 | 타입 | 설명 |
|------|------|------|
| `prefix` | `string` | prefix ID |
| `versionId` | `string` | version ID |
| `specs` | `DimStateSpec[]` | dim별 상태 사양 (dimIndex, state, coords, reason) |
| `reservedRanges` | `[number, number][]` | reserved 주소 범위 |
| `inactiveRanges` | `[number, number][]` | inactive 주소 범위 |
| `openRanges` | `[number, number][]` | open 주소 범위 |
| `computedAt` | `string` | 상태 계산 시각 |

## 통합 패턴

### POST /resolve + withGate=true

1. `resolvePolicy()` — coord + rules + shape로 정책 해소 (ResolveResult)
2. `loadGateRecord()` — HttpGateStateClient로 gate 상태 조회
3. `gateAwareResolve()` — ResolveResult + address + gateRecord → GateAwareResult
4. shape 검증: 요청 shape이 registry의 WeightedIndex shape과 일치해야 함

**제약:** `withGate=true` 시 `indexId`와 `versionId` 필수.

### POST /match-ranges + gateMode

1. `matchRanges()` — partial entity 조건으로 주소 범위 매칭
2. gateMode 있으면 `loadGateRecord()` → `gateFilterRanges()` 적용
3. gateMode null이면 gate 필터 미적용

## 실패 모드

| gateFailureMode | gate 호출 성공 | gate 호출 실패 |
|:---|:---|:---|
| `fail-open` | gate 상태 합성 | warning 로그 + null 반환 (gate 없이 진행) |
| `fail-closed` | gate 상태 합성 | 503 SERVICE_UNAVAILABLE 에러 |

- fail-open이 기본값 (ADR: Fail-open 원칙)
- 에러 격리: gate 실패가 질의 자체를 차단하지 않음 (fail-open 시)

## Runtime 배선

- Node.js `server.ts`는 `GATE_SERVICE_URL` env 기본값으로 `HttpGateStateClient`를 생성한다.
- `createApp()` 직접 호출 또는 테스트에서 `gateClient`를 생략하면 `NoopGateStateClient`를 사용한다.
- Worker `worker.ts`는 현재 `GATE_SERVICE_URL`을 Env 타입으로 받지만 `HttpGateStateClient`를 생성하지 않는다. 따라서 Worker 배포의 gate 통합은 아직 Node.js 배선과 동일하지 않다.

## Transition State Store (선택적)

query-service는 `@qa-sdk/spec-core/transition`이 설치된 환경에서 시점 replay(`/state/:c/:r/at`)용 엔진만 선택적으로 초기화한다. 현재 상태 store는 만들지 않는다 — query-service에는 전이를 기록하는 쓰기 경로가 없어 빈 store가 항상 `{}`를 돌려주기 때문이다.

- `/state/:c/:r`, `/state/:c/:r/history`, `/transitions?context_id=`는 store가 주입되지 않으면 501
- `/transitions`에는 전이 목록만 마운트한다 (`createTransitionRoutes`) — `/state` 라우트를 중복 마운트하지 않는다
- 동적 import (`Function('return import(...)')()`) → 미설치 환경에서는 무시 (에러 격리)
- `InMemoryStateStore`는 `get`/`set`/`snapshot` 인터페이스 충족

## createApp 팩토리

`createApp(deps)` — Hono 앱 인스턴스를 생성하는 팩토리 함수.

| 의존성 | 타입 | 필수 | 기본값 |
|--------|------|------|--------|
| `policyRuleStore` | `PolicyRuleStore<unknown>` | - | `InMemoryPolicyRuleStore` |
| `prefixRegistry` | `PrefixRegistry` | - | `InMemoryPrefixRegistry` |
| `queryService` | `QueryLookupService` | - | `createQueryService(deps)` |
| `metaRegistry` | `MetaRegistry` | - | - |
| `defaultStrategy` | `ConflictStrategy` | - | `most-specific` |
| `gateClient` | `GateStateClient` | - | `NoopGateStateClient` |
| `gateFailureMode` | `fail-open \| fail-closed` | - | `fail-open` |
| `stateRoutes` | `StateRouteDeps` | - | - |

**GateStateClient 구현:**

| 클래스 | 설명 |
|--------|------|
| `HttpGateStateClient` | `GATE_SERVICE_URL` 기반. `GET /gate/state/:prefix/:versionId` 호출 |
| `NoopGateStateClient` | 항상 `null` 반환. gate-service 미설정 환경용 |

gate-service 응답은 `gateStateRecordSchema` (zod)로 검증 후 반환.

## 미들웨어 스택

```
1. requestId (모든 경로) — X-Request-Id 전파
... 라우트 핸들러 ...
N. errorHandler (onError) — AppError, ZodError 분기 처리
```

## 라우트 구성

| 경로 | 핸들러 | 설명 |
|------|--------|------|
| `GET /health` | `createHealthRoutes` | store 종류 + uptime + version |
| `GET /metrics` | `createMetricsRoutes` | Prometheus 형식 (uptime, heap, rss) |
| `POST /rules`, `GET /rules`, `PUT /rules/:id`, `DELETE /rules/:id` | `createRuleRoutes` | PolicyRule CRUD |
| `POST /resolve`, `POST /match-ranges`, `POST /compose-query` 등 | `createQueryRoutes` | 좌표 질의 API |
| `/state` | `createStateRoutes` | 전이 상태 조회·시점 replay (선택적) |
| `/transitions` | `createTransitionRoutes` | context별 전이 목록 (선택적) |

## SQLite 상태 저장소 초기화

```
server.ts
  → createSqliteDriver({ driver: SQLITE_DRIVER, path: SQLITE_PATH, schema: null })
  → SqlPolicyRuleStore<unknown>(driver)
```

- `SqlPolicyRuleStore`는 DDL 자동 실행 — 테이블 미존재 시 생성
- `InMemoryPrefixRegistry`: 런타임에서 prefix 메타데이터 동적 등록
- `MetaRegistry({ dims: {}, indices: {} })`: 빈 상태로 시작 (필요 시 동적 등록)

## 배포 토폴로지

### Standalone (Node.js)

```
server.ts
  → createSqliteDriver(SQLITE_DRIVER, SQLITE_PATH)
  → SqlPolicyRuleStore(driver)
  → HttpGateStateClient(GATE_SERVICE_URL) 또는 undefined
  → InMemoryStateStore (spec-core/transition 설치 시)
  → createApp(deps)
  → serve(port: 3500)
  → installSimpleShutdown (SIGTERM/SIGINT)
```

- `ServiceBootConfig`: `createServiceBootConfig("query-service")`
- `warnPortConflict`: 포트 충돌 경고

### Cloudflare Workers

```
worker.ts
  → D1SqlDriver(env.DB)
  → SqlPolicyRuleStore(driver)
  → InMemoryPrefixRegistry, MetaRegistry (빈 상태)
  → createApp({ defaultStrategy: "most-specific", gateFailureMode: "fail-open" })
```

- 현재 Worker entrypoint는 `GATE_SERVICE_URL`을 `gateClient`로 연결하지 않는다.
- transition state store 미지원 (Worker 모드)
