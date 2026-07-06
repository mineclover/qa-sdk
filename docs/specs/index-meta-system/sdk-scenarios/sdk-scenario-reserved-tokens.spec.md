---
def:
  id: sdk-scenario-reserved-tokens
  tier: component
  scope: feature
  aspect: scenario
  depth: validation
  svc: index-meta
  lifecycle: approved
  layer: domain
  tags: [testing]
  links:
    - target: sdk-scenarios
      type: refines
    - target: sdk-system
      type: traces_to
sources:
  - packages/index-meta/src/index-sdk.ts
  - packages/index-meta/src/index-sdk.test.ts
---
# SDK 시나리오 — reservedTokens 오버라이드

## 목적 ^purpose

테이블별 커스텀 reserved token 집합을 설정했을 때 constants 제외 대상과 fullView 분류가 의도대로 동작하는지 검증한다.

## 상태

implemented

## 구성 ^overview

- reservedTokens 오버라이드
- constants 필터링
- fullView 분류 제어

## 검증 포인트

- 테이블별 reserved token 세트가 기본값을 덮어씀
- constants는 오버라이드된 reserved token을 제외
- fullView는 reserved/normal/empty를 맞게 분류
