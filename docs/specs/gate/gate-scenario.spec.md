---
def:
  tier: component
  id: gate-scenario
  address: def_document:v2:70021
  scope: feature
  aspect: scenario
  depth: validation
  lifecycle: approved
  layer: domain
  svc: gate-service
  tags: [testing]
  links:
    - target: gate-engine-func
      type: traces_to
    - target: gate-api
      type: traces_to
sources:
  - packages/gate-service/src/app.test.ts
  - packages/gate-service/src/services/consistency.test.ts
  - packages/gate-service/src/services/cache-invalidation.test.ts
  - packages/index-meta/src/gate-engine.test.ts
  - packages/index-meta/src/gate-aware-query.test.ts
---
# Gate 테스트 시나리오

## 목적 ^purpose

gate 시스템의 핵심 경로를 검증하는 시나리오와 기대 결과를 정의한다.

## 구성 ^overview

5개 시나리오: 정상 encode, inactive dim 차단, composite cascade 전파, fail-open 안전장치, filterRanges 범위 필터.

## 변경 트리거 ^update-trigger

이 시나리오는 다음 문서가 변경될 때 재검토가 필요하다:
- gate-api: 엔드포인트 요청/응답 스키마 변경 시
- gate-engine-func: 계산 로직 변경 시
- gate-constraint: 불변 조건 변경 시 (특히 fail-open, composite AND)

## 시나리오 1: 정상 encode

- 전제: prefix "tracking" v2, 주소 42, dim 모두 active
- 기대: checkGate → { allowed: true, state: "active", shouldVerify: false }

## 시나리오 2: inactive dim이 있는 경우

- 전제: dim_a = inactive (entity "admin" 비활성)
- 기대: checkGate → { allowed: false, state: "inactive" }
- 기대: classifyAddress → "inactive"

## 시나리오 3: composite cascade

- 전제: leaf prefix "role"의 entry "admin" → inactive
- 기대: cascadeRecompute → composite "permission"에서 admin 관련 주소도 inactive

## 시나리오 4: fail-open

- 전제: gate-service 내부 에러 (store 접근 실패)
- 기대: checkGate → { allowed: true, state: "active" } + warning diagnostic

## 시나리오 5: gateFilterRanges

- 전제: ranges = [[0,100]], reserved = [[20,30]], mode = "active"
- 기대: → [[0,19], [31,100]]
