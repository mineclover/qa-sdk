---
def:
  id: gate-scenario
  scope: feature
  aspect: scenario
  depth: validation
  lifecycle: approved
  tags: [testing]
  links:
    - target: gate-engine-func
      type: traces_to
    - target: gate-api
      type: traces_to
---
# Gate 테스트 시나리오

> 정상 encode, inactive dim, cascade, fail-open 등 gate 검증 시나리오. ^purpose

## 시나리오 1: 정상 encode ^overview

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
