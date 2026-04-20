---
def:
  tier: component
  id: scope-nesting-procedure
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: approved
  layer: domain
  tags: [structural]
  links:
    - target: scope-nesting-system
      type: refines
    - target: scope-nesting-guide
      type: depends_on
    - target: scope-nesting-validation-rules
      type: depends_on
---

# Scope Nesting 변경 절차

## 목적 ^purpose

scope 추가, 순서 변경, 제거 시 따르는 절차를 고정한다.

## 정의 ^defines

- **새 scope 추가 4단계**
- **순서 변경 사전 검증**
- **scope 제거 영향 분석**

## 소비 ^consumes

- `validateScopeNesting()` (`@qa-sdk/core`)
- `checkSwapSafety()` (`@qa-sdk/core`)
- `validateMountFlow()` (`@qa-sdk/core`)

## 새 scope 추가

1. 새 scope의 provides/consumes 계약을 선언
2. 소비하는 계약의 provider가 상위에 있는 위치에 삽입
3. `validateScopeNesting()` 실행하여 정합성 확인
4. pipe binding이 있으면 `validateMountFlow()`로 마운트 시점 검증

## 순서 변경

1. `checkSwapSafety(nesting, indexA, indexB)` 실행
2. null 반환 → 교환 안전. 적용 후 `validateMountFlow()` 재검증
3. 에러 반환 → 어떤 계약이 깨지는지 확인 (`contractId`, `scopeId`)
4. 깨지는 계약을 optional로 전환하거나 순서 변경을 포기

## scope 제거

1. 제거 대상 scope의 provides 계약 목록 확인
2. 해당 계약을 소비하는 하위 scope 파악 (descentPaths에서 consumedBy)
3. 하위가 required로 소비 → 다른 provider를 추가하거나 optional로 전환
4. 제거 후 `validateScopeNesting()` + `validateMountFlow()` 재검증
