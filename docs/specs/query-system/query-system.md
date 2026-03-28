---
def:
  id: query-system
  level: unit
  address: def_document:v2:412686
  scope: interface
  aspect: api_contract
  depth: overview
  lifecycle: approved
  layer: mediation
  svc: query-service
  tags: [structural, entry-point, tier-infra]
  links:
    - target: query-api
      type: contains
    - target: query-rules
      type: contains
    - target: query-gate-integration
      type: contains
    - target: gate-system
      type: depends_on
---

# Query 시스템

## 목적 ^purpose

관계형 질의, 정책 해소, gate 통합을 제공하는 중앙 질의 서비스. 규칙 관리 + 질의 실행 + gate 상태 합성을 단일 진입점으로 제공한다.

## 구성 ^overview

- `query-api`: 좌표 질의를 수행하는 REST 엔드포인트.
- `query-rules`: PolicyRule의 CRUD와 충돌 전략을 정의한다.
- `query-gate-integration`: 질의 결과에 gate 상태를 합성하는 통합 경로.

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

- `GATE_SERVICE_URL` 미설정 → `NoopGateStateClient` (gate 통합 비활성)
- gate 호출 실패 시 `gateFailureMode`에 따라 fail-open 또는 fail-closed

### 환경 변수

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `PORT` | `3500` | 서비스 포트 |
| `SQLITE_DRIVER` | `node` | SQLite 드라이버 (`node` / `better`) |
| `SQLITE_PATH` | `data/query-service.sqlite` | PolicyRuleStore SQLite 경로 |
| `GATE_SERVICE_URL` | - | gate-service URL (gate 통합 시 필수) |
| `QUERY_DEFAULT_STRATEGY` | `most-specific` | 기본 충돌 해소 전략 |
| `QUERY_GATE_FAILURE_MODE` | `fail-open` | gate 호출 실패 시 동작 |
