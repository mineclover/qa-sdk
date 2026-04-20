---
def:
  id: sdk-scenario-cli-simulation
  level: leaf
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
---
# SDK 시나리오 — CLI 시뮬레이션

## 목적 ^purpose

CLI에서 기대하는 info/capacity/constants/diff/fullview 출력이 SDK API만으로 재현 가능함을 사전 검증한다.

## 구성 ^overview

- `index-meta info`
- `index-meta capacity`
- `index-meta constants`
- `index-meta diff`
- `index-meta fullview`

## 검증 포인트

- SDK API로 같은 결과를 산출할 수 있음
- CLI가 아직 미구현이어도 출력 계약을 테스트 레벨에서 증명
