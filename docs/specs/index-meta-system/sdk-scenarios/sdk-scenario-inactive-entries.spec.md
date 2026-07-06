---
def:
  id: sdk-scenario-inactive-entries
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
  - packages/index-meta/src/meta-codec.ts
  - packages/index-meta/src/meta-codec.test.ts
---
# SDK 시나리오 — inactive 항목 운영

## 목적 ^purpose

deprecated/inactive entry가 constants에서는 제외되면서도 기존 데이터의 encode/decode 호환성은 유지되는지 검증한다.

## 상태

implemented

## 구성 ^overview

- constants 제외
- entries 보존
- decode 보존
- fullView에서 normal 위치 유지

## 검증 포인트

- inactive entry는 constants에 나오지 않음
- 기존 payload decode는 여전히 가능
- fullView에서는 값이 존재하는 정규 위치로 유지
