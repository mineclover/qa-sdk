---
def:
  id: demo-tests
  type: spec
  tier: component
  scope: data
  aspect: system_data
  depth: specification
  lifecycle: approved
  layer: operation
  svc: demo-tests
  tags: [testing, integration]
  links:
    - target: e2e-suite-spec
      type: refines
  source: packages/demo-tests
---

# @qa-sdk/demo-tests — 데모 cross-package 통합 테스트

## 목적 ^purpose

데모 카탈로그와 서비스 흐름을 cross-package로 묶어 검증하는 통합 테스트 스위트. weighted-index/bit-index 인코딩, demo-snapshot 파생, browser codec 경로, ingest pipeline 연동이 동일 repo 내에서 일관되게 동작하는지 확인.
