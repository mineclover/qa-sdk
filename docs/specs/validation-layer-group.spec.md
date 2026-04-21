---
def:
  id: validation-layer-group
  type: spec
  tier: layout
  scope: feature
  aspect: scenario
  depth: validation
  lifecycle: approved
  layer: domain
  links:
    - target: indexing-core-system
      type: depends_on
---
# Validation Layer Group
## 목적 ^purpose
E2E, 시뮬레이션, 패싯 테스트 등 시스템의 정합성을 검증하는 모든 테스트 환경을 포함한다.
