---
def:
  id: gate-system
  level: module
  tier: system
  address: def_document:v2:68631
  scope: feature
  aspect: func_def
  depth: overview
  lifecycle: approved
  layer: domain
  svc: gate-service
  tags: [structural, security, entry-point]
  links:
    - target: gate-api
      type: depends_on
    - target: gate-state-model
      type: contains
    - target: gate-state-model-rule
      type: traces_to
    - target: gate-engine-func
      type: contains
    - target: gate-flow
      type: contains
    - target: gate-constraint
      type: contains
    - target: gate-scenario
      type: contains
    - target: gate-engine-group
      type: depends_on
---

# Gate 시스템

## 목적 ^purpose

주소 공간의 물리적 유효성을 관리하여 encode/decode 가능 여부를 결정하는 시스템.
dim별 상태(active/inactive/open/reserved)를 자동 계산하고, 변경을 cascade 전파한다.

## 구성 ^overview

- `gate-api`: RPC 엔드포인트 명세.
- `gate-state-model`: 주소 공간의 4가지 상태(active, inactive, open, reserved)와 전이 규칙을 정의한다.
- `gate-engine-func`: 주소 상태를 자동으로 계산하고, 변경을 전파하고, 질의에 gate 필터를 적용하는 엔진.
- `gate-flow`: encode, 상태변경, query 3개 경로에서 gate 상태가 어떤 순서로 확인되고 전파되는지를 정의한다.
- `gate-constraint`: gate 시스템에 부과되는 기술적 불변 조건과 보안/성능 제약을 정의한다.
- `gate-scenario`: gate 시스템의 핵심 경로를 검증하는 시나리오와 기대 결과를 정의한다.
모든 멤버에 security concern이 전파된다.

## 운영 개요

### 서비스 정체성

- `ServiceBootConfig`: `createServiceBootConfig("gate-service")`
- ownedPrefixes: `[]` — 읽기 전용 캐시, 이벤트 생산 없음
- 포트: 3400 (기본)

### 저장소 레이어

| 환경 | 드라이버 | 저장소 |
|------|---------|--------|
| Node.js (Standalone) | `createSqliteDriver` (`node` / `better`) | `SqlAddressStateStore` |
| CF Workers | `D1SqlDriver` (D1 바인딩) | `SqlAddressStateStore` |
| 테스트 | - | `InMemoryAddressStateStore` |

### 서비스 의존

```
gate-service (읽기 전용)
  ← query-service (HttpGateStateClient로 gate 상태 조회)
  ← encode 경로 (checkGate 호출)
```

- gate-service 자체는 외부 서비스를 호출하지 않음 (독립 운영)
- 상태 계산(recompute)은 `index-meta` 패키지의 GateEngine이 담당 — gate-service에 engine 인스턴스가 없으면 읽기 전용
