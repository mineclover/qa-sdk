---
def:
  id: demo-snapshot
  type: spec
  tier: component
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: approved
  layer: domain
  svc: demo-snapshot
  tags: [ssot, catalog, demo]
  links:
    - target: platform-chain-system
      type: refines
source: packages/demo-snapshot/src/index.ts
---

# demo-snapshot — 데모 카탈로그 SSOT

## 목적 ^purpose

`DEMO_CATALOG`과 데모 도메인 데이터(prefix, axis entries, sample fixtures)의 단일 원본. `demo-types`는 본 스냅샷에서 파생되며, 서비스 테스트/브라우저 데모/viteplus smoke는 모두 이 snapshot을 import해 축 수·prefix 수 하드코딩을 피한다.
