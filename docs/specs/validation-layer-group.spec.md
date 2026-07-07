---
def:
  id: validation-layer-group
  type: spec
  tier: system
  scope: feature
  aspect: scenario
  depth: validation
  lifecycle: approved
  layer: domain
  links:
    - target: indexing-core-system
      type: depends_on
sources:
  - docs/specs/system/demo-tests.spec.md
  - docs/specs/system/e2e-suite.spec.md
  - docs/specs/system/facet-tests.spec.md
  - docs/specs/system/testing-patterns.spec.md
  - packages/demo-tests/package.json
  - packages/e2e/package.json
  - packages/facet-tests/package.json
  - packages/simulation-tests/package.json
---
# Validation Layer Group
## 목적 ^purpose
E2E, 시뮬레이션, 패싯 테스트 등 시스템의 정합성을 검증하는 모든 테스트 환경을 포함한다.
