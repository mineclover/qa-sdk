---
def:
  id: query-system
  tier: layout
  address: def_document:v2:412686
  scope: interface
  aspect: query_contract
  depth: overview
  lifecycle: approved
  layer: mediation
  svc: query-service
  tags: [structural, entry-point]
  links:
    - target: query-api
      type: refs
    - target: query-rules
      type: refs
    - target: query-gate-integration
      type: refs
    - target: gate-system
      type: depends_on
sources:
  - packages/query-service/src/app.ts
  - packages/query-service/src/server.ts
  - packages/query-service/src/worker.ts
  - packages/query-service/src/config/env.ts
  - packages/query-service/src/routes/query.ts
  - packages/query-service/src/routes/rules.ts
  - packages/query-service/src/routes/state.ts
  - packages/query-service/src/lib/query-service.ts
  - packages/query-service/src/lib/rule-service.ts
  - packages/query-service/src/stores/sql-policy-rule-store.ts
  - packages/query-service/src/app.test.ts
---

# Query 시스템

## 목적 ^purpose

관계형 질의, 정책 해소, gate 통합을 제공하는 중앙 질의 서비스. 규칙 관리 + 질의 실행 + gate 상태 합성을 단일 진입점으로 제공한다.

소스: `packages/query-service/src/app.ts`, `packages/query-service/src/server.ts`, `packages/query-service/src/worker.ts`, `packages/query-service/src/lib/query-service.ts`

## 구성 ^overview

- `query-api`: 좌표 질의를 수행하는 REST 엔드포인트.
- `query-rules`: PolicyRule의 CRUD와 충돌 전략을 정의한다.
- `query-gate-integration`: 질의 결과에 gate 상태를 합성하는 통합 경로.
- `query-rule-migration`: index version 변경 시 StoredPolicyRule pattern을 새 version으로 변환한다.
- `query-state-replay`: 이벤트 레코드를 시점 기준으로 replay해 state snapshot을 재구성한다.

## 운영 개요

### 서비스 정체성

- `ServiceBootConfig`: `createServiceBootConfig("query-service")`
- ownedPrefixes: `[]` — 질의 전용, 이벤트 생산 없음
- 포트: 3500 (기본)

### 저장소 레이어

| 환경 | 드라이버 | PolicyRuleStore |
|------|---------|-----------------|
| Node.js | `createSqliteDriver` (`node`/`better`) | `SqlPolicyRuleStore` |
| CF Workers | `D1SqlDriver` | `SqlPolicyRuleStore` |
| 테스트 | - | `InMemoryPolicyRuleStore` |

### 서비스 의존

```
query-service
  → gate-service (HttpGateStateClient, GATE_SERVICE_URL 설정 시)
  → spec-core/transition (선택적, InMemoryStateStore)
```

- Node.js server는 `GATE_SERVICE_URL` env 기본값으로 gate-service dev URL 또는 `http://localhost:3400`을 사용한다.
- `createApp()` 직접 호출 시 `gateClient`를 주입하지 않으면 `NoopGateStateClient`를 사용한다.
- Worker entrypoint는 현재 `GATE_SERVICE_URL`을 Env 타입으로 받지만 `gateClient`를 배선하지 않아 `NoopGateStateClient` 경로로 동작한다.
- gate 호출 실패 시 `gateFailureMode`에 따라 fail-open 또는 fail-closed

### 환경 변수

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `PORT` | `3500` | 서비스 포트 |
| `SQLITE_DRIVER` | `node` | SQLite 드라이버 (`node` / `better`) |
| `SQLITE_PATH` | `data/query-service.sqlite` | PolicyRuleStore SQLite 경로 |
| `GATE_SERVICE_URL` | gate-service dev URL 또는 `http://localhost:3400` | Node.js gate-service URL |
| `QUERY_DEFAULT_STRATEGY` | `most-specific` | 기본 충돌 해소 전략 |
| `QUERY_GATE_FAILURE_MODE` | `fail-open` | gate 호출 실패 시 동작 |
| `RECORD_STORE_PATH` | - | state replay용 event_records DB 경로. 미설정 시 `SQLITE_PATH` 공유 |
