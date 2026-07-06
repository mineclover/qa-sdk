---
def:
  id: sdk-scenario-cli-simulation
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
    - target: resolver-spec
      type: traces_to
sources:
  - packages/index-meta/src/index-sdk.ts
  - packages/index-meta/src/index-sdk.test.ts
  - packages/index-meta/src/meta-resolver.ts
  - packages/index-meta/src/meta-resolver.test.ts
---
# SDK 시나리오 — CLI 시뮬레이션

## 목적 ^purpose

CLI-like info/capacity/constants/fullview 출력이 SDK API만으로 재현 가능함을 검증한다.

## 상태

implemented

## 구성 ^overview

- `client.indexId`, `client.versionId`, `client.shape`, `client.size`
- `client.dimCapacity(dimId)`
- `client.constants(dimId)`
- `client.dimFullView(dimId)`

## 검증 포인트

- SDK API로 같은 결과를 산출할 수 있음
- package-local bin CLI를 전제하지 않고 read model 계약을 테스트 레벨에서 증명
